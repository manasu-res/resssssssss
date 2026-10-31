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

    const { tableId } = await req.json();
    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    if (supabase) {
      // 1. Verify dining table
      const { data: diningTable, error: dtErr } = await (supabase as any)
        .from('dining_tables')
        .select('*')
        .eq('id', tableId)
        .single();

      if (dtErr || !diningTable) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }

      // 2. Check if open session exists
      const { data: existingSession } = await (supabase as any)
        .from('table_sessions')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'open')
        .maybeSingle();

      if (existingSession) {
        return NextResponse.json({ success: true, session: existingSession });
      }

      // 3. Insert new open session
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

      if (sErr) throw sErr;

      return NextResponse.json({ success: true, session: newSession });
    } else {
      // Standalone / demo store
      const table = dbStore.getTableById(tableId);
      if (!table) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }

      const tableSession = dbStore.openTableSession(tableId);
      return NextResponse.json({ success: true, session: tableSession });
    }
  } catch (err: any) {
    console.error('Open table session error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to open table' },
      { status: 500 }
    );
  }
}
