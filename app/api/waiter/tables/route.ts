import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerStaffSession();
    // Allow waiter and owner
    if (session && !['owner', 'waiter'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      const { data: tables, error: tErr } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('is_active', true)
        .order('table_number', { ascending: true });

      if (tErr) throw tErr;

      const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .neq('status', 'cancelled')
        .neq('status', 'served');

      if (oErr) throw oErr;

      const result = (tables || []).map(tbl => {
        const tableOrders = (orders || []).filter(o => o.table_id === tbl.id);
        const pendingCount = tableOrders.filter(o => o.status === 'pending').length;
        const totalPaise = tableOrders.reduce((sum, o) => sum + (o.total_paise || 0), 0);

        return {
          ...tbl,
          activeOrders: tableOrders,
          pendingOrdersCount: pendingCount,
          currentTotalPaise: totalPaise,
        };
      });

      return NextResponse.json({ tables: result });
    } else {
      // In-memory store
      const result = dbStore.tables.map(tbl => {
        const tableOrders = dbStore.orders
          .filter(o => o.table_id === tbl.id && o.status !== 'cancelled' && o.status !== 'served')
          .map(o => ({
            ...o,
            items: dbStore.orderItems.filter(i => i.order_id === o.id),
          }));

        const pendingCount = tableOrders.filter(o => o.status === 'pending').length;
        const totalPaise = tableOrders.reduce((sum, o) => sum + o.total_paise, 0);

        return {
          ...tbl,
          activeOrders: tableOrders,
          pendingOrdersCount: pendingCount,
          currentTotalPaise: totalPaise,
        };
      });

      return NextResponse.json({ tables: result });
    }
  } catch (err: any) {
    console.error('Waiter tables error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load tables' }, { status: 500 });
  }
}
