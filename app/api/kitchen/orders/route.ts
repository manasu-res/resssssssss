import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerStaffSession();
    // Allow kitchen, waiter, and owner
    if (session && !['owner', 'waiter', 'kitchen'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          table_id,
          status,
          source,
          notes,
          total_paise,
          created_at,
          updated_at,
          table:restaurant_tables(id, table_number),
          items:order_items(*)
        `)
        .in('status', ['approved', 'preparing', 'ready'])
        .order('created_at', { ascending: true });

      if (oErr) throw oErr;
      return NextResponse.json({ orders: orders || [] });
    } else {
      const activeOrders = dbStore.orders
        .filter(o => ['approved', 'preparing', 'ready'].includes(o.status))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(o => ({
          ...o,
          table: dbStore.getTableById(o.table_id),
          items: dbStore.orderItems.filter(i => i.order_id === o.id),
        }));

      return NextResponse.json({ orders: activeOrders });
    }
  } catch (err: any) {
    console.error('Kitchen orders error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load kitchen orders' }, { status: 500 });
  }
}
