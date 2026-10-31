import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerStaffSession();
    if (session && !['owner', 'waiter'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { tableId, paymentMethod = 'upi', discountPaise = 0 } = body;

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      try {
        // 1. Get dining table
        const { data: diningTable } = await (supabase as any)
          .from('dining_tables')
          .select('*')
          .eq('id', tableId)
          .maybeSingle();

        if (diningTable) {
          // 2. Find open or billed session
          const { data: tableSession } = await (supabase as any)
            .from('table_sessions')
            .select('*')
            .eq('table_id', tableId)
            .in('status', ['open', 'billed'])
            .order('opened_at', { ascending: false })
            .maybeSingle();

          if (tableSession) {
            // 3. Find non-cancelled orders for this session with order lines
            const { data: orders } = await (supabase as any)
              .from('orders')
              .select(`
                id,
                status,
                order_lines:order_lines (
                  id,
                  name_snapshot,
                  price_snapshot,
                  quantity
                )
              `)
              .eq('session_id', tableSession.id)
              .neq('status', 'cancelled');

            // 4. Calculate subtotal & grouped lines
            let subtotal = 0;
            const groupedMap = new Map<string, { name: string; price: number; quantity: number }>();

            for (const o of orders || []) {
              for (const l of o.order_lines || []) {
                const linePrice = l.price_snapshot || 0;
                const lineQty = l.quantity || 1;
                subtotal += linePrice * lineQty;

                const key = `${l.name_snapshot}_${linePrice}`;
                const existing = groupedMap.get(key);
                if (existing) {
                  existing.quantity += lineQty;
                } else {
                  groupedMap.set(key, {
                    name: l.name_snapshot,
                    price: linePrice,
                    quantity: lineQty,
                  });
                }
              }
            }

            const groupedLines = Array.from(groupedMap.values());

            // 5. Query tax settings
            const { data: settings } = await (supabase as any)
              .from('settings')
              .select('*')
              .eq('id', 1)
              .maybeSingle();

            const taxPercent = Number(settings?.tax_percent ?? 5);
            const taxAmount = Math.round((subtotal * taxPercent) / 100);
            const total = Math.max(0, subtotal + taxAmount - discountPaise);

            // 6. Generate next daily bill number
            let billNoStr = '0001';
            try {
              const { data: generatedNo } = await (supabase as any).rpc('generate_daily_bill_no');
              if (generatedNo) billNoStr = generatedNo;
            } catch {
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              const { count } = await (supabase as any)
                .from('bills')
                .select('*', { count: 'exact', head: true })
                .gte('paid_at', todayStart.toISOString());
              billNoStr = String((count || 0) + 1).padStart(4, '0');
            }

            // 7. Insert bill record
            const { data: bill, error: bErr } = await (supabase as any)
              .from('bills')
              .insert({
                session_id: tableSession.id,
                bill_no: billNoStr,
                table_label: diningTable.label,
                subtotal,
                tax_percent: taxPercent,
                tax_amount: taxAmount,
                total,
                payment_method: paymentMethod,
                gstin: settings?.gstin || null,
                status: 'paid',
                created_by: session?.userId || null,
                paid_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (!bErr && bill) {
              // 8. Close session and free table
              await (supabase as any)
                .from('table_sessions')
                .update({
                  status: 'closed',
                  closed_at: new Date().toISOString(),
                })
                .eq('id', tableSession.id);

              logAudit({
                action: 'SETTLE_BILL',
                actorId: session?.userId,
                actorName: session?.fullName,
                actorRole: session?.role,
                targetId: `Bill #${billNoStr}`,
                details: {
                  tableId,
                  tableLabel: diningTable.label,
                  totalPaise: total,
                  paymentMethod,
                },
              });

              return NextResponse.json({
                success: true,
                bill: {
                  ...bill,
                  bill_number: bill.bill_no,
                  subtotal_paise: bill.subtotal,
                  tax_paise: bill.tax_amount,
                  final_paise: bill.total,
                  payment_method: bill.payment_method,
                  created_at: bill.paid_at,
                  paid_at: bill.paid_at,
                  table: {
                    table_number: `Table ${diningTable.label}`,
                    label: diningTable.label,
                  },
                  items: groupedLines.map(l => ({
                    item_name: l.name,
                    price_paise: l.price,
                    quantity: l.quantity,
                  })),
                  settings: {
                    restaurant_name: settings?.restaurant_name || 'Manasu Restaurant',
                    address: settings?.address || '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
                    phone: settings?.phone || '+91 80 2520 1980',
                    gstin: settings?.gstin || null,
                    tax_percent: taxPercent,
                    bill_footer: settings?.bill_footer || 'Thank you for dining at Manasu! Visit again.',
                    paper_width: settings?.paper_width || '80mm',
                  },
                },
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('Supabase bill settle error, falling back to dbStore:', err.message);
      }
    }

    // In-memory store fallback (Always succeeds)
    const bill = dbStore.settleBill({
      tableId,
      paymentMethod,
      discountPaise,
      settledBy: session?.userId,
    });

    // Close the table session and free the table
    dbStore.closeTableSession(tableId);

    // Group items in in-memory bill
    const groupedMap = new Map<string, { name: string; price: number; quantity: number }>();
    for (const it of bill.items || []) {
      const itemName = it.item_name || 'Item';
      const itemPrice = it.price_paise || 0;
      const key = `${itemName}_${itemPrice}`;
      const existing = groupedMap.get(key);
      if (existing) {
        existing.quantity += it.quantity;
      } else {
        groupedMap.set(key, {
          name: itemName,
          price: itemPrice,
          quantity: it.quantity,
        });
      }
    }

    logAudit({
      action: 'SETTLE_BILL',
      actorId: session?.userId,
      actorName: session?.fullName,
      actorRole: session?.role,
      targetId: `Bill #${bill.bill_number}`,
      details: {
        tableId,
        totalPaise: bill.final_paise,
        paymentMethod,
      },
    });

    return NextResponse.json({
      success: true,
      bill: {
        ...bill,
        bill_no: String(bill.bill_number).padStart(4, '0'),
        bill_number: String(bill.bill_number).padStart(4, '0'),
        paid_at: bill.created_at,
        items: Array.from(groupedMap.values()).map(l => ({
          item_name: l.name,
          price_paise: l.price,
          quantity: l.quantity,
        })),
        settings: {
          restaurant_name: 'Manasu Restaurant',
          address: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
          phone: '+91 80 2520 1980',
          gstin: '29AABCM8291Q1ZP',
          tax_percent: 5,
          bill_footer: 'Thank you for dining at Manasu! Visit again.',
          paper_width: '80mm',
        },
      },
    });
  } catch (err: any) {
    console.error('Bill settle/generate error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to mark bill paid' },
      { status: 500 }
    );
  }
}
