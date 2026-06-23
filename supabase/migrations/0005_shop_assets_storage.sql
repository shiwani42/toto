-- Public storage bucket for per-shop assets (zone maps, brand
-- artwork, etc.). Files are namespaced by shop_id so a single
-- bucket holds every shop's uploads without leakage.
--
-- Path convention
--   shop_id/<filename>  →  e.g. f47ac10b-58cc-4372-a567-0e02b2c3d479/zone-map.png
--
-- Read is public so the shopper-side anon client can render the
-- zone map without auth. Write is restricted to admins of that
-- specific shop via RLS on storage.objects.
--
-- This migration uses the standard storage.buckets + storage.objects
-- machinery Supabase provides. If you self-host without Storage, you
-- can skip it — the rest of the app works without zone-map uploads.

insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', true)
on conflict (id) do nothing;

-- ─── Read: public ─────────────────────────────────────────────────────
-- Anonymous reads so anyone with the URL can view the zone map.
drop policy if exists "shop_assets_read_public" on storage.objects;
create policy "shop_assets_read_public"
  on storage.objects for select
  using (bucket_id = 'shop-assets');

-- ─── Write: only admins of the shop whose id is the path prefix ──────
-- We parse the first path segment as the shop_id (uuid) and check
-- shop_admins membership via is_shop_admin().
drop policy if exists "shop_assets_insert_admin" on storage.objects;
create policy "shop_assets_insert_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'shop-assets'
    and public.is_shop_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "shop_assets_update_admin" on storage.objects;
create policy "shop_assets_update_admin"
  on storage.objects for update
  using (
    bucket_id = 'shop-assets'
    and public.is_shop_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "shop_assets_delete_admin" on storage.objects;
create policy "shop_assets_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'shop-assets'
    and public.is_shop_admin(((storage.foldername(name))[1])::uuid)
  );
