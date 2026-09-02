# 2 de setembro de 2026 — a dívida conhecida, e um campo a mais do que se sabia

Sessão de retomada. Não havia nada aberto em código: local, `origin/main` e
produção no mesmo commit (`f15d757`), árvore limpa, PM2 online, `/api/health`
com `db: connected`. O que restava era a lista "dívida conhecida, sem urgência"
do handoff anterior, com três itens.

Os três foram fechados. Um deles era maior do que estava escrito.

## Item 1 — a aula de demonstração, e o que apareceu junto

O handoff dizia: _"`/aula-preview/:id` responde 403 em produção: `isPreview` não
tem coluna no banco, então a preview pública de aula está morta. Ou cria-se a
coluna, ou remove-se a rota."_

**Criar a coluna era a escolha óbvia**, e não por preferência: a UI inteira já
existe e é elaborada. Caixa "aula de demonstração" no editor do admin, selo "tem
aula grátis" no catálogo, lista de aulas livres na página do curso, item no
checklist de publicação. Remover a rota significaria arrancar cinco pontos de
tela de um site que está tentando converter.

Mas o 403 era o **menor** dos sintomas. Medido no código:

- `createLesson` no caminho de banco **não gravava** `isPreview`.
- `updateLesson` **não propagava** a mudança.
- A leitura devolvia sempre `undefined`.

Ou seja: marcar a caixa no admin salvava sem erro e não fazia nada. Nunca fez.
O administrador não tinha como perceber — o formulário responde 200.

### E `transcripts` estava na mesma situação

Ao conferir quais campos do `createLessonSchema` a tabela `lessons` sabe
guardar, apareceu um segundo: **`transcripts` também não tinha coluna**. O
editor tem um painel de transcrição com três idiomas e botão de copiar de um
para o outro; o texto se perdia no caminho do banco, e as duas rotas que servem
transcrição respondiam `NO_TRANSCRIPT` para toda aula — o que se lê como
"ninguém cadastrou ainda", não como "o sistema apaga o que você digita".

### É a terceira vez

| campo         | perdido até | o que o admin via                           |
| ------------- | ----------- | ------------------------------------------- |
| `content`     | 21/ago/2026 | aula salva; 309 terminavam no meio da frase |
| `isPreview`   | 2/set/2026  | caixa marcada, sem efeito                   |
| `transcripts` | 2/set/2026  | três idiomas digitados, texto descartado    |

O que une os três é **a ausência de erro**. E a razão de a suíte não pegar:
`test/courses-repo-fields.test.ts` roda sobre o `JsonStore`, que é justamente o
caminho que sempre funcionou. O defeito só existia no banco.

`test/aula-cabe-no-banco.test.ts` compara `createLessonSchema` com as colunas de
`lessons` e falha se divergirem. Foi verificado com dentes: removendo a coluna
de propósito, ele quebra em três asserções nomeando o campo.

**A migration `0017` é aditiva, mas o código não sobe antes dela.** O Drizzle
seleciona coluna a coluna: a app nova contra o banco velho quebra toda consulta
a `lessons` — comprovado antes de aplicar, com a query falhando pelo nome da
coluna que faltava. Migração primeiro, deploy depois.

## Item 2 — o `&amp;` na URL do vídeo, que eram três

O handoff falava em "um `videoUrl`". Medidos em produção: **três**.

```
?color&amp;autopause=0&amp;dnt=true&amp;loop=0…
```

A Vimeo lê isso como os parâmetros `amp;autopause`, `amp;dnt`, `amp;loop` — e os
ignora sem reclamar. O vídeo toca, e nenhuma das configurações vale. Inclusive
`dnt=true`, o "não rastreie este espectador".

A causa é a mesma dos títulos de aula, e vale como regra: **valor lido de dentro
de HTML não é o valor.** `extract_video_url` extrai a URL de um atributo
(`<iframe src="…">`) — o regex parar em `"` e `<` é o sinal disso — e nunca
desescapava. Corrigido lá, com um detalhe que o teste cobra: desescapar
**depois** de casar o regex, nunca antes, senão um `&lt;` viraria `<` e cortaria
a URL no meio.

As 3 linhas já gravadas foram corrigidas por
`scripts/corrigir_entidades_video.ts` — ensaio por padrão, `--aplicar` para
gravar. Ensaio mostrou 3, aplicou 3, reconferência dá 0.

## Item 3 — os scripts do VPS, cujo problema não era o IP

O handoff mandava revisar `update_vps_pwd.py`, `restart_vps.py`,
`sync_data_to_vps.py`, `deploy.sh` e os `docs/migration-*.md`, "que ainda
apontam para o IP morto `177.7.35.13`".

**Lidos, nenhum dos três scripts tem IP fixo** — todos leem `HOST` de variável
de ambiente, e o `sync_data_to_vps.py` já traz o IP certo no exemplo de uso. Os
docs que citam o IP já o citam _dito morto_. Corrigir o IP não corrigiria nada.

O problema real é outro, e é maior: **os três são anteriores ao PM2.** Sobem a
app com `setsid nohup npx tsx`, por fora do processo gerenciado. O
`sync_data_to_vps.py` ainda dava `pkill` antes — o PM2 reergue o que foi morto,
os dois disputam a porta 3035, e produção fica em laço de reinício. No fim de um
script cujo nome fala em copiar arquivo.

- `restart_vps.py` e `update_vps_pwd.py` **recusam** rodar sem
  `SEI_O_QUE_FACO=1` (o mesmo portão que o `sync_data_to_vps.py` já usava) e
  imprimem o caminho de hoje. Ficam no repo porque servem de referência para um
  host sem PM2.
- `sync_data_to_vps.py` passou a reiniciar com `pm2 restart ava-pco`.

### O `AGENTS.md` era o pior deles, e não é script

Ele mandava, com todas as letras: _"When the user says 'atualize a produção',
run `restart_vps.py`"_. Também passava o host morto, com senha — que deixou de
existir em 30/ago — e dizia que o job de E2E do CI tem `continue-on-error: true`,
removido em 26/ago.

Era uma cópia congelada do `CLAUDE.md`: 195 linhas contra 642, tocada duas vezes
na vida. Virou um ponteiro para o `CLAUDE.md`, com o registro do que estava
errado.

**Instrução errada num arquivo escrito para agente não é documentação
desatualizada — é uma ordem que alguém executa.** Duas fontes de verdade
divergindo é a mesma armadilha que produziu os defeitos de coluna.

## Estado ao fim da sessão

Verificação completa, nesta ordem: **typecheck** limpo, **lint 0 erros** (550
warnings, do mesmo tipo pré-existente — o script novo usa `console.log` como os
outros scripts do repo), **227 arquivos / 2082 testes passando** (eram 226/2067)
e **build OK**.

Um aviso para a próxima sessão: **não rode `npm run format` neste repo.** O
Prettier reformata centenas de arquivos que ninguém tocou — a árvore não é
prettier-limpa e o CI não cobra isso (roda typecheck → lint → test → build). Uma
das reflows chegou a quebrar a indentação de um item de lista do `CLAUDE.md`.
Formate só o que você escreveu.

Produção: migration `0017` aplicada (18 no journal, `is_preview` e `transcripts`
presentes na tabela) e as 3 URLs de vídeo corrigidas.

## O que continua aberto

Sem mudança desde ontem, e nada bloqueia venda ou aula:

1. **Decisão do dono** — as 160 pessoas apagadas na origem entre julho e agosto,
   com 256 matrículas e 97 com progresso real.
2. **Sem dado que responda** — a origem das 418 contas sem ficha. Precisa de um
   mapa de referências regerado pela carga v3.
3. **Conteúdo, não código** — 419 das 590 aulas não têm vídeo, e por isso 363
   ficam com o placeholder de 15 min.

Uma observação nova, fora do repositório: **`.claude/settings.local.json` guarda
senhas em texto claro** — a antiga senha de SSH do VPS e as
`INITIAL_*_PASSWORD`. Ele é gitignored e **nunca foi versionado** (conferido no
histórico), então não há vazamento no repo; mas as credenciais estão no disco em
claro, e as do VPS já não valem. Trocar as `INITIAL_*` e limpar o arquivo é
decisão do dono — não mexi nele, porque é a lista de permissões da máquina e
editá-la quebraria o ambiente de trabalho.

## Por onde começar na volta

`git fetch && git status` antes de qualquer edição. Depois, no `CLAUDE.md`, a
seção **"Campo de aula sem coluna: o defeito que não dá erro"** — é a lição
desta sessão, e a que tem mais chance de se repetir: o próximo campo de aula que
alguém acrescentar ao `createLessonSchema` sem coluna cai exatamente no mesmo
buraco, e agora existe um teste esperando por ele.
