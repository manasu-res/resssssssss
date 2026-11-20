import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner', 'waiter']);
  if (errorResponse) return errorResponse;

  try {

    const { tableId, resetToken } = await req.json();
    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      try {
        // Close any active session for this table in Supabase
        await (supabase as any)
          .from('table_sessions')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
          })
          .eq('table_id', tableId)
          .in('status', ['open', 'billed']);

        // Optionally rotate token
        if (resetToken) {
          const randomHex = Math.random().toString(36).substring(2, 8);
          await (supabase as any)
            .from('dining_tables')
            .update({ qr_token: `tbl-manasu-${randomHex}` })
            .eq('id', tableId);
        }
      } catch (err: any) {
        console.warn('Supabase vacate error, fallback to dbStore:', err.message);
      }
    }

    // Always update local store so state updates immediately
    dbStore.closeTableSession(tableId);
    if (resetToken) {
      dbStore.resetTableToken(tableId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Vacate table error:', err);
    return NextResponse.json({ error: err.message || 'Failed to vacate table' }, { status: 500 });
  }
}
