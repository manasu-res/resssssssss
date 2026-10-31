import { NextRequest, NextResponse } from 'next/server';
import { waiterPlaceOrderSchema } from '@/lib/validation';
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
    const parse = waiterPlaceOrderSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { tableId, items, notes } = parse.data;
    const supabase = getServiceSupabase();

    if (supabase) {
      const itemIds = items.map(i => i.itemId).filter(Boolean) as string[];
      const { data: menuItems, error: mErr } = await supabase
        .from('menu_items')
        .select('*')
        .in('id', itemIds);

      if (mErr) throw mErr;

      let totalPaise = 0;
      const orderLines: any[] = [];

      for (const reqItem of items) {
        if (reqItem.itemId) {
          const item = (menuItems || []).find(i => i.id === reqItem.itemId);
          if (!item) {
            return NextResponse.json({ error: 'Item not found' }, { status: 400 });
          }
          totalPaise += item.price_paise * reqItem.quantity;
          orderLines.push({
            item_id: item.id,
            item_name: item.name,
            price_paise: item.price_paise,
            quantity: reqItem.quantity,
            dietary: item.dietary,
            status: 'approved',
            notes: reqItem.notes || '',
          });
        }
      }

      const { data: newOrder, error: oErr } = await supabase
        .from('orders')
        .insert({
          table_id: tableId,
          status: 'approved',
          source: 'waiter',
          waiter_id: session?.userId || null,
          notes: notes || '',
          total_paise: totalPaise,
        })
        .select()
        .single();

      if (oErr) throw oErr;

      const itemsWithOrder = orderLines.map(line => ({
        ...line,
        order_id: newOrder.id,
      }));

      const { data: insertedItems } = await supabase
        .from('order_items')
        .insert(itemsWithOrder)
        .select();

      await supabase
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', tableId);

      return NextResponse.json({
        success: true,
        order: { ...newOrder, items: insertedItems },
      });
    } else {
      const { order, items: createdItems } = dbStore.placeOrder({
        tableId,
        source: 'waiter',
        waiterId: session?.userId,
        notes: notes || '',
        items,
      });

      return NextResponse.json({
        success: true,
        order: { ...order, items: createdItems },
      });
    }
  } catch (err: any) {
    console.error('Waiter add order error:', err);
    return NextResponse.json({ error: err.message || 'Failed to place order' }, { status: 500 });
  }
}
