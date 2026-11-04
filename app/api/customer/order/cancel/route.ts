import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase/service';
import { dbStore } from '@/lib/data/store';
import { getTableJoinCookie } from '@/lib/auth/table-session-cookie';

export const dynamic = 'force-dynamic';

const cancelSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  token: z.string().min(1, 'Table token is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = cancelSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { orderId, token } = parse.data;

    // Verify customer joined device cookie
    const joinPayload = getTableJoinCookie();
    if (!joinPayload) {
      return NextResponse.json(
        { error: 'Unauthorized. Table session expired or device not authorized.' },
        { status: 401 }
      );
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      try {
        const { data: order, error: oErr } = await (supabase as any)
          .from('orders')
          .select('id, session_id, status, created_at')
          .eq('id', orderId)
          .maybeSingle();

        if (oErr || !order) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.session_id !== joinPayload.sessionId) {
          return NextResponse.json({ error: 'Unauthorized for this table order' }, { status: 403 });
        }

        // Must still be 'placed' (kitchen has not tapped Start / 'preparing')
        if (order.status !== 'placed') {
          return NextResponse.json(
            { error: 'The kitchen has already started preparing your order. Ask your waiter if you need changes.' },
            { status: 400 }
          );
        }

        // Check 60 second undo window (with 5s buffer for latency)
        const orderAgeMs = Date.now() - new Date(order.created_at).getTime();
        if (orderAgeMs > 65 * 1000) {
          return NextResponse.json(
            { error: 'The 60-second cancellation window has passed. Please ask your waiter.' },
            { status: 400 }
          );
        }

        // Cancel order
        const now = new Date().toISOString();
        const { error: updErr } = await (supabase as any)
          .from('orders')
          .update({
            status: 'cancelled',
            cancelled_at: now,
            cancel_reason: 'Cancelled by customer within 60s',
          })
          .eq('id', order.id);

        if (updErr) throw updErr;

        const memOrder = dbStore.orders.find(o => o.id === order.id);
        if (memOrder) {
          memOrder.status = 'cancelled';
        }

        return NextResponse.json({ success: true, message: 'Order cancelled successfully' });
      } catch (err: any) {
        console.warn('Supabase customer order cancel error, fallback to dbStore:', err);
      }
    }

    // Fallback: dbStore
    const memOrder = dbStore.orders.find(o => o.id === orderId);
    if (!memOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (memOrder.status !== 'placed') {
      return NextResponse.json(
        { error: 'The kitchen has already started preparing your order. Ask your waiter if you need changes.' },
        { status: 400 }
      );
    }

    const orderAgeMs = Date.now() - new Date(memOrder.created_at).getTime();
    if (orderAgeMs > 65 * 1000) {
      return NextResponse.json(
        { error: 'The 60-second cancellation window has passed. Please ask your waiter.' },
        { status: 400 }
      );
    }

    memOrder.status = 'cancelled';
    (memOrder as any).cancelled_at = new Date().toISOString();
    (memOrder as any).cancel_reason = 'Cancelled by customer within 60s';

    return NextResponse.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err: any) {
    console.error('Customer cancel order error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to cancel order' },
      { status: 500 }
    );
  }
}
