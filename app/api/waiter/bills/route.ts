import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerStaffSession();
    if (session && !['owner', 'waiter'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      // 1. Fetch settings
      const { data: settings } = await (supabase as any)
        .from('settings')
        .select('*')
        .maybeSingle();

      // 2. Fetch bills with sessions and tables
      const { data: bills, error: bErr } = await (supabase as any)
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
                quantity
              )
            )
          )
        `)
        .order('paid_at', { ascending: false })
        .limit(50);

      if (bErr) throw bErr;

      const formattedBills = (bills || []).map((b: any) => {
        const tableLabel = b.session?.table?.label ? `Table ${b.session.table.label}` : 'Table';
        const orders = b.session?.orders || [];

        // Group line items
        const groupedMap = new Map<string, { name: string; price: number; quantity: number }>();
        for (const order of orders) {
          for (const line of order.order_lines || []) {
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

        return {
          id: b.id,
          bill_no: b.bill_no,
          bill_number: b.bill_no,
          subtotal_paise: b.subtotal,
          tax_paise: b.tax_amount,
          final_paise: b.total,
          payment_method: b.payment_method,
          created_at: b.paid_at,
          paid_at: b.paid_at,
          table: {
            table_number: tableLabel,
            label: b.session?.table?.label || '',
          },
          items: Array.from(groupedMap.values()).map(l => ({
            item_name: l.name,
            price_paise: l.price,
            quantity: l.quantity,
          })),
          settings: {
            restaurant_name: settings?.restaurant_name || 'Manasu Restaurant',
            address: settings?.address || '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
            phone: settings?.phone || '+91 80 2520 1980',
            gstin: settings?.gstin || null,
            tax_percent: settings?.tax_percent || 5,
            bill_footer: settings?.bill_footer || 'Thank you for dining at Manasu! Visit again.',
            paper_width: settings?.paper_width || '80mm',
          },
        };
      });

      return NextResponse.json({ bills: formattedBills });
    } else {
      // In-memory store
      const bills = dbStore.bills.map(b => ({
        ...b,
        bill_no: String(b.bill_number).padStart(4, '0'),
        bill_number: String(b.bill_number).padStart(4, '0'),
        paid_at: b.created_at,
        settings: {
          restaurant_name: 'Manasu Restaurant',
          address: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
          phone: '+91 80 2520 1980',
          gstin: '29AABCM8291Q1ZP',
          tax_percent: 5,
          bill_footer: 'Thank you for dining at Manasu! Visit again.',
          paper_width: '80mm',
        },
      }));

      return NextResponse.json({ bills });
    }
  } catch (err: any) {
    console.error('Fetch bills error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch bills' },
      { status: 500 }
    );
  }
}
