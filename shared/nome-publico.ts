/**
 * O nome que aparece ao lado do que um aluno escreve — nunca um e-mail.
 *
 * Três telas publicam texto de aluno para outros alunos, e duas delas gravavam
 * o **endereço inteiro** no campo de nome:
 *
 * - **Fórum do curso** (`authorName`) — corrigido em 3/set/2026.
 * - **Avaliação de curso** (`userName`) — `student.name || u.email`, e
 *   `GET /courses/:id/reviews` é **público, sem token**: o e-mail de quem
 *   avaliou virava conteúdo indexável por buscador.
 * - Comentário de aula já fazia certo, e foi de onde a regra saiu.
 *
 * Cada um resolvia (ou não) por conta própria. Duas cópias da mesma regra
 * acabam discordando — é o motivo de `shared/documento.ts` e
 * `shared/visibilidade.ts` existirem, e agora deste arquivo.
 *
 * ## O que a função garante
 *
 * O retorno **nunca contém `@`**. Isso vale inclusive quando o nome cadastrado
 * é ele próprio um e-mail — caso real: contas importadas da loja cujo
 * `display_name` veio como o endereço. Sanear só na escrita deixaria de fora as
 * linhas já gravadas, então esta função é usada **nos dois lados**: ao gravar e
 * ao devolver.
 */

/** Um valor que se parece com endereço de e-mail não serve como nome público. */
function pareceEmail(valor: string): boolean {
  return /\S+@\S+/.test(valor);
}

/** `maria.souza@exemplo.com` → `maria.souza`. Só a parte local. */
function parteLocal(valor: string): string {
  return valor.split('@')[0]!.trim();
}

/**
 * Nome de exibição a partir do nome cadastrado e, como reserva, do e-mail.
 *
 * Devolve `'Aluno'` quando não há nada aproveitável — melhor um rótulo genérico
 * do que uma linha sem autor, que a tela renderizaria como espaço em branco.
 */
export function nomePublico(
  nome?: string | null,
  email?: string | null,
): string {
  const limpo = (nome ?? '').trim();
  if (limpo && !pareceEmail(limpo)) return limpo;
  // O nome cadastrado é um e-mail: aproveita a parte local dele antes de
  // recorrer ao endereço de login, que pode ser outro.
  if (limpo) {
    const local = parteLocal(limpo);
    if (local) return local;
  }
  const local = parteLocal((email ?? '').trim());
  return local || 'Aluno';
}
