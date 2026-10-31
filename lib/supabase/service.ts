import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const isRealSupabase =
    url.startsWith('https://') &&
    !url.includes('demo') &&
    serviceKey.length > 20 &&
    !serviceKey.includes('demo');

  if (!isRealSupabase) {
    return null;
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
