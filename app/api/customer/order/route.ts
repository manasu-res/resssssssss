import { NextRequest, NextResponse } from 'next/server';
import { customerPlaceOrderSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { dbStore } from '@/lib/data/store';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate-limit by client IP
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    const ipLimit = rateLimit(`ip:${ip}`, 30, 60);
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before trying again.' },
        { status: 429 }
      );
    }

    // 2. Parse and validate payload with Zod
    const body = await req.json();
    const parseResult = customerPlaceOrderSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { tableToken, items, notes } = parseResult.data;

    // 3. Rate-limit per table token (max 6 orders per 2 minutes to prevent spam)
    const tableLimit = rateLimit(`tbl:${tableToken}`, 6, 120, true);
    if (!tableLimit.success) {
      return NextResponse.json(
        { error: 'An order was placed recently for this table. Please wait a moment.' },
        { status: 429 }
      );
    }

    // 4. Verify table via Service Supabase or Store
    const supabase = getServiceSupabase();

    if (supabase) {
      // Query table with service key
      const { data: table, error: tableErr } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('active_token', tableToken)
        .eq('is_active', true)
        .single();

      if (tableErr || !table) {
        return NextResponse.json(
          { error: 'Invalid or inactive table token. Please ask staff for assistance.' },
          { status: 404 }
        );
      }

      // Fetch official menu prices from database (NEVER TRUST CLIENT PRICES)
      const itemIds = items.map(i => i.itemId).filter(Boolean) as string[];
      let dbMenuItems: any[] = [];
      if (itemIds.length > 0) {
        const { data: mItems, error: mErr } = await supabase
          .from('menu_items')
          .select('id, name, price_paise, dietary, is_available')
          .in('id', itemIds);
        if (mErr) throw mErr;
        dbMenuItems = mItems || [];
      }

      let totalPaise = 0;
      const orderLinesToInsert: any[] = [];

      for (const reqItem of items) {
        if (reqItem.itemId) {
          const item = dbMenuItems.find(i => i.id === reqItem.itemId);
          if (!item || !item.is_available) {
            return NextResponse.json(
              { error: `Item "${item?.name || reqItem.itemId}" is currently unavailable.` },
              { status: 400 }
            );
          }
          totalPaise += item.price_paise * reqItem.quantity;
          orderLinesToInsert.push({
            item_id: item.id,
            item_name: item.name,
            price_paise: item.price_paise, // strict DB snapshot
            quantity: reqItem.quantity,
            dietary: item.dietary,
            status: 'pending',
            notes: reqItem.notes || '',
          });
        }
      }

      // Insert Order record
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          table_id: table.id,
          status: 'pending',
          source: 'customer',
          notes: notes || '',
          total_paise: totalPaise,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // Insert Order Items with snapshots
      const itemsPayload = orderLinesToInsert.map(line => ({
        ...line,
        order_id: newOrder.id,
      }));

      const { data: insertedItems, error: itemsErr } = await supabase
        .from('order_items')
        .insert(itemsPayload)
        .select();

      if (itemsErr) throw itemsErr;

      // Update table status to occupied
      await supabase
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', table.id);

      return NextResponse.json({
        success: true,
        order: {
          ...newOrder,
          items: insertedItems,
        },
      });
    } else {
      // Standalone / In-memory fallback
      const table = dbStore.getTableByToken(tableToken);
      if (!table) {
        return NextResponse.json(
          { error: 'Invalid or inactive table token. Please ask staff for assistance.' },
          { status: 404 }
        );
      }

      const { order, items: createdItems } = dbStore.placeOrder({
        tableId: table.id,
        source: 'customer',
        notes: notes || '',
        items,
      });

      return NextResponse.json({
        success: true,
        order: {
          ...order,
          items: createdItems,
        },
      });
    }
  } catch (err: any) {
    console.error('Error placing customer order:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while placing order.' },
      { status: 500 }
    );
  }
}
