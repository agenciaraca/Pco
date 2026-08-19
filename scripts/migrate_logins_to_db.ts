/**
 * Leva as credenciais de `data/users.json` para as colunas da tabela `users`.
 *
 * É o passo que precede ligar `AUTH_STORE=db`. Enquanto ele não roda, a tabela
 * tem a pessoa mas não tem a senha, e virar a chave deixaria todo mundo de fora.
 *
 * O que faz, casando por e-mail:
 *   - conta que já existe no banco  → preenche a credencial, preservando o id
 *     (o id é o que o token de sessão carrega e o que liga a pessoa às
 *     matrículas; trocá-lo seria entrar numa plataforma vazia)
 *   - conta que só existe no JSON   → insere com o id do próprio JSON
 *   - conta que só existe no banco  → fica sem senha e só entra pelo "esqueci
 *     minha senha"; o script conta quantas são
 *
 * Não apaga nada e não toca no JSON: até a virada, ele continua sendo a fonte.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   DATABASE_URL=... npx tsx scripts/migrate_logins_to_db.ts
 *   DATABASE_URL=... npx tsx scripts/migrate_logins_to_db.ts --apply
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const log = (m: string) => console.log(`[migra-logins] ${m}`);

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERRO: defina DATABASE_URL no ambiente.');
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

interface LoginUser {
  id: string;
  email: string;
  name: string;
  role: string;
  customRoleSlug?: string | null;
  passwordHash: string;
  tokenVersion: number;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  active: boolean;
  document?: string | null;
  onboardingCompletedAt?: string | null;
  totpEnabled?: boolean;
  totpSecretEncrypted?: string;
  totpBackupCodes?: string[];
}

function stripSslParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
}

const data = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function main(): Promise<void> {
  log(`modo: ${APPLY ? '*** APPLY (grava) ***' : 'DRY-RUN (rollback ao final)'}`);

  const logins = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, 'users.json'), 'utf8'),
  ) as LoginUser[];
  log(`credenciais no arquivo: ${logins.length}`);

  const client = new pg.Client({
    connectionString: stripSslParams(DB_URL!),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const existentes = (
      await client.query('select id, lower(email) as email, password_hash from users')
    ).rows as Array<{ id: string; email: string; password_hash: string | null }>;
    const idPorEmail = new Map(existentes.map((r) => [r.email, r.id]));
    log(`contas no banco: ${existentes.length} · com senha já preenchida: ${existentes.filter((r) => r.password_hash).length}`);

    await client.query('BEGIN');

    let atualizadas = 0;
    let inseridas = 0;
    for (const u of logins) {
      const email = u.email.toLowerCase();
      const id = idPorEmail.get(email) ?? u.id;
      const valores = [
        id,
        email,
        u.name,
        u.role,
        u.avatarUrl ?? null,
        data(u.createdAt) ?? new Date(),
        data(u.updatedAt) ?? new Date(),
        u.passwordHash,
        u.tokenVersion ?? 0,
        u.active !== false,
        u.customRoleSlug ?? null,
        data(u.lastLoginAt),
        u.document ?? null,
        data(u.onboardingCompletedAt),
        u.totpEnabled ?? false,
        u.totpSecretEncrypted ?? null,
        u.totpBackupCodes ? JSON.stringify(u.totpBackupCodes) : null,
      ];
      await client.query(
        `insert into users (id, email, name, role, avatar_url, created_at, updated_at,
                            password_hash, token_version, active, custom_role_slug,
                            last_login_at, document, onboarding_completed_at,
                            totp_enabled, totp_secret_encrypted, totp_backup_codes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         on conflict (email) do update set
           password_hash = excluded.password_hash,
           token_version = excluded.token_version,
           active = excluded.active,
           custom_role_slug = excluded.custom_role_slug,
           last_login_at = excluded.last_login_at,
           document = excluded.document,
           onboarding_completed_at = excluded.onboarding_completed_at,
           totp_enabled = excluded.totp_enabled,
           totp_secret_encrypted = excluded.totp_secret_encrypted,
           totp_backup_codes = excluded.totp_backup_codes,
           updated_at = excluded.updated_at`,
        valores,
      );
      if (idPorEmail.has(email)) atualizadas++;
      else inseridas++;
    }

    const semSenha = (
      await client.query("select count(*)::int as n from users where password_hash is null")
    ).rows[0].n as number;
    const comSenha = (
      await client.query("select count(*)::int as n from users where password_hash is not null")
    ).rows[0].n as number;

    log(`credenciais gravadas: ${atualizadas} em conta existente · ${inseridas} conta(s) nova(s)`);
    log(`estado final: ${comSenha} com senha · ${semSenha} sem senha (entram pelo "esqueci minha senha")`);

    if (APPLY) {
      await client.query('COMMIT');
      log('*** COMMIT feito. ***');
      log('Próximo passo: AUTH_STORE=db no .env do VPS e pm2 restart ava-pco --update-env');
      log('Para voltar atrás, basta remover a variável e reiniciar — o JSON continua intacto.');
    } else {
      await client.query('ROLLBACK');
      log('DRY-RUN → ROLLBACK (nada gravado). Rode com --apply para aplicar.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[migra-logins] ERRO — rollback feito:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
