-- Shop-scoped analytics + tighter anon event inserts.
--
-- 1. Aggregation views now expose `shop_id` so the admin dashboard can
--    filter to the currently-selected shop (client-side after fetch).
-- 2. Anon inserts on `events` must reference a real shop (or the
--    legacy 'default' sentinel). Stops spam with invented shop ids.

-- ─── Tighten events insert ────────────────────────────────────────────

drop policy if exists "events_insert_any" on public.events;
create policy "events_insert_any"
  on public.events for insert
  with check (
    shop_id = 'default'
    or exists (select 1 from public.shops s where s.id::text = shop_id)
  );

-- ─── Aggregation views, now per-shop ──────────────────────────────────

create or replace view public.v_funnel_daily as
with d as (
  select
    shop_id,
    date_trunc('day', created_at)::date as day,
    session_id,
    event
  from public.events
)
select
  shop_id,
  day,
  count(distinct session_id) filter (where event = 'wizard_start')   as wizard_started,
  count(distinct session_id) filter (where event = 'wizard_complete') as wizard_completed,
  count(distinct session_id) filter (where event = 'plan_returned')   as plan_returned,
  count(distinct session_id) filter (where event = 'list_added')      as added_to_list,
  count(distinct session_id) filter (where event = 'scan_found')      as scanned_item,
  count(distinct session_id) filter (where event = 'scan_completed')  as completed_scan
from d
group by shop_id, day
order by day desc;

create or replace view public.v_top_categories as
select
  shop_id,
  cat as category,
  count(*) as appeared_in_plans
from public.events,
     lateral jsonb_array_elements_text(coalesce(payload->'categories', '[]'::jsonb)) as cat
where event = 'plan_returned'
group by shop_id, cat
order by appeared_in_plans desc;

create or replace view public.v_activity_mix as
select
  shop_id,
  payload->>'activity' as activity,
  count(distinct session_id) as sessions
from public.events
where event = 'wizard_complete'
  and payload ? 'activity'
group by shop_id, activity
order by sessions desc;

create or replace view public.v_purpose_mix as
select
  shop_id,
  payload->>'purpose' as purpose,
  count(distinct session_id) as sessions
from public.events
where event = 'wizard_complete'
  and payload ? 'purpose'
group by shop_id, purpose
order by sessions desc;

create or replace view public.v_profile_mix as
select
  shop_id,
  payload->>'gender'     as gender,
  payload->>'age'        as age,
  payload->>'experience' as experience,
  count(distinct session_id) as sessions
from public.events
where event = 'wizard_complete'
group by shop_id, gender, age, experience
order by sessions desc;

create or replace view public.v_product_performance as
with viewed as (
  select shop_id, payload->>'code' as code, count(*) as views
  from public.events
  where event = 'swipe_decision' and payload ? 'code'
  group by shop_id, code
),
picked as (
  select shop_id, payload->>'code' as code, count(*) as picks
  from public.events
  where event = 'swipe_decision' and payload->>'decision' = 'add'
  group by shop_id, code
),
added as (
  select shop_id, payload->>'code' as code, count(*) as adds
  from public.events
  where event = 'list_added' and payload ? 'code'
  group by shop_id, code
),
scanned as (
  select shop_id, payload->>'code' as code, count(*) as scans
  from public.events
  where event = 'scan_found' and payload ? 'code'
  group by shop_id, code
)
select
  coalesce(v.shop_id, p.shop_id, a.shop_id, s.shop_id) as shop_id,
  coalesce(v.code, p.code, a.code, s.code) as code,
  coalesce(v.views, 0) as views,
  coalesce(p.picks, 0) as picks,
  coalesce(a.adds, 0) as adds,
  coalesce(s.scans, 0) as scans,
  case when coalesce(v.views, 0) > 0
       then round(100.0 * coalesce(p.picks, 0) / v.views, 1)
       else null end as pick_rate_pct
from viewed v
full outer join picked p
  on p.code = v.code and p.shop_id = v.shop_id
full outer join added a
  on a.code = coalesce(v.code, p.code) and a.shop_id = coalesce(v.shop_id, p.shop_id)
full outer join scanned s
  on s.code = coalesce(v.code, p.code, a.code)
 and s.shop_id = coalesce(v.shop_id, p.shop_id, a.shop_id)
order by views desc nulls last, picks desc nulls last;

create or replace view public.v_demand_gaps as
select
  shop_id,
  cat as category,
  count(*) as sessions
from public.events,
     lateral jsonb_array_elements_text(coalesce(payload->'empty_categories', '[]'::jsonb)) as cat
where event = 'plan_returned'
group by shop_id, cat
order by sessions desc;

create or replace view public.v_hourly_usage as
select
  shop_id,
  extract(hour from created_at)::int as hour_utc,
  count(distinct session_id) as sessions
from public.events
where event = 'wizard_start'
  and created_at >= now() - interval '14 days'
group by shop_id, hour_utc
order by hour_utc;

create or replace view public.v_headline_counters as
select
  shop_id,
  count(distinct session_id) filter (where created_at >= now() - interval '24 hours')  as sessions_24h,
  count(distinct session_id) filter (where created_at >= now() - interval '7 days')    as sessions_7d,
  count(distinct session_id) filter (where created_at >= now() - interval '30 days')   as sessions_30d,
  count(*) filter (where event = 'list_added'  and created_at >= now() - interval '7 days') as adds_7d,
  count(*) filter (where event = 'scan_found'  and created_at >= now() - interval '7 days') as scans_7d
from public.events
group by shop_id;
