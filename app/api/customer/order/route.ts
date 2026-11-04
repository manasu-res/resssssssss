import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { dbStore } from '@/lib/data/store';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getTableJoinCookie } from '@/lib/auth/table-session-cookie';
import { resolveDiningTable, resolveOpenSession } from '@/lib/data/table-resolver';

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
    idempotencyKey: z.string().max(100).optional(),
  })
  .transform(d => ({
    ...d,
    token: (d.token || d.tableToken || '').trim(),
    orderNote: (d.orderNote || d.notes || '').trim(),
    idempotencyKey: (d.idempotencyKey || '').trim(),
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

    const { token, items, orderNote, idempotencyKey } = parse.data;

    // 3. Limit to 30 items total per order
    const totalItemCount = items.reduce((sum, it) => sum + it.quantity, 0);
    if (totalItemCount > 30) {
      return NextResponse.json(
        { error: 'Maximum 30 items per order allowed.' },
        { status: 400 }
      );
    }

    // 4. Verify table join cookie (Only customers who entered 4-digit code can order)
    const joinCookie = getTableJoinCookie();
    if (!joinCookie) {
      return NextResponse.json(
        {
          error: 'Table code required. Please ask your waiter for the 4-digit code.',
          requiresCode: true,
        },
        { status: 401 }
      );
    }

    // 5. Resolve dining table (handles token, table id, label, number)
    const table = await resolveDiningTable(token);
    if (!table || !table.is_enabled) {
      return NextResponse.json(
        { error: 'This QR is not valid. Please ask the waiter.' },
        { status: 404 }
      );
    }

    // 6. Resolve active open session
    const openSession = await resolveOpenSession(table);
    if (!openSession) {
      return NextResponse.json(
        { error: 'Ask the waiter to open your table to order.' },
        { status: 400 }
      );
    }

    // 7. Verify join cookie matches this active session or table
    if (joinCookie.sessionId !== openSession.id && joinCookie.tableId !== table.id) {
      return NextResponse.json(
        {
          error: 'Session expired or new table code generated. Please enter the current table code.',
          requiresCode: true,
        },
        { status: 401 }
      );
    }

    const supabase = getServiceSupabase();

    if (supabase && table.source === 'supabase' && openSession.source === 'supabase') {
      try {
        // Check device is not removed in table_session_devices
        const { data: deviceRecord } = await (supabase as any)
          .from('table_session_devices')
          .select('is_active, removed_at')
          .eq('session_id', openSession.id)
          .eq('device_id', joinCookie.deviceId)
          .maybeSingle();

        if (deviceRecord && (!deviceRecord.is_active || deviceRecord.removed_at)) {
          return NextResponse.json(
            {
              error: 'This device was removed by the waiter. Please re-enter the table code.',
              requiresCode: true,
            },
            { status: 401 }
          );
        }

        // Idempotency Check
        if (idempotencyKey) {
          const { data: existingOrder } = await (supabase as any)
            .from('orders')
            .select(`
              id,
              order_number,
              status,
              source,
              needs_confirmation,
              created_at,
              order_lines (
                id,
                name_snapshot,
                price_snapshot,
                quantity,
                note
              )
            `)
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();

          if (existingOrder) {
            return NextResponse.json({
              success: true,
              deduplicated: true,
              order: existingOrder,
            });
          }
        }

        // Rate limit: Max 6 orders per session per 10 minutes
        const sessionLimit = rateLimit(`session-orders:${openSession.id}`, 6, 600);
        if (!sessionLimit.success) {
          return NextResponse.json(
            { error: 'Order limit reached (max 6 orders per 10 minutes). Please wait a few minutes.' },
            { status: 429 }
          );
        }

        // Re-read all prices & availability strictly from database
        const itemIds = items.map(i => i.itemId).filter(Boolean) as string[];
        const comboIds = items.map(i => i.comboId).filter(Boolean) as string[];

        let dbItems: any[] = [];
        if (itemIds.length > 0) {
          const { data: mItems } = await (supabase as any)
            .from('menu_items')
            .select('id, name, price, price_paise, is_available')
            .in('id', itemIds);
          dbItems = mItems || [];
        }

        let dbCombos: any[] = [];
        if (comboIds.length > 0) {
          const { data: mCombos } = await (supabase as any)
            .from('combos')
            .select('id, name, price, price_paise, is_available')
            .in('id', comboIds);
          dbCombos = mCombos || [];
        }

        // Build verified order lines
        const linesToInsert: Array<{
          name_snapshot: string;
          price_snapshot: number;
          quantity: number;
          note: string;
        }> = [];

        let orderSubtotalPaise = 0;

        for (const item of items) {
          if (item.itemId) {
            const found = dbItems.find(i => i.id === item.itemId);
            if (!found) {
              return NextResponse.json({ error: 'One or more items are not available on the menu.' }, { status: 400 });
            }
            if (found.is_available === false) {
              return NextResponse.json({ error: `"${found.name}" is currently sold out.` }, { status: 400 });
            }
            const unitPrice = found.price_paise ?? found.price ?? 0;
            linesToInsert.push({
              name_snapshot: found.name,
              price_snapshot: unitPrice,
              quantity: item.quantity,
              note: item.note || '',
            });
            orderSubtotalPaise += unitPrice * item.quantity;
          } else if (item.comboId) {
            const found = dbCombos.find(c => c.id === item.comboId);
            if (!found) {
              return NextResponse.json({ error: 'Selected combo is not available.' }, { status: 400 });
            }
            if (found.is_available === false) {
              return NextResponse.json({ error: `Combo "${found.name}" is currently sold out.` }, { status: 400 });
            }
            const unitPrice = found.price_paise ?? found.price ?? 0;
            linesToInsert.push({
              name_snapshot: found.name,
              price_snapshot: unitPrice,
              quantity: item.quantity,
              note: item.note || '',
            });
            orderSubtotalPaise += unitPrice * item.quantity;
          }
        }

        // Check large order threshold (> ₹5000 = 500,000 paise)
        let largeOrderThreshold = 500000;
        try {
          const { data: settings } = await (supabase as any).from('settings').select('*').maybeSingle();
          if (settings?.large_order_threshold_paise) {
            largeOrderThreshold = settings.large_order_threshold_paise;
          }
        } catch {}

        const isLargeOrder = orderSubtotalPaise > largeOrderThreshold;

        // Insert Order with status 'placed'
        const { data: newOrder, error: oErr } = await (supabase as any)
          .from('orders')
          .insert({
            session_id: openSession.id,
            status: 'placed',
            source: 'customer',
            notes: orderNote,
            idempotency_key: idempotencyKey || null,
            needs_confirmation: isLargeOrder,
          })
          .select()
          .single();

        if (oErr || !newOrder) {
          throw oErr || new Error('Failed to insert order');
        }

        // Insert Order Lines
        const orderLines = linesToInsert.map(l => ({ ...l, order_id: newOrder.id }));
        const { data: insertedLines } = await (supabase as any)
          .from('order_lines')
          .insert(orderLines)
          .select();

        // Also sync to local dbStore so kitchen/waiter in-memory screens see it instantly
        try {
          dbStore.orders.unshift({
            id: newOrder.id,
            order_number: newOrder.order_number || Date.now() % 10000,
            table_id: table.id,
            status: 'placed',
            source: 'customer',
            notes: orderNote,
            total_paise: orderSubtotalPaise,
            created_at: newOrder.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            needs_confirmation: isLargeOrder,
          });

          for (const l of linesToInsert) {
            dbStore.orderItems.push({
              id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              order_id: newOrder.id,
              item_id: 'synced-item',
              item_name: l.name_snapshot,
              price_paise: l.price_snapshot,
              quantity: l.quantity,
              dietary: 'veg',
              status: 'placed',
              notes: l.note,
              created_at: new Date().toISOString(),
            });
          }
        } catch {}

        return NextResponse.json({
          success: true,
          order: {
            ...newOrder,
            order_lines: insertedLines || linesToInsert,
          },
          needsConfirmation: isLargeOrder,
        });
      } catch (err: any) {
        console.warn('Customer order Supabase placement error, fallback to dbStore:', err.message);
      }
    }

    // Fallback: In-memory store
    const { order, items: createdItems } = dbStore.placeOrder({
      tableId: table.id,
      source: 'customer',
      notes: orderNote,
      idempotencyKey: idempotencyKey || undefined,
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
      needsConfirmation: (order as any).needs_confirmation || false,
    });
  } catch (err: any) {
    console.error('Customer place order error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to place order' },
      { status: 500 }
    );
  }
}
