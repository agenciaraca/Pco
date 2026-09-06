import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * LEARN4-001 · o gotejamento atrasava o clique de concluir, não a aula.
 *
 * O drip nasceu plugado em **uma** rota: `POST /lessons/:id/complete`. Essa
 * rota registra a conclusão — ela não entrega nada. Quem entrega o texto e a
 * URL do vídeo é `GET /me/courses/:c/lessons/:l/content`, e ela não sabia do
 * lock.
 *
 * O efeito não exigia esperteza nenhuma para acontecer: o `lessonId` de aula
 * trancada **já está nas mãos do aluno** — `semConteudoDeAula` remove `content`
 * e `videoUrl` da resposta do catálogo e mantém a lista de aulas inteira. Link
 * salvo, histórico do navegador ou a URL montada à mão abriam a aula completa
 * antes da data. O que ficava trancado era o botão de dizer "concluí".
 *
 * Como o certificado sai de contagem de cliques em aula obrigatória, o drip
 * protegia a cerimônia de conclusão e não a aprendizagem — que é o contrário do
 * que ele existe para fazer.
 *
 * ## Por que o teste lê o arquivo
 *
 * Montar as três rotas exigiria app, banco, matrícula e módulo com data — e o
 * teste passaria a medir o arranjo. O que precisa ser garantido é estrutural e
 * cabe na leitura: as rotas que **entregam** conferem o lock, e respondem 423.
 */

async function app(): Promise<string> {
  return await fs.readFile(path.join(process.cwd(), 'server', 'app.ts'), 'utf8');
}

/** O corpo de um handler, do `app.<verbo>('<rota>'` até o fechamento dele. */
function handler(fonte: string, assinatura: string): string {
  const i = fonte.indexOf(assinatura);
  expect(i, `não achei ${assinatura}`).toBeGreaterThan(0);
  return fonte.slice(i, i + 4500);
}

describe('as rotas que entregam a aula conferem o gotejamento', () => {
  it('a rota do conteúdo (texto e vídeo) checa o lock e devolve 423', async () => {
    const bloco = handler(
      await app(),
      "app.get('/me/courses/:courseId/lessons/:lessonId/content'",
    );
    expect(bloco).toContain('findModuleLockForLesson');
    // 423 e não 403: o conteúdo é dele, só não abriu ainda — e a resposta diz
    // quando. 403 se lê como "você não tem direito a isto".
    expect(bloco).toMatch(/423, 'LOCKED'/);
    expect(bloco).toContain('lockedUntil');
  });

  it('o heartbeat de tempo assistido também', async () => {
    // Sem isto, tempo em aula que ainda não abriu entra no cálculo de risco de
    // evasão: a coordenação decide sobre um número que, oficialmente, não podia
    // existir.
    const bloco = handler(await app(), '// Watch-time heartbeat');
    expect(bloco).toContain('findModuleLockForLesson');
    expect(bloco).toMatch(/423, 'LOCKED'/);
  });

  it('e a rota de concluir continua checando, como sempre checou', async () => {
    const bloco = handler(await app(), "app.post('/lessons/:id/complete'");
    expect(bloco).toContain('findModuleLockForLesson');
  });

  it('a data de liberação sai legível, e não em ISO', async () => {
    // O aluno lia "liberação em 2026-09-19T03:00:00.000Z". O campo cru segue no
    // corpo do erro, para a tela que queira formatar sozinha.
    const fonte = await app();
    expect(fonte).toContain('function dataDeLiberacao(');
    expect(fonte).not.toMatch(/liberação em \$\{[a-z]+\.lock\.lockedUntil\}/);
  });
});

describe('a tela do módulo não promete o clique que o servidor recusa', () => {
  it('aula de módulo trancado não vira link', async () => {
    // `LMSModule.tsx` não tinha uma única ocorrência de `locked`: renderizava
    // toda aula como `<Link>`, independentemente do lock que o servidor já
    // mandava calculado em `GET /courses/:id`.
    const s = await fs.readFile(
      path.join(process.cwd(), 'src', 'app', 'pages', 'LMSModule.tsx'),
      'utf8',
    );
    expect(s).toContain('module.locked === true');
    expect(s).toContain('aria-disabled');
    // E diz por quê: fila de linhas apagadas sem uma frase se lê como defeito.
    expect(s).toContain('Este módulo abre em');
  });
});
