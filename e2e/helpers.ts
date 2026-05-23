// Helpers compartilhados pelos E2E. Login via API + setLocalStorage
// (mais robusto que preencher form — evita timing flaky).

import type { APIRequestContext, Page } from '@playwright/test';

export const STUDENT_EMAIL = 'aluno@pco.local';
export const STUDENT_PASSWORD = 'e2e-student-pass';
export const SUPERADMIN_EMAIL = 'superadmin@pco.local';
export const SUPERADMIN_PASSWORD = 'e2e-super-pass';

const TOKEN_KEY = 'ava-pco-auth';

interface LoginResult {
  token: string;
  user: { id: string; email: string; role: string };
}

export async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await request.post('/api/auth/login', {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`Login falhou: HTTP ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as
    | LoginResult
    | { totpRequired: true; ticket: string };
  if ('totpRequired' in body) {
    throw new Error('TOTP requerido — esperava login direto pra E2E');
  }
  return body;
}

/**
 * Faz login via API e injeta o token no localStorage do browser.
 * Após chamar, navegue para uma rota protegida e o AuthContext vai pegar.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<LoginResult> {
  // Garante que estamos numa origem válida pra setar localStorage
  await page.goto('/login');
  const result = await loginViaApi(page.request, email, password);
  await page.evaluate(
    ({ key, token }) => {
      window.localStorage.setItem(key, token);
    },
    { key: TOKEN_KEY, token: result.token },
  );
  return result;
}

/**
 * Garante que o student está matriculado num curso (via API admin).
 * Idempotente — se já matriculado, retorna sem erro.
 */
export async function ensureEnrolled(
  request: APIRequestContext,
  superadminToken: string,
  courseId: string,
  studentId: string,
): Promise<void> {
  const res = await request.post(
    `/api/admin/courses/${courseId}/enroll-bulk`,
    {
      headers: { Authorization: `Bearer ${superadminToken}` },
      data: { studentIds: [studentId] },
    },
  );
  if (!res.ok() && res.status() !== 409) {
    const body = await res.text();
    throw new Error(`enroll-bulk falhou: HTTP ${res.status()} ${body}`);
  }
}

/** Pega lista de cursos via /api/courses (público). */
export async function fetchCourses(
  request: APIRequestContext,
): Promise<Array<{ id: string; title: string; modules?: unknown[] }>> {
  const res = await request.get('/api/courses');
  if (!res.ok()) {
    throw new Error(`fetchCourses falhou: HTTP ${res.status()}`);
  }
  return (await res.json()) as Array<{
    id: string;
    title: string;
    modules?: unknown[];
  }>;
}
