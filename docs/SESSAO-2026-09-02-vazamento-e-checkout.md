# 2 de setembro de 2026 — o curso interno vazando, e a venda que não passava

Sessão longa, em duas metades. A primeira fechou a dívida conhecida do handoff
anterior (`docs/SESSAO-2026-09-02-campo-sem-coluna.md` — **leia aquele
primeiro**, é independente deste). A segunda começou com um relato do dono e
virou cinco problemas distintos.

> **Se você só tem cinco minutos:** as Entregas 1 e 2 estão no ar e
> verificadas — a venda voltou a passar pelo Pagar.me e o curso interno parou de
> vazar (de 105 URLs de vídeo abertas a zero). A Entrega 3 — PCNews, Podcasts e
> Biblioteca — **não começou, e é o que sobrou**. Pule para "Por onde retomar",
> no fim.

## O relato do dono, e o que ele era de verdade

> "o curso treinamento pco é apenas para operadores, e todos os alunos estão
> visualizando e podendo fazer o curso, não vi uma trava do tipo curso fechado,
> pago etc... é um erro grotesco da plataforma"

O diagnóstico está certo no essencial e errado na causa: **a trava existe e
está ligada.** O Treinamento PCO (id `14958`) já estava marcado
`publicListed: false`, e tem só **19 matrículas** — ninguém matriculou a escola
inteira. Três caminhos ignoravam a marca.

Depois vieram mais quatro relatos, na mesma mensagem:

> "Aluno tenta comprar mais cursos / Falha [erro do Pagar.me] / Biblioteca
> somente com 3 titulos quando tenta baixar nada acontece / PCNews não deixa
> clicar nas materias / Podcasts estão mudos"

## O que foi medido em produção

| medida | valor |
| --- | --- |
| cursos que `/api/courses` devolve **sem token** | 4 |
| `videoUrl` expostos a quem não está logado | **105** |
| Treinamento PCO: módulos / aulas / vídeos | 8 / 53 / 9 |
| matrículas no Treinamento PCO | 19 |
| matrículas em "Como ser um Super Aluno Online" (**também `publicListed: false`**) | **655** |
| matérias no PCNews, todas com `body` completo | 77 |
| itens na Biblioteca, todos com `fileMockUrl: "#"` | 3 |
| episódios de Podcast, nenhum com áudio | 3 |

### As três camadas do vazamento

1. **`GET /api/courses` responde sem token e ignora `isPubliclyListed`.** A
   regra era aplicada no site público, no checkout e na prateleira do SPA — em
   toda parte, menos na rota que serve todas elas. E `semConteudoDeAula`
   removia `content` (conserto de 27/ago) mas não `videoUrl`. Para um curso
   feito de podcasts gravados, **o vídeo é o curso**.
2. **`Courses.tsx` (`/cursos`)** ramifica em `!isEnrolled && product`. Curso
   **sem produto ativo** — que é a definição de curso interno — caía no `else`,
   que era um botão **"Começar"** apontando para `/curso/:id`. Era o botão que
   o dono viu.
3. **`LMSLesson.tsx`** usava `isEnrolled` só para buscar o texto e o heartbeat.
   O `<VideoAula>` renderizava **incondicionalmente**.

O servidor sempre protegeu o que passa por `courseAccessFor`: texto da aula e
progresso devolvem 403 a não matriculado. **O vídeo nunca passou por lá.**

## Decisões que o dono já tomou (não perguntar de novo)

| pergunta | resposta |
| --- | --- |
| Checkout: quais métodos? | **Os três, com CPF no checkout** |
| Biblioteca e Podcasts? | **Construir player e upload agora** |
| Como entregar? | **Checkout primeiro, entrega própria** |

---

## Entrega 1 — NO AR e verificada ✅

Commit `a3872c3`, deploy conferido pelo hash do bundle
(`CTm9z7wA` → `NH5bI7Yv`), `/api/health` com `db: connected`.

O erro que a aluna recebeu tinha **duas causas somadas**:

1. A API v5 do Pagar.me recusa o pedido inteiro quando um método está em
   `accepted_payment_methods` e o bloco de configuração dele não vem junto.
   Pedíamos cartão, boleto e pix, e mandávamos zero blocos.
2. No mesmo payload: `"name":"mariadyduda"`, que é o e-mail da compradora
   cortado no `@`. `POST /payments/checkout` mandava ao gateway **só o
   e-mail**, enquanto `POST /public/checkout` — que faz a mesma coisa — sempre
   mandou nome, CPF e telefone.

O método e o bloco passaram a ser montados da mesma lista. Sem documento,
boleto **não é oferecido**: oferecê-lo faria o gateway recusar a compra inteira
e a pessoa perderia também cartão e pix. `documentoValido` mudou de
`providers/sandra.ts` para `shared/documento.ts` porque o navegador agora
precisa dela — o caminho antigo continua exportando.

**A prova que falta é uma compra real.** A conta de teste `aluno@pco.local` não
existe em produção, e não criei uma só para isso. Testes cobrem o payload e o
nível da rota; o que ninguém pode simular é o gateway aceitando de verdade.
**Peça ao dono uma compra de ponta a ponta.**

## Entrega 2 — NO AR e verificada ✅

Mergeada em `aac4f58`, mais `306eb91`. Deploy conferido: bundle
`NH5bI7Yv` → `BlnhwBJr`, `/api/health` com `db: connected`, e o servidor em
`306eb91`.

O que está no ar:

- `server/access/conteudo-aula.ts` remove `videoUrl` além de `content`.
- `GET /courses` e `GET /courses/:id` passam a depender de quem pergunta:

  | quem | quais cursos | com `videoUrl`? |
  | --- | --- | --- |
  | anônimo | só os publicamente listados | não |
  | aluno | os listados **+ aqueles em que tem matrícula** | não |
  | admin | todos | sim |

- `GET /me/courses/:c/lessons/:l/content` devolve `videoUrl` junto do texto,
  atrás do `courseAccessFor` que já estava lá.
- `LMSLesson.tsx` monta o player com essa URL.
- `Courses.tsx`: o ramo final deixa de ser porta aberta.
- `test/curso-interno-nao-vaza.test.ts`, 18 casos por persona. **8 deles falham
  contra o código anterior** — foi assim que se conferiu que provam alguma
  coisa.

### A prova em produção

| medida | antes | agora |
| --- | --- | --- |
| cursos que `/api/courses` devolve sem token | 4 | **2** |
| `videoUrl` na resposta anônima | **105** | **0** |
| `content` na resposta anônima | 0 | 0 |
| aulas com ementa na resposta anônima | — | 170 (a ementa vende, e continua) |
| `GET /api/courses/14958` sem token | 200, 53 aulas | **404** |
| `GET /api/courses/8887` sem token | 200 | **404** |
| `GET /api/courses/14839` sem token | 200 | 200 |

### Duas coisas que escrever o teste descobriu

**1. O admin ia perder a URL dos vídeos, uma aula por vez.** A branch tirava o
`videoUrl` também de `GET /courses/:id` — e **não existe `GET
/admin/courses/:id`**. O editor de curso lê da rota pública e é dela que prefill
o campo "URL do vídeo" (`AdminCourseEditor.tsx:2157`). Com o campo ausente, o
formulário abriria vazio e **gravaria o vazio por cima** ao salvar. Sem erro,
sem aviso: as 171 aulas com vídeo perderiam a URL à medida que alguém editasse.
É a mesma classe do campo sem coluna — salva, responde 200, e o dado some em
silêncio. Corrigido com a escapatória de admin, e fixado pelo último caso do
arquivo de teste.

**2. Havia um quarto caminho, e ele só apareceu depois dos outros três.** Com o
curso fora do catálogo, sem botão na tela e com o vídeo atrás do portão, um
`curl` anônimo em `/api/courses/14958` ainda trazia a ementa inteira do
treinamento de operador: 8 módulos, 53 títulos de aula. Ementa é pública **por
padrão**, não apesar da marca. Agora responde 404 — e não 403, que confirmaria
a existência do curso, mesmo motivo de `/public/checkout`.

Consumidores da rota, todos conferidos antes de fechá-la: `/curso-preview/:id`
(público, já mostra "Curso não encontrado"), `Quiz.tsx` (aluno matriculado),
`AdminCourseEditor` e `AdminQuestions` (admin escapa).

## Entrega 3 — NÃO COMEÇOU

Levantada, planejada, nada escrito. **É o que sobrou.**

- **PCNews.** `News.tsx` tem **zero** `Link`, `onClick` ou `href` em 137 linhas,
  e não existe rota `/news/:id`. As 77 matérias têm `body` completo no payload
  e não há como abrir nenhuma. É só frontend: rota nova + página que renderiza
  o `body` com `sanitizeHtml`, e os cards viram `Link`.
- **Podcasts.** `audioUrl` existe no schema, no tipo e no formulário do admin —
  e **nenhuma tela do aluno o renderiza**. Não estão mudos: nunca tiveram som.
  **`server/public/csp.ts` não emite `media-src`** — áudio de host externo cai
  em `default-src 'self'` e é bloqueado em silêncio, exatamente como o
  `frame-src` bloqueava o player de vídeo. A diretiva tem de entrar junto com o
  player, com teste em `test/video-da-aula.test.tsx`.
- **Biblioteca.** 3 itens de semente com `fileMockUrl: "#"`; o link do front
  honra o campo, não há arquivo. `server/uploads/store.ts` só aceita imagem e
  5 MB: falta `application/pdf` com teto próprio, e um botão de upload em
  `AdminLibrary.tsx` reusando `POST /uploads`, que já existe.

**Recomendação sobre áudio:** episódio de 30–45 min pesa 30–50 MB, e o upload
local tem teto de 5 MB e é servido sem `Range` (sem seek). O caminho
sustentável é hospedar fora, como os vídeos já ficam na Vimeo — o campo
`audioUrl` do admin já aceita. O upload local fica para os PDFs da biblioteca.

---

## Estado exato dos repositórios

| onde | commit | situação |
| --- | --- | --- |
| `main` local, `origin/main` e **produção** | `306eb91` | Entregas 1 e 2 no ar |
| `entrega-2-vazamento-curso` | `05191ca` | mergeada; pode ser apagada |

Nada em stash. A árvore fica limpa.

## Duas armadilhas encontradas hoje, que vão voltar

**Workers do vitest vazam e travam a suíte.** Chegaram a **82 processos
`node.exe`** pendurados, e aí *qualquer* arquivo de teste falhava com
`Timeout waiting for worker to respond` — inclusive um teste trivial de três
linhas. Parece defeito no seu código e não é. Conferir com
`tasklist //FI "IMAGENAME eq node.exe" //NH | wc -l`. Antes de matar, confira
que nenhum servidor seu está ouvindo (`netstat -ano | grep LISTENING`), porque
`taskkill //F //IM node.exe` **derruba junto os servidores MCP** — foi o que
aconteceu, e chrome-devtools, context7, github, memory e playwright caíram.

**`npm run format` continua proibido** — reformata centenas de arquivos não
tocados e uma das reflows chegou a quebrar a indentação de um item de lista do
`CLAUDE.md`. Já está registrado na memória do projeto.

## Por onde retomar

1. `git fetch && git status` — a regra que o CLAUDE.md fixou.
2. **Peça ao dono duas provas que só ele pode dar**, e as duas são de olhar,
   não de código:
   - **a compra de ponta a ponta** (Entrega 1), a única que não dá para simular;
   - **um dos 19 operadores abrindo o Treinamento PCO** e um dos 655 abrindo o
     Super Aluno (Entrega 2). O risco desta entrega não é vazar de novo: é ter
     fechado demais, e a conta de aluno de verdade é o que mede isso.
3. Entrega 3, na ordem PCNews (menor) → Podcasts (**a CSP vem junto, e é o
   ponto de maior risco**) → Biblioteca.

O plano aprovado, com o detalhamento de cada arquivo, está em
`C:\Users\Usuario\.claude\plans\reactive-humming-puzzle.md`.
