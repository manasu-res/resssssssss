import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { dbStore } from '@/lib/data/store';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getTableJoinCookie } from '@/lib/auth/table-session-cookie';

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

    const supabase = getServiceSupabase();

    if (supabase) {
      try {
        // 5. Verify table and active status
        const { data: diningTable } = await (supabase as any)
          .from('dining_tables')
          .select('*')
          .eq('qr_token', token)
          .maybeSingle();

        if (!diningTable || !diningTable.is_enabled) {
          return NextResponse.json(
            { error: 'This QR is not valid. Please ask the waiter.' },
            { status: 404 }
          );
        }

        // 6. Verify table has an open session
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

        // 7. Check 4-hour auto-close rule
        const openedAtMs = new Date(openSession.opened_at).getTime();
        const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
        if (Date.now() - openedAtMs > FOUR_HOURS_MS) {
          // Auto-close session
          await (supabase as any)
            .from('table_sessions')
            .update({ status: 'closed', closed_at: new Date().toISOString() })
            .eq('id', openSession.id);

          return NextResponse.json(
            { error: 'Table session has expired. Ask the waiter to open the table.' },
            { status: 400 }
          );
        }

        // 8. Verify join cookie matches this active session
        if (joinCookie.sessionId !== openSession.id) {
          return NextResponse.json(
            {
              error: 'Session expired or new table code generated. Please enter the current table code.',
              requiresCode: true,
            },
            { status: 401 }
          );
        }

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

        // 9. Idempotency Check: prevent duplicate orders on double tap / network retry
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

        // 10. Rate limit: Max 6 orders per session per 10 minutes
        const sessionLimit = rateLimit(`session-orders:${openSession.id}`, 6, 600);
        if (!sessionLimit.success) {
          return NextResponse.json(
            { error: 'Order limit reached (max 6 orders per 10 minutes). Please wait a few minutes.' },
            { status: 429 }
          );
        }

        // 11. Re-read all prices & availability strictly from database
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
          const { data: cItems } = await (supabase as any)
            .from('combos')
            .select('id, name, price, price_paise, is_available')
            .in('id', comboIds);
          dbCombos = cItems || [];
        }

        let subtotalPaise = 0;
        const linesToInsert: any[] = [];

        for (const line of items) {
          if (line.itemId) {
            const dbItem = dbItems.find(i => i.id === line.itemId);
            if (!dbItem || dbItem.is_available === false) {
              return NextResponse.json(
                { error: `"${dbItem?.name || 'Selected item'}" is sold out.` },
                { status: 400 }
              );
            }
            const itemPrice = dbItem.price ?? dbItem.price_paise ?? 0;
            subtotalPaise += itemPrice * line.quantity;

            linesToInsert.push({
              menu_item_id: dbItem.id,
              combo_id: null,
              name_snapshot: dbItem.name,
              price_snapshot: itemPrice,
              quantity: line.quantity,
              note: line.note || '',
            });
          } else if (line.comboId) {
            const dbCombo = dbCombos.find(c => c.id === line.comboId);
            if (!dbCombo || dbCombo.is_available === false) {
              return NextResponse.json(
                { error: `"${dbCombo?.name || 'Selected combo'}" is sold out.` },
                { status: 400 }
              );
            }
            const comboPrice = dbCombo.price ?? dbCombo.price_paise ?? 0;
            subtotalPaise += comboPrice * line.quantity;

            linesToInsert.push({
              menu_item_id: null,
              combo_id: dbCombo.id,
              name_snapshot: dbCombo.name,
              price_snapshot: comboPrice,
              quantity: line.quantity,
              note: line.note || '',
            });
          }
        }

        if (linesToInsert.length === 0) {
          return NextResponse.json({ error: 'No valid items in order' }, { status: 400 });
        }

        // 12. Large Order Check (Hold for waiter confirmation if > threshold)
        const { data: settingsRow } = await (supabase as any)
          .from('settings')
          .select('large_order_threshold_paise')
          .eq('id', 1)
          .maybeSingle();

        const thresholdPaise = settingsRow?.large_order_threshold_paise ?? 500000;
        const isLargeOrder = subtotalPaise > thresholdPaise;

        // 13. Insert Order with status 'placed'
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

        // 14. Insert Order Lines
        const orderLines = linesToInsert.map(l => ({ ...l, order_id: newOrder.id }));
        const { data: insertedLines } = await (supabase as any)
          .from('order_lines')
          .insert(orderLines)
          .select();

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
    const memTable = dbStore.getTableByToken(token);
    if (!memTable) {
      return NextResponse.json(
        { error: 'This QR is not valid. Please ask the waiter.' },
        { status: 404 }
      );
    }

    const openSession = dbStore.getOpenSessionForTable(memTable.id);
    if (!openSession) {
      return NextResponse.json(
        { error: 'Ask the waiter to open your table to order.' },
        { status: 400 }
      );
    }

    // 4-hour check
    if (Date.now() - new Date(openSession.opened_at).getTime() > 4 * 60 * 60 * 1000) {
      openSession.status = 'closed';
      return NextResponse.json(
        { error: 'Table session has expired. Ask the waiter to open the table.' },
        { status: 400 }
      );
    }

    if (joinCookie.sessionId !== openSession.id) {
      return NextResponse.json(
        { error: 'Session expired. Please enter the current table code.', requiresCode: true },
        { status: 401 }
      );
    }

    const { order, items: createdItems } = dbStore.placeOrder({
      tableId: memTable.id,
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
