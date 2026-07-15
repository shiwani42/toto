-- Zone-map pin positions + per-product images.
--
-- zone_positions on shops: JSONB map of zone letter → {x,y} percentages
--   of the zone map image, plus optional entry/checkout endpoints.
--   Shape: {
--     "zones": { "A": {"x": 21, "y": 82}, ... },
--     "entry": {"x": 50, "y": 95},
--     "checkout": {"x": 82, "y": 92}
--   }
-- image_url on products: public URL (typically shop-assets bucket).

alter table public.shops
  add column if not exists zone_positions jsonb;

alter table public.products
  add column if not exists image_url text;

-- v_my_products is select p.* so it picks up image_url automatically.
-- Recreate so PostgREST schema caches refresh cleanly on some setups.
create or replace view public.v_my_products as
select p.*
from public.products p
where p.shop_id in (select shop_id from public.my_shop_ids() as shop_id);
