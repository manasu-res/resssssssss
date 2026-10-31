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
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Table token is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      const { data: table, error: tErr } = await supabase
        .from('restaurant_tables')
        .select('id, table_number, seat_capacity, status')
        .eq('active_token', token)
        .eq('is_active', true)
        .single();

      if (tErr || !table) {
        return NextResponse.json({ error: 'Table not found or invalid QR' }, { status: 404 });
      }

      const { data: categories } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true)
        .order('sort_order', { ascending: true });

      const { data: combos } = await supabase
        .from('combos')
        .select('*')
        .eq('is_available', true);

      // Get active orders for this table
      const { data: orders } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('table_id', table.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      return NextResponse.json({
        table,
        categories: categories || [],
        items: items || [],
        combos: combos || [],
        activeOrders: orders || [],
      });
    } else {
      // In-memory store fallback
      const table = dbStore.getTableByToken(token);
      if (!table) {
        return NextResponse.json({ error: 'Table not found or invalid QR' }, { status: 404 });
      }

      const categories = dbStore.getActiveCategories();
      const items = dbStore.getAvailableItems();
      const combos = dbStore.combos.filter(c => c.is_available);
      const activeOrders = dbStore.orders
        .filter(o => o.table_id === table.id && o.status !== 'cancelled')
        .map(o => ({
          ...o,
          items: dbStore.orderItems.filter(i => i.order_id === o.id),
        }));

      return NextResponse.json({
        table: {
          id: table.id,
          table_number: table.table_number,
          seat_capacity: table.seat_capacity,
          status: table.status,
        },
        categories,
        items,
        combos,
        activeOrders,
      });
    }
  } catch (err: any) {
    console.error('Menu fetch error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch menu' },
      { status: 500 }
    );
  }
}
