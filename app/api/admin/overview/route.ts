import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerStaffSession();
    // Strictly owner
    if (session && session.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      const { data: bills } = await supabase.from('bills').select('*');
      const { data: orders } = await supabase.from('orders').select('*');
      const { data: items } = await supabase.from('order_items').select('*');

      const billList = bills || [];
      const totalRevenuePaise = billList.reduce((sum, b) => sum + (b.final_paise || 0), 0);
      const cashPaise = billList.filter(b => b.payment_method === 'cash').reduce((sum, b) => sum + b.final_paise, 0);
      const upiPaise = billList.filter(b => b.payment_method === 'upi').reduce((sum, b) => sum + b.final_paise, 0);
      const cardPaise = billList.filter(b => b.payment_method === 'card').reduce((sum, b) => sum + b.final_paise, 0);

      // Top items
      const itemMap = new Map<string, { name: string; count: number; revenuePaise: number }>();
      (items || []).forEach(it => {
        const cur = itemMap.get(it.item_name) || { name: it.item_name, count: 0, revenuePaise: 0 };
        cur.count += it.quantity;
        cur.revenuePaise += (it.price_paise || 0) * it.quantity;
        itemMap.set(it.item_name, cur);
      });

      const topItems = Array.from(itemMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return NextResponse.json({
        totalRevenuePaise,
        totalOrdersCount: (orders || []).length,
        settledBillsCount: billList.length,
        breakdown: { cashPaise, upiPaise, cardPaise },
        topItems,
      });
    } else {
      const billList = dbStore.bills;
      const totalRevenuePaise = billList.reduce((sum, b) => sum + b.final_paise, 0);
      const cashPaise = billList.filter(b => b.payment_method === 'cash').reduce((sum, b) => sum + b.final_paise, 0);
      const upiPaise = billList.filter(b => b.payment_method === 'upi').reduce((sum, b) => sum + b.final_paise, 0);
      const cardPaise = billList.filter(b => b.payment_method === 'card').reduce((sum, b) => sum + b.final_paise, 0);

      const itemMap = new Map<string, { name: string; count: number; revenuePaise: number }>();
      dbStore.orderItems.forEach(it => {
        const cur = itemMap.get(it.item_name) || { name: it.item_name, count: 0, revenuePaise: 0 };
        cur.count += it.quantity;
        cur.revenuePaise += (it.price_paise || 0) * it.quantity;
        itemMap.set(it.item_name, cur);
      });

      const topItems = Array.from(itemMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return NextResponse.json({
        totalRevenuePaise,
        totalOrdersCount: dbStore.orders.length,
        settledBillsCount: billList.length,
        breakdown: { cashPaise, upiPaise, cardPaise },
        topItems,
      });
    }
  } catch (err: any) {
    console.error('Admin overview error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch overview' }, { status: 500 });
  }
}
