import type { Context } from 'hono';
import type { z, ZodTypeAny } from 'zod';

export function jsonError(
  c: Context,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  c.status(status as 400);
  return c.json({ error: { code, message, details } });
}

export type ValidateResult<T extends ZodTypeAny> =
  | { ok: true; data: z.infer<T> }
  | { ok: false; error: z.ZodError };

export function validate<T extends ZodTypeAny>(schema: T, value: unknown): ValidateResult<T> {
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error };
}
