import crypto from 'crypto';

/**
 * 5-Minute Table Code Rotation Engine
 * Codes stay constant for 5 minutes (300 seconds), then rotate.
 * Also supports on-demand waiter refresh ("New code").
 */
const ROTATION_WINDOW_SECONDS = 300; // 5 minutes

// In-memory store for manual rotation offsets
const manualOffsets = new Map<string, number>();

function getSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'manasu-table-code-seed'
  );
}

export function getCurrentWindow(): number {
  return Math.floor(Date.now() / (ROTATION_WINDOW_SECONDS * 1000));
}

export function getRemainingSeconds(): number {
  const elapsedInWindow = Math.floor(Date.now() / 1000) % ROTATION_WINDOW_SECONDS;
  return ROTATION_WINDOW_SECONDS - elapsedInWindow;
}

/**
 * Deterministically generates a 4-digit code for a table session in a given 5-minute window.
 */
function computeCodeForWindow(tableIdentifier: string, windowNumber: number, offset: number = 0): string {
  const secret = getSecret();
  const input = `${tableIdentifier}:${windowNumber}:${offset}`;
  const hash = crypto.createHmac('sha256', secret).update(input).digest();
  // Take 4 bytes from hash to get a positive 32-bit integer
  const num = hash.readUInt32BE(0);
  const fourDigit = 1000 + (num % 9000);
  return fourDigit.toString();
}

/**
 * Returns the current active 4-digit code for a table / session,
 * along with the seconds remaining in the current 5-minute window.
 */
export function getActiveTableCode(tableId: string, sessionId?: string): {
  code: string;
  remainingSeconds: number;
  windowNumber: number;
} {
  const key = sessionId || tableId;
  const currentWindow = getCurrentWindow();
  const offset = manualOffsets.get(key) || 0;
  const code = computeCodeForWindow(key, currentWindow, offset);
  const remainingSeconds = getRemainingSeconds();

  return {
    code,
    remainingSeconds,
    windowNumber: currentWindow,
  };
}

/**
 * Manually forces a new code for the table (e.g. when waiter taps "New code").
 */
export function forceRotateTableCode(tableId: string, sessionId?: string): {
  code: string;
  remainingSeconds: number;
} {
  const key = sessionId || tableId;
  const currentOffset = manualOffsets.get(key) || 0;
  const newOffset = currentOffset + 1;
  manualOffsets.set(key, newOffset);

  const currentWindow = getCurrentWindow();
  const code = computeCodeForWindow(key, currentWindow, newOffset);
  const remainingSeconds = getRemainingSeconds();

  return { code, remainingSeconds };
}

/**
 * Verifies whether the code entered by a customer is valid.
 * Accepts:
 * 1. The code for the current 5-minute window.
 * 2. The code for the immediately previous window (grace period for codes that just changed).
 * 3. Any explicit access_code stored in the database record.
 */
export function verifyTableCode(
  enteredCode: string,
  tableId: string,
  sessionId?: string,
  dbCode?: string | null
): boolean {
  if (!enteredCode || enteredCode.length !== 4) return false;

  // 1. Check database explicit code if present
  if (dbCode && dbCode === enteredCode) {
    return true;
  }

  const key = sessionId || tableId;
  const currentWindow = getCurrentWindow();
  const offset = manualOffsets.get(key) || 0;

  // 2. Check current 5-minute window
  const currentCode = computeCodeForWindow(key, currentWindow, offset);
  if (currentCode === enteredCode) {
    return true;
  }

  // 3. Check previous 5-minute window (grace window)
  const previousCode = computeCodeForWindow(key, currentWindow - 1, offset);
  if (previousCode === enteredCode) {
    return true;
  }

  // 4. Also check without offset in case offset was just bumped
  if (offset > 0) {
    const origCurrent = computeCodeForWindow(key, currentWindow, 0);
    if (origCurrent === enteredCode) return true;
  }

  return false;
}
