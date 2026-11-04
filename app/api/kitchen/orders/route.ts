import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerStaffSession();
    // Allow kitchen and owner roles
    if (session && !['owner', 'kitchen'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      // 1. Fetch placed, preparing and ready orders (oldest first), excluding those needing waiter confirmation
      const { data: orders, error: oErr } = await (supabase as any)
        .from('orders')
        .select(`
          id,
          session_id,
          status,
          source,
          needs_confirmation,
          created_at,
          approved_at,
          session:table_sessions (
            id,
            table:dining_tables (
              id,
              label
            )
          ),
          order_lines:order_lines (
            id,
            combo_id,
            menu_item_id,
            name_snapshot,
            price_snapshot,
            quantity,
            note
          )
        `)
        .in('status', ['placed', 'preparing', 'ready', 'approved'])
        .or('needs_confirmation.is.null,needs_confirmation.eq.false')
        .order('created_at', { ascending: true });

      if (oErr) throw oErr;

      // 2. Fetch combos with items for indenting combo contents
      const { data: combos } = await (supabase as any)
        .from('combos')
        .select(`
          id,
          name,
          combo_items (
            quantity,
            menu_item:menu_items (
              name
            )
          )
        `);

      const formattedOrders = (orders || []).map((o: any) => {
        const tableLabel = o.session?.table?.label ? `Table ${o.session.table.label}` : 'Table';
        const lines = (o.order_lines || []).map((line: any) => {
          let comboItems: Array<{ name: string; quantity: number }> = [];
          if (line.combo_id) {
            const matchedCombo = (combos || []).find((c: any) => c.id === line.combo_id);
            if (matchedCombo) {
              comboItems = (matchedCombo.combo_items || []).map((ci: any) => ({
                name: ci.menu_item?.name || '',
                quantity: ci.quantity || 1,
              }));
            }
          }

          return {
            id: line.id,
            name: line.name_snapshot,
            quantity: line.quantity,
            note: line.note,
            is_combo: Boolean(line.combo_id),
            combo_items: comboItems,
          };
        });

        return {
          id: o.id,
          order_number: o.id.slice(-4).toUpperCase(),
          table_label: tableLabel,
          status: o.status,
          source: o.source,
          created_at: o.created_at,
          approved_at: o.approved_at,
          lines,
        };
      });

      return NextResponse.json({ orders: formattedOrders });
    } else {
      // In-memory store
      const activeOrders = dbStore.orders
        .filter(o => ['placed', 'preparing', 'ready', 'approved'].includes(o.status) && !(o as any).needs_confirmation)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(o => {
          const table = dbStore.getTableById(o.table_id);
          const tableLabel = table ? table.table_number : 'Table';
          const items = dbStore.orderItems.filter(i => i.order_id === o.id);

          const lines = items.map(it => {
            let comboItems: Array<{ name: string; quantity: number }> = [];
            const isCombo = Boolean(it.combo_id || it.item_id?.startsWith('combo-'));
            if (isCombo) {
              const comboId = it.combo_id || it.item_id;
              const combo = dbStore.getComboById(comboId || '');
              if (combo && combo.items) {
                comboItems = combo.items.map(ci => ({
                  name: ci.name,
                  quantity: ci.quantity,
                }));
              }
            }

            return {
              id: it.id,
              name: it.item_name,
              quantity: it.quantity,
              note: it.notes,
              is_combo: isCombo,
              combo_items: comboItems,
            };
          });

          return {
            id: o.id,
            order_number: o.order_number ? `#${o.order_number}` : o.id.slice(-4).toUpperCase(),
            table_label: tableLabel,
            status: o.status,
            source: o.source,
            created_at: o.created_at,
            notes: o.notes,
            lines,
          };
        });

      return NextResponse.json({ orders: activeOrders });
    }
  } catch (err: any) {
    console.error('Kitchen orders error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to load kitchen orders' },
      { status: 500 }
    );
  }
}
