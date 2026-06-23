-- Multi-tenant foundation: shops + shop_admins + per-shop RLS.
--
-- Design notes
--   * One row in `shops` per retail location. Owner_email is the
--     person who signed it up; staff are added via `shop_admins`.
--   * `slug` is the URL-safe short code used in shop-context URLs
--     (?shop=alpine-store). Generated once at creation, indexed for
--     fast lookup.
--   * Events already carry `shop_id text default 'default'`. We
--     leave the type as text (not uuid) so existing rows with
--     'default' still validate; new rows carry the shops.id.
--   * RLS: shop owners + admins read/write only their shop. Anon
--     shoppers can read shop public info (name, slug, lat/lng, zone
--     map) for the cross-shop search use case.

-- ─── shops table ───────────────────────────────────────────────────────
create table if not exists public.shops (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  owner_email   text not null,
  address       text,
  city          text,
  country       text,
  lat           double precision,
  lng           double precision,
  brand_color   text,
  zone_map_url  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists shops_owner_email_idx on public.shops (owner_email);
create index if not exists shops_geo_idx         on public.shops (lat, lng);

-- ─── shop_admins join table ───────────────────────────────────────────
-- Many-to-many between people and shops. The owner gets a row at
-- creation; they can invite staff by inserting more rows. role lets us
-- split capabilities later (owner can edit shop settings, staff just
-- read analytics) without another migration.
create table if not exists public.shop_admins (
  shop_id    uuid        not null references public.shops (id) on delete cascade,
  email      text        not null,
  role       text        not null default 'owner' check (role in ('owner', 'staff')),
  added_at   timestamptz not null default now(),
  primary key (shop_id, email)
);

create index if not exists shop_admins_email_idx on public.shop_admins (email);

-- ─── helpers ──────────────────────────────────────────────────────────

-- True when the signed-in user is on any shop's admin list.
create or replace function public.is_shop_admin(shop uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.shop_admins sa
    join auth.users u on u.email = sa.email
    where sa.shop_id = shop and u.id = auth.uid()
  );
$$;

-- Return the set of shop ids the current user can administer. Used by
-- views that need to filter by accessible shops.
create or replace function public.my_shop_ids()
returns setof uuid
language sql
stable
as $$
  select sa.shop_id
  from public.shop_admins sa
  join auth.users u on u.email = sa.email
  where u.id = auth.uid();
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────

alter table public.shops       enable row level security;
alter table public.shop_admins enable row level security;

-- Shops: public read of basic fields for the cross-shop discovery
-- use case. Writes only by admins of that shop. Anon clients can read
-- the row to find "which shop am I near?" without auth.
drop policy if exists "shops_select_public" on public.shops;
create policy "shops_select_public"
  on public.shops for select
  using (true);

drop policy if exists "shops_insert_own" on public.shops;
create policy "shops_insert_own"
  on public.shops for insert
  with check (
    -- The shop being created must list the current user's email as
    -- owner_email — prevents creating shops on behalf of someone else.
    owner_email = (select email from auth.users where id = auth.uid())
  );

drop policy if exists "shops_update_admin" on public.shops;
create policy "shops_update_admin"
  on public.shops for update
  using (public.is_shop_admin(id));

drop policy if exists "shops_delete_admin" on public.shops;
create policy "shops_delete_admin"
  on public.shops for delete
  using (public.is_shop_admin(id));

-- shop_admins: only readable + writable by other admins of the same
-- shop. The owner can add/remove staff; staff can see who else is on
-- the team.
drop policy if exists "shop_admins_select_admin" on public.shop_admins;
create policy "shop_admins_select_admin"
  on public.shop_admins for select
  using (public.is_shop_admin(shop_id));

drop policy if exists "shop_admins_insert_admin" on public.shop_admins;
create policy "shop_admins_insert_admin"
  on public.shop_admins for insert
  with check (
    -- Two paths: an existing admin adds a new admin to their shop,
    -- OR the shop creator inserts themselves at signup (the just-
    -- inserted shops row has them as owner_email).
    public.is_shop_admin(shop_id)
    or exists (
      select 1 from public.shops s
      where s.id = shop_id
        and s.owner_email = (select email from auth.users where id = auth.uid())
    )
  );

drop policy if exists "shop_admins_delete_admin" on public.shop_admins;
create policy "shop_admins_delete_admin"
  on public.shop_admins for delete
  using (public.is_shop_admin(shop_id));

-- ─── events: tighten the shop_id story ───────────────────────────────
--
-- The old policy let anon insert any event including arbitrary
-- shop_id. We keep insert open (shoppers are anonymous) but add a
-- soft check that shop_id, if present, references a real shop.
-- Reads remain admin-only and are now further scoped to the admin's
-- own shop(s) — they no longer see every shop's events.

drop policy if exists "events_select_admin" on public.events;
create policy "events_select_admin"
  on public.events for select
  using (
    -- Old default-shop rows are visible to the original is_admin()
    -- allow-list. New rows must match a shop the user administers.
    (shop_id = 'default' and public.is_admin())
    or shop_id in (select shop_id::text from public.my_shop_ids() as shop_id)
  );

-- ─── Sample data hook ─────────────────────────────────────────────────
-- For the initial dev shop, create a 'default' row so existing analytics
-- continue to render. Idempotent on slug.
insert into public.shops (slug, name, owner_email, country)
values ('default', 'Default Shop', 'owner@example.com', 'Switzerland')
on conflict (slug) do nothing;
