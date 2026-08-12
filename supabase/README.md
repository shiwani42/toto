# Supabase setup

Migrations live under `supabase/migrations/`. Apply them in order.

## Applying a migration

If you have the Supabase CLI configured:

```
supabase db push
```

Otherwise, copy the SQL into the Supabase dashboard's SQL editor and run it.

## Migrations in this repo

Apply `0001` … `0008` in order. See [`HANDOFF.md`](../HANDOFF.md) §4 for the live checklist.

- `0001_profiles.sql` — per-user profile rows for sign-in / cross-device prefs sync.
- `0002_events_admin.sql` — anonymous event log + aggregation views + legacy admin allow-list.
- `0003_shops.sql` — `shops`, `shop_admins`, RLS.
- `0004_products.sql` — per-shop `products`.
- `0005_shop_assets_storage.sql` — public `shop-assets` Storage bucket.
- `0006_shop_scoped_analytics.sql` — shop-scoped analytics views.
- `0007_zone_positions_image_url.sql` — `zone_positions` + `products.image_url`.
- `0008_fix_admin_rls_jwt_email.sql` — admin RLS helpers use JWT email (not `auth.users` join).

## Granting admin access

Shop owners are added via `shop_admins` on signup (owner insights dashboard). Platform operators (Toto usage funnel) use the legacy allow-list from `0002`:

```sql
insert into public.admins (email) values ('platform-ops@example.com');
```

`?screen=dashboard` (legacy `?screen=admin` redirects) shows owner insights for `shop_admins`, platform usage for `admins`, and a toggle when both apply.

## Environment variables

The web app reads these env vars at build time (see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ANTHROPIC_API_KEY` (optional; AI planner + Fit Check)

When the Supabase vars are missing, auth and live sessions stay off and
the app falls back to local-only mode (bundled catalog). The admin dashboard
surfaces a setup checklist in that case. Camera scanning uses `zxing-wasm`
and needs no license key.
