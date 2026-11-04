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
    const { orderId, action } = body; // action: 'confirm' | 'reject'

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();

    if (action === 'reject') {
      const reason = body.reason || 'Rejected by waiter';
      try {
        await (serviceSupabase as any)
          .from('orders')
          .update({
            status: 'cancelled',
            cancelled_by: staff?.userId || null,
            cancelled_at: new Date().toISOString(),
            cancel_reason: reason,
          })
          .eq('id', orderId);
      } catch {
        const ord = dbStore.orders.find(o => o.id === orderId);
        if (ord) {
          ord.status = 'cancelled';
          (ord as any).cancel_reason = reason;
        }
      }
      return NextResponse.json({ success: true, message: 'Large order rejected' });
    }

    // Default: confirm
    try {
      await (serviceSupabase as any)
        .from('orders')
        .update({
          needs_confirmation: false,
          status: 'placed',
        })
        .eq('id', orderId);
    } catch {
      const ord = dbStore.orders.find(o => o.id === orderId);
      if (ord) {
        (ord as any).needs_confirmation = false;
        ord.status = 'placed';
      }
    }

    return NextResponse.json({ success: true, message: 'Order confirmed and sent to kitchen' });
  } catch (err: any) {
    console.error('Waiter confirm order error:', err);
    return NextResponse.json({ error: err.message || 'Failed to process order confirmation' }, { status: 500 });
  }
}
