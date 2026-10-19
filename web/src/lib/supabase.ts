import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The server's only way into Supabase: the service role key, which never leaves the server.
 * Since migration 20261017090000 the anon key can't read or call anything.
 * Returns null without Supabase (local JSON stores take over); throws when the URL is set
 * but the key isn't, so a half-configured deploy fails loudly instead of half working.
 */
let client: SupabaseClient | null | undefined;

export function serviceClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) return (client = null);
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return (client = createClient(url, key, { auth: { persistSession: false } }));
}
