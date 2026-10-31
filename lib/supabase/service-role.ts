import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/**
 * Service Role Supabase Client.
 *
 * SECURITY: Used ONLY in server-side route handlers and server actions.
 * Never import or execute this in client components or browser bundles.
 * Bypasses RLS to perform trusted server operations (e.g. customer table token verification,
 * fetching authoritative price snapshots, and writing order lines).
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.'
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
