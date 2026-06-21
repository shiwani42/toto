# Supabase setup

Migrations live under `supabase/migrations/`. Apply them in order.

## Applying a migration

If you have the Supabase CLI configured:

```
supabase db push
```

Otherwise, copy the SQL into the Supabase dashboard's SQL editor and run it.

## Environment variables

The web app reads two env vars at build time:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

When either is missing, auth and live sessions stay off and the app falls
back to local-only mode. No sign-in UI is shown.
