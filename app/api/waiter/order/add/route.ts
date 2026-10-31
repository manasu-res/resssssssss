import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const waiterOrderItemSchema = z.object({
  itemId: z.string().optional(),
  comboId: z.string().optional(),
  quantity: z.number().int().min(1).max(20),
  note: z.string().max(100).optional().default(''),
  notes: z.string().max(100).optional(),
}).transform(d => ({
  ...d,
  note: d.note || d.notes || '',
})).refine(d => d.itemId || d.comboId, {
  message: 'Must specify itemId or comboId',
});

const waiterAddOrderSchema = z.object({
  tableId: z.string().min(1, 'tableId is required'),
  items: z.array(waiterOrderItemSchema).min(1, 'At least one item required'),
  notes: z.string().max(200).optional().default(''),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerStaffSession();
    if (session && !['owner', 'waiter'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parse = waiterAddOrderSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { tableId, items, notes } = parse.data;
    const supabase = getServiceSupabase();

    if (supabase) {
      try {
        // 1. Get or create active session for table
        let { data: openSession } = await (supabase as any)
          .from('table_sessions')
          .select('*')
          .eq('table_id', tableId)
          .eq('status', 'open')
          .maybeSingle();

        if (!openSession) {
          const { data: newSession, error: sErr } = await (supabase as any)
            .from('table_sessions')
            .insert({
              table_id: tableId,
              status: 'open',
              opened_by: session?.userId || null,
              opened_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!sErr && newSession) {
            openSession = newSession;
          }
        }

        if (openSession) {
          // 2. Re-read prices from DB
          const itemIds = items.map(i => i.itemId).filter(Boolean) as string[];
          const comboIds = items.map(i => i.comboId).filter(Boolean) as string[];

          let dbItems: any[] = [];
          if (itemIds.length > 0) {
            const { data: mItems } = await (supabase as any)
              .from('menu_items')
              .select('id, name, price, is_available')
              .in('id', itemIds);
            dbItems = mItems || [];
          }

          let dbCombos: any[] = [];
          if (comboIds.length > 0) {
            const { data: cItems } = await (supabase as any)
              .from('combos')
              .select('id, name, price, is_available')
              .in('id', comboIds);
            dbCombos = cItems || [];
          }

          const linesToInsert: any[] = [];
          for (const line of items) {
            if (line.itemId) {
              const dbItem = dbItems.find(i => i.id === line.itemId);
              if (dbItem) {
                if (dbItem.is_available === false) {
                  return NextResponse.json(
                    { error: `"${dbItem.name}" is sold out and cannot be ordered.` },
                    { status: 400 }
                  );
                }
                linesToInsert.push({
                  menu_item_id: dbItem.id,
                  combo_id: null,
                  name_snapshot: dbItem.name,
                  price_snapshot: dbItem.price,
                  quantity: line.quantity,
                  note: line.note,
                });
              }
            } else if (line.comboId) {
              const dbCombo = dbCombos.find(c => c.id === line.comboId);
              if (dbCombo) {
                if (dbCombo.is_available === false) {
                  return NextResponse.json(
                    { error: `"${dbCombo.name}" is sold out and cannot be ordered.` },
                    { status: 400 }
                  );
                }
                linesToInsert.push({
                  menu_item_id: null,
                  combo_id: dbCombo.id,
                  name_snapshot: dbCombo.name,
                  price_snapshot: dbCombo.price,
                  quantity: line.quantity,
                  note: line.note,
                });
              }
            }
          }

          if (linesToInsert.length > 0) {
            // 3. Insert order directly approved
            const now = new Date().toISOString();
            const { data: newOrder, error: oErr } = await (supabase as any)
              .from('orders')
              .insert({
                session_id: openSession.id,
                status: 'approved',
                source: 'waiter',
                approved_by: session?.userId || null,
                approved_at: now,
              })
              .select()
              .single();

            if (!oErr && newOrder) {
              // 4. Insert order lines
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
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('Supabase add order error, fallback to dbStore:', err.message);
      }
    }

    // Fallback: In-memory store (Guaranteed to succeed)
    for (const line of items) {
      if (line.itemId) {
        const it = dbStore.getItemById(line.itemId);
        if (it && it.is_available === false) {
          return NextResponse.json(
            { error: `"${it.name}" is sold out and cannot be ordered.` },
            { status: 400 }
          );
        }
      } else if (line.comboId) {
        const combo = dbStore.getComboById(line.comboId);
        if (combo && combo.is_available === false) {
          return NextResponse.json(
            { error: `"${combo.name}" is sold out and cannot be ordered.` },
            { status: 400 }
          );
        }
      }
    }

    dbStore.openTableSession(tableId);

    const { order, items: createdItems } = dbStore.placeOrder({
      tableId,
      source: 'waiter',
      waiterId: session?.userId,
      notes: notes || '',
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
  } catch (err: any) {
    console.error('Waiter add order error:', err);
    const isUnavailable = err.message && err.message.toLowerCase().includes('unavailable');
    return NextResponse.json(
      { error: err.message || 'Failed to place order' },
      { status: isUnavailable ? 400 : 500 }
    );
  }
}
