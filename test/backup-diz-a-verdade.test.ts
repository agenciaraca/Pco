/**
 * O painel não pode mentir sobre o backup — nem para mais, nem para menos.
 *
 * Dois defeitos medidos em produção em 9/set/2026, com o servidor no ar:
 *
 * 1. **`bancoCoberto` dizia `false` sem ter medido.** A expressão caía em
 *    `false` sempre que `lastResult` fosse nulo, isto é, do boot até as 04:00
 *    UTC. Produção reinicia muito — 143 vezes até aquele dia —, então `false`
 *    era o estado normal do painel: ele afirmava que o banco não estava no
 *    backup enquanto os despejos dos três dias anteriores estavam em disco.
 *    Alarme que grita à toa todo dia é alarme que ninguém lê no dia certo.
 *
 *    A linha vizinha, `saudavel`, já tratava isso ("nunca rodou não é não
 *    saudável, é não medido"). As duas moravam na mesma função e discordavam.
 *
 * 2. **O painel de saúde não perguntava pelo backup.** Doze verificações —
 *    gateways, e-mail, IA, erros, disco, workers — e nenhuma sobre a cópia dos
 *    dados. É a mesma falta que os workers tinham até 7/set, no lugar em que
 *    ela custa mais: backup incompleto é indistinguível de backup completo até
 *    o dia em que alguém precisa dele.
 *
 * A resposta vem do DISCO, e não do worker, porque o worker só sabe desta vida
 * do processo. `copiaMaisRecente()` lê as snapshots datadas, que é o que
 * responde depois de um restart.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { copiaMaisRecente } from '../server/db/ultima-copia';

let tmpDir: string;
const DATA_DIR_ORIGINAL = process.env.DATA_DIR;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-backup-'));
  process.env.DATA_DIR = tmpDir;
});

afterEach(async () => {
  if (DATA_DIR_ORIGINAL === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = DATA_DIR_ORIGINAL;
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

/** Cria uma snapshot datada com N tabelas do banco e M arquivos de store. */
async function snapshot(data: string, tabelas: number, stores: number): Promise<void> {
  const dir = path.join(tmpDir, 'backups', data);
  await fs.mkdir(dir, { recursive: true });
  for (let i = 0; i < tabelas; i++) {
    await fs.writeFile(path.join(dir, `db-tabela_${i}.json`), '[]', 'utf8');
  }
  for (let i = 0; i < stores; i++) {
    await fs.writeFile(path.join(dir, `store-${i}.json`), '[]', 'utf8');
  }
}

const EM = (iso: string) => new Date(iso);

describe('a última cópia é perguntada ao disco', () => {
  it('acha a snapshot mais recente que carrega o banco', async () => {
    await snapshot('2026-09-07', 25, 60);
    await snapshot('2026-09-08', 25, 61);
    const r = await copiaMaisRecente(EM('2026-09-08T19:00:00Z'));
    expect(r.erro).toBeNull();
    expect(r.banco?.data).toBe('2026-09-08');
    expect(r.banco?.tabelas).toBe(25);
    expect(r.banco?.arquivos).toBe(61);
    expect(r.banco?.idadeEmDias).toBe(0);
  });

  it('pula as snapshots sem banco para achar a última que o tem', async () => {
    // Foi exatamente o histórico de produção: o despejo do Postgres só passou
    // a existir em 6/set, e as pastas anteriores só tinham os JSON.
    await snapshot('2026-09-05', 0, 62);
    await snapshot('2026-09-06', 25, 62);
    await snapshot('2026-09-07', 0, 63);
    const r = await copiaMaisRecente(EM('2026-09-07T12:00:00Z'));
    expect(r.qualquer?.data, 'a mais recente é a de 07, com banco ou sem').toBe('2026-09-07');
    expect(r.banco?.data, 'mas a última COM banco é a de 06').toBe('2026-09-06');
    expect(r.banco?.idadeEmDias).toBe(1);
  });

  it('não conseguir olhar não é "não há cópia"', async () => {
    // Sem o diretório de backups: é o caso de instalação nova e o de disco
    // fora do ar. Zero diria "medi e não há", que manda alguém correr atrás de
    // um backup que pode estar lá.
    const r = await copiaMaisRecente();
    expect(r.banco).toBeNull();
    expect(r.qualquer).toBeNull();
    expect(r.erro, 'o motivo tem de vir junto').toBeTruthy();
  });

  it('olhei e não há: diretório existe e está vazio', async () => {
    await fs.mkdir(path.join(tmpDir, 'backups'), { recursive: true });
    const r = await copiaMaisRecente();
    expect(r.banco).toBeNull();
    expect(r.erro, 'aqui a leitura funcionou — não há erro a reportar').toBeNull();
  });

  it('o .tar.gz do outro backup não conta como cópia do banco', async () => {
    // Produção tem dois backups no mesmo diretório: este worker, em pastas
    // datadas, e um cron de shell que gera `<data>_<hora>.tar.gz` só com os
    // JSON. Contar o tar diria que há cópia do banco onde não há.
    await fs.mkdir(path.join(tmpDir, 'backups'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'backups', '2026-09-09_03-00-02.tar.gz'), 'x', 'utf8');
    const r = await copiaMaisRecente();
    expect(r.banco).toBeNull();
    expect(r.qualquer).toBeNull();
  });

  it('pasta ilegível com o despejo dentro não vira "não há cópia"', async () => {
    // Achado auditando o próprio código, no mesmo dia em que foi escrito. A
    // versão anterior descartava o erro assim que QUALQUER pasta legível
    // aparecesse. Com a mais recente ilegível e a anterior sem despejo, o
    // resultado era `banco: null, erro: null` — que se lê como "olhei e não há
    // cópia do banco", e o painel manda alguém correr atrás de um backup que
    // pode estar dentro da pasta que não deu para abrir.
    await snapshot('2026-09-07', 0, 60); // legível, sem banco
    const recente = path.join(tmpDir, 'backups', '2026-09-08');
    await fs.mkdir(recente, { recursive: true });
    await fs.writeFile(path.join(recente, 'db-users.json'), '[]', 'utf8');
    // Torna a mais recente ilegível trocando-a por um ARQUIVO: `readdir` nela
    // falha, que é o efeito de permissão negada sem depender de chmod (que o
    // Windows ignora).
    await fs.rm(recente, { recursive: true, force: true });
    await fs.writeFile(recente, 'nao sou um diretorio', 'utf8');

    const r = await copiaMaisRecente(EM('2026-09-08T12:00:00Z'));
    expect(r.banco, 'não achou despejo — mas isso não é o mesmo que não haver').toBeNull();
    expect(
      r.erro,
      'o motivo tem de sobreviver: sem ele o painel afirma que não há backup',
    ).toBeTruthy();
  });

  it('achado o despejo, erro em pasta mais velha é ruído e some', async () => {
    const velha = path.join(tmpDir, 'backups', '2026-09-01');
    await fs.mkdir(path.dirname(velha), { recursive: true });
    await fs.writeFile(velha, 'nao sou um diretorio', 'utf8');
    await snapshot('2026-09-09', 25, 61);
    const r = await copiaMaisRecente(EM('2026-09-09T12:00:00Z'));
    expect(r.banco?.data).toBe('2026-09-09');
    expect(r.erro, 'com a resposta na mão, o erro não muda o que se faz').toBeNull();
  });

  it('a idade sai da data da pasta, não do mtime do arquivo', async () => {
    // O mtime muda quando o worker apaga snapshots velhas ao lado. A pergunta
    // é de que dia é a cópia.
    await snapshot('2026-09-01', 25, 60);
    const r = await copiaMaisRecente(EM('2026-09-09T00:30:00Z'));
    expect(r.banco?.idadeEmDias).toBe(8);
  });
});

describe('o status do worker não reporta o que não mediu', () => {
  it('bancoCoberto é null antes do primeiro ciclo, nunca false — COM banco', async () => {
    // O mock é a parte que faz este caso valer. Sem `DATABASE_URL` o status
    // já devolvia `null` pelo primeiro ramo (`!hasDb()`), então um teste sem
    // banco passa contra o código defeituoso e não prova nada.
    //
    // O defeito só aparece onde ele aconteceu: **há banco** e o worker ainda
    // não rodou nesta vida do processo. Era o estado de produção do boot até
    // as 04:00 UTC, todo dia.
    vi.resetModules();
    vi.doMock('../server/db/client', async () => {
      const real = await vi.importActual<typeof import('../server/db/client')>(
        '../server/db/client',
      );
      return { ...real, hasDb: () => true };
    });
    const worker = await import('../server/db/backup-worker');
    const s = worker.getStatus();
    expect(s.lastRunAt, 'este caso vale para o worker que ainda não rodou').toBeNull();
    expect(
      s.bancoCoberto,
      '`false` significa "há banco e ele NÃO está na snapshot" — a única ' +
        'situação que pode custar a base inteira. Dizer isso sem ter medido ' +
        'gasta o alarme: em produção era o estado normal do painel.',
    ).toBeNull();
    // E a linha vizinha continua concordando com esta.
    expect(s.saudavel).toBeNull();
    vi.doUnmock('../server/db/client');
    vi.resetModules();
  });
});

describe('o painel de saúde pergunta pelo backup', () => {
  it('tem uma verificação de backup, e ela sai do disco', async () => {
    await snapshot('2026-09-09', 25, 61);
    const { buildSnapshot } = await import('../server/health/dashboard');
    const snap = await buildSnapshot();
    const check = snap.checks.find((c) => c.id === 'backup');
    expect(check, 'o painel voltou a não perguntar pelo backup').toBeTruthy();
    expect(check!.message).toContain('2026-09-09');
  });

  it('cópia atrasada é aviso, e o número vai junto', async () => {
    await snapshot('2026-09-01', 25, 61);
    const { buildSnapshot } = await import('../server/health/dashboard');
    const snap = await buildSnapshot();
    const check = snap.checks.find((c) => c.id === 'backup')!;
    expect(check.status).toBe('warn');
    expect(check.message).toContain('ATRASADA');
    expect(typeof check.metric).toBe('number');
  });

  it('sem cópia nenhuma é erro, não silêncio', async () => {
    await fs.mkdir(path.join(tmpDir, 'backups'), { recursive: true });
    const { buildSnapshot } = await import('../server/health/dashboard');
    const snap = await buildSnapshot();
    const check = snap.checks.find((c) => c.id === 'backup')!;
    expect(check.status).toBe('error');
  });
});
