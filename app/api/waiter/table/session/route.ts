import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffApiRoute } from '@/lib/auth/guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { dbStore } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner', 'waiter']);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');
    const sessionId = searchParams.get('sessionId');

    if (!tableId && !sessionId) {
      return NextResponse.json({ error: 'tableId or sessionId is required' }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();

    try {
      let query = (serviceSupabase as any)
        .from('table_sessions')
        .select('id, table_id, status, access_code, code_attempts, code_locked_until, opened_at')
        .eq('status', 'open');

      if (sessionId) {
        query = query.eq('id', sessionId);
      } else if (tableId) {
        query = query.eq('table_id', tableId);
      }

      const { data: session, error } = await query.order('opened_at', { ascending: false }).limit(1).maybeSingle();

      if (error || !session) {
        // Fallback to in-memory store
        const memSession = sessionId
          ? dbStore.sessions.find(s => s.id === sessionId && s.status === 'open')
          : dbStore.sessions.find(s => s.table_id === tableId && s.status === 'open');

        if (!memSession) {
          return NextResponse.json({ error: 'No active session found' }, { status: 404 });
        }

        const activeDevices = (dbStore.devices || []).filter(
          d => d.session_id === memSession.id && d.is_active
        );

        return NextResponse.json({
          session: {
            id: memSession.id,
            tableId: memSession.table_id,
            accessCode: memSession.access_code || '1234',
            codeAttempts: memSession.code_attempts || 0,
            devices: activeDevices.map(d => ({
              id: d.id,
              deviceId: d.device_id,
              deviceName: d.device_name || 'Customer Phone',
              joinedAt: d.joined_at,
            })),
          },
        });
      }

      // Ensure access code exists
      let accessCode = session.access_code;
      if (!accessCode) {
        accessCode = Math.floor(1000 + Math.random() * 9000).toString();
        try {
          await (serviceSupabase as any)
            .from('table_sessions')
            .update({ access_code: accessCode, code_attempts: 0 })
            .eq('id', session.id);
          session.access_code = accessCode;
        } catch (updErr) {
          console.warn('Failed to backfill access_code:', updErr);
        }
      }

      // Fetch active devices from table_session_devices
      const { data: devices } = await (serviceSupabase as any)
        .from('table_session_devices')
        .select('id, device_id, device_name, joined_at, is_active')
        .eq('session_id', session.id)
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

      return NextResponse.json({
        session: {
          id: session.id,
          tableId: session.table_id,
          accessCode: accessCode,
          codeAttempts: session.code_attempts || 0,
          codeLockedUntil: session.code_locked_until,
          devices: (devices || []).map((d: any) => ({
            id: d.id,
            deviceId: d.device_id,
            deviceName: d.device_name || 'Customer Phone',
            joinedAt: d.joined_at,
          })),
        },
      });
    } catch {
      // In-memory fallback
      const memSession = sessionId
        ? dbStore.sessions.find(s => s.id === sessionId && s.status === 'open')
        : dbStore.sessions.find(s => s.table_id === tableId && s.status === 'open');

      if (!memSession) {
        return NextResponse.json({ error: 'No active session found' }, { status: 404 });
      }

      const activeDevices = (dbStore.devices || []).filter(
        d => d.session_id === memSession.id && d.is_active
      );

      return NextResponse.json({
        session: {
          id: memSession.id,
          tableId: memSession.table_id,
          accessCode: memSession.access_code || '1234',
          devices: activeDevices.map(d => ({
            id: d.id,
            deviceId: d.device_id,
            deviceName: d.device_name || 'Customer Phone',
            joinedAt: d.joined_at,
          })),
        },
      });
    }
  } catch (err: any) {
    console.error('Fetch table session details error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch session' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await verifyStaffApiRoute(['owner', 'waiter']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { action, sessionId, deviceId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const serviceSupabase = createServiceRoleClient();

    if (action === 'new_code') {
      const newCode = Math.floor(1000 + Math.random() * 9000).toString();

      try {
        // 1. Update session with new access code
        await (serviceSupabase as any)
          .from('table_sessions')
          .update({
            access_code: newCode,
            code_attempts: 0,
            code_locked_until: null,
          })
          .eq('id', sessionId);

        // 2. Invalidate all existing joined devices
        await (serviceSupabase as any)
          .from('table_session_devices')
          .update({
            is_active: false,
            removed_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId);
      } catch {
        // Fallback store
        dbStore.resetSessionCode(sessionId);
      }

      return NextResponse.json({
        success: true,
        accessCode: newCode,
        message: 'New code generated and all joined devices disconnected.',
      });
    }

    if (action === 'remove_device') {
      if (!deviceId) {
        return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
      }

      try {
        await (serviceSupabase as any)
          .from('table_session_devices')
          .update({
            is_active: false,
            removed_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId)
          .or(`id.eq.${deviceId},device_id.eq.${deviceId}`);
      } catch {
        dbStore.removeJoinedDevice(sessionId, deviceId);
      }

      return NextResponse.json({
        success: true,
        message: 'Device removed from table session.',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Table session action error:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
