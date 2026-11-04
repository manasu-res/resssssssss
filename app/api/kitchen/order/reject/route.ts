import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { dbStore } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { errorResponse, staff } = await verifyStaffApiRoute(['owner', 'kitchen']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { orderId, reason } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const cancelReason = (reason || 'Rejected by kitchen').trim();
    const serviceSupabase = createServiceRoleClient();

    try {
      const { data: updated, error } = await (serviceSupabase as any)
        .from('orders')
        .update({
          status: 'cancelled',
          cancelled_by: staff?.userId || null,
          cancelled_at: new Date().toISOString(),
          cancel_reason: cancelReason,
          rejection_reason: cancelReason,
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
    } catch {
      // Fallback to store
      const ord = dbStore.orders.find(o => o.id === orderId);
      if (ord) {
        ord.status = 'cancelled';
        (ord as any).cancelled_by = staff?.userId || 'kitchen';
        (ord as any).cancelled_at = new Date().toISOString();
        (ord as any).cancel_reason = cancelReason;
      }
    }

    return NextResponse.json({ success: true, message: 'Order rejected and cancelled' });
  } catch (err: any) {
    console.error('Kitchen reject order error:', err);
    return NextResponse.json({ error: err.message || 'Failed to reject order' }, { status: 500 });
  }
}
