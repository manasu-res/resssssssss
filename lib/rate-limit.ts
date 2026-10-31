/**
 * In-memory sliding window rate limiter.
 * Protects customer endpoints against flooding per IP and per Table Token.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipStore = new Map<string, RateLimitRecord>();
const tableStore = new Map<string, RateLimitRecord>();

// Clean expired records every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    ipStore.forEach((record, key) => {
      if (now > record.resetAt) ipStore.delete(key);
    });
    tableStore.forEach((record, key) => {
      if (now > record.resetAt) tableStore.delete(key);
    });
  }, 300000);
}

export function rateLimit(
  key: string,
  limit: number = 30,
  windowSeconds: number = 60,
  isTableToken: boolean = false
): { success: boolean; remaining: number; resetInSeconds: number } {
  const store = isTableToken ? tableStore : ipStore;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const current = store.get(key);

  if (!current || now > current.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      remaining: limit - 1,
      resetInSeconds: windowSeconds,
    };
  }

  if (current.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetInSeconds: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  return {
    success: true,
    remaining: limit - current.count,
    resetInSeconds: Math.ceil((current.resetAt - now) / 1000),
  };
}
