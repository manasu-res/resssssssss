import { getServiceSupabase } from '@/lib/supabase/service';
import { dbStore } from '@/lib/data/store';
import { getActiveTableCode } from '@/lib/auth/table-codes';

export interface ResolvedTable {
  id: string;
  label: string; // e.g. "Table 3"
  cleanNumber: string; // e.g. "3"
  qr_token: string;
  is_enabled: boolean;
  source: 'supabase' | 'store';
}

export interface ResolvedSession {
  id: string;
  table_id: string;
  status: 'open' | 'billed' | 'closed';
  access_code?: string;
  code_attempts: number;
  code_locked_until?: string | null;
  opened_at: string;
  closed_at?: string | null;
  source: 'supabase' | 'store';
}

/**
 * Resolves a dining table from any identifier:
 * - qr_token (e.g. tbl-manasu-03, mnsu_tbl_...)
 * - table ID (e.g. table-03, UUID)
 * - table label (e.g. "Table 3", "3")
 * - URL encoded parameter
 */
export async function resolveDiningTable(rawToken: string): Promise<ResolvedTable | null> {
  if (!rawToken) return null;
  const token = decodeURIComponent(rawToken).trim();
  const digitsMatch = token.match(/\d+/);
  const num = digitsMatch ? parseInt(digitsMatch[0], 10) : null;

  const supabase = getServiceSupabase();

  if (supabase) {
    try {
      // 1. Try matching by qr_token
      let { data: table } = await (supabase as any)
        .from('dining_tables')
        .select('*')
        .eq('qr_token', token)
        .maybeSingle();

      // 2. Try matching by id
      if (!table) {
        const { data: byId } = await (supabase as any)
          .from('dining_tables')
          .select('*')
          .eq('id', token)
          .maybeSingle();
        if (byId) table = byId;
      }

      // 3. Try matching by label (e.g. "Table 3" or "3")
      if (!table) {
        const { data: byLabel } = await (supabase as any)
          .from('dining_tables')
          .select('*')
          .or(`label.eq.${token},label.eq.Table ${token}`)
          .maybeSingle();
        if (byLabel) table = byLabel;
      }

      // 4. Try matching by numeric digit if present
      if (!table && num !== null) {
        const { data: byNum } = await (supabase as any)
          .from('dining_tables')
          .select('*')
          .or(`label.eq.${num},label.eq.Table ${num}`)
          .maybeSingle();
        if (byNum) table = byNum;
      }

      if (table) {
        const rawLabel = (table.label || `Table ${num || table.id}`).toString().trim();
        const cleanNumber = rawLabel.replace(/^table\s*/i, '').trim();
        const displayLabel = rawLabel.toLowerCase().startsWith('table')
          ? rawLabel
          : `Table ${rawLabel}`;

        return {
          id: table.id,
          label: displayLabel,
          cleanNumber: cleanNumber || String(num || 1),
          qr_token: table.qr_token || token,
          is_enabled: table.is_enabled !== false,
          source: 'supabase',
        };
      }
    } catch (err: any) {
      console.warn('Supabase resolveDiningTable error, falling back to local store:', err.message);
    }
  }

  // Fallback: in-memory / dbStore
  const match = dbStore.tables.find(t => {
    if (t.active_token === token || t.id === token) return true;
    if (t.table_number.toLowerCase() === token.toLowerCase()) return true;
    if (t.table_number.toLowerCase() === `table ${token}`.toLowerCase()) return true;
    if (t.table_number.toLowerCase().replace(/^table\s*/i, '') === token.toLowerCase()) return true;
    if (num !== null) {
      const tDigits = t.table_number.replace(/\D/g, '') || t.id.replace(/\D/g, '');
      if (tDigits && parseInt(tDigits, 10) === num) return true;
    }
    return false;
  });

  if (match) {
    const rawLabel = match.table_number.trim();
    const cleanNumber = rawLabel.replace(/^table\s*/i, '').trim();
    const displayLabel = rawLabel.toLowerCase().startsWith('table')
      ? rawLabel
      : `Table ${rawLabel}`;

    return {
      id: match.id,
      label: displayLabel,
      cleanNumber: cleanNumber || '1',
      qr_token: match.active_token,
      is_enabled: match.is_active !== false,
      source: 'store',
    };
  }

  return null;
}

/**
 * Resolves an active / open session for a given table.
 */
export async function resolveOpenSession(table: ResolvedTable): Promise<ResolvedSession | null> {
  const supabase = getServiceSupabase();

  if (supabase && table.source === 'supabase') {
    try {
      const { data: sessionList, error: sErr } = await (supabase as any)
        .from('table_sessions')
        .select('*')
        .eq('table_id', table.id)
        .in('status', ['open', 'billed'])
        .order('opened_at', { ascending: false })
        .limit(1);

      const session = !sErr && sessionList && sessionList.length > 0 ? sessionList[0] : null;

      if (session) {
        // 4-hour auto-close check
        const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
        if (Date.now() - new Date(session.opened_at).getTime() > FOUR_HOURS_MS) {
          await (supabase as any)
            .from('table_sessions')
            .update({ status: 'closed', closed_at: new Date().toISOString() })
            .eq('id', session.id);
          return null;
        }

        const { code } = getActiveTableCode(table.id, session.id);
        return {
          id: session.id,
          table_id: session.table_id,
          status: session.status,
          access_code: session.access_code || code,
          code_attempts: session.code_attempts || 0,
          code_locked_until: session.code_locked_until || null,
          opened_at: session.opened_at,
          closed_at: session.closed_at,
          source: 'supabase',
        };
      }
    } catch (err: any) {
      console.warn('Supabase resolveOpenSession error, trying dbStore:', err.message);
    }
  }

  // Check dbStore
  let memSession = dbStore.getOpenSessionForTable(table.id);
  if (!memSession && table.cleanNumber) {
    const storeTable = dbStore.tables.find(t => {
      const tDigits = t.table_number.replace(/\D/g, '') || t.id.replace(/\D/g, '');
      return tDigits === table.cleanNumber;
    });
    if (storeTable) {
      memSession = dbStore.getOpenSessionForTable(storeTable.id);
    }
  }

  if (memSession) {
    const { code } = getActiveTableCode(table.id, memSession.id);
    return {
      id: memSession.id,
      table_id: memSession.table_id,
      status: memSession.status,
      access_code: memSession.access_code || code,
      code_attempts: memSession.code_attempts || 0,
      code_locked_until: memSession.code_locked_until || null,
      opened_at: memSession.opened_at,
      closed_at: memSession.closed_at,
      source: 'store',
    };
  }

  return null;
}
