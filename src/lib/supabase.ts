// Single Supabase client shared by Auth (profile sync, sign-in) and Realtime
// (live shopping sessions). Two clients on the same project would race on
// the localStorage auth slot, so we centralize here.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    console.error(
      "Supabase not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing).",
    );
    throw new Error("Live sessions and accounts aren't available here yet.");
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}
