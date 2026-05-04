import type { Context, Next } from 'hono';

interface Bucket {
  count: number;
  resetAt: number;
}

interface Options {
  windowMs: number;
  max: number;
  keyFn?: (c: Context) => string;
}

const store = new Map<string, Bucket>();

export function rateLimit({ windowMs, max, keyFn }: Options) {
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-real-ip') ||
      'unknown';
    const key = keyFn ? keyFn(c) : `${ip}:${c.req.path}`;
    const now = Date.now();
    let bucket = store.get(key);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 1, resetAt: now + windowMs };
      store.set(key, bucket);
    } else {
      bucket.count += 1;
      if (bucket.count > max) {
        const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        c.header('Retry-After', retryAfter.toString());
        c.header('RateLimit-Limit', max.toString());
        c.header('RateLimit-Remaining', '0');
        c.header('RateLimit-Reset', retryAfter.toString());
        c.status(429);
        return c.json({
          error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente em instantes.' },
        });
      }
    }
    await next();
    const remaining = Math.max(0, max - bucket.count);
    const resetSec = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
    c.header('RateLimit-Limit', max.toString());
    c.header('RateLimit-Remaining', remaining.toString());
    c.header('RateLimit-Reset', resetSec.toString());
  };
}
