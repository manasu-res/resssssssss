import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'manasu_table_join';
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AUTH_SECRET || 'manasu-restaurant-table-secret-2026';

export interface TableJoinTokenPayload {
  tableId: string;
  sessionId: string;
  deviceId: string;
  exp: number;
}

export function signTableJoinPayload(payload: TableJoinTokenPayload): string {
  const jsonStr = JSON.stringify(payload);
  const base64Data = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(base64Data)
    .digest('base64url');
  return `${base64Data}.${signature}`;
}

export function verifyTableJoinToken(tokenStr: string): TableJoinTokenPayload | null {
  try {
    const parts = tokenStr.split('.');
    if (parts.length !== 2) return null;
    const [base64Data, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(base64Data)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const jsonStr = Buffer.from(base64Data, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as TableJoinTokenPayload;

    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getTableJoinCookie(req?: any): TableJoinTokenPayload | null {
  try {
    let rawCookieVal: string | undefined;

    // 1. Try reading from req.cookies (NextRequest)
    if (req?.cookies) {
      if (typeof req.cookies.get === 'function') {
        rawCookieVal = req.cookies.get(COOKIE_NAME)?.value;
      } else if (req.cookies[COOKIE_NAME]) {
        rawCookieVal = req.cookies[COOKIE_NAME];
      }
    }

    // 2. Try reading from incoming headers cookie string
    if (!rawCookieVal && req?.headers) {
      const cookieHeader =
        typeof req.headers.get === 'function'
          ? req.headers.get('cookie')
          : req.headers.cookie;
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
        if (match) {
          rawCookieVal = decodeURIComponent(match[1]);
        }
      }
    }

    // 3. Fallback to next/headers cookies()
    if (!rawCookieVal) {
      try {
        const cookieStore = cookies();
        rawCookieVal = cookieStore.get(COOKIE_NAME)?.value;
      } catch {}
    }

    if (!rawCookieVal) return null;
    return verifyTableJoinToken(rawCookieVal);
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
