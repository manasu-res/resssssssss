import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { dbStore } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { errorResponse, staff } = await verifyStaffApiRoute(['owner', 'waiter']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { orderId, reason } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const cancelReason = (reason || 'Voided by waiter').trim();
    const serviceSupabase = createServiceRoleClient();

    try {
      // Check current status - can only void before served
      const { data: currentOrder } = await (serviceSupabase as any)
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (currentOrder?.status === 'served') {
        return NextResponse.json({ error: 'Cannot void an order that has already been served.' }, { status: 400 });
      }

      const { error } = await (serviceSupabase as any)
        .from('orders')
        .update({
          status: 'cancelled',
          cancelled_by: staff?.userId || null,
          cancelled_at: new Date().toISOString(),
          cancel_reason: cancelReason,
          rejection_reason: cancelReason,
        })
        .eq('id', orderId);

      if (error) throw error;
    } catch {
      // In-memory fallback
      const ord = dbStore.orders.find(o => o.id === orderId);
      if (ord) {
        if (ord.status === 'served') {
          return NextResponse.json({ error: 'Cannot void an order that has already been served.' }, { status: 400 });
        }
        ord.status = 'cancelled';
        (ord as any).cancelled_by = staff?.userId || 'waiter';
        (ord as any).cancelled_at = new Date().toISOString();
        (ord as any).cancel_reason = cancelReason;
      }
    }

    return NextResponse.json({ success: true, message: 'Order voided' });
  } catch (err: any) {
    console.error('Waiter void order error:', err);
    return NextResponse.json({ error: err.message || 'Failed to void order' }, { status: 500 });
  }
}
