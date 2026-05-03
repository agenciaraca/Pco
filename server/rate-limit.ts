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
    const bucket = store.get(key);
    if (!bucket || bucket.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > max) {
        const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        c.header('Retry-After', retryAfter.toString());
        c.status(429);
        return c.json({
          error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente em instantes.' },
        });
      }
    }
    await next();
  };
}
