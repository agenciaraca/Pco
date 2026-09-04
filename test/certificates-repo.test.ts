import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let repo: typeof import('../server/repositories/certificates');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-cert-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.DATABASE_URL;
  repo = await import('../server/repositories/certificates');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('repositories/certificates', () => {
  it('issueCertificate gera id + validationCode formato PCO-XXX-XXX-XXX', async () => {
    const c = await repo.issueCertificate({
      studentId: 's-1',
      courseId: 'c-1',
    });
    expect(c.id).toMatch(/^cert-/);
    expect(c.validationCode).toMatch(/^PCO-[A-Z2-9]{3}-[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    expect(c.status).toBe('issued');
    expect(c.progress).toBe(100);
    expect(c.studentId).toBe('s-1');
    expect(c.courseId).toBe('c-1');
    expect(c.issuedAt).toMatch(/T.*Z$/);
  });

  it('validationCode é único para múltiplas emissões', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const c = await repo.issueCertificate({
        studentId: `s-uniq-${i}`,
        courseId: 'c-x',
      });
      codes.add(c.validationCode);
    }
    expect(codes.size).toBe(20);
  });

  it('findByValidationCode retorna certificate emitido', async () => {
    const c = await repo.issueCertificate({
      studentId: 's-find',
      courseId: 'c-find',
    });
    const found = await repo.findByValidationCode(c.validationCode);
    expect(found!.id).toBe(c.id);
  });

  it('findByValidationCode retorna null pra código inexistente', async () => {
    expect(await repo.findByValidationCode('PCO-XXX-XXX-XXX')).toBeNull();
  });

  it('listCertificatesForStudent filtra por studentId', async () => {
    await repo.issueCertificate({ studentId: 's-A', courseId: 'c1' });
    await repo.issueCertificate({ studentId: 's-A', courseId: 'c2' });
    await repo.issueCertificate({ studentId: 's-B', courseId: 'c1' });
    const a = await repo.listCertificatesForStudent('s-A');
    expect(naoVazio(a).every((c) => c.studentId === 's-A')).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(2);
  });

  it('listAllCertificates retorna tudo cross-student', async () => {
    const all = await repo.listAllCertificates();
    expect(all.length).toBeGreaterThan(0);
    const studentIds = new Set(all.map((c) => c.studentId));
    expect(studentIds.size).toBeGreaterThan(1);
  });

  it('deleteCertificate remove + retorna true; segunda false', async () => {
    const c = await repo.issueCertificate({
      studentId: 's-del',
      courseId: 'c',
    });
    expect(await repo.deleteCertificate(c.id)).toBe(true);
    expect(await repo.deleteCertificate(c.id)).toBe(false);
  });

  it('certificado deletado não aparece em findByValidationCode', async () => {
    const c = await repo.issueCertificate({
      studentId: 's-del2',
      courseId: 'c',
    });
    await repo.deleteCertificate(c.id);
    expect(await repo.findByValidationCode(c.validationCode)).toBeNull();
  });
});
