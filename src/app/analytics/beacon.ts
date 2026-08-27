/**
 * O sinal de página aberta que alimenta `/admin/metricas`.
 *
 * ## O que sai daqui
 *
 * Um POST minúsculo por página: o caminho, o referrer da primeira página, o
 * `utm_medium` se houver, se a rota caiu no 404 e o LCP que o próprio
 * navegador mediu. Mais nada. Não há id de pessoa, não há cookie, não há
 * leitura de `localStorage`.
 *
 * `sessionId` é um número aleatório guardado no `sessionStorage` — morre com a
 * aba, não atravessa domínio nenhum e o servidor nunca o grava em disco. Ele
 * existe para uma pergunta só: "estas duas páginas são a mesma visita?". Sem
 * ela não há taxa de rejeição nem tempo de sessão.
 *
 * ## Por que não olhamos Do Not Track
 *
 * DNT pede para não ser **rastreado entre sites**. Aqui não há entre-sites: o
 * dado nasce e morre neste domínio, é contador agregado, e nada nele aponta
 * para uma pessoa. Respeitar o cabeçalho significaria devolver ao admin uma
 * subcontagem silenciosa — o mesmo defeito que esta medição veio corrigir,
 * com outra roupa. Se um dia algo aqui identificar visitante, esta decisão
 * precisa cair junto.
 *
 * ## Falha em silêncio, sempre
 *
 * Medição não pode quebrar a navegação de ninguém. Toda falha é engolida.
 */

import type { Router } from '@remix-run/router';

const ENDPOINT = `${import.meta.env.VITE_API_URL ?? '/api'}/analytics/hit`;
const CHAVE_SESSAO = 'ava-pco-sess';

/** O id da rota curinga em `routes.tsx` — é assim que sabemos que deu 404. */
export const ID_ROTA_404 = 'not-found';

function idDaSessao(): string {
  try {
    const existente = sessionStorage.getItem(CHAVE_SESSAO);
    if (existente) return existente;
    const novo =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(CHAVE_SESSAO, novo);
    return novo;
  } catch {
    // Aba anônima com storage bloqueado: cada página vira uma visita. Contar
    // a mais nunca; contar como visita separada, sim — é o mal menor.
    return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

interface Sinal {
  sessionId: string;
  path: string;
  referrer: string;
  utmMedium: string;
  notFound: boolean;
  lcpMs?: number;
  /** Sinal só de desempenho — não conta página vista. */
  apenasVitals?: boolean;
}

function envia(sinal: Sinal): void {
  const corpo = JSON.stringify(sinal);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // sendBeacon sobrevive ao fechamento da aba — é o que faz a última
      // página de uma visita ser contada.
      // `text/plain` de propósito: é um dos tipos que o CORS dispensa de
      // preflight, e `sendBeacon` não tem como responder a um preflight que
      // falhe. Com `application/json` o sinal morria em silêncio sempre que o
      // front e a API estivessem em portas diferentes — o caso do dev local.
      // O servidor lê o corpo como JSON independentemente do cabeçalho.
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([corpo], { type: 'text/plain' }));
      if (ok) return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: corpo,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* medição nunca atrapalha navegação */
  }
}

/**
 * LCP da carga inicial, mandado **separado** da página vista.
 *
 * A primeira versão esperava 2 segundos para mandar a página junto com o LCP.
 * O efeito foi medido no próprio E2E: de ~20 navegações, duas foram contadas.
 * E o viés era o pior possível — quem sai em menos de dois segundos é
 * exatamente quem rejeita, então a taxa de rejeição sairia mais baixa do que
 * a verdade, fazendo o site parecer melhor do que é.
 *
 * Agora a página é contada na hora e o desempenho chega depois, num sinal que
 * o servidor soma ao histograma sem contar visita.
 */
let lcpJaEnviado = false;

function observaLcp(): void {
  if (typeof PerformanceObserver === 'undefined') return;
  let ultimo: number | undefined;

  const despacha = () => {
    if (lcpJaEnviado || typeof ultimo !== 'number') return;
    lcpJaEnviado = true;
    envia({
      sessionId: idDaSessao(),
      path: window.location.pathname,
      referrer: '',
      utmMedium: '',
      notFound: false,
      lcpMs: ultimo,
      apenasVitals: true,
    });
  };

  try {
    const obs = new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) {
        // O último LCP reportado é o válido — o navegador pode revisá-lo.
        ultimo = Math.round(entrada.startTime);
      }
    });
    obs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    /* navegador sem suporte: o p75 fica sem amostra, e a tela diz isso */
    return;
  }

  // O LCP é definitivo quando o usuário interage ou a aba sai de cena; é
  // nesses dois momentos que o valor vai embora.
  window.addEventListener('pagehide', despacha, { once: true });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') despacha();
    },
    { once: true },
  );
  // Rede de segurança para quem fica: 10s é bem depois de qualquer LCP.
  const t = window.setTimeout(despacha, 10_000);
  window.addEventListener('pagehide', () => window.clearTimeout(t), { once: true });
}

function mediumDaUrl(busca: string): string {
  try {
    return new URLSearchParams(busca).get('utm_medium') ?? '';
  } catch {
    return '';
  }
}

let ultimoCaminho: string | null = null;

function marca(pathname: string, busca: string, notFound: boolean, primeira: boolean): void {
  // React Router pode notificar duas vezes a mesma rota (revalidação); página
  // repetida em sequência não é página nova.
  const chave = `${pathname}${busca}`;
  if (chave === ultimoCaminho) return;
  ultimoCaminho = chave;

  envia({
    sessionId: idDaSessao(),
    path: pathname,
    referrer: primeira ? document.referrer : '',
    utmMedium: mediumDaUrl(busca),
    notFound,
  });
}

function ehNotFound(matches: ReadonlyArray<{ route: { id?: string } }>): boolean {
  return matches.some((m) => m.route.id === ID_ROTA_404);
}

/**
 * Liga a medição. Chamada uma vez, no boot. A primeira página é marcada com um
 * atraso curto para dar chance ao LCP de existir — sem isso, quase nenhuma
 * amostra de desempenho chegaria.
 */
export function initAnalytics(router: Router): void {
  if (typeof window === 'undefined') return;
  observaLcp();

  // A primeira página é contada agora, sem esperar por nada. Esperar pelo LCP
  // custava as visitas curtas — que são as rejeições.
  const { pathname, search } = window.location;
  marca(pathname, search, ehNotFound(router.state.matches ?? []), true);

  router.subscribe((state) => {
    if (state.navigation.state !== 'idle') return;
    marca(state.location.pathname, state.location.search, ehNotFound(state.matches), false);
  });
}
