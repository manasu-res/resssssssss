import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerStaffSession();
    if (session && !['owner', 'waiter'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      // 1. Fetch enabled dining tables
      const { data: diningTables, error: tErr } = await (supabase as any)
        .from('dining_tables')
        .select('*')
        .eq('is_enabled', true)
        .order('label', { ascending: true });

      if (tErr) throw tErr;

      // 2. Fetch active sessions (status 'open' or 'billed')
      const { data: activeSessions, error: sErr } = await (supabase as any)
        .from('table_sessions')
        .select('*')
        .in('status', ['open', 'billed']);

      if (sErr) throw sErr;

      const activeSessionIds = (activeSessions || []).map((s: any) => s.id);

      // 3. Fetch active orders for these sessions
      let sessionOrders: any[] = [];
      if (activeSessionIds.length > 0) {
        const { data: orders, error: oErr } = await (supabase as any)
          .from('orders')
          .select(`
            id,
            session_id,
            status,
            source,
            created_at,
            approved_by,
            approved_at,
            order_lines:order_lines (
              id,
              name_snapshot,
              price_snapshot,
              quantity,
              note
            )
          `)
          .in('session_id', activeSessionIds)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false });

        if (oErr) throw oErr;
        sessionOrders = orders || [];
      }

      // 4. Map each table to its unified POS representation
      const result = (diningTables || []).map((tbl: any) => {
        const tableSession = (activeSessions || []).find((s: any) => s.table_id === tbl.id);
        const ordersForTable = tableSession
          ? sessionOrders.filter((o: any) => o.session_id === tableSession.id)
          : [];

        const pendingOrders = ordersForTable.filter((o: any) => o.status === 'pending');
        const pendingCount = pendingOrders.length;

        let runningTotalPaise = 0;
        for (const order of ordersForTable) {
          for (const line of order.order_lines || []) {
            runningTotalPaise += (line.price_snapshot || 0) * (line.quantity || 1);
          }
        }

        // Determine State: 'Free', 'Open', 'Order waiting', 'Billed'
        let state: 'Free' | 'Open' | 'Order waiting' | 'Billed' = 'Free';
        if (tableSession) {
          if (tableSession.status === 'billed') {
            state = 'Billed';
          } else if (pendingCount > 0) {
            state = 'Order waiting';
          } else {
            state = 'Open';
          }
        }

        return {
          id: tbl.id,
          label: tbl.label,
          table_number: `Table ${tbl.label}`,
          qr_token: tbl.qr_token,
          state,
          session: tableSession || null,
          opened_at: tableSession?.opened_at || null,
          running_total_paise: runningTotalPaise,
          currentTotalPaise: runningTotalPaise,
          pending_orders_count: pendingCount,
          pendingOrdersCount: pendingCount,
          orders: ordersForTable,
          activeOrders: ordersForTable.map((o: any) => ({
            id: o.id,
            status: o.status,
            source: o.source,
            created_at: o.created_at,
            total_paise: (o.order_lines || []).reduce(
              (sum: number, l: any) => sum + (l.price_snapshot || 0) * (l.quantity || 1),
              0
            ),
            items: (o.order_lines || []).map((l: any) => ({
              id: l.id,
              item_name: l.name_snapshot,
              price_paise: l.price_snapshot,
              quantity: l.quantity,
              notes: l.note,
            })),
          })),
        };
      });

      return NextResponse.json({ tables: result });
    } else {
      // In-memory / demo fallback
      const result = dbStore.tables.map(tbl => {
        const session = dbStore.getOpenSessionForTable(tbl.id);
        const tableOrders = dbStore.orders
          .filter(o => o.table_id === tbl.id && o.status !== 'cancelled')
          .map(o => ({
            id: o.id,
            order_number: o.order_number,
            status: o.status,
            source: o.source,
            created_at: o.created_at,
            notes: o.notes,
            total_paise: o.total_paise,
            order_lines: dbStore.orderItems
              .filter(i => i.order_id === o.id)
              .map(i => ({
                id: i.id,
                name_snapshot: i.item_name,
                price_snapshot: i.price_paise,
                quantity: i.quantity,
                note: i.notes || '',
              })),
            items: dbStore.orderItems.filter(i => i.order_id === o.id),
          }));

        const pendingOrders = tableOrders.filter(o => o.status === 'pending');
        const pendingCount = pendingOrders.length;
        const totalPaise = tableOrders.reduce((sum, o) => sum + o.total_paise, 0);

        let state: 'Free' | 'Open' | 'Order waiting' | 'Billed' = 'Free';
        if (session) {
          if (session.status === 'billed') {
            state = 'Billed';
          } else if (pendingCount > 0) {
            state = 'Order waiting';
          } else {
            state = 'Open';
          }
        }

        return {
          id: tbl.id,
          label: tbl.table_number.replace('Table ', ''),
          table_number: tbl.table_number,
          qr_token: tbl.active_token,
          state,
          session: session || null,
          opened_at: session?.opened_at || null,
          running_total_paise: totalPaise,
          currentTotalPaise: totalPaise,
          pending_orders_count: pendingCount,
          pendingOrdersCount: pendingCount,
          orders: tableOrders,
          activeOrders: tableOrders,
        };
      });

      return NextResponse.json({ tables: result });
    }
  } catch (err: any) {
    console.error('Waiter tables error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load tables' }, { status: 500 });
  }
}
