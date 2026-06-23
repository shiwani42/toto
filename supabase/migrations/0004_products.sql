-- Per-shop product catalog. Each row mirrors a row in the bundled
-- data/products.json (Product type in src/lib/types.ts) — same column
-- names, plus shop_id to scope it.
--
-- Design notes
--   * Composite primary key (shop_id, product_code) so the same barcode
--     can appear in two shops (rare but cleaner than forcing globally
--     unique barcodes).
--   * shop_id is a uuid pointing at shops(id). The 'default' string
--     used elsewhere only applies to events, not catalog — every
--     product row belongs to a real shop.
--   * RLS: anyone can read a shop's catalog (the shopper-side app
--     fetches with the anon key). Only admins of that shop can
--     insert / update / delete.

create table if not exists public.products (
  shop_id              uuid        not null references public.shops (id) on delete cascade,
  product_code         text        not null,
  product_id           text        not null,
  name                 text        not null,
  brand                text        not null,
  category             text        not null,
  color                text        not null default '',
  size                 text        not null default '',
  price_chf            numeric(10, 2) not null default 0,
  discount_pct         numeric(5, 2)  not null default 0,
  weight_g             integer     not null default 0,
  waterproof_rating_mm integer     not null default 0,
  temp_rating_c        integer,
  material             text        not null default '',
  tags                 text[]      not null default '{}',
  zone                 text        not null default '',
  zone_name            text        not null default '',
  aisle                text        not null default '',
  stock_total          integer     not null default 0,
  stock_front          integer     not null default 0,
  description          text        not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (shop_id, product_code)
);

create index if not exists products_category_idx on public.products (shop_id, category);
create index if not exists products_zone_idx     on public.products (shop_id, zone);

-- ─── RLS ──────────────────────────────────────────────────────────────

alter table public.products enable row level security;

-- Reads are public so the shopper-side anon client can pull a shop's
-- catalog when ?shop=<slug> is in the URL. No PII here — just product
-- metadata, prices, and stock counts.
drop policy if exists "products_select_public" on public.products;
create policy "products_select_public"
  on public.products for select
  using (true);

-- Writes are admin-only. Owner / staff of the shop can manage their
-- own inventory; no one can touch another shop's products.
drop policy if exists "products_insert_admin" on public.products;
create policy "products_insert_admin"
  on public.products for insert
  with check (public.is_shop_admin(shop_id));

drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin"
  on public.products for update
  using (public.is_shop_admin(shop_id));

drop policy if exists "products_delete_admin" on public.products;
create policy "products_delete_admin"
  on public.products for delete
  using (public.is_shop_admin(shop_id));

-- ─── Useful views ─────────────────────────────────────────────────────

-- Catalog snapshot scoped to the signed-in admin's shops. The admin
-- page can SELECT * from this view and rely on RLS to scope.
create or replace view public.v_my_products as
select p.*
from public.products p
where p.shop_id in (select shop_id from public.my_shop_ids() as shop_id);

-- Cross-shop product search by exact product code. Used by the
-- shopper-side "which nearby shop has my list?" feature: given a list
-- of codes, return shop name + slug + stock_front for any shop that
-- carries it.
create or replace view public.v_product_availability as
select
  p.product_code,
  p.name        as product_name,
  p.brand,
  p.price_chf,
  p.stock_front,
  p.stock_total,
  s.id    as shop_id,
  s.slug  as shop_slug,
  s.name  as shop_name,
  s.lat,
  s.lng
from public.products p
join public.shops s on s.id = p.shop_id
where p.stock_total > 0;
