import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * PRIV2-011 · o plano de recuperação mandava o nome do aluno para um LLM.
 *
 * `generateWithAi` montava a mensagem ao provedor assim:
 *
 * ```
 * Aluno: Maria de Souza
 * Score de risco: 82/100
 * Razões: sem acesso há 40 dias; nenhuma aula concluída no mês
 * ```
 *
 * Isto é um **juízo sobre uma pessoa nomeada**, enviado a um provedor de IA de
 * terceiro. E ela não pediu nada: quem aciona é a coordenação, sobre alguém que
 * não sabe que está sendo avaliado.
 *
 * A política de privacidade do próprio produto diz que IA é usada "quando
 * solicitada pelo próprio usuário". O tutor de IA cumpre isso — não manda
 * identidade. Esta função era a que destoava, e era a que mandava o dado mais
 * sensível dos dois: o nome colado ao score de risco e às razões dele.
 *
 * ## O que mudou
 *
 * O provedor recebe `{{ALUNO}}`. O nome real é substituído **depois** da
 * resposta, dentro do servidor. A mensagem que chega ao aluno continua
 * personalizada; o provedor é que nunca vê o nome.
 *
 * ## O que este arquivo cobra
 *
 * A asserção central não é "a função funciona" — é **o que sai pela rede**. Por
 * isso o provedor é substituído por um espião que guarda tudo que recebeu, e os
 * casos inspecionam o payload, não o retorno.
 */

const espiao = vi.hoisted(() => ({
  recebido: [] as string[],
  resposta: '',
}));

vi.mock('../server/ai/store', () => ({
  getActiveByModule: () => ({
    provider: 'anthropic',
    model: 'claude-fake',
    apiKey: 'k',
    temperature: 0.5,
    maxTokens: 600,
  }),
}));

vi.mock('../server/ai/providers', () => ({
  getProvider: () => ({
    chat: async (args: { messages: Array<{ content: string }>; systemPrompt: string }) => {
      // Guarda TUDO que atravessaria a rede: mensagens e prompt de sistema.
      espiao.recebido.push(args.systemPrompt, ...args.messages.map((m) => m.content));
      return { text: espiao.resposta };
    },
  }),
}));

const NOME_REAL = 'Maria de Souza Albuquerque';

const entrada = {
  studentId: 'stu-1',
  studentName: NOME_REAL,
  riskScore: 82,
  riskReasons: ['sem acesso há 40 dias', 'nenhuma aula concluída no mês'],
  realProgress: 12,
  expectedProgress: 60,
  tone: 'acolhedor' as const,
  channel: 'email' as const,
  intensity: 'media' as const,
  goal: 'retomar o módulo 3',
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-recovery-'));
  process.env.DATA_DIR = tmpDir;
  espiao.recebido = [];
  espiao.resposta = JSON.stringify({
    diagnosis: '{{ALUNO}} está afastado há semanas e o progresso ficou para trás.',
    message: 'Olá {{ALUNO}}, que tal retomar de onde parou?',
    weeklyGoalMinutes: 120,
    suggestedTutorPrompt: 'O que {{ALUNO}} deveria revisar primeiro?',
  });
});

afterEach(async () => {
  vi.resetModules();
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('o nome do aluno não atravessa a rede', () => {
  it('nada do que vai ao provedor contém o nome', async () => {
    const repo = await import('../server/repositories/recovery-plans');
    await repo.generateWithAi(entrada);

    expect(espiao.recebido.length, 'o provedor precisa ter sido chamado').toBeGreaterThan(0);
    for (const trecho of espiao.recebido) {
      expect(trecho, 'o nome do aluno foi enviado ao provedor de IA').not.toContain(NOME_REAL);
      // Nem o primeiro nome sozinho, que já identifica em base pequena.
      expect(trecho).not.toContain('Maria');
    }
  });

  it('o marcador vai no lugar — senão o modelo inventaria um nome', async () => {
    const repo = await import('../server/repositories/recovery-plans');
    await repo.generateWithAi(entrada);
    expect(espiao.recebido.join('\n')).toContain('{{ALUNO}}');
  });

  it('score e razões continuam indo — é o que o modelo precisa para escrever', async () => {
    // Guarda contra "consertar" removendo o contexto: sem risco e sem razões o
    // plano vira texto genérico, e o recurso perde a função.
    const repo = await import('../server/repositories/recovery-plans');
    await repo.generateWithAi(entrada);
    const tudo = espiao.recebido.join('\n');
    expect(tudo).toContain('82');
    expect(tudo).toContain('sem acesso há 40 dias');
  });
});

describe('o aluno continua sendo chamado pelo nome', () => {
  it('o marcador é trocado pelo nome real na volta', async () => {
    const repo = await import('../server/repositories/recovery-plans');
    const plano = await repo.generateWithAi(entrada);

    expect(plano.message).toContain(NOME_REAL);
    expect(plano.message, 'o marcador não pode vazar para a tela').not.toContain('{{ALUNO}}');
    expect(plano.diagnosis).toContain(NOME_REAL);
    expect(plano.diagnosis).not.toContain('{{ALUNO}}');
  });

  it('a sugestão de pergunta ao tutor também é substituída', async () => {
    const repo = await import('../server/repositories/recovery-plans');
    const plano = await repo.generateWithAi(entrada);
    expect(plano.suggestedTutorPrompt).toContain(NOME_REAL);
    expect(plano.suggestedTutorPrompt).not.toContain('{{ALUNO}}');
  });

  it('resposta sem marcador nenhum não quebra', async () => {
    // O modelo pode simplesmente não usar o marcador. Isso não é erro: o texto
    // sai sem o nome, e sem nome é melhor do que com marcador aparecendo.
    espiao.resposta = JSON.stringify({
      diagnosis: 'Progresso abaixo do esperado.',
      message: 'Vamos retomar?',
      weeklyGoalMinutes: 90,
    });
    const repo = await import('../server/repositories/recovery-plans');
    const plano = await repo.generateWithAi(entrada);
    expect(plano.message).toBe('Vamos retomar?');
    expect(plano.diagnosis).toBe('Progresso abaixo do esperado.');
  });
});
