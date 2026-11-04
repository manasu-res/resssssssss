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

export function getTableJoinCookie(): TableJoinTokenPayload | null {
  try {
    const cookieStore = cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return null;
    return verifyTableJoinToken(cookie.value);
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
