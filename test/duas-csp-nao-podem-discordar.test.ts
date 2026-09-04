import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { montarCsp, cabecalhosDeSeguranca, HOST_DO_PLAYER } from '../server/public/csp';

/**
 * PUB-003 e PUB-014 · existem duas políticas de segurança, e elas discordavam.
 *
 * O projeto tem **dois alvos de deploy** — o VPS Node (`server/dev.ts`, que é
 * produção) e a Vercel (`vercel.json`, que ninguém usa hoje mas está no
 * repositório e vale se alguém publicar por lá). Cada um traz a sua própria
 * política, escrita à mão, e elas divergiram em três pontos — todos na direção
 * insegura:
 *
 * 1. **`script-src 'self' 'unsafe-inline'`** na Vercel. Isso derruba
 *    exatamente a defesa que as tags de marketing existem para ter: o campo
 *    "cole aqui o código do Google" valida o formato e **o servidor monta o
 *    trecho**, servido de `/_pub/tags.js` — same-origin — justamente porque
 *    `script-src 'self'` bloqueia inline. Com `'unsafe-inline'`, uma conta de
 *    admin comprometida volta a poder executar JavaScript em toda página, para
 *    todo visitante.
 * 2. **Sem `frame-src`.** O bug do player de vídeo, de novo, e no mesmo
 *    formato: sem a diretiva o iframe cai em `default-src 'self'` e o site
 *    bloqueia o próprio player. Custou dias de diagnóstico na conta da Vimeo
 *    quando aconteceu no VPS.
 * 3. **HSTS `includeSubDomains; preload`.** O `dev.ts` gasta doze linhas
 *    explicando por que isso não pode: servindo o domínio principal, a
 *    diretiva vale para *todos* os subdomínios — inclusive `old.`, que hospeda
 *    a loja e não tem certificado válido. Quem abrisse o site principal ficaria
 *    um ano sem conseguir acessar a loja, **sem opção de "continuar assim
 *    mesmo"**, porque HSTS não tem escapatória por clique. E `preload` é pior:
 *    entra numa lista embutida nos navegadores, e sair dela leva meses.
 *
 * A explicação vive aqui porque **JSON não aceita comentário** — não há onde
 * escrever, dentro do `vercel.json`, por que cada diretiva é o que é. Um
 * arquivo de configuração sem lugar para o porquê é um arquivo que diverge.
 *
 * Este teste não exige políticas idênticas: os dois alvos são diferentes e
 * podem, legitimamente, ter diferenças. Ele exige que as **garantias** sejam
 * as mesmas, e que nenhuma das três regressões acima volte.
 */

const vercel = JSON.parse(
  readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf-8'),
) as {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};

function cabecalhoVercel(nome: string): string {
  const bloco = vercel.headers.find((h) => h.source === '/(.*)');
  const item = bloco?.headers.find((x) => x.key === nome);
  expect(item, `vercel.json não emite ${nome} para todas as rotas`).toBeDefined();
  return item!.value;
}

/** A política do VPS, sem tag de marketing cadastrada — o caso base. */
const cspDoVps = montarCsp({ script: [], img: [], connect: [], frame: [] });
const cspDaVercel = cabecalhoVercel('Content-Security-Policy');

describe('as duas CSP dão as mesmas garantias', () => {
  it('nenhuma das duas permite script inline', () => {
    // A diretiva de script é a que separa "tag de marketing é identificador"
    // de "tag de marketing é execução arbitrária".
    for (const [alvo, csp] of [
      ['VPS', cspDoVps],
      ['Vercel', cspDaVercel],
    ] as const) {
      const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
      expect(scriptSrc, `${alvo} não emite script-src`).toBeDefined();
      expect(scriptSrc, `${alvo} permite script inline`).not.toContain('unsafe-inline');
      expect(scriptSrc, `${alvo} permite eval`).not.toContain('unsafe-eval');
    }
  });

  it('as duas liberam o player de vídeo — senão o site bloqueia a própria aula', () => {
    for (const [alvo, csp] of [
      ['VPS', cspDoVps],
      ['Vercel', cspDaVercel],
    ] as const) {
      expect(csp, `${alvo} não emite frame-src`).toContain('frame-src');
      expect(csp, `${alvo} não libera o player`).toContain(HOST_DO_PLAYER);
    }
  });

  it('as duas emitem media-src — a mesma parede, agora para o áudio', () => {
    // Sem `media-src`, o áudio cai em `default-src 'self'`. É o bug do vídeo
    // repetido no podcast, e entrou na política ANTES de o player existir de
    // propósito: a parede já está derrubada quando a sprint começar.
    for (const [alvo, csp] of [
      ['VPS', cspDoVps],
      ['Vercel', cspDaVercel],
    ] as const) {
      expect(csp, `${alvo} não emite media-src`).toContain('media-src');
    }
  });

  it('as duas negam enquadramento e limitam base e formulário', () => {
    for (const [alvo, csp] of [
      ['VPS', cspDoVps],
      ['Vercel', cspDaVercel],
    ] as const) {
      expect(csp, alvo).toContain("frame-ancestors 'none'");
      expect(csp, alvo).toContain("base-uri 'self'");
      expect(csp, alvo).toContain("form-action 'self'");
    }
  });
});

describe('HSTS não derruba os subdomínios', () => {
  it('a Vercel não manda includeSubDomains nem preload', () => {
    const hsts = cabecalhoVercel('Strict-Transport-Security');
    expect(
      hsts,
      'includeSubDomains deixa quem visita o site principal um ano sem acessar ' +
        'old.psicanaliseclinica.online, que ainda não tem certificado — e HSTS ' +
        'não tem escapatória por clique',
    ).not.toContain('includeSubDomains');
    expect(
      hsts,
      'preload entra numa lista embutida nos navegadores, e sair dela leva meses',
    ).not.toContain('preload');
  });

  it('o VPS também não, enquanto a variável não for ligada', () => {
    const [, hsts] =
      cabecalhosDeSeguranca({
        extras: { script: [], img: [], connect: [], frame: [] },
      }).find(([nome]) => nome === 'Strict-Transport-Security') ?? [];
    expect(hsts).toBe('max-age=31536000');
  });

  it('mas o VPS permite ligar quando o certificado existir', () => {
    // Guarda contra "consertar" tornando impossível: o dia em que
    // `old.` tiver certificado próprio, `includeSubDomains` deve voltar.
    const [, hsts] =
      cabecalhosDeSeguranca({
        extras: { script: [], img: [], connect: [], frame: [] },
        hstsIncluiSubdominios: true,
      }).find(([nome]) => nome === 'Strict-Transport-Security') ?? [];
    expect(hsts).toContain('includeSubDomains');
  });
});

describe('os cabeçalhos de segurança não dependem do modo de execução', () => {
  it('o conjunto é o mesmo, e não vive dentro de um `if`', () => {
    // PUB-014: este bloco morava dentro do `if (staticRoot)` do `dev.ts`, e
    // por isso `npm run dev` — o modo em que se desenvolve — servia o site
    // público SSR **sem CSP nenhuma**. Foi o que tornou o bug do `frame-src`
    // irreproduzível localmente: o player funcionava na máquina de quem
    // programava porque não havia política para bloqueá-lo.
    const dev = readFileSync(resolve(process.cwd(), 'server/dev.ts'), 'utf-8');
    const semComentarios = dev
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');

    const aplicacoes = semComentarios.match(/root\.use\('\*', aplicaSeguranca\)/g) ?? [];
    expect(
      aplicacoes.length,
      'os dois modos (full-stack e dev) precisam aplicar o middleware',
    ).toBe(2);
  });

  it('emite os seis cabeçalhos', () => {
    const nomes = cabecalhosDeSeguranca({
      extras: { script: [], img: [], connect: [], frame: [] },
    }).map(([n]) => n);
    expect(nomes).toEqual([
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'X-Content-Type-Options',
    ]);
  });
});
