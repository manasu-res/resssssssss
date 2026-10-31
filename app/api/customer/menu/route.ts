import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { dbStore } from '@/lib/data/store';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    const ipLimit = rateLimit(`menu-ip:${ip}`, 60, 60);
    if (!ipLimit.success) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'This QR is not valid. Please ask the waiter.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      // 1. Look up table by qr_token in dining_tables
      const { data: diningTable, error: dtErr } = await (supabase as any)
        .from('dining_tables')
        .select('*')
        .eq('qr_token', token)
        .maybeSingle();

      if (dtErr || !diningTable || !diningTable.is_enabled) {
        return NextResponse.json(
          { error: 'This QR is not valid. Please ask the waiter.' },
          { status: 404 }
        );
      }

      // 2. Check for active open session
      const { data: openSession, error: sErr } = await (supabase as any)
        .from('table_sessions')
        .select('*')
        .eq('table_id', diningTable.id)
        .eq('status', 'open')
        .maybeSingle();

      const hasOpenSession = Boolean(openSession && !sErr);

      // 3. Fetch categories
      const { data: categories } = await (supabase as any)
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      // 4. Fetch menu items (include sold out items so customer sees "Sold out" on menu card)
      const { data: items } = await (supabase as any)
        .from('menu_items')
        .select('*')
        .order('sort_order', { ascending: true });

      // 5. Fetch combos with items
      const { data: combos } = await (supabase as any)
        .from('combos')
        .select('*')
        .order('sort_order', { ascending: true });

      const { data: comboItems } = await (supabase as any)
        .from('combo_items')
        .select('*, menu_item:menu_items(id, name, price, is_veg)');

      const formattedCombos = (combos || []).map((c: any) => {
        const included = (comboItems || [])
          .filter((ci: any) => ci.combo_id === c.id)
          .map((ci: any) => ({
            id: ci.menu_item_id,
            name: ci.menu_item?.name || '',
            quantity: ci.quantity,
          }));
        return {
          ...c,
          includedItems: included,
        };
      });

      // 6. Fetch placed orders for this session with order_lines for live status tracking
      let sessionOrders: any[] = [];
      if (openSession) {
        const { data: orders } = await (supabase as any)
          .from('orders')
          .select(`
            id,
            status,
            source,
            created_at,
            order_lines:order_lines (
              id,
              name_snapshot,
              price_snapshot,
              quantity,
              note
            )
          `)
          .eq('session_id', openSession.id)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false });

        sessionOrders = orders || [];
      }

      return NextResponse.json({
        table: {
          id: diningTable.id,
          label: diningTable.label,
        },
        hasOpenSession,
        session: openSession || null,
        categories: categories || [],
        items: items || [],
        combos: formattedCombos || [],
        orders: sessionOrders,
      });
    } else {
      // Standalone / Demo fallback
      const table =
        dbStore.getTableByToken(token) ||
        dbStore.tables.find(t => t.active_token.includes(token) || token.includes(t.active_token));

      if (!table || !table.is_active) {
        return NextResponse.json(
          { error: 'This QR is not valid. Please ask the waiter.' },
          { status: 404 }
        );
      }

      const openSession = dbStore.getOpenSessionForTable(table.id);
      const hasOpenSession = Boolean(openSession);

      const categories = dbStore.categories.map(c => ({
        id: c.id,
        name: c.name,
        sort_order: c.sort_order,
      }));

      const items = dbStore.items.map(i => ({
        id: i.id,
        category_id: i.category_id,
        name: i.name,
        description: i.description,
        price: i.price_paise,
        is_veg: i.dietary === 'veg',
        is_available: i.is_available,
        sort_order: i.sort_order,
      }));

      const combos = dbStore.combos.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        price: c.price_paise,
        is_veg: c.dietary === 'veg',
        is_available: c.is_available,
        includedItems: (c.items || []).map(ci => ({
          id: ci.id,
          name: ci.name,
          quantity: ci.quantity,
        })),
      }));

      const sessionOrders = dbStore.orders
        .filter(o => o.table_id === table.id && o.status !== 'cancelled')
        .map(o => ({
          id: o.id,
          status: o.status,
          source: o.source,
          created_at: o.created_at,
          order_lines: dbStore.orderItems
            .filter(i => i.order_id === o.id)
            .map(i => ({
              id: i.id,
              name_snapshot: i.item_name,
              price_snapshot: i.price_paise,
              quantity: i.quantity,
              note: i.notes || '',
            })),
        }));

      return NextResponse.json({
        table: {
          id: table.id,
          label: table.table_number,
        },
        hasOpenSession,
        session: openSession || null,
        categories,
        items,
        combos,
        orders: sessionOrders,
      });
    }
  } catch (err: any) {
    console.error('Customer menu error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to load menu.' },
      { status: 500 }
    );
  }
}
