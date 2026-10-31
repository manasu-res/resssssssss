import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/data/store';
import { getServerStaffSession } from '@/lib/auth/session';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerStaffSession();
    if (session && !['owner', 'waiter'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tableId, resetToken } = await req.json();
    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      const updateData: any = { status: 'vacant' };
      if (resetToken) {
        const randomHex = Math.random().toString(36).substring(2, 8);
        updateData.active_token = `tbl-manasu-${randomHex}`;
      }

      const { data: table, error } = await supabase
        .from('restaurant_tables')
        .update(updateData)
        .eq('id', tableId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, table });
    } else {
      if (resetToken) {
        dbStore.resetTableToken(tableId);
      } else {
        dbStore.updateTableStatus(tableId, 'vacant');
      }
      const table = dbStore.getTableById(tableId);
      return NextResponse.json({ success: true, table });
    }
  } catch (err: any) {
    console.error('Vacate table error:', err);
    return NextResponse.json({ error: err.message || 'Failed to vacate table' }, { status: 500 });
  }
}
