import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatusSchema } from '@/lib/validation';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

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
    const supabase = getServiceSupabase();

    if (supabase) {
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (oErr) throw oErr;

      await supabase
        .from('order_items')
        .update({ status })
        .eq('order_id', orderId);

      return NextResponse.json({ success: true, order });
    } else {
      const updated = dbStore.updateOrderStatus(orderId, status);
      return NextResponse.json({ success: true, order: updated });
    }
  } catch (err: any) {
    console.error('Kitchen update error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update order status' }, { status: 500 });
  }
}
