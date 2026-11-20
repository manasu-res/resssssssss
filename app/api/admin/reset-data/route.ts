import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { dbStore } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner']);
  if (errorResponse) return errorResponse;

  try {
    const serviceSupabase = createServiceRoleClient();

    // 1. Wipe order lines
    try {
      await (serviceSupabase as any).from('order_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e: any) {
      console.warn('Reset order_lines note:', e.message);
    }

    // 2. Wipe orders
    try {
      await (serviceSupabase as any).from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e: any) {
      console.warn('Reset orders note:', e.message);
    }

    // 3. Wipe bills
    try {
      await (serviceSupabase as any).from('bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e: any) {
      console.warn('Reset bills note:', e.message);
    }

    // 4. Wipe table session devices
    try {
      await (serviceSupabase as any).from('table_session_devices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch {}

    // 5. Wipe table sessions
    try {
      await (serviceSupabase as any).from('table_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e: any) {
      console.warn('Reset table_sessions note:', e.message);
    }

    // 6. Wipe in-memory store
    dbStore.orders = [];
    dbStore.orderItems = [];
    dbStore.bills = [];
    dbStore.sessions = [];
    dbStore.devices = [];

    return NextResponse.json({
      success: true,
      message: 'All test orders, bills, and table sessions have been cleared. Ready for business!',
    });
  } catch (err: any) {
    console.error('Reset data error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to reset test data' },
      { status: 500 }
    );
  }
}
