-- Anonymous event log + aggregation views for the retailer admin dashboard.
--
-- Design notes
--   * One table, one row per event. Wide payload as JSONB so adding a new
--     dimension never needs a migration.
--   * No PII. session_id is a random per-visit string, not tied to a user
--     account. Anonymous-but-correlated within a visit.
--   * Insert is open to anon (the shopper app is unauthenticated by
--     default). Read is admin-only. Views inherit the underlying RLS.
--   * shop_id is reserved for the future multi-tenant move. For now every
--     row carries the same constant 'default' and the admin filters by it.

create table if not exists public.events (
  id          bigserial primary key,
  shop_id     text        not null default 'default',
  session_id  text        not null,
  user_id     uuid                 references auth.users (id) on delete set null,
  event       text        not null,
  payload     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists events_shop_created_idx
  on public.events (shop_id, created_at desc);
create index if not exists events_event_created_idx
  on public.events (event, created_at desc);
create index if not exists events_session_idx
  on public.events (session_id);

-- Admin allow-list. Anyone with a row here (matched by auth.users.email)
-- is treated as an admin. Single-shop for now; later we'd carry a shop_id.
create table if not exists public.admins (
  email      text primary key,
  added_at   timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admins a
    join auth.users u on u.email = a.email
    where u.id = auth.uid()
  );
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.events enable row level security;
alter table public.admins enable row level security;

-- Anyone (including anon) can insert their own events. They can never
-- read them back; only admins can.
drop policy if exists "events_insert_any" on public.events;
create policy "events_insert_any"
  on public.events for insert
  with check (true);

drop policy if exists "events_select_admin" on public.events;
create policy "events_select_admin"
  on public.events for select
  using (public.is_admin());

-- Admins table: only admins read. No client writes — managed by SQL.
drop policy if exists "admins_select_admin" on public.admins;
create policy "admins_select_admin"
  on public.admins for select
  using (public.is_admin());

-- ─── Aggregation views ──────────────────────────────────────────────────────
--
-- Materialized? No. Volume is low (one retailer, a few thousand events a
-- day at peak). Live views keep the dashboard truthful.

-- Daily conversion funnel. One row per day with counts at each stage.
create or replace view public.v_funnel_daily as
with d as (
  select
    date_trunc('day', created_at)::date as day,
    session_id,
    event
  from public.events
)
select
  day,
  count(distinct session_id) filter (where event = 'wizard_start')   as wizard_started,
  count(distinct session_id) filter (where event = 'wizard_complete') as wizard_completed,
  count(distinct session_id) filter (where event = 'plan_returned')   as plan_returned,
  count(distinct session_id) filter (where event = 'list_added')      as added_to_list,
  count(distinct session_id) filter (where event = 'scan_found')      as scanned_item,
  count(distinct session_id) filter (where event = 'scan_completed')  as completed_scan
from d
group by day
order by day desc;

-- Wizard step drop-off. Each step gets a count of how many sessions
-- reached it. Steps without an entry never reached.
create or replace view public.v_wizard_steps as
select
  payload->>'step' as step,
  count(distinct session_id) as sessions
from public.events
where event = 'wizard_step'
group by step
order by sessions desc;

-- Categories the AI returned, ranked by how often they appeared in plans.
-- payload.categories is an array of category keys from plan_returned.
create or replace view public.v_top_categories as
select
  cat as category,
  count(*) as appeared_in_plans
from public.events,
     lateral jsonb_array_elements_text(coalesce(payload->'categories', '[]'::jsonb)) as cat
where event = 'plan_returned'
group by cat
order by appeared_in_plans desc;

-- Activity / purpose mix. Counts per activity key.
create or replace view public.v_activity_mix as
select
  payload->>'activity' as activity,
  count(distinct session_id) as sessions
from public.events
where event = 'wizard_complete'
  and payload ? 'activity'
group by activity
order by sessions desc;

create or replace view public.v_purpose_mix as
select
  payload->>'purpose' as purpose,
  count(distinct session_id) as sessions
from public.events
where event = 'wizard_complete'
  and payload ? 'purpose'
group by purpose
order by sessions desc;

-- Customer profile distribution: age × gender × experience.
create or replace view public.v_profile_mix as
select
  payload->>'gender'     as gender,
  payload->>'age'        as age,
  payload->>'experience' as experience,
  count(distinct session_id) as sessions
from public.events
where event = 'wizard_complete'
group by gender, age, experience
order by sessions desc;

-- Per-product performance. For each product code referenced in events:
--   views = swipe deck impressions (decision event)
--   picks = right-swipes / accepts
--   adds  = added to list
--   scans = found in store while shopping
create or replace view public.v_product_performance as
with viewed as (
  select payload->>'code' as code, count(*) as views
  from public.events
  where event = 'swipe_decision' and payload ? 'code'
  group by code
),
picked as (
  select payload->>'code' as code, count(*) as picks
  from public.events
  where event = 'swipe_decision' and payload->>'decision' = 'add'
  group by code
),
added as (
  select payload->>'code' as code, count(*) as adds
  from public.events
  where event = 'list_added' and payload ? 'code'
  group by code
),
scanned as (
  select payload->>'code' as code, count(*) as scans
  from public.events
  where event = 'scan_found' and payload ? 'code'
  group by code
)
select
  coalesce(v.code, p.code, a.code, s.code) as code,
  coalesce(v.views, 0) as views,
  coalesce(p.picks, 0) as picks,
  coalesce(a.adds, 0) as adds,
  coalesce(s.scans, 0) as scans,
  case when coalesce(v.views, 0) > 0
       then round(100.0 * coalesce(p.picks, 0) / v.views, 1)
       else null end as pick_rate_pct
from viewed v
full outer join picked p   on p.code = v.code
full outer join added  a   on a.code = coalesce(v.code, p.code)
full outer join scanned s  on s.code = coalesce(v.code, p.code, a.code)
order by views desc nulls last, picks desc nulls last;

-- Demand gaps: categories shoppers were planning around but the plan came
-- back empty for. payload.empty_categories holds the gap list from the
-- plan_returned event.
create or replace view public.v_demand_gaps as
select
  cat as category,
  count(*) as sessions
from public.events,
     lateral jsonb_array_elements_text(coalesce(payload->'empty_categories', '[]'::jsonb)) as cat
where event = 'plan_returned'
group by cat
order by sessions desc;

-- Hourly usage (last 14 days). Hour of day in store-local time, but
-- we don't know the store's timezone yet so this is UTC. Good enough
-- for relative shape; absolute hour can be shifted client-side.
create or replace view public.v_hourly_usage as
select
  extract(hour from created_at)::int as hour_utc,
  count(distinct session_id) as sessions
from public.events
where event = 'wizard_start'
  and created_at >= now() - interval '14 days'
group by hour_utc
order by hour_utc;

-- Headline counters for the top of the dashboard.
create or replace view public.v_headline_counters as
select
  count(distinct session_id) filter (where created_at >= now() - interval '24 hours')  as sessions_24h,
  count(distinct session_id) filter (where created_at >= now() - interval '7 days')    as sessions_7d,
  count(distinct session_id) filter (where created_at >= now() - interval '30 days')   as sessions_30d,
  count(*) filter (where event = 'list_added'  and created_at >= now() - interval '7 days') as adds_7d,
  count(*) filter (where event = 'scan_found'  and created_at >= now() - interval '7 days') as scans_7d
from public.events;
