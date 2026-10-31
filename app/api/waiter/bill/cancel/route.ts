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

    const { billId, reason } = await req.json();
    if (!billId || !reason) {
      return NextResponse.json({ error: 'billId and cancellation reason are required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const now = new Date().toISOString();

    if (supabase) {
      const { data: cancelledBill, error: bErr } = await (supabase as any)
        .from('bills')
        .update({
          is_cancelled: true,
          cancelled_by: session?.userId || null,
          cancellation_reason: reason,
          cancelled_at: now,
        })
        .eq('id', billId)
        .select()
        .single();

      if (bErr) throw bErr;
      return NextResponse.json({ success: true, bill: cancelledBill });
    } else {
      const bill = dbStore.bills.find(b => b.id === billId || String(b.bill_number) === billId);
      if (!bill) {
        return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
      }

      bill.is_cancelled = true;
      bill.cancelled_by = session?.userId || 'staff';
      bill.cancellation_reason = reason;
      bill.cancelled_at = now;

      return NextResponse.json({ success: true, bill });
    }
  } catch (err: any) {
    console.error('Cancel bill error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to cancel bill' },
      { status: 500 }
    );
  }
}
