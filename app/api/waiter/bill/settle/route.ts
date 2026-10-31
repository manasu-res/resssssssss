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
      // 1. Get dining table
      const { data: diningTable, error: dtErr } = await (supabase as any)
        .from('dining_tables')
        .select('*')
        .eq('id', tableId)
        .single();

      if (dtErr || !diningTable) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }

      // 2. Find open or billed session
      const { data: tableSession, error: sErr } = await (supabase as any)
        .from('table_sessions')
        .select('*')
        .eq('table_id', tableId)
        .in('status', ['open', 'billed'])
        .order('opened_at', { ascending: false })
        .maybeSingle();

      if (sErr || !tableSession) {
        return NextResponse.json({ error: 'No active session found for this table' }, { status: 400 });
      }

      // 3. Find non-cancelled orders for this session with order lines
      const { data: orders, error: oErr } = await (supabase as any)
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

      if (oErr || !orders || orders.length === 0) {
        return NextResponse.json({ error: 'No active orders on this table to bill' }, { status: 400 });
      }

      // 4. Calculate subtotal & group identical items
      let subtotal = 0;
      const groupedMap = new Map<string, { name: string; price: number; quantity: number }>();

      for (const order of orders) {
        for (const line of order.order_lines || []) {
          const itemTotal = line.price_snapshot * line.quantity;
          subtotal += itemTotal;

          const key = `${line.name_snapshot}_${line.price_snapshot}`;
          const existing = groupedMap.get(key);
          if (existing) {
            existing.quantity += line.quantity;
          } else {
            groupedMap.set(key, {
              name: line.name_snapshot,
              price: line.price_snapshot,
              quantity: line.quantity,
            });
          }
        }
      }

      const groupedLines = Array.from(groupedMap.values());

      // 5. Fetch settings for restaurant name, address, phone, GSTIN, tax_percent, bill_footer
      const { data: settings } = await (supabase as any)
        .from('settings')
        .select('*')
        .maybeSingle();

      const taxPercent = settings?.tax_percent ?? 5;
      const taxAmount = Math.round(subtotal * (taxPercent / 100));
      const total = Math.max(0, subtotal + taxAmount - discountPaise);

      // 6. Generate daily-resetting bill number: count of bills today + 1 (e.g. 0001, 0002)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: todayBillsCount } = await (supabase as any)
        .from('bills')
        .select('id', { count: 'exact', head: true })
        .gte('paid_at', todayStart.toISOString());

      const billNoNumber = (todayBillsCount || 0) + 1;
      const billNoStr = String(billNoNumber).padStart(4, '0');

      const now = new Date().toISOString();

      // 7. Insert immutable bill row
      const { data: bill, error: bErr } = await (supabase as any)
        .from('bills')
        .insert({
          session_id: tableSession.id,
          bill_no: billNoStr,
          subtotal,
          tax_amount: taxAmount,
          total,
          payment_method: paymentMethod,
          paid_at: now,
          created_by: session?.userId || null,
        })
        .select()
        .single();

      if (bErr) throw bErr;

      // 8. Close the table session and free the table
      await (supabase as any)
        .from('table_sessions')
        .update({
          status: 'closed',
          closed_at: now,
        })
        .eq('id', tableSession.id);

      // Mark orders as served
      await (supabase as any)
        .from('orders')
        .update({ status: 'served' })
        .eq('session_id', tableSession.id)
        .neq('status', 'cancelled');

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
    } else {
      // In-memory store
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
    }
  } catch (err: any) {
    console.error('Bill settle/generate error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to mark bill paid' },
      { status: 500 }
    );
  }
}
