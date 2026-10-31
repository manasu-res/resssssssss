import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { dbStore } from '@/lib/data/store';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

const customerOrderItemSchema = z
  .object({
    itemId: z.string().optional(),
    comboId: z.string().optional(),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(20, 'Max 20 of any item per order'),
    note: z.string().max(100, 'Note must be under 100 characters').optional().default(''),
    notes: z.string().max(100).optional(),
  })
  .transform(d => ({
    ...d,
    note: (d.note || d.notes || '').trim(),
  }))
  .refine(data => data.itemId || data.comboId, {
    message: 'Each line must specify an item or combo',
  });

const placeOrderSchema = z
  .object({
    token: z.string().optional(),
    tableToken: z.string().optional(),
    items: z.array(customerOrderItemSchema).min(1, 'Please select at least one item'),
    orderNote: z.string().max(200, 'Order note too long').optional().default(''),
    notes: z.string().max(200).optional(),
  })
  .transform(d => ({
    ...d,
    token: (d.token || d.tableToken || '').trim(),
    orderNote: (d.orderNote || d.notes || '').trim(),
  }))
  .refine(d => Boolean(d.token), {
    message: 'Table token is required',
  });

export async function POST(req: NextRequest) {
  try {
    // 1. Rate-limit by client IP (30 req/min)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    const ipLimit = rateLimit(`order-ip:${ip}`, 30, 60);
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before placing another order.' },
        { status: 429 }
      );
    }

    // 2. Validate payload with Zod
    const body = await req.json();
    const parse = placeOrderSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { token, items, orderNote } = parse.data;

    // 3. Limit to 30 items total per order
    const totalItemCount = items.reduce((sum, it) => sum + it.quantity, 0);
    if (totalItemCount > 30) {
      return NextResponse.json(
        { error: 'Maximum 30 items per order allowed.' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      // 4. Verify table and active status
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

      // 5. Verify table has an open session
      const { data: openSession, error: sErr } = await (supabase as any)
        .from('table_sessions')
        .select('*')
        .eq('table_id', diningTable.id)
        .eq('status', 'open')
        .maybeSingle();

      if (sErr || !openSession) {
        return NextResponse.json(
          { error: 'Ask the waiter to open your table to order.' },
          { status: 400 }
        );
      }

      // 6. Limit to 5 pending orders per session
      const { count: pendingCount, error: cErr } = await (supabase as any)
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', openSession.id)
        .eq('status', 'pending');

      if (!cErr && (pendingCount || 0) >= 5) {
        return NextResponse.json(
          { error: 'You have 5 orders waiting for waiter approval. Please wait for the waiter to confirm.' },
          { status: 400 }
        );
      }

      // 7. Re-read all prices from database (NEVER TRUST CLIENT PRICES)
      const itemIds = items.map(i => i.itemId).filter(Boolean) as string[];
      const comboIds = items.map(i => i.comboId).filter(Boolean) as string[];

      let dbItems: any[] = [];
      if (itemIds.length > 0) {
        const { data: mItems, error: mErr } = await (supabase as any)
          .from('menu_items')
          .select('id, name, price, is_available')
          .in('id', itemIds);
        if (mErr) throw mErr;
        dbItems = mItems || [];
      }

      let dbCombos: any[] = [];
      if (comboIds.length > 0) {
        const { data: cItems, error: cErr } = await (supabase as any)
          .from('combos')
          .select('id, name, price, is_available')
          .in('id', comboIds);
        if (cErr) throw cErr;
        dbCombos = cItems || [];
      }

      // Validate availability and build line snapshots
      const linesToInsert: Array<{
        menu_item_id: string | null;
        combo_id: string | null;
        name_snapshot: string;
        price_snapshot: number;
        quantity: number;
        note: string;
      }> = [];

      for (const line of items) {
        if (line.itemId) {
          const dbItem = dbItems.find(i => i.id === line.itemId);
          if (!dbItem) {
            return NextResponse.json({ error: 'Item not found in menu.' }, { status: 400 });
          }
          if (!dbItem.is_available) {
            return NextResponse.json(
              { error: `"${dbItem.name}" is sold out.` },
              { status: 400 }
            );
          }
          linesToInsert.push({
            menu_item_id: dbItem.id,
            combo_id: null,
            name_snapshot: dbItem.name,
            price_snapshot: dbItem.price, // strict DB snapshot
            quantity: line.quantity,
            note: line.note || '',
          });
        } else if (line.comboId) {
          const dbCombo = dbCombos.find(c => c.id === line.comboId);
          if (!dbCombo) {
            return NextResponse.json({ error: 'Combo not found in menu.' }, { status: 400 });
          }
          if (!dbCombo.is_available) {
            return NextResponse.json(
              { error: `"${dbCombo.name}" is sold out.` },
              { status: 400 }
            );
          }
          linesToInsert.push({
            menu_item_id: null,
            combo_id: dbCombo.id,
            name_snapshot: dbCombo.name,
            price_snapshot: dbCombo.price, // strict DB snapshot
            quantity: line.quantity,
            note: line.note || '',
          });
        }
      }

      // 8. Insert Order record: starts as 'pending' (waiter must approve before kitchen sees it)
      const { data: newOrder, error: oErr } = await (supabase as any)
        .from('orders')
        .insert({
          session_id: openSession.id,
          status: 'pending',
          source: 'customer',
        })
        .select()
        .single();

      if (oErr) throw oErr;

      // 9. Insert Order Lines with immutable price snapshots
      const orderLinesPayload = linesToInsert.map(l => ({
        ...l,
        order_id: newOrder.id,
      }));

      const { data: insertedLines, error: lErr } = await (supabase as any)
        .from('order_lines')
        .insert(orderLinesPayload)
        .select();

      if (lErr) throw lErr;

      return NextResponse.json({
        success: true,
        order: {
          ...newOrder,
          order_lines: insertedLines,
        },
      });
    } else {
      // Demo / Local In-Memory Fallback - strict exact token match
      const table = dbStore.getTableByToken(token);

      if (!table || !table.is_active) {
        return NextResponse.json(
          { error: 'This QR is not valid. Please ask the waiter.' },
          { status: 404 }
        );
      }

      const openSession = dbStore.getOpenSessionForTable(table.id);
      if (!openSession) {
        return NextResponse.json(
          { error: 'Ask the waiter to open your table to order.' },
          { status: 400 }
        );
      }

      const pendingCount = dbStore.orders.filter(
        o => o.table_id === table.id && o.status === 'pending'
      ).length;

      if (pendingCount >= 5) {
        return NextResponse.json(
          { error: 'You have 5 orders waiting for waiter approval. Please wait for the waiter to confirm.' },
          { status: 400 }
        );
      }

      // Check availability and map items
      for (const line of items) {
        if (line.itemId) {
          const it = dbStore.getItemById(line.itemId);
          if (!it || !it.is_available) {
            return NextResponse.json(
              { error: `"${it?.name || 'Item'}" is sold out.` },
              { status: 400 }
            );
          }
        }
      }

      const { order, items: createdItems } = dbStore.placeOrder({
        tableId: table.id,
        source: 'customer',
        notes: orderNote,
        items: items.map(i => ({
          itemId: i.itemId,
          comboId: i.comboId,
          quantity: i.quantity,
          notes: i.note,
        })),
      });

      return NextResponse.json({
        success: true,
        order: {
          ...order,
          order_lines: createdItems.map(i => ({
            id: i.id,
            name_snapshot: i.item_name,
            price_snapshot: i.price_paise,
            quantity: i.quantity,
            note: i.notes,
          })),
        },
      });
    }
  } catch (err: any) {
    console.error('Customer order error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to place order.' },
      { status: 500 }
    );
  }
}
