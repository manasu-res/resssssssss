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
      try {
        // 1. Verify dining table in Supabase
        const { data: diningTable } = await (supabase as any)
          .from('dining_tables')
          .select('*')
          .eq('id', tableId)
          .maybeSingle();

        if (diningTable) {
          // 2. Check if open session exists
          const { data: existingSession } = await (supabase as any)
            .from('table_sessions')
            .select('*')
            .eq('table_id', tableId)
            .eq('status', 'open')
            .maybeSingle();

          if (existingSession) {
            let accessCode = existingSession.access_code;
            if (!accessCode) {
              accessCode = Math.floor(1000 + Math.random() * 9000).toString();
              await (supabase as any)
                .from('table_sessions')
                .update({ access_code: accessCode, code_attempts: 0 })
                .eq('id', existingSession.id);
              existingSession.access_code = accessCode;
            }
            return NextResponse.json({ success: true, session: existingSession });
          }

          // 3. Insert new open session with random 4-digit access code
          const newAccessCode = Math.floor(1000 + Math.random() * 9000).toString();
          const { data: newSession, error: sErr } = await (supabase as any)
            .from('table_sessions')
            .insert({
              table_id: tableId,
              status: 'open',
              access_code: newAccessCode,
              code_attempts: 0,
              opened_by: session?.userId || null,
              opened_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!sErr && newSession) {
            return NextResponse.json({ success: true, session: newSession });
          }
        }
      } catch (err: any) {
        console.warn('Supabase open table session failed, using store fallback:', err.message);
      }
    }

    // Reliable fallback to dbStore
    let table = dbStore.getTableById(tableId);
    if (!table) {
      // Find by matching label or index
      table = dbStore.tables.find(t => t.id === tableId || t.table_number.toLowerCase().includes(tableId.toLowerCase()));
      if (!table) {
        table = {
          id: tableId,
          table_number: tableId.startsWith('tbl') ? tableId : `Table ${tableId}`,
          seat_capacity: 4,
          active_token: `mnsu_tbl_${tableId}`,
          status: 'vacant',
          is_active: true,
          created_at: new Date().toISOString(),
        };
        dbStore.tables.push(table);
      }
    }

    const tableSession = dbStore.openTableSession(table.id);
    return NextResponse.json({ success: true, session: tableSession });
  } catch (err: any) {
    console.error('Open table session error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to open table' },
      { status: 500 }
    );
  }
}
