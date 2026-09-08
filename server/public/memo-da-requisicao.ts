/**
 * Uma leitura pesada por requisição, e não uma por chamada.
 *
 * ## O que ele resolve, medido em 8/set/2026
 *
 * A home levava **2,5 a 3,7 segundos de tempo de servidor** — medido no próprio
 * VPS, com `curl` no `127.0.0.1`, sem rede nenhuma no meio. No celular com 4G
 * lento isso virava LCP de 6,9 s; as outras páginas ficavam em 1,4 s e o blog
 * em 0,46 s.
 *
 * Cronometrado leitura a leitura contra o banco de produção:
 *
 * | leitura              | custo   |
 * | -------------------- | ------- |
 * | `numerosDoSite`      | 2483 ms |
 * | `listPublicCourses`  | 1054 ms |
 * | `listPublicPosts`    |  412 ms |
 *
 * Duas causas, e as duas estão dentro de `numerosDoSite`: as três leituras
 * rodavam **em sequência**, e a pior delas era `coursesRepo.listCourses()` — a
 * árvore inteira de cursos, com o conteúdo das 590 aulas, **só para contar
 * quantas aulas existem**. Como a home também chama `listPublicCourses()`, os
 * ~3 MB de conteúdo de aula vinham do banco remoto **duas vezes na mesma
 * página**.
 *
 * ## Por que POR REQUISIÇÃO, e não um cache com relógio
 *
 * Um cache de 60 segundos seria mais rápido e traria um problema: a vitrine
 * mostraria por até um minuto um curso que o admin acabou de despublicar.
 * `publicListed` não é preferência de exibição neste projeto — foi a marca que
 * segurava o curso interno de operadores, e o vazamento dele custou um sprint
 * inteiro em 2/set. Atrasar essa marca em 60 segundos é abrir de volta uma
 * fresta que foi fechada de propósito.
 *
 * Um cache com relógio também exigiria invalidar na escrita, e são **17
 * funções de escrita** só no repositório de cursos. Gancho espalhado por
 * dezessete lugares é gancho que alguém esquece, e o sintoma seria a vitrine
 * mostrando conteúdo velho sem nada explicar.
 *
 * Por requisição não tem nenhum dos dois problemas: a segunda leitura da mesma
 * coisa **na mesma página** é servida de memória, e a próxima visita lê tudo de
 * novo. Zero obsolescência.
 *
 * ## Duas regras
 *
 * - **Falha não fica.** A promessa rejeitada é removida do armazém, então o
 *   `safe()` de quem chamou decide o que a tela diz e uma segunda leitura na
 *   mesma requisição volta a tentar. Guardar o fallback faria "não consegui
 *   ler" virar "não existe", que é o defeito que `falhas-de-leitura.ts` existe
 *   para acabar.
 * - **Fora de requisição não há armazém, e a leitura simplesmente acontece.**
 *   Script, teste e boot não ganham memo — de propósito: memo global é estado
 *   compartilhado entre pessoas diferentes, que é o que este arquivo evita.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const armazem = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

/** Abre o armazém para uma requisição. Chamado no mesmo lugar que a coleta de falhas. */
export function comMemoDaRequisicao<T>(fn: () => Promise<T>): Promise<T> {
  return armazem.run(new Map(), fn);
}

export function memoDaRequisicao<T>(chave: string, ler: () => Promise<T>): Promise<T> {
  const mapa = armazem.getStore();
  if (!mapa) return ler();
  const guardado = mapa.get(chave) as Promise<T> | undefined;
  if (guardado) return guardado;
  const promessa = ler().catch((err) => {
    mapa.delete(chave);
    throw err;
  });
  mapa.set(chave, promessa);
  return promessa;
}
