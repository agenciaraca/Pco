import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * ALU4-006 · o player de podcast era uma animação, e ela gravava dado.
 *
 * A tela do episódio não tinha `<audio>` em lugar nenhum. O "player" era um
 * `setInterval` somando 0.6% a cada 200ms numa barra; `episode.audioUrl` — que
 * existe no DTO — nunca era lido; e o botão "voltar 15s" mexia num número.
 *
 * O que transforma isso de tela incompleta em **dado falso**: aos 80% daquele
 * progresso inventado a página gravava `listened: true`. A métrica de
 * engajamento com podcast da escola era produzida por uma animação — ninguém
 * tinha ouvido nada, e o número existia.
 *
 * ## Por que o teste lê o arquivo
 *
 * Montar a página exigiria simular `HTMLMediaElement` inteiro (jsdom não
 * implementa `play()`, `duration` nem `timeupdate`), e o teste ficaria medindo
 * o dublê. O que precisa ser garantido aqui é estrutural e cabe na leitura: o
 * áudio existe, o progresso vem dele, e a marca de "ouvido" depende do tempo
 * real — não de um contador.
 */

async function fonte(): Promise<string> {
  return await fs.readFile(
    path.join(process.cwd(), 'src', 'app', 'pages', 'PodcastEpisode.tsx'),
    'utf8',
  );
}

describe('o player toca o arquivo, não uma animação', () => {
  it('existe um <audio> ligado ao `audioUrl` do episódio', async () => {
    const s = await fonte();
    expect(s).toMatch(/<audio/);
    expect(s).toContain('src={audioUrl}');
  });

  it('o progresso vem do áudio, e não de um contador', async () => {
    const s = await fonte();
    expect(s).toContain('onTimeUpdate');
    // O contador que fingia. Se voltar, a barra volta a andar sozinha.
    expect(s).not.toMatch(/setInterval\([\s\S]{0,80}setProgress/);
    expect(s).not.toMatch(/p \+ 0\.6/);
  });

  it('"ouvido" depende do tempo real reproduzido', async () => {
    const s = await fonte();
    // 80% de `currentTime / duration`, os dois vindos do elemento.
    expect(s).toMatch(/currentTime \/ a\.duration >= 0\.8/);
    expect(s).toContain("patch: { listened: true }");
  });

  it('sem arquivo, a tela diz isso em vez de oferecer um play que finge', async () => {
    const s = await fonte();
    expect(s).toContain('ainda não tem o áudio publicado');
    // E o botão de tocar não fica clicável sem áudio.
    expect(s).toContain('disabled={!audioUrl}');
  });

  it('a CSP permite o áudio — sem `media-src` ele não tocaria', async () => {
    // `media-src` entrou em 3/set/2026 **antes** de existir player, de
    // propósito: o bug do vídeo custou dias porque a diretiva faltante só
    // aparece depois de muito procurar na conta do provedor.
    const csp = await fs.readFile(
      path.join(process.cwd(), 'server', 'public', 'csp.ts'),
      'utf8',
    );
    expect(csp).toContain('media-src');
  });
});
