# 31 de agosto de 2026 — a venda destravou, e as aulas ficaram mudas

> **Ponto exato de retomada.** Local, `origin/main` e **produção** no mesmo
> commit: `604c37c`. Nada pendente de commit, de push nem de deploy.
>
> 222 arquivos de teste, **2.034 testes**, zero falhas. Tipos limpos. Lint sem
> erros. Bundle publicado: `assets/index-B1hDCVfy.js`.
>
> **O primeiro item da próxima sessão não é código** — é autorizar o domínio na
> Vimeo. Ver "O que me tira o sono", abaixo.

Painel vivo: https://claude.ai/code/artifact/d7e9cfca-fc6c-44de-91e7-b30766e81508

---

## O que mudou de figura hoje

A PCO **passou a vender**: dois cursos com preço, página de venda completa,
checkout aceitando. E, medindo outra coisa, apareceu um problema maior que a
venda: **os vídeos das aulas não tocam neste domínio**.

Dezessete commits, oito deploys, cada um conferido pelo hash do bundle — porque
`/api/health` responde 200 mesmo com código velho, e só o bundle prova que subiu.

---

## 1. A troca de disco quase custou o dia inteiro

O repositório saiu de `C:\ia\dev\pco` para `H:\ia\dev\pco`. Os **arquivos**
atravessaram inteiros — comparei byte a byte, incluindo `data/*.json`, `.env` e
`.env.import`. O **`.git`**, não: veio parado no dia 30, dez commits atrás do
GitHub.

O efeito era traiçoeiro: no disco novo, todo o trabalho da madrugada de 31/ago
(carrinho, tokens, links de compra) aparecia como *alteração por salvar*, como se
nunca tivesse sido feito. Uma sessão que começasse ali refaria tudo ou commitaria
por cima. Pior: parte dos objetos veio pela metade — `git log` dava erro ao
chegar no commit do carrinho.

**Corrigido** trazendo o histórico do GitHub e realinhando o marcador sem tocar
em arquivo. A árvore ficou limpa, o que prova que nada se perdeu.

**Decisões do dono:** a cópia em `C:` fica por enquanto (ele apaga depois); os
resíduos de permissão da máquina se refazem conforme aparecerem.

**Lição que virou regra:** copiar pasta de projeto não copia o estado do git de
forma confiável. Da próxima vez, `git fetch && git status` **antes** de qualquer
edição.

---

## 2. Botões e CTAs — o desenho estava certo, a cópia é que era velha

O dono apontou que o acabamento não era o do protótipo. Era verdade, e a causa
raiz importava mais que o sintoma: **havia duas cópias do design no repositório**.

- `docs/design/` — 9 artboards, **sem** `SiteHeader` nem `SiteFooter`. Foi dela
  que saiu a transposição.
- `design pagina publicas pco/design_handoff_ava_paginas_publicas/` — o pacote
  completo, 17 artboards, atualizado pelo dono hoje. **É esta a fonte.**

CLAUDE.md e `docs/design/README.md` agora dizem isso em letras grandes.

O que estava fora do padrão, item a item:

| | Antes | Agora |
|---|---|---|
| Variantes de botão | 3 de 5 | 5 (cta, primary, outline, ghost, wa) |
| Estados | **nenhum** | foco (anel macio), desabilitado, carregando |
| Tamanhos | 1 | 3 (13/24, 14/26 no par do curso, 17/34 no herói) |
| Campo de formulário | sem desabilitado, sem erro | ambos, com `.fi-erro` para a mensagem |
| CTA no topo | só "Entrar" | "Matricular-se" em degradê laranja |
| Herói da home | ação secundária em ciano | CTA grande laranja |
| Carrinho | emoji `🛒` | ícone do protótipo em botão redondo |

**A CTA no topo é a que valia dinheiro:** até hoje o cabeçalho de toda página
levava só para "Entrar" — a porta de quem **já** comprou.

Medido em seis larguras: a barra não estoura em nenhuma; abaixo de 560px as duas
portas descem para dentro do menu. `test/botoes-do-desenho.test.ts` cobra o
contrato inteiro.

---

## 3. O preço — o número veio da loja, não da cabeça de ninguém

Era o item que travava a receita. O que faltava não era código: era o número.

Li a API pública do WooCommerce de `old.psicanaliseclinica.online` e apliquei o
que a loja **está cobrando agora**:

| Curso | Preço | Cheio |
|---|---|---|
| Psicanálise Clínica Online | **R$ 1.198,60** | 3.496,50 |
| Terapia Familiar Sistêmica | **R$ 1.198,60** | 2.196,50 |
| Hipnoterapia Clínica | 599,40 | 1.199,80 |

**Hipnoterapia não foi aplicada**: a importação deixou dois cursos com o slug
`hipnoterapia`, e preço no curso errado cobra o valor errado de gente de verdade.
O script pula slug ambíguo em vez de adivinhar — `scripts/precos_e_vitrine.ts`.

O `price: 1497` do protótipo é maquete e continua não atravessando.

Dois cursos sem produto em lugar nenhum (Super Aluno, Treinamento PCO) **saíram
da vitrine** por decisão do dono — `publicListed: false` esconde do visitante e
preserva o acesso de quem já está matriculado.

**Descoberta pelo caminho:** já existia um produto para o carro-chefe a
R$ 3.496,50, ativo. Ou seja, a página vinha mostrando um preço 3x o da loja.

---

## 4. A home e a página do curso são as do dono, verbatim

Ele entregou os dois textos e foi explícito: *"o texto da home deve ser
exatamente esse"*, com liberdade só de UX/UI. Então as palavras são dele e a
casca é o protótipo.

**Home:** sobre a PCO, três pilares, oito motivos, a carreira, sete depoimentos,
reconhecimento RNTP e a faixa de números.

**Os três números da home são DECLARADOS pela escola, não medidos** — +800
formados, +100 aulas, 96,6% de satisfação. A regra do projeto não morreu: o que
o **sistema** afirma continua andando com a medição, e a barra medida ficou logo
abaixo, rotulada "Medido no sistema, hoje", sumindo sozinha quando não há o que
medir. A diferença entre as duas está no código e no teste
(`test/home-do-dono.test.ts`).

**Página do curso:** seis seções longas, jornada em três etapas, quinze itens de
ementa, destaques, FAQs e o regulamento da promoção (vigência 01/09 a 30/09/2026).
A contagem continua sendo **contada**: 19 módulos e 146 aulas.

Corrigi o `tldr`, que repetia "12 módulos, 60 aulas e 560 horas" do site antigo
enquanto a página conta 19 e 146 — a página se desmentindo sozinha.

**O selo do RNTP** deixou de ser um círculo desenhado à mão e virou a imagem
oficial (`public/img/selo-rntp*.png`), no rodapé e na home. Desenhar à mão um
selo de certificação é pior que não ter: parece o selo sem ser o selo.

---

## 5. Onde se escreve o conteúdo comercial — agora existe

O dono perguntou onde montava o conteúdo da página de venda. Metade dos blocos
**não tinha campo em lugar nenhum do admin**: entrava só por
`scripts/aplicar_conteudo_curso.ts`, rodado por quem tem shell.

Agora a aba **"Página pública"** do curso escreve os cinco que faltavam:
`learningOutcomes`, `highlights`, `sections`, `jornada` e `promoNote`.

`test/pagina-de-venda-editavel.test.ts` amarra os três lados — schema aceita,
admin tem campo, projeção pública continua sendo lista fechada.

---

## 6. Tags de marketing e conversão pelo servidor

**`/admin/marketing`** — não existia. A tela de integrações listava o Google
Analytics como *inexistente*, não como "não conectado".

A decisão que estrutura tudo: **só o identificador entra, nunca script**. Campo
de "cole aqui o código do Google" seria XSS com aparência de recurso — conta de
admin comprometida executaria JavaScript em toda página, para todo visitante.
Cada campo valida o formato do provedor e **o servidor monta o trecho**.

- O carregador vem de `/_pub/tags.js`, same-origin, porque a CSP é
  `script-src 'self'`. Efeito de lado bom: tag de HTML customizado no painel do
  GTM continua barrada.
- **A CSP só afrouxa o que está em uso.** Sem tag, é byte a byte a de antes.
- **Consentimento primeiro**, ligado por padrão, com "Recusar" do mesmo peso de
  "Aceitar". Sem JS não há como pedir nem respeitar escolha, então o `<noscript>`
  do pixel só existe quando o site não exige aceite.

**Conversão pelo servidor** (o que ele chamou de "conversão offline"): o pixel
do navegador perde parte grande das compras porque quem paga sai do site para o
gateway e muitas vezes não volta. O `Purchase` agora pode sair do servidor no
instante em que o pedido vira pago, com `event_id` = id do pedido para o Meta
deduplicar. PII só em SHA-256 normalizado. **Nasce desligado** — é decisão de
dono. O token da API de Conversões é cifrado em repouso e nunca volta para a
tela.

---

## 7. A Sandra entrou como gateway

Sétimo provedor, e o único com desenho diferente: **a cobrança nasce no gateway
da própria escola**, com a credencial dela. A Sandra não recebe o dinheiro, e o
cartão é digitado na página do provedor.

Três coisas que custam dinheiro se estiverem erradas:

1. **A chave de repetição é o id do pedido.** Sem ela, retentativa de rede ou
   duplo clique viram duas cobranças reais. Nunca um id gerado na hora.
2. **CPF/CNPJ é obrigatório e conferido aqui** (com dígito verificador), antes de
   chamar — para que erro de formulário volte como erro de formulário. O checkout
   já coletava o documento; ele parava no cadastro e não chegava ao gateway.
3. **O 502 não é para repetir**: vem com `invoiceId`, a fatura existe, e a escola
   reemite pelo painel.

O aviso `charge.paid` é fase 2 do lado da Sandra e ainda não é emitido. Quem
confirma é **`sandra-poll`**, de 5 em 5 minutos, parando 10 dias depois do
pedido; aparece em `/admin/jobs`. `parseWebhook` já está escrito no contrato
documentado (HMAC sobre `timestamp.corpo`, janela de 5 min) e recusa tudo que não
bate.

**Para cadastrar:** `/admin/gateways` → Sandra. Além da chave (escopo
`charges:write`), a tela pede endereço da instalação, slug da escola e forma de
cobrança. No servidor da Sandra, `PUBLIC_CHARGES` precisa estar ligado.

Fonte: `H:\ia\dev\Sandra\docs\cobranca-api\`.

---

## 8. O CI voltou — e achou um defeito real

A conta do GitHub foi regularizada. O fluxo executou de verdade pela primeira vez
desde 26/ago: tipos, lint, testes e build passaram, e **o deploy automático rodou
sozinho**.

E o E2E falhou, por motivo legítimo: desde 30/ago ninguém entra sem ter comprado,
e o aluno da suíte nasce sem matrícula — **a suíte inteira morria no login com
403**, e ninguém tinha visto porque o CI estava travado e o job roda com
`continue-on-error`. Consertado: o helper matricula pelo admin antes de entrar,
que é o que o produto faz. Desligar o portão no teste mediria um produto que não
existe.

---

## 9. Duração das aulas — medida, mas com uma ressalva grande

Todas as aulas estavam com 15 minutos, preenchimento da importação. Agora
**105 aulas têm a duração real**, somando 48,3 horas de vídeo. As 133 sem vídeo
ficaram como estavam.

Dois tropeços iguais no mesmo dia, e ambos corrigidos: `resolver_duracoes_aulas.ts`
e `aplicar_conteudo_curso.ts` **não liam o `.env`** e miravam o seed em vez do
banco. Script de manutenção precisa carregar o ambiente como a aplicação carrega.

E o terceiro, que é o achado do dia: a primeira execução resolveu **zero de 105**
sem dar erro. A causa não era vídeo sem duração — era bloqueio de domínio
devolvendo HTTP 200 com o corpo vazio. O script agora distingue as duas coisas e
grita a diferença.

Para medir, usei `VIMEO_REFERER=https://portalpco.online/`, um domínio que a
Vimeo já autoriza. **Isso mede, mas não faz a aula tocar.**

---

## O que me tira o sono

### 1. As aulas não tocam neste domínio — e quem já pagou é quem sente

Os vídeos são da Vimeo com **privacidade por domínio**. A lista autoriza
`portalpco.online`, o portal antigo. De `psicanaliseclinica.online` — onde o AVA
vive desde 30/ago — a Vimeo responde **403, "Because of its privacy settings"**.
Conferido no player, no oEmbed e na API autenticada.

São **105 aulas com vídeo** nessa condição. Não é defeito de código nem coisa que
deploy resolva: é uma linha na configuração da conta da Vimeo
(**"Psicanalise Digital"**, user 107108908). Os vídeos estão
`privacy.embed: "whitelist"` e `privacy.view: "disable"`.

**O conserto:** adicionar `psicanaliseclinica.online` (e subdomínios em uso) aos
domínios autorizados. Tentei pela conexão Vimeo disponível aqui — as ferramentas
expostas leem metadados, mas **não** alteram privacidade. É ação de dono.

Assim que entrar, conferir aula por aula e rodar o resolvedor de duração sem o
`VIMEO_REFERER` de contorno.

### 2. O preço mora num arquivo, não no banco

Produto era o último registro de dinheiro fora do Postgres. O código para levá-lo
já está publicado e é aditivo — **cai no arquivo enquanto a tabela não existir**,
então publicar antes de migrar não muda nada.

Falta a DDL, e o usuário da aplicação não tem permissão (`42501`, conferido):

```bash
DATABASE_URL=<credencial de dono> npx tsx server/db/migrate.ts   # cria payment_products
# depois, pelo painel:
POST /admin/payments/products/migrar                             # leva o JSON para a tabela
```

A mesma credencial de dono continua na lista para ser **rotacionada** — passou
por conversa em 27/ago.

### 3. 560 ou 380 horas?

A página antiga anuncia **560 horas/aula**; o curso no sistema declara **380**, e
é 380 que a página nova mostra. Módulos e aulas ela conta sozinha (19 e 146). Só
o dono diz qual é a carga horária certa. (O vídeo medido soma 48,3 h — que é
outra grandeza, não substitui carga horária.)

---

## Só o dono destrava (fora os três acima)

1. **Cadastrar os profissionais que atendem** — agendamento pronto, zero
   cadastrados. `/admin/analise-supervisao`.
2. **Declarar o prazo de acesso de cada curso** — efeito retroativo; simular
   antes com `POST /admin/jobs/access-expiry/run?dryRun=true`.
3. **Revisão jurídica, LGPD e descrições** — módulo 17 × FAQ, os três parágrafos
   de LGPD do rodapé, dois cursos com lixo do scraper e quatro repetindo o título.
4. **Disparar os 507 convites** — cota de 300/dia, dois dias de envio.
5. **Credencial do Search Console** — agora tem onde colar: `/admin/marketing`.
6. **Certificado de `old.psicanaliseclinica.online`** — resolvido: voltou ao ar
   hoje, com certificado válido até 29/11/2026.

## Aberto, e não depende do dono

- **Auditoria das 222 contas com presença no portal e sem ficha** —
  `scripts/auditar_contas_sem_ficha.ts --db`.
- **Delta da loja**: `scripts/sync_wc_delta.ts --commit` — 4 contas e 4
  matrículas de gente que pagou e não entrou.
- **Transpor `Dashboard.dc.html` e `Aula.dc.html`** — as duas telas de dentro do
  AVA, que são React/Tailwind e não SSR. Depois: `Sobre`, `Contato`, `Blog`,
  `Post`, `Autor` contra o pacote novo.

---

## Como retomar

```bash
cd H:\ia\dev\pco
git fetch && git status        # ANTES de editar: a lição da troca de disco
git log --oneline -1           # deve ser 0c665af (produto em 604c37c)
npm run test                   # 222 arquivos, 2.034 testes
```

**Leia antes de mexer em tela pública:** o pacote de design é
`design pagina publicas pco/design_handoff_ava_paginas_publicas/README-HANDOFF.md`.
`docs/design/` é a cópia velha e parcial.

**Antes de qualquer script contra produção:** confirme que ele importa
`dotenv/config`, e rode sem `--commit`/`--aplicar` primeiro. Dois scripts miraram
o seed hoje por causa disso.
