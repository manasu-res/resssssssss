import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerStaffSession();
    if (session && !['owner', 'waiter'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
      actorId: session?.userId,
      actorName: session?.fullName,
      actorRole: session?.role,
      targetId: `Order #${orderId}`,
      details: { status, reason: reason || null },
    });

    const supabase = getServiceSupabase();

    if (supabase) {
      const updatePayload: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'approved') {
        updatePayload.approved_by = session?.userId || null;
        updatePayload.approved_at = new Date().toISOString();
      }

      if (status === 'cancelled' && reason) {
        updatePayload.rejection_reason = reason;
      }

      const { data: updatedOrder, error: oErr } = await (supabase as any)
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .select()
        .single();

      if (oErr) throw oErr;

      return NextResponse.json({ success: true, order: updatedOrder });
    } else {
      const updated = dbStore.updateOrderStatus(orderId, status);
      if (!updated) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      if (status === 'cancelled' && reason) {
        updated.notes = updated.notes ? `${updated.notes} [Rejected: ${reason}]` : `[Rejected: ${reason}]`;
      }
      return NextResponse.json({ success: true, order: updated });
    }
  } catch (err: any) {
    console.error('Approve/update order status error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update order status' },
      { status: 500 }
    );
  }
}
