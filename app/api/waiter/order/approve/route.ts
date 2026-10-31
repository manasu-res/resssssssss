import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatusSchema } from '@/lib/validation';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerStaffSession();
    if (session && !['owner', 'waiter'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parse = updateOrderStatusSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid order parameters' }, { status: 400 });
    }

    const { orderId, status } = parse.data;
    const supabase = getServiceSupabase();

    if (supabase) {
      const { data: updatedOrder, error: oErr } = await supabase
        .from('orders')
        .update({
          status,
          waiter_id: session?.userId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (oErr) throw oErr;

      // Update status on all line items of this order as well
      await supabase
        .from('order_items')
        .update({ status })
        .eq('order_id', orderId);

      return NextResponse.json({ success: true, order: updatedOrder });
    } else {
      const updated = dbStore.updateOrderStatus(orderId, status);
      if (!updated) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, order: updated });
    }
  } catch (err: any) {
    console.error('Approve order error:', err);
    return NextResponse.json({ error: err.message || 'Failed to approve order' }, { status: 500 });
  }
}
