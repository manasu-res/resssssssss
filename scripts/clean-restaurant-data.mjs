import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function cleanData() {
  console.log('🧹 Cleaning test restaurant data to start 100% fresh for business...');

  // 1. Delete order lines
  const { error: olErr } = await supabase.from('order_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (olErr) console.warn('order_lines clean note:', olErr.message);
  else console.log('✓ Cleared order_lines');

  // 2. Delete orders
  const { error: oErr } = await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (oErr) console.warn('orders clean note:', oErr.message);
  else console.log('✓ Cleared orders');

  // 3. Delete bills
  const { error: bErr } = await supabase.from('bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (bErr) console.warn('bills clean note:', bErr.message);
  else console.log('✓ Cleared bills');

  // 4. Delete table session devices
  try {
    const { error: dErr } = await supabase.from('table_session_devices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (!dErr) console.log('✓ Cleared table_session_devices');
  } catch {}

  // 5. Delete table sessions
  const { error: sErr } = await supabase.from('table_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (sErr) console.warn('table_sessions clean note:', sErr.message);
  else console.log('✓ Cleared table_sessions');

  // 6. Delete audit logs
  try {
    const { error: aErr } = await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (!aErr) console.log('✓ Cleared audit_logs');
  } catch {}

  console.log('🎉 Database is clean and ready for real restaurant operation!');
}

cleanData().catch(err => {
  console.error('Fatal error during clean:', err);
  process.exit(1);
});
