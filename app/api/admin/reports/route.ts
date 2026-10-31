import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerStaffSession();
    if (session && session.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();

    // Default to last 7 days
    const defaultStart = new Date(now.getTime() - 6 * 24 * 3600000);
    const startDateParam = searchParams.get('startDate') || defaultStart.toISOString().split('T')[0];
    const endDateParam = searchParams.get('endDate') || now.toISOString().split('T')[0];

    const startDateTime = new Date(`${startDateParam}T00:00:00.000Z`);
    const endDateTime = new Date(`${endDateParam}T23:59:59.999Z`);

    // Today boundaries
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);

    const supabase = getServiceSupabase();

    if (supabase) {
      // 1. Fetch bills for range + today
      const { data: billsData, error: bErr } = await (supabase as any)
        .from('bills')
        .select(`
          id,
          session_id,
          bill_no,
          subtotal,
          tax_amount,
          total,
          payment_method,
          paid_at,
          created_by,
          is_cancelled,
          cancellation_reason,
          session:table_sessions (
            id,
            table:dining_tables (
              id,
              label
            ),
            orders:orders (
              id,
              order_lines:order_lines (
                id,
                name_snapshot,
                price_snapshot,
                quantity,
                combo_id
              )
            )
          )
        `)
        .order('paid_at', { ascending: false });

      if (bErr) throw bErr;
      const allBills = billsData || [];

      // Calculate today's sales
      const todayBills = allBills.filter((b: any) => {
        const d = new Date(b.paid_at);
        return d >= todayStart && d <= todayEnd && !b.is_cancelled;
      });

      const todayTotal = todayBills.reduce((s: number, b: any) => s + (b.total || 0), 0);
      const todayBillCount = todayBills.length;
      const todayAverage = todayBillCount > 0 ? Math.round(todayTotal / todayBillCount) : 0;

      const todaySplit = {
        cash: { count: 0, amount: 0 },
        upi: { count: 0, amount: 0 },
        card: { count: 0, amount: 0 },
      };
      for (const b of todayBills) {
        const method = (b.payment_method || 'upi').toLowerCase() as 'cash' | 'upi' | 'card';
        if (todaySplit[method]) {
          todaySplit[method].count += 1;
          todaySplit[method].amount += b.total || 0;
        }
      }

      // Filter range bills
      const rangeBills = allBills.filter((b: any) => {
        const d = new Date(b.paid_at);
        return d >= startDateTime && d <= endDateTime;
      });

      const rangeValidBills = rangeBills.filter((b: any) => !b.is_cancelled);
      const rangeTotal = rangeValidBills.reduce((s: number, b: any) => s + (b.total || 0), 0);
      const rangeBillCount = rangeValidBills.length;
      const rangeAverage = rangeBillCount > 0 ? Math.round(rangeTotal / rangeBillCount) : 0;

      const rangeSplit = {
        cash: { count: 0, amount: 0 },
        upi: { count: 0, amount: 0 },
        card: { count: 0, amount: 0 },
      };
      for (const b of rangeValidBills) {
        const method = (b.payment_method || 'upi').toLowerCase() as 'cash' | 'upi' | 'card';
        if (rangeSplit[method]) {
          rangeSplit[method].count += 1;
          rangeSplit[method].amount += b.total || 0;
        }
      }

      // Day-by-day table
      const dayMap = new Map<string, {
        date: string;
        billCount: number;
        subtotal: number;
        tax: number;
        totalSales: number;
        cash: number;
        upi: number;
        card: number;
      }>();

      for (const b of rangeValidBills) {
        const dateKey = new Date(b.paid_at).toISOString().split('T')[0];
        const cur = dayMap.get(dateKey) || {
          date: dateKey,
          billCount: 0,
          subtotal: 0,
          tax: 0,
          totalSales: 0,
          cash: 0,
          upi: 0,
          card: 0,
        };

        cur.billCount += 1;
        cur.subtotal += b.subtotal || 0;
        cur.tax += b.tax_amount || 0;
        cur.totalSales += b.total || 0;

        const m = (b.payment_method || 'upi').toLowerCase() as 'cash' | 'upi' | 'card';
        if (m === 'cash') cur.cash += b.total || 0;
        else if (m === 'upi') cur.upi += b.total || 0;
        else if (m === 'card') cur.card += b.total || 0;

        dayMap.set(dateKey, cur);
      }

      const dayByDay = Array.from(dayMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Top selling items and combos
      const itemAggMap = new Map<string, { name: string; type: 'Combo' | 'Item'; quantity: number; totalRevenue: number }>();

      for (const b of rangeValidBills) {
        const orders = b.session?.orders || [];
        for (const order of orders) {
          for (const line of order.order_lines || []) {
            const isCombo = Boolean(line.combo_id);
            const name = line.name_snapshot || 'Item';
            const price = line.price_snapshot || 0;
            const key = `${name}_${isCombo ? 'combo' : 'item'}`;

            const existing = itemAggMap.get(key) || {
              name,
              type: isCombo ? ('Combo' as const) : ('Item' as const),
              quantity: 0,
              totalRevenue: 0,
            };

            existing.quantity += line.quantity;
            existing.totalRevenue += price * line.quantity;
            itemAggMap.set(key, existing);
          }
        }
      }

      const topSelling = Array.from(itemAggMap.values())
        .sort((a, b) => b.quantity - a.quantity || b.totalRevenue - a.totalRevenue)
        .slice(0, 15);

      // Bills list with summary
      const billsList = rangeBills.map((b: any) => {
        const tableLabel = b.session?.table?.label ? `Table ${b.session.table.label}` : 'Table';
        const orders = b.session?.orders || [];
        const lines: any[] = [];
        for (const o of orders) {
          for (const l of o.order_lines || []) {
            lines.push(l);
          }
        }

        return {
          id: b.id,
          bill_no: b.bill_no,
          table_number: tableLabel,
          paid_at: b.paid_at,
          payment_method: b.payment_method,
          subtotal: b.subtotal || 0,
          tax_amount: b.tax_amount || 0,
          total: b.total || 0,
          is_cancelled: Boolean(b.is_cancelled),
          items_count: lines.reduce((s, l) => s + (l.quantity || 1), 0),
          items_summary: lines.map(l => `${l.quantity}x ${l.name_snapshot}`).join(', '),
        };
      });

      // Cancelled or rejected orders list
      const { data: cancelledOrdersData } = await (supabase as any)
        .from('orders')
        .select(`
          id,
          source,
          created_at,
          rejection_reason,
          notes,
          session:table_sessions (
            id,
            table:dining_tables (
              label
            )
          ),
          order_lines:order_lines (
            name_snapshot,
            quantity
          )
        `)
        .eq('status', 'cancelled')
        .gte('created_at', startDateTime.toISOString())
        .lte('created_at', endDateTime.toISOString())
        .order('created_at', { ascending: false });

      const cancelledOrders = (cancelledOrdersData || []).map((o: any) => ({
        id: o.id,
        order_number: o.id.slice(-4).toUpperCase(),
        table_number: o.session?.table?.label ? `Table ${o.session.table.label}` : 'Table',
        created_at: o.created_at,
        source: o.source,
        reason: o.rejection_reason || o.notes || 'Cancelled by staff',
        items: (o.order_lines || []).map((l: any) => ({
          name: l.name_snapshot,
          quantity: l.quantity,
        })),
      }));

      return NextResponse.json({
        today: {
          total: todayTotal,
          billCount: todayBillCount,
          average: todayAverage,
          split: todaySplit,
        },
        range: {
          startDate: startDateParam,
          endDate: endDateParam,
          total: rangeTotal,
          billCount: rangeBillCount,
          average: rangeAverage,
          split: rangeSplit,
        },
        dayByDay,
        topSelling,
        bills: billsList,
        cancelledOrders,
      });
    } else {
      // In-memory store
      const allBills = dbStore.bills;

      // Today
      const todayBills = allBills.filter(b => {
        const d = new Date(b.created_at);
        return d >= todayStart && d <= todayEnd && !b.is_cancelled;
      });

      const todayTotal = todayBills.reduce((s, b) => s + b.final_paise, 0);
      const todayBillCount = todayBills.length;
      const todayAverage = todayBillCount > 0 ? Math.round(todayTotal / todayBillCount) : 0;

      const todaySplit = {
        cash: { count: 0, amount: 0 },
        upi: { count: 0, amount: 0 },
        card: { count: 0, amount: 0 },
      };
      for (const b of todayBills) {
        const m = b.payment_method as 'cash' | 'upi' | 'card';
        if (todaySplit[m]) {
          todaySplit[m].count += 1;
          todaySplit[m].amount += b.final_paise;
        }
      }

      // Range
      const rangeBills = allBills.filter(b => {
        const d = new Date(b.created_at);
        return d >= startDateTime && d <= endDateTime;
      });

      const rangeValidBills = rangeBills.filter(b => !b.is_cancelled);
      const rangeTotal = rangeValidBills.reduce((s, b) => s + b.final_paise, 0);
      const rangeBillCount = rangeValidBills.length;
      const rangeAverage = rangeBillCount > 0 ? Math.round(rangeTotal / rangeBillCount) : 0;

      const rangeSplit = {
        cash: { count: 0, amount: 0 },
        upi: { count: 0, amount: 0 },
        card: { count: 0, amount: 0 },
      };
      for (const b of rangeValidBills) {
        const m = b.payment_method as 'cash' | 'upi' | 'card';
        if (rangeSplit[m]) {
          rangeSplit[m].count += 1;
          rangeSplit[m].amount += b.final_paise;
        }
      }

      // Day by day
      const dayMap = new Map<string, any>();
      for (const b of rangeValidBills) {
        const dateKey = new Date(b.created_at).toISOString().split('T')[0];
        const cur = dayMap.get(dateKey) || {
          date: dateKey,
          billCount: 0,
          subtotal: 0,
          tax: 0,
          totalSales: 0,
          cash: 0,
          upi: 0,
          card: 0,
        };

        cur.billCount += 1;
        cur.subtotal += b.subtotal_paise;
        cur.tax += b.tax_paise;
        cur.totalSales += b.final_paise;

        if (b.payment_method === 'cash') cur.cash += b.final_paise;
        else if (b.payment_method === 'upi') cur.upi += b.final_paise;
        else if (b.payment_method === 'card') cur.card += b.final_paise;

        dayMap.set(dateKey, cur);
      }

      const dayByDay = Array.from(dayMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Top selling
      const itemAggMap = new Map<string, any>();
      for (const b of rangeValidBills) {
        for (const it of b.items || []) {
          const itemName = it.item_name || (it as any).name || 'Item';
          const itemPrice = it.price_paise ?? (it as any).price ?? 0;
          const isCombo = itemName.toLowerCase().includes('combo') || itemName.toLowerCase().includes('feast');
          const key = `${itemName}_${isCombo ? 'combo' : 'item'}`;
          const existing = itemAggMap.get(key) || {
            name: itemName,
            type: isCombo ? 'Combo' : 'Item',
            quantity: 0,
            totalRevenue: 0,
          };
          existing.quantity += it.quantity;
          existing.totalRevenue += itemPrice * it.quantity;
          itemAggMap.set(key, existing);
        }
      }

      const topSelling = Array.from(itemAggMap.values())
        .sort((a, b) => b.quantity - a.quantity || b.totalRevenue - a.totalRevenue)
        .slice(0, 15);

      // Bills list
      const billsList = rangeBills.map(b => ({
        id: b.id,
        bill_no: String(b.bill_number).padStart(4, '0'),
        table_number: b.table?.table_number || 'Table',
        paid_at: b.created_at,
        payment_method: b.payment_method,
        subtotal: b.subtotal_paise,
        tax_amount: b.tax_paise,
        total: b.final_paise,
        is_cancelled: Boolean(b.is_cancelled),
        items_count: (b.items || []).reduce((s, i) => s + i.quantity, 0),
        items_summary: (b.items || []).map(i => `${i.quantity}x ${i.item_name || (i as any).name || 'Item'}`).join(', '),
      }));

      // Cancelled orders
      const cancelledOrders = dbStore.orders
        .filter(o => o.status === 'cancelled')
        .map(o => {
          const table = dbStore.getTableById(o.table_id);
          const items = dbStore.orderItems.filter(i => i.order_id === o.id);
          return {
            id: o.id,
            order_number: `#${o.order_number}`,
            table_number: table ? table.table_number : 'Table',
            created_at: o.created_at,
            source: o.source,
            reason: o.notes || 'Item out of stock / Customer cancelled',
            items: items.map(i => ({ name: i.item_name, quantity: i.quantity })),
          };
        });

      return NextResponse.json({
        today: {
          total: todayTotal,
          billCount: todayBillCount,
          average: todayAverage,
          split: todaySplit,
        },
        range: {
          startDate: startDateParam,
          endDate: endDateParam,
          total: rangeTotal,
          billCount: rangeBillCount,
          average: rangeAverage,
          split: rangeSplit,
        },
        dayByDay,
        topSelling,
        bills: billsList,
        cancelledOrders,
      });
    }
  } catch (err: any) {
    console.error('Reports fetch error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate reports' },
      { status: 500 }
    );
  }
}
