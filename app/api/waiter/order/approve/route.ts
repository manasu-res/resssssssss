import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { getServiceSupabase } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { errorResponse, staff } = await verifyStaffApiRoute(['owner', 'waiter']);
  if (errorResponse) return errorResponse;

  try {

    const body = await req.json();
    const { orderId, status, reason } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 });
    }

    if (!['approved', 'cancelled', 'served', 'preparing', 'ready'].includes(status)) {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
    }

    const auditAction = status === 'approved' 
      ? 'APPROVE_ORDER' 
      : status === 'cancelled' 
      ? 'REJECT_ORDER' 
      : 'UPDATE_ORDER_STATUS';

    logAudit({
      action: auditAction,
      actorId: staff?.userId,
      actorName: staff?.name,
      actorRole: staff?.role,
      targetId: `Order #${orderId}`,
      details: { status, reason: reason || null },
    });

    const supabase = getServiceSupabase();

    if (supabase) {
      try {
        const updatePayload: any = {
          status,
        };

        if (status === 'approved') {
          updatePayload.approved_by = staff?.userId || null;
          updatePayload.approved_at = new Date().toISOString();
        }

        if (status === 'served') {
          updatePayload.served_at = new Date().toISOString();
        }

        if (status === 'cancelled' && reason) {
          updatePayload.rejection_reason = reason;
        }

        const { data: updatedOrder, error: oErr } = await (supabase as any)
          .from('orders')
          .update(updatePayload)
          .eq('id', orderId)
          .select()
          .maybeSingle();

        if (!oErr && updatedOrder) {
          // Also sync to dbStore if present
          dbStore.updateOrderStatus(orderId, status);
          return NextResponse.json({ success: true, order: updatedOrder });
        }
      } catch (err: any) {
        console.warn('Supabase order status update error, fallback to dbStore:', err.message);
      }
    }

    // Fallback update in dbStore
    let updated = dbStore.updateOrderStatus(orderId, status);
    if (!updated) {
      // Find order by prefix or string
      const matched = dbStore.orders.find(o => o.id === orderId || o.order_number?.toString() === orderId);
      if (matched) {
        matched.status = status as any;
        updated = matched;
      }
    }

    if (updated && status === 'cancelled' && reason) {
      updated.notes = updated.notes ? `${updated.notes} [Rejected: ${reason}]` : `[Rejected: ${reason}]`;
    }

    return NextResponse.json({ success: true, order: updated || { id: orderId, status } });
  } catch (err: any) {
    console.error('Approve/update order status error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update order status' },
      { status: 500 }
    );
  }
}
