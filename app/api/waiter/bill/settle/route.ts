import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

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

      // 4. Calculate subtotal
      let subtotal = 0;
      const allLines: any[] = [];
      for (const order of orders) {
        for (const line of order.order_lines || []) {
          subtotal += line.price_snapshot * line.quantity;
          allLines.push(line);
        }
      }

      // Fetch tax_percent from settings
      const { data: settings } = await (supabase as any)
        .from('settings')
        .select('tax_percent')
        .maybeSingle();

      const taxPercent = settings?.tax_percent ?? 5;
      const taxAmount = Math.round(subtotal * (taxPercent / 100));
      const total = Math.max(0, subtotal + taxAmount - discountPaise);

      // Generate daily bill number: count of bills today + 1
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: todayBillsCount } = await (supabase as any)
        .from('bills')
        .select('id', { count: 'exact', head: true })
        .gte('paid_at', todayStart.toISOString());

      const billNoNumber = (todayBillsCount || 0) + 1;
      const billNoStr = String(billNoNumber).padStart(4, '0');

      // Insert Bill
      const { data: bill, error: bErr } = await (supabase as any)
        .from('bills')
        .insert({
          session_id: tableSession.id,
          bill_no: billNoStr,
          subtotal,
          tax_amount: taxAmount,
          total,
          payment_method: paymentMethod,
          paid_at: new Date().toISOString(),
          created_by: session?.userId || null,
        })
        .select()
        .single();

      if (bErr) throw bErr;

      // Update table session status to 'billed'
      await (supabase as any)
        .from('table_sessions')
        .update({ status: 'billed' })
        .eq('id', tableSession.id);

      // Mark orders as served
      await (supabase as any)
        .from('orders')
        .update({ status: 'served' })
        .eq('session_id', tableSession.id)
        .neq('status', 'cancelled');

      return NextResponse.json({
        success: true,
        bill: {
          ...bill,
          bill_number: bill.bill_no,
          subtotal_paise: bill.subtotal,
          tax_paise: bill.tax_amount,
          final_paise: bill.total,
          table: {
            table_number: diningTable.label,
          },
          items: allLines.map(l => ({
            id: l.id,
            item_name: l.name_snapshot,
            price_paise: l.price_snapshot,
            quantity: l.quantity,
          })),
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

      return NextResponse.json({
        success: true,
        bill,
      });
    }
  } catch (err: any) {
    console.error('Bill settle/generate error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate bill' },
      { status: 500 }
    );
  }
}
