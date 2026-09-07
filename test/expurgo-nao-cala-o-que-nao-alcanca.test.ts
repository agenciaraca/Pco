/**
 * Duas metades do mesmo defeito, e nenhuma dava erro.
 *
 * **1. `external-references.json` sobrevivia ao expurgo.** Cada linha amarra a
 * conta a um usuário do WordPress de origem (`psi:1234`, `portal:567`). A
 * anonimização trocava o nome e o e-mail na tabela de contas e deixava, ao
 * lado, o ponteiro para o nome real — indexado pelo id da conta anonimizada.
 * Anonimizar assim é de fachada: o caminho de volta continua escrito.
 *
 * **2. As transcrições de sessão ao vivo não estavam em ponta nenhuma** — nem
 * na exportação, nem no expurgo, nem declaradas. O relatório imprimia
 * `completo: true` por cima de um lugar que ninguém tinha olhado, que é a
 * mesma classe do `contar()` com `catch` vazio que este arquivo já corrigiu:
 * "não consegui olhar" saindo igual a "não havia nada".
 *
 * A segunda não vira rotina, e o teste cobra a razão: `SessionTranscript`
 * guarda `sessionId`, e `LiveSession` não tem lista de participante. Não há
 * campo que ligue a transcrição a uma pessoa — e a gravação é de aula
 * coletiva, então apagá-la a pedido de um aluno destruiria o registro dos
 * outros. O que se pode fazer é não calar sobre ela.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let expurgo: typeof import('../server/privacy/expurgo');
let refs: typeof import('../server/imports/refs-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-priv-'));
  process.env.DATA_DIR = tmpDir;
  expurgo = await import('../server/privacy/expurgo');
  refs = await import('../server/imports/refs-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

describe('a referência externa é caminho de volta ao nome real', () => {
  it('está na lista de decisões, e é para apagar', () => {
    const d = expurgo.DECISOES.find((x) => x.categoria === 'externalReferences');
    expect(d, 'categoria ausente: a anonimização ficaria de fachada').toBeDefined();
    expect(d!.destino).toBe('apagar');
  });

  it('o expurgo encontra e apaga a referência do titular', async () => {
    const userId = 'u-titular-teste';
    await refs.upsert({
      sourceType: 'wordpress',
      externalEntityType: 'student',
      externalId: 'psi:4242',
      internalEntityType: 'student',
      internalId: userId,
      jobId: 'job-teste',
    });
    expect(await refs.listForUser(userId)).toHaveLength(1);

    // Ensaio primeiro: encontra e NÃO apaga.
    const ensaio = await expurgo.expurgarTitular(userId);
    const noEnsaio = ensaio.itens.find((i) => i.categoria === 'externalReferences');
    expect(noEnsaio?.encontrados).toBe(1);
    expect(noEnsaio?.tratados).toBe(0);
    expect(await refs.listForUser(userId)).toHaveLength(1);

    const exec = await expurgo.expurgarTitular(userId, { commit: true });
    const tratado = exec.itens.find((i) => i.categoria === 'externalReferences');
    expect(tratado?.tratados).toBe(1);
    expect(await refs.listForUser(userId)).toHaveLength(0);
  });

  it('não encosta na referência de outra pessoa', async () => {
    const eu = 'u-eu';
    const outro = 'u-outro';
    for (const [id, ext] of [
      [eu, 'psi:1'],
      [outro, 'psi:2'],
    ] as const) {
      await refs.upsert({
        sourceType: 'wordpress',
        externalEntityType: 'student',
        externalId: ext,
        internalEntityType: 'student',
        internalId: id,
        jobId: 'job-teste',
      });
    }
    await expurgo.expurgarTitular(eu, { commit: true });
    expect(await refs.listForUser(eu)).toHaveLength(0);
    expect(await refs.listForUser(outro)).toHaveLength(1);
  });

  it('a referência de PEDIDO não é varrida junto — ela tem outro id', async () => {
    // `internalId` só é o id do usuário nas referências de `student`. As de
    // pedido carregam o id do pedido, e pedido pago é documento fiscal retido.
    const userId = 'u-com-pedido';
    await refs.upsert({
      sourceType: 'woocommerce',
      externalEntityType: 'order',
      externalId: 'wc:900',
      internalEntityType: 'order',
      internalId: 'ord-123',
      jobId: 'job-teste',
    });
    await expurgo.expurgarTitular(userId, { commit: true });
    const sobrou = await refs.listForUser('ord-123');
    expect(sobrou).toHaveLength(1);
  });
});

describe('o que a rotina não alcança é declarado, não omitido', () => {
  it('o relatório traz a transcrição de sessão como verificação manual', async () => {
    const r = await expurgo.expurgarTitular('u-qualquer');
    expect(r.semIndice.length).toBeGreaterThan(0);

    const t = r.semIndice.find((x) => x.store.includes('session-transcripts'));
    expect(t, 'a transcrição de sessão sumiu do relatório').toBeDefined();
    // A razão precisa estar escrita: sem ela, o operador lê como pendência
    // técnica e fica esperando alguém "consertar".
    expect(t!.porQue).toMatch(/participante|coletiva/i);
    expect(t!.oQueGuarda).toMatch(/transcri/i);
  });

  it('o total é do store, e nunca vira "encontrados" do titular', async () => {
    const r = await expurgo.expurgarTitular('u-qualquer');
    const t = r.semIndice.find((x) => x.store.includes('session-transcripts'))!;
    // Zero aqui significa "não há o que procurar", e é afirmação sobre o STORE.
    expect(t.existentesNoTotal).toBe(0);
    // E não pode existir uma categoria com esse nome fingindo que foi tratada.
    expect(
      expurgo.DECISOES.some((d) => d.categoria.toLowerCase().includes('transcri')),
    ).toBe(false);
    expect(
      r.itens.some((i) => i.categoria.toLowerCase().includes('transcri')),
    ).toBe(false);
  });

  it('o store realmente não tem por onde ligar transcrição a pessoa', async () => {
    // Esta é a prova de que a ausência de rotina é do MODELO, não esquecimento.
    // No dia em que a sessão ganhar lista de participante, o teste falha — e é
    // exatamente aí que a categoria tem de deixar de ser "manual".
    const tipos = await fs.readFile(
      path.join(process.cwd(), 'server', 'transcription', 'store.ts'),
      'utf8',
    );
    const bloco = tipos.slice(
      tipos.indexOf('export interface SessionTranscript'),
      tipos.indexOf('const store ='),
    );
    expect(bloco).not.toMatch(/userId|studentId|participant/i);

    const sessao = await fs.readFile(
      path.join(process.cwd(), 'server', 'live-sessions', 'store.ts'),
      'utf8',
    );
    const blocoSessao = sessao.slice(
      sessao.indexOf('export interface LiveSession'),
      sessao.indexOf('const store ='),
    );
    expect(blocoSessao).not.toMatch(/userId|studentId|participant|attendee/i);
  });
});
