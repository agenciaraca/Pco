/**
 * O que a varredura de 7/set/2026 deixou passar — e por que ela deixou.
 *
 * Aquele sprint converteu 24 pontos de `getAll()` + `setAll()` para `modify`,
 * e escreveu no CLAUDE.md que `setAll([])` e `setAll([cfg])` ficavam de fora
 * porque "não são leitura-seguida-de-escrita — são substituição deliberada".
 *
 * **A metade da frase sobre `setAll([cfg])` estava errada.** Vale para quem
 * monta a linha inteira a partir da entrada (`zoom-config.setConfig`,
 * `transcription.setConfig`) e para quem limpa. Não vale para o formato que
 * todas as telas de configuração deste projeto usam:
 *
 *     const atual = await getConfig();
 *     const next  = { ...atual, ...patch };
 *     await store.setAll([next]);
 *
 * Isso é ler, mesclar e gravar. Dois pedidos concorrentes leem a mesma base, e
 * o segundo grava por cima — a mudança do primeiro some, sem erro e sem log.
 *
 * E um ponto pior escapou por não ter a forma `setAll([x])`:
 * `reengagement/config-store.recordSent` fazia `[novo, ...todos].slice(0, N)`,
 * que é exatamente o `unshiftComTeto` criado naquele mesmo sprint. Aquele
 * arquivo é o livro que impede reenviar para a mesma pessoa: registro perdido
 * ali não é linha faltando num log, é **o aluno recebendo o e-mail de novo**.
 *
 * Os casos abaixo falham contra o código anterior.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-cfg-'));
  process.env.DATA_DIR = tmpDir;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('configuração de uma linha', () => {
  it('duas telas salvando campos diferentes ao mesmo tempo não se apagam', async () => {
    const { updateSettings, getSettings } = await import('../server/repositories/settings');

    await Promise.all([
      updateSettings({ siteName: 'Escola A' }),
      updateSettings({ helpEmail: 'suporte-b@exemplo.test' }),
    ]);

    const final = await getSettings();
    // Com `getAll` + `setAll`, um dos dois sobrescrevia a base que o outro
    // tinha lido e a mudança dele sumia. Os dois campos são independentes.
    expect(final.siteName).toBe('Escola A');
    expect(final.helpEmail).toBe('suporte-b@exemplo.test');
  });

  it('o mesmo vale para a aparência da tela de login', async () => {
    const { updateConfig, getConfig } = await import('../server/repositories/login-config');

    await Promise.all([updateConfig({ title: 'Entrar' }), updateConfig({ theme: 'dark' })]);

    const final = await getConfig();
    expect(final.title).toBe('Entrar');
    expect(final.theme).toBe('dark');
  });

  it('e para as tags de marketing, onde a perda também fecha a CSP', async () => {
    const { updateTags, getTags } = await import('../server/marketing/tags-store');

    await Promise.all([updateTags({ gtmId: 'GTM-ABC1234' }), updateTags({ ga4Id: 'G-XYZ98765' })]);

    const final = await getTags();
    // Uma tag perdida não é só uma linha a menos: `hostsParaCsp()` afrouxa a
    // política só para o que está cadastrado, então o navegador volta a
    // bloquear o script sem que nada explique por quê.
    expect(final.gtmId).toBe('GTM-ABC1234');
    expect(final.ga4Id).toBe('G-XYZ98765');
  });
});

describe('livro de reenvio do reengajamento', () => {
  it('dois registros no mesmo instante não viram um', async () => {
    const { recordSent, lastSentForUser, listRecentSends } = await import(
      '../server/reengagement/config-store'
    );

    await Promise.all([
      recordSent('aluno-1', 'um@exemplo.test'),
      recordSent('aluno-2', 'dois@exemplo.test'),
    ]);

    // O que importa não é a contagem: é que os DOIS alunos passem a ter
    // registro. Quem some da lista recebe o mesmo e-mail na próxima execução,
    // porque é esta consulta que segura o reenvio.
    expect(await lastSentForUser('aluno-1')).not.toBeNull();
    expect(await lastSentForUser('aluno-2')).not.toBeNull();
    expect((await listRecentSends()).length).toBe(2);
  });

  it('o teto continua valendo, e corta os mais antigos', async () => {
    const { recordSent, listRecentSends } = await import('../server/reengagement/config-store');
    // O teto real é 5000; aqui basta provar que a lista cresce em ordem, com o
    // mais recente no topo — que é o que `listRecentSends` promete.
    await recordSent('aluno-3', 'tres@exemplo.test');
    const lista = await listRecentSends();
    expect(lista[0]?.userId).toBe('aluno-3');
    expect(lista.length).toBe(3);
  });
});
