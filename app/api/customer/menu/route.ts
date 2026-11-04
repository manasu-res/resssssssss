import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { dbStore } from '@/lib/data/store';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getTableJoinCookie } from '@/lib/auth/table-session-cookie';
import { resolveDiningTable, resolveOpenSession } from '@/lib/data/table-resolver';

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

    const joinCookie = getTableJoinCookie();
    const supabase = getServiceSupabase();

    // 1. Resolve dining table (handles qr_token, table id, label, or number)
    const table = await resolveDiningTable(token);
    if (!table || !table.is_enabled) {
      return NextResponse.json(
        { error: 'This QR is not valid. Please ask the waiter.' },
        { status: 404 }
      );
    }

    // 2. Resolve active session
    const openSession = await resolveOpenSession(table);
    const hasOpenSession = Boolean(openSession);
    let isJoined = false;

    if (hasOpenSession && joinCookie && joinCookie.sessionId === openSession!.id) {
      if (supabase && openSession!.source === 'supabase') {
        try {
          const { data: dev } = await (supabase as any)
            .from('table_session_devices')
            .select('is_active, removed_at')
            .eq('session_id', openSession!.id)
            .eq('device_id', joinCookie.deviceId)
            .maybeSingle();

          if (dev && dev.is_active && !dev.removed_at) {
            isJoined = true;
          }
        } catch {}
      }

      if (!isJoined) {
        const dev = dbStore.devices.find(
          d => d.session_id === openSession!.id && d.device_id === joinCookie.deviceId && d.is_active
        );
        if (dev) isJoined = true;
      }
    }

    // 3. Try to fetch menu from Supabase
    let categories: any[] = [];
    let items: any[] = [];
    let formattedCombos: any[] = [];
    let sessionOrders: any[] = [];

    if (supabase) {
      try {
        const [catRes, itemRes, comboRes, comboItemsRes] = await Promise.all([
          (supabase as any).from('categories').select('*').order('sort_order', { ascending: true }),
          (supabase as any).from('menu_items').select('*').order('sort_order', { ascending: true }),
          (supabase as any).from('combos').select('*').order('sort_order', { ascending: true }),
          (supabase as any).from('combo_items').select('*, menu_item:menu_items(id, name, price, is_veg)'),
        ]);

        if (catRes.data && catRes.data.length > 0 && itemRes.data && itemRes.data.length > 0) {
          categories = catRes.data;
          items = itemRes.data;

          formattedCombos = (comboRes.data || []).map((c: any) => {
            const included = (comboItemsRes.data || [])
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

          if (openSession && openSession.source === 'supabase') {
            const { data: orders } = await (supabase as any)
              .from('orders')
              .select(`
                id,
                status,
                source,
                needs_confirmation,
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
        }
      } catch (err: any) {
        console.warn('Customer menu Supabase fetch fallback to local store:', err.message);
      }
    }

    // Fallback menu data from dbStore
    if (categories.length === 0 || items.length === 0) {
      categories = dbStore.categories.map(c => ({
        id: c.id,
        name: c.name,
        sort_order: (c as any).sort_order || 0,
      }));

      items = dbStore.items.map(i => ({
        id: i.id,
        category_id: i.category_id,
        name: i.name,
        description: i.description,
        price: i.price_paise,
        is_veg: i.dietary === 'veg',
        is_available: i.is_available,
        sort_order: i.sort_order,
      }));

      formattedCombos = dbStore.combos.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        price: c.price_paise,
        is_veg: c.dietary === 'veg',
        is_available: c.is_available,
        sort_order: (c as any).sort_order || 0,
        includedItems: (c.items || []).map(ci => ({
          name: ci.name || (ci as any).item_name || '',
          quantity: ci.quantity,
        })),
      }));
    }

    if (sessionOrders.length === 0 && openSession) {
      sessionOrders = dbStore.orders
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
    }

    return NextResponse.json({
      table: {
        id: table.id,
        label: table.label,
      },
      hasOpenSession,
      isJoined,
      session: openSession ? { id: openSession.id, opened_at: openSession.opened_at } : null,
      categories,
      items,
      combos: formattedCombos,
      orders: sessionOrders,
    });
  } catch (err: any) {
    console.error('Customer menu route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
