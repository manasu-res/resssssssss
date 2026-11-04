import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { rateLimit } from '@/lib/rate-limit';
import { getServiceSupabase } from '@/lib/supabase/service';
import { dbStore } from '@/lib/data/store';
import { signTableJoinPayload, COOKIE_NAME } from '@/lib/auth/table-session-cookie';
import { verifyTableCode } from '@/lib/auth/table-codes';
import { resolveDiningTable, resolveOpenSession } from '@/lib/data/table-resolver';

export const dynamic = 'force-dynamic';

const joinSchema = z.object({
  token: z.string().min(1, 'Table token is required'),
  code: z.string().regex(/^\d{4}$/, 'Code must be 4 digits'),
  customerName: z.string().max(60).optional(),
  deviceName: z.string().max(60).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting (10 tries/min per IP)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    const ipLimit = rateLimit(`table-join-ip:${ip}`, 10, 60);
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: 'Too many tries. Ask your waiter.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parse = joinSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: 'That code is not right.' },
        { status: 400 }
      );
    }

    const { token, code, customerName, deviceName } = parse.data;
    const userAgent = req.headers.get('user-agent') || 'Phone';
    const rawName = customerName?.trim() || deviceName?.trim();
    const inferredDeviceName = rawName
      ? rawName
      : userAgent.includes('iPhone')
      ? 'iPhone'
      : userAgent.includes('Android')
      ? 'Android'
      : 'Customer Phone';

    // 2. Resolve dining table (handles qr_token, table id, label, or number)
    const table = await resolveDiningTable(token);
    if (!table || !table.is_enabled) {
      return NextResponse.json(
        { error: 'This QR is not valid. Please ask the waiter.' },
        { status: 404 }
      );
    }

    // 3. Resolve active open session
    const session = await resolveOpenSession(table);
    if (!session) {
      return NextResponse.json(
        { error: 'Ask the waiter to open your table.' },
        { status: 400 }
      );
    }

    // 4. Check if session is locked
    if (session.code_locked_until && new Date(session.code_locked_until) > new Date()) {
      return NextResponse.json(
        { error: 'Too many tries. Ask your waiter.' },
        { status: 429 }
      );
    }

    // 5. Compare 4-digit code (checks window, grace window, and explicit record codes)
    const isCodeValid = verifyTableCode(code, table.id, session.id, session.access_code);

    if (!isCodeValid) {
      const nextAttempts = (session.code_attempts || 0) + 1;
      const isLocked = nextAttempts >= 5;
      const lockTime = isLocked ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;

      // Update in Supabase if session came from Supabase
      const supabase = getServiceSupabase();
      if (supabase && session.source === 'supabase') {
        try {
          await (supabase as any)
            .from('table_sessions')
            .update({
              code_attempts: isLocked ? 0 : nextAttempts,
              code_locked_until: lockTime,
            })
            .eq('id', session.id);
        } catch (e) {
          console.warn('Failed to update session attempts in Supabase:', e);
        }
      }

      // Update in dbStore
      const memSession = dbStore.sessions.find(s => s.id === session.id || s.table_id === table.id);
      if (memSession) {
        memSession.code_attempts = isLocked ? 0 : nextAttempts;
        memSession.code_locked_until = lockTime;
      }

      if (isLocked) {
        return NextResponse.json(
          { error: 'Too many tries. Ask your waiter.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'That code is not right.' },
        { status: 400 }
      );
    }

    // Code matches! Reset attempts & lock
    const supabase = getServiceSupabase();
    if (supabase && session.source === 'supabase') {
      try {
        await (supabase as any)
          .from('table_sessions')
          .update({
            code_attempts: 0,
            code_locked_until: null,
          })
          .eq('id', session.id);
      } catch (e) {
        console.warn('Failed to reset session attempts in Supabase:', e);
      }
    }

    const memSession = dbStore.sessions.find(s => s.id === session.id || s.table_id === table.id);
    if (memSession) {
      memSession.code_attempts = 0;
      memSession.code_locked_until = null;
    }

    const deviceId = `dev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    // Record joined device in Supabase
    if (supabase) {
      try {
        await (supabase as any)
          .from('table_session_devices')
          .insert({
            session_id: session.id,
            device_id: deviceId,
            device_name: inferredDeviceName,
            is_active: true,
          });
      } catch (e) {
        console.warn('Failed to insert table_session_devices in Supabase:', e);
      }
    }

    // Record joined device in dbStore
    dbStore.devices.push({
      id: `dev-row-${Date.now()}`,
      session_id: session.id,
      device_id: deviceId,
      device_name: inferredDeviceName,
      joined_at: new Date().toISOString(),
      is_active: true,
    });

    // Create signed join cookie
    const tokenPayload = {
      tableId: table.id,
      sessionId: session.id,
      deviceId,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    };
    const signedCookie = signTableJoinPayload(tokenPayload);

    const res = NextResponse.json({
      success: true,
      deviceId,
      sessionId: session.id,
      customerName: inferredDeviceName,
    });

    res.cookies.set(COOKIE_NAME, signedCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
    });

    return res;
  } catch (err: any) {
    console.error('Table join error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to join table' },
      { status: 500 }
    );
  }
}
