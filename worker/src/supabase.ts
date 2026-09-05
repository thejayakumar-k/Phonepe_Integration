import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './env';

/**
 * Server-side Supabase client.
 * Prefers the service role key (bypasses RLS — the Worker itself enforces
 * per-user scoping). Falls back to the anon key for local dev.
 */
export function getSupabase(env: Env): SupabaseClient {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';
  return createClient(env.SUPABASE_URL, key);
}