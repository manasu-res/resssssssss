import { NextRequest, NextResponse } from 'next/server';
import { settleBillSchema } from '@/lib/validation';
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
    const parse = settleBillSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { tableId, paymentMethod, discountPaise } = parse.data;
    const supabase = getServiceSupabase();

    if (supabase) {
      const { data: table, error: tErr } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('id', tableId)
        .single();

      if (tErr || !table) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }

      // Fetch active table orders
      const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('table_id', tableId)
        .neq('status', 'cancelled');

      if (oErr || !orders || orders.length === 0) {
        return NextResponse.json({ error: 'No active orders to bill for this table' }, { status: 400 });
      }

      const subtotalPaise = orders.reduce((sum, o) => sum + (o.total_paise || 0), 0);
      const taxPaise = Math.round(subtotalPaise * 0.05);
      const finalPaise = Math.max(0, subtotalPaise + taxPaise - discountPaise);

      // Create bill
      const { data: bill, error: bErr } = await supabase
        .from('bills')
        .insert({
          table_id: tableId,
          subtotal_paise: subtotalPaise,
          tax_paise: taxPaise,
          discount_paise: discountPaise,
          final_paise: finalPaise,
          payment_method: paymentMethod,
          settled_by: session?.userId || null,
        })
        .select()
        .single();

      if (bErr) throw bErr;

      // Link bill with orders
      const billOrderRows = orders.map(o => ({
        bill_id: bill.id,
        order_id: o.id,
      }));
      await supabase.from('bill_orders').insert(billOrderRows);

      // Mark orders as served
      await supabase
        .from('orders')
        .update({ status: 'served' })
        .eq('table_id', tableId)
        .neq('status', 'cancelled');

      // Mark table as billed
      await supabase
        .from('restaurant_tables')
        .update({ status: 'billed' })
        .eq('id', tableId);

      const allItems = orders.flatMap(o => o.items || []);

      return NextResponse.json({
        success: true,
        bill: {
          ...bill,
          table,
          items: allItems,
        },
      });
    } else {
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
    console.error('Settle bill error:', err);
    return NextResponse.json({ error: err.message || 'Failed to settle bill' }, { status: 500 });
  }
}
