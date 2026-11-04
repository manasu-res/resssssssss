import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { rateLimit } from '@/lib/rate-limit';
import { getServiceSupabase } from '@/lib/supabase/service';
import { dbStore } from '@/lib/data/store';
import { signTableJoinPayload, COOKIE_NAME } from '@/lib/auth/table-session-cookie';

export const dynamic = 'force-dynamic';

const joinSchema = z.object({
  token: z.string().min(1, 'Table token is required'),
  code: z.string().regex(/^\d{4}$/, 'Code must be 4 digits'),
  deviceName: z.string().max(50).optional(),
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

    const { token, code, deviceName } = parse.data;
    const userAgent = req.headers.get('user-agent') || 'Phone';
    const inferredDeviceName = deviceName || (userAgent.includes('iPhone') ? 'iPhone' : userAgent.includes('Android') ? 'Android' : 'Phone');

    const supabase = getServiceSupabase();

    if (supabase) {
      try {
        // Find dining table
        const { data: table, error: tErr } = await (supabase as any)
          .from('dining_tables')
          .select('*')
          .eq('qr_token', token)
          .maybeSingle();

        if (tErr || !table || !table.is_enabled) {
          return NextResponse.json(
            { error: 'This QR is not valid. Please ask the waiter.' },
            { status: 404 }
          );
        }

        // Find open session
        const { data: session, error: sErr } = await (supabase as any)
          .from('table_sessions')
          .select('*')
          .eq('table_id', table.id)
          .eq('status', 'open')
          .maybeSingle();

        if (sErr || !session) {
          return NextResponse.json(
            { error: 'Ask the waiter to open your table.' },
            { status: 400 }
          );
        }

        // Check if session is locked
        if (session.code_locked_until && new Date(session.code_locked_until) > new Date()) {
          return NextResponse.json(
            { error: 'Too many tries. Ask your waiter.' },
            { status: 429 }
          );
        }

        // Compare 4-digit code strictly on server
        if (!session.access_code || session.access_code !== code) {
          const nextAttempts = (session.code_attempts || 0) + 1;
          const isLocked = nextAttempts >= 5;
          const lockTime = isLocked ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;

          await (supabase as any)
            .from('table_sessions')
            .update({
              code_attempts: isLocked ? 0 : nextAttempts,
              code_locked_until: lockTime,
            })
            .eq('id', session.id);

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
        await (supabase as any)
          .from('table_sessions')
          .update({
            code_attempts: 0,
            code_locked_until: null,
          })
          .eq('id', session.id);

        const deviceId = `dev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

        // Insert joined device
        await (supabase as any)
          .from('table_session_devices')
          .insert({
            session_id: session.id,
            device_id: deviceId,
            device_name: inferredDeviceName,
            is_active: true,
          });

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
        console.warn('Supabase join table error, falling back to dbStore:', err);
      }
    }

    // Fallback: dbStore in-memory
    const memTable = dbStore.getTableByToken(token);
    if (!memTable) {
      return NextResponse.json(
        { error: 'This QR is not valid. Please ask the waiter.' },
        { status: 404 }
      );
    }

    let memSession = dbStore.getOpenSessionForTable(memTable.id);
    if (!memSession) {
      return NextResponse.json(
        { error: 'Ask the waiter to open your table.' },
        { status: 400 }
      );
    }

    if (memSession.code_locked_until && new Date(memSession.code_locked_until) > new Date()) {
      return NextResponse.json(
        { error: 'Too many tries. Ask your waiter.' },
        { status: 429 }
      );
    }

    if (!memSession.access_code || memSession.access_code !== code) {
      const nextAttempts = (memSession.code_attempts || 0) + 1;
      const isLocked = nextAttempts >= 5;
      memSession.code_attempts = isLocked ? 0 : nextAttempts;
      memSession.code_locked_until = isLocked ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;

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

    // Reset attempts on success
    memSession.code_attempts = 0;
    memSession.code_locked_until = null;

    const deviceId = `dev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    dbStore.devices.push({
      id: `dev-row-${Date.now()}`,
      session_id: memSession.id,
      device_id: deviceId,
      device_name: inferredDeviceName,
      joined_at: new Date().toISOString(),
      is_active: true,
    });

    const tokenPayload = {
      tableId: memTable.id,
      sessionId: memSession.id,
      deviceId,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    };
    const signedCookie = signTableJoinPayload(tokenPayload);

    const res = NextResponse.json({
      success: true,
      deviceId,
      sessionId: memSession.id,
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
