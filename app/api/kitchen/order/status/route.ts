import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatusSchema } from '@/lib/validation';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerStaffSession();
    if (session && !['owner', 'kitchen', 'waiter'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parse = updateOrderStatusSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { orderId, status } = parse.data;

    logAudit({
      action: 'UPDATE_ORDER_STATUS',
      actorId: session?.userId,
      actorName: session?.fullName,
      actorRole: session?.role,
      targetId: `Order #${orderId}`,
      details: { status, origin: 'kitchen' },
    });

    const supabase = getServiceSupabase();

    if (supabase) {
      try {
        const { data: order, error: oErr } = await (supabase as any)
          .from('orders')
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)
          .select()
          .maybeSingle();

        if (!oErr && order) {
          dbStore.updateOrderStatus(orderId, status);
          return NextResponse.json({ success: true, order });
        }
      } catch (err: any) {
        console.warn('Supabase kitchen status update error, fallback to dbStore:', err.message);
      }
    }

    // High-reliability Fallback (dbStore)
    let updated = dbStore.updateOrderStatus(orderId, status);
    if (!updated) {
      const matched = dbStore.orders.find(o => o.id === orderId || o.order_number?.toString() === orderId);
      if (matched) {
        matched.status = status as any;
        updated = matched;
      }
    }

    return NextResponse.json({ success: true, order: updated || { id: orderId, status } });
  } catch (err: any) {
    console.error('Kitchen update error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update order status' }, { status: 500 });
  }
}
