# Supabase setup

Migrations live under `supabase/migrations/`. Apply them in order.

## Applying a migration

If you have the Supabase CLI configured:

```
supabase db push
```

Otherwise, copy the SQL into the Supabase dashboard's SQL editor and run it.

## Migrations in this repo

- `0001_profiles.sql` — per-user profile rows for sign-in / cross-device prefs sync.
- `0002_events_admin.sql` — anonymous event log + aggregation views + admin allow-list. Required for the `?screen=admin` dashboard.

## Granting admin access

After `0002` is applied, add yourself (and any retailer staff) to the
allow-list. From the Supabase SQL editor:

```sql
insert into public.admins (email) values ('shop-owner@example.com');
```

The dashboard checks this table on every visit; row-level security keeps
event reads admin-only at the database level, so this is the real gate.

## Environment variables

The web app reads these env vars at build time:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SCANDIT_LICENSE_KEY` (for the camera screens)
- `VITE_ANTHROPIC_API_KEY` (for the AI planner)

When the Supabase vars are missing, auth and live sessions stay off and
the app falls back to local-only mode. The admin dashboard surfaces a
"setup needed" message in that case.
