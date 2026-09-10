# `/ava-pco` — auditoria de conversão e copy nova (recebida em 10/set/2026)

> **Status: NÃO EXECUTADO.** Este arquivo guarda o pedido do dono na íntegra,
> para que a próxima sessão execute sem depender da memória da conversa. Nada
> dele foi aplicado. A ordem de execução está na seção 6.
>
> **Antes de começar, leia "O que NÃO pode ser inventado", no fim.**

## 1. Diagnóstico em uma frase

A página fala para o **dono da plataforma** (retenção, score de risco, gestão de
IAs, métricas & SEO, `/admin/tutor`) quando deveria falar para o **aluno que
ainda não comprou**. Resultado: o prospect lê uma ficha técnica de software e
não uma promessa de formação. Não há dor, não há transformação, não há prova
social, não há preço/caminho de compra, e o CTA final ("Entrar no AVA / Primeiro
acesso") pressupõe que ele já é aluno.

### O que quebra a conversão hoje

| Problema | Onde | Efeito no comprador |
|---|---|---|
| Vazamento de backstage: "Score de risco", "recalculado a cada 6 h", "some se ninguém aprovar", "Admin PCO", "Gestão de IAs", "Métricas & SEO", "Limite mensal e escopo configurados em /admin/tutor" | Retenção, Admin, Tutor | Sente-se vigiado/monitorado, não acolhido. Lê custo/limite de IA como restrição. |
| Sem "por quê": 100% features, 0% benefício | Página inteira | Não responde "o que muda na minha vida/carreira?" |
| Descrição do curso genérica (fala de "psicoterapia", "clientes", "terapia de casais") | Multi-cursos | Soa copiada; contradiz a identidade psicanalítica da escola. Mata E-E-A-T. |
| Zero prova social (nº de alunos, depoimentos, professor, credenciais) | Página inteira | Sem Autoridade nem Confiança para uma decisão de formação profissional. |
| CTA errado para o público | Hero e rodapé | "Conhecer o AVA" leva a quê? "Entrar" exclui quem não tem conta. |
| "Sem mascotes, sem ranking infantil" | Jornada | Posicionamento por negação; gasta a frase mais nobre da seção atacando ninguém. |
| Banner PWA "Instalar AVA PCO" para visitante anônimo | Global | Ruído antes do valor; só faz sentido pós-login. |
| Sem FAQ, sem preço/parcelamento, sem garantia, sem duração/carga horária | Página inteira | O comprador sai para procurar isso no Google e cai no concorrente. |
| Análise/supervisão "opcional, contratada à parte" está correta, mas posicionada como aviso legal frio | Certificados | Vira objeção em vez de transparência que gera confiança. |

## 2. Decisão por seção

| Seção atual | Ação | Motivo |
|---|---|---|
| Hero | **Reescrever** | Promessa para o aluno + CTA de compra |
| "Mais do que uma área de aulas" | **Fundir** no hero/benefícios | Redundante |
| Jornada PCO | **Manter + reescrever** | Ótimo ativo; tirar tom de spec |
| Modo Foco | **Manter + reescrever** | Benefício real de estudo |
| Multi-cursos | **Reescrever** | Trocar texto genérico por 3 cards de formações reais + "ver as 15" |
| Recursos do AVA (grid 9) | **Manter, cortar "Plano de retomada"** | Vira benefício "você nunca fica pra trás" em outro lugar |
| Tutor Virtual IA | **Reescrever** | Tirar "limites/pacotes/admin"; manter aviso ético (é E-E-A-T) |
| Conteúdo curado (POD/News/Biblioteca) | **Manter + reescrever** | Bom diferencial |
| **Retenção** | **Remover** da página pública → mover para `/para-escolas` ou `/sobre/metodologia` | É venda B2B/institucional, não B2C |
| Certificados | **Manter + reforçar** | Adicionar validade pública, o que consta, exemplo real |
| Análise e Supervisão (opcional) | **Manter, reenquadrar** | Transparência = confiança; virar oferta de próximo passo |
| **Admin PCO** | **Remover** | Zero relevância para o aluno |
| Primeiro acesso (4 passos) | **Reescrever** como "Como funciona em 4 passos" (comprar → acessar → estudar → certificar) | Passo a passo reduz ansiedade de compra |
| CTA final | **Reescrever** | Compra primeiro, login secundário |
| **Novo:** Para quem é | Adicionar | Identificação (gatilho de pertencimento) |
| **Novo:** Quem ensina | Adicionar | E-E-A-T: Ulisses Jadanhi, ORCID, livros, Lattes |
| **Novo:** Prova social | Adicionar | Depoimentos, nº de alunos, tempo de escola |
| **Novo:** Garantia + preço/parcelas | Adicionar | Reversão de risco |
| **Novo:** FAQ | Adicionar | SEO/GEO + objeções |

## 3. Nova arquitetura + copy pronta

Ordem: Hero → Para quem é → Benefícios (3) → Jornada → Modo Foco → Tutor →
Conteúdo → Formações → Quem ensina → Certificado → Prova social → Como funciona
→ Garantia/Oferta → FAQ → CTA final.

Placeholders entre colchetes = preencher com dado real. **Não publicar número
inventado** (E-E-A-T e Código de Defesa do Consumidor).

### 3.1 Hero

Eyebrow: `Ambiente de estudo da Psicanálise Clínica Online`

**H1:** Estude psicanálise no seu ritmo — com um ambiente feito para você chegar
ao fim.

Sub: Aulas, trilha de estudo, biblioteca, tutor de dúvidas por IA e certificado
com validação pública. Tudo em um lugar, no computador ou no celular, 24 h por
dia.

CTA primário: **Ver formações e valores** (→ /cursos)
CTA secundário (texto): Já é aluno? Entrar no AVA
Micro-prova sob o CTA: `[X] alunos` · `15 formações` · `Acesso imediato após a
matrícula` · `Garantia de [7] dias`

Gatilhos: promessa de resultado ("chegar ao fim"), autonomia, imediatismo.

### 3.2 Para quem é

**H2:** Feito para quem estuda com vida adulta acontecendo ao redor.

Três cards, um por perfil:

- **Quem quer atuar** — "Você quer formação séria em psicanálise para atender, e
  precisa de um caminho claro do primeiro módulo à certificação."
- **Quem já atende** — "Você é psicólogo, terapeuta ou profissional da saúde e
  quer aprofundar a escuta psicanalítica sem parar a agenda."
- **Quem estuda por si** — "Você quer entender Freud, Lacan, Jung e a clínica com
  profundidade, sem a burocracia de uma faculdade."

Gatilho: identificação / pertencimento.

### 3.3 Por que o AVA PCO (3 benefícios)

**H2:** Um ambiente pensado para um problema real: a maioria dos alunos online
não termina.

1. **Você sempre sabe o próximo passo.** A trilha mostra onde você está, o que
   falta e qual é a próxima aula. Sem se perder em pastas de vídeo.
2. **Se a vida atropelar, você retoma sem vergonha.** Ficou semanas fora? O AVA
   monta um plano de retomada realista e a equipe pedagógica fala com você.
   Ninguém é abandonado no módulo 2.
3. **Dúvida às 23h tem resposta.** O Tutor Virtual responde sobre o conteúdo das
   aulas a qualquer hora; para o que é clínico, você tem gente de verdade.

(Aqui a "retenção" vira benefício do aluno — a única forma legítima de ela
aparecer na página.)

### 3.4 Jornada PCO

**H2:** Sua formação em uma trilha que mostra progresso de verdade.

Módulos, aulas e avaliações organizados em sequência. Cada etapa concluída
libera a próxima; cada avaliação devolve feedback. Você vê a formação inteira em
uma tela e o quanto já caminhou.

Bullets: Próxima ação sempre visível · Módulos liberados por progresso ·
Microconquistas a cada etapa · Certificado liberado ao concluir os requisitos

(Manter o mock visual dos 4 módulos — é o elemento mais persuasivo da página.)

### 3.5 Modo Foco

**H2:** Quando é hora de estudar, a tela some — fica só a aula.

Ao abrir uma aula, o AVA troca para um layout de estudo: vídeo em destaque,
material da aula ao lado, trilha à mão e nada de distração. Continua de onde
parou, em qualquer dispositivo.

### 3.6 Tutor Virtual

**H2:** Um tutor de dúvidas disponível a qualquer hora, treinado no conteúdo da
PCO.

Pergunte sobre a aula, peça um exemplo, reveja um conceito. O Tutor Virtual
responde a partir do material dos seus cursos — não da internet. Ele não
substitui supervisão clínica nem atendimento profissional, e diz isso com
clareza. Para o que é clínico, você tem tutoria humana.

(Remover chip "Limite mensal e escopo configurados em /admin/tutor". Manter o
exemplo de chat — trocar por pergunta real de aluno.)

Gatilho: disponibilidade + honestidade (o aviso ético é ativo de confiança, não
passivo).

### 3.7 Conteúdo além da aula

**H2:** Continue estudando fora da tela: no carro, na fila, no café.

- **PCO POD** — episódios por módulo, para revisar ouvindo.
- **PCO News** — leituras comentadas e estudos, curadoria por curso.
- **Biblioteca PCO** — apostilas, leituras obrigatórias e complementares,
  filtradas por tema.

### 3.8 Formações

**H2:** 15 formações, um só ambiente, um só login.

Mostrar 3 cards com **texto real de cada curso** (nome, carga horária, para quem,
preço/parcela, "Ver detalhes"). Sugestão de ordem: Psicanálise Clínica
(carro-chefe) · [2ª mais vendida] · [3ª]. Botão: **Ver as 15 formações**.

Substituir o parágrafo atual do curso de Psicanálise Clínica por algo como:

> Formação completa em psicanálise clínica: fundamentos freudianos, técnica,
> ética da escuta, manejo e construção do caso. Do primeiro conceito ao primeiro
> atendimento supervisionado (opcional).

### 3.9 Quem ensina (novo — E-E-A-T)

**H2:** Formação conduzida por quem pratica, publica e ensina.

Foto + nome + 3 linhas: Ulisses Jadanhi, psicanalista e professor, autor de
*Freud, Seu Filho da Mãe!* e do romance *Onde o Silêncio Grita*; pesquisador com
ORCID `0009-0000-4129-2001` e currículo Lattes; criador dos frameworks
Coordenada Terapêutica e Teoria Etho Simbólica. Links: ORCID, Lattes, livros,
[LinkedIn].
[+ demais professores/tutores com credencial]

Gatilho: autoridade.

### 3.10 Certificado

**H2:** Certificado digital que qualquer pessoa pode conferir.

Ao concluir, você recebe certificado com QR Code e código único. Empregador,
paciente ou instituição confere a autenticidade em segundos, em página pública.
Consta: [nome do curso, carga horária, período, conteúdo programático].

Caixa de transparência (manter): "Certificado de formação livre. Análise pessoal
e supervisão clínica são serviços opcionais, contratados à parte, e não são
requisito para conclusão ou emissão do certificado." + link "Quero incluir
supervisão" (transforma o aviso em upsell).

### 3.11 Prova social (novo)

**H2:** Quem já estuda na PCO.

3 depoimentos com nome, cidade, formação cursada, foto (autorizados). Faixa
numérica: `[X] alunos` · `[Y] certificados emitidos` · `desde [ano]` ·
`[nota/avaliação se existir]`.

Gatilho: prova social + consenso.

### 3.12 Como funciona

**H2:** Da matrícula ao certificado em 4 passos.

1. **Escolha a formação** e conclua a matrícula (Pix, cartão em até [12]x).
2. **Acesse na hora**: login por e-mail, onboarding de [5] minutos, plano de
   estudo montado com você.
3. **Estude no seu ritmo**: aulas, avaliações, tutor e biblioteca, no computador
   ou no celular.
4. **Conclua e valide**: certificado digital com QR Code.

### 3.13 Garantia e oferta (novo)

**H2:** Comece sem risco.

[7] dias de garantia incondicional. Se não for para você, devolvemos 100%.
Acesso por [período]. Suporte humano por [WhatsApp/e-mail] em horário comercial.

Escassez/urgência só se for verdade: turma com tutoria ao vivo, bônus com data,
vagas de supervisão.

Gatilho: reversão de risco, ancoragem (parcela vs. valor total), reciprocidade
(aula aberta grátis, se existir).

### 3.14 FAQ (novo — SEO/GEO)

Perguntas com resposta direta na primeira frase:

- **O AVA PCO funciona no celular?** Sim. Funciona no navegador do celular,
  tablet e computador, e pode ser instalado como aplicativo na tela inicial.
- **Preciso estudar em horários fixos?** Não. Todo conteúdo é gravado e liberado
  por progresso; você estuda quando quiser.
- **O certificado é reconhecido?** É um certificado de formação livre, com
  validação pública por QR Code. A psicanálise não é profissão regulamentada no
  Brasil; [frase institucional da escola sobre isso].
- **O Tutor Virtual substitui um professor?** Não. Ele tira dúvidas sobre o
  conteúdo das aulas. Supervisão e questões clínicas são tratadas por
  profissionais.
- **E se eu parar de estudar por um tempo?** Você retoma de onde parou; a equipe
  pedagógica te ajuda a montar um plano de retomada.
- **Preciso fazer análise pessoal ou supervisão?** São opcionais e contratadas à
  parte; não são requisito para o certificado.
- **Por quanto tempo tenho acesso?** [período].
- **Posso pedir reembolso?** Sim, em até [7] dias após a compra.

### 3.15 CTA final

**H2:** Sua formação em psicanálise começa com um clique — e termina com um
certificado.

Botão primário: **Escolher minha formação** · Secundário: Já sou aluno → Entrar
Linha final: Garantia de [7] dias · Acesso imediato · Suporte humano

## 4. Gatilhos mentais — onde cada um entra

| Gatilho | Onde |
|---|---|
| Promessa/transformação | H1 ("chegar ao fim"), CTA final |
| Identificação | Para quem é |
| Autoridade | Quem ensina, ORCID/Lattes/livros |
| Prova social | Depoimentos, contadores, micro-prova no hero |
| Reversão de risco | Garantia, FAQ reembolso |
| Antecipação/clareza | Como funciona em 4 passos |
| Autonomia | "no seu ritmo", Modo Foco, mobile |
| Honestidade radical | Aviso ético do Tutor, caixa de transparência do certificado |
| Ancoragem | Parcela em destaque ao lado do total |
| Escassez (só se real) | Turmas de tutoria ao vivo / supervisão |

## 5. SEO · GEO · LLM · E-E-A-T

### 5.1 On-page

- **Title:** `AVA PCO: ambiente de estudo online de psicanálise | Psicanálise
  Clínica Online` (≤60 c.)
- **Meta description:** `Estude psicanálise no seu ritmo: trilha de estudo,
  aulas, biblioteca, tutor por IA e certificado com validação pública. 15
  formações em um só ambiente. Garantia de [7] dias.`
- **H1** único (3.1). H2 = as seções acima; H3 = cards. Hoje há eyebrows/labels
  concorrendo com headings.
- **Palavra-chave primária:** "curso de psicanálise online" (o AVA é meio, não
  busca). Secundárias: "formação em psicanálise a distância", "plataforma de
  estudo de psicanálise", "certificado curso de psicanálise". Sem stuffing — uma
  ocorrência natural por seção basta.
- **Bloco de resposta direta** logo após o hero (2–3 frases que definem o que é o
  AVA PCO, para quem e o que entrega) — é o trecho que AI Overviews/LLMs
  extraem.
- **Links internos:** cada formação → sua página; "Quem ensina" → /sobre e página
  do professor; FAQ certificado → página pública de validação; Retenção → nova
  página institucional.
- **Imagens:** `alt` descritivo nos mocks (hoje são divs decorativos — trocar por
  screenshots reais com `alt="Trilha de estudo do AVA PCO mostrando módulos
  concluídos"`), `loading="lazy"`, WebP.
- **Canonical**, `lang="pt-BR"`, Open Graph com screenshot real do AVA.

### 5.2 JSON-LD (emitir do template)

- `Organization` (site-wide) com `contactPoint`, `sameAs` (Instagram, YouTube,
  LinkedIn).
- `WebPage` + `BreadcrumbList` (Home → Nosso AVA).
- `FAQPage` com exatamente as perguntas visíveis da 3.14.
- `Person` para Ulisses com `@id`, `jobTitle`, `hasCredential`, `sameAs` [ORCID,
  Lattes, LinkedIn] — referenciado como `instructor` nos `Course` das páginas de
  curso.
- `ItemList` de `Course` (3 cards visíveis) com `provider` → `Organization @id`,
  `hasCourseInstance.courseMode: "online"`, `offers` com preço real em BRL.
- **Não** marcar `AggregateRating` sem avaliações reais coletadas.

### 5.3 GEO/LLM (ser citado por ChatGPT/Perplexity/AI Mode)

- Um fato por parágrafo, respostas autocontidas (FAQ e bloco de resposta direta
  cumprem isso).
- Números concretos e verificáveis: 15 formações, [X] alunos, [Y] h de aulas, [Z]
  episódios do POD, ano de fundação.
- Frase-definição citável: "O AVA PCO é o ambiente virtual de aprendizagem da
  Psicanálise Clínica Online, escola brasileira de formação em psicanálise, que
  reúne 15 formações, trilha de estudo, biblioteca, podcast pedagógico, tutor por
  IA e certificado com validação pública."
- `dateModified` visível ("Atualizado em …") e revisão trimestral.
- Fora da página: perfil do professor citado em terceiros (The Conversation,
  entrevistas, Google Scholar) alimenta a autoridade de entidade que os LLMs usam
  para decidir citar o domínio.

### 5.4 E-E-A-T (YMYL: saúde mental/educação profissional → barra alta)

- **Experience:** depoimentos reais, screenshots reais do AVA (não mocks),
  "estudo de caso" de um aluno que concluiu.
- **Expertise:** seção Quem ensina com credenciais; bios dos tutores; conteúdo
  programático linkado.
- **Authoritativeness:** ORCID/Lattes/livros/`sameAs`; menções externas.
- **Trust:** CNPJ, endereço, e-mail e WhatsApp no rodapé; páginas de Termos,
  Privacidade, Política de reembolso linkadas; frase honesta sobre regulamentação
  da psicanálise; validação pública do certificado; aviso ético do Tutor.

## 6. Ordem de execução (impacto × esforço)

1. Remover Retenção, Admin PCO e chip `/admin/tutor`; trocar CTAs (hero e final).
   *1 h — maior ganho imediato.*
2. Reescrever hero, Tutor, Jornada, Modo Foco, Multi-cursos com a copy acima.
   *2–3 h.*
3. Adicionar Para quem é, Como funciona, Garantia/oferta, FAQ. *Meio dia.*
4. Quem ensina + prova social (coletar 3 depoimentos autorizados e números
   reais). *1 semana.*
5. JSON-LD + title/meta + screenshots reais com alt. *Meio dia.*
6. Medir: taxa de clique hero→/cursos, scroll até FAQ, conversão da página; rodar
   10 prompts em ChatGPT/Perplexity ("melhor curso de psicanálise online",
   "plataforma para estudar psicanálise") mensalmente e registrar se o domínio é
   citado.

---

## O que NÃO pode ser inventado — leia antes de executar

O plano tem **placeholders de propósito**, e a maior parte é dado que só o dono
tem. Publicar número inventado num site que vende formação em saúde mental é
problema de E-E-A-T **e** de Código de Defesa do Consumidor. Este projeto já
tomou a decisão equivalente na página `/autor`, que está no ar deliberadamente
sem credenciais.

**Precisa vir do dono antes de a seção existir:**

| Placeholder | Onde aparece | Sem ele |
|---|---|---|
| `[X] alunos`, `[Y] certificados` | hero, prova social | a faixa numérica não entra |
| `[7]` dias de garantia | hero, garantia, FAQ, CTA final | a seção de garantia não entra |
| `[período]` de acesso | garantia, FAQ | ver "Prazo de acesso" no CLAUDE.md: **nenhum curso declara prazo hoje**, e declarar é RETROATIVO |
| 3 depoimentos autorizados | prova social | a seção não entra |
| `[LinkedIn]`, foto, demais professores | quem ensina | entra só o que é verificável — ORCID e Lattes são |
| frase sobre regulamentação | FAQ | usar a que já está no rodapé, não escrever outra |
| Política de reembolso | rodapé, FAQ | a página precisa existir antes de ser linkada |

**Duas contradições com o produto real, a resolver antes de escrever a copy:**

1. **"15 formações"** — a vitrine tem **4 cursos ativos** hoje. Ou o número é de
   catálogo (e a página precisa dizer isso), ou a copy erra por 11.
2. **"cartão em até [12]x"** — o teto real sai de `server/payments/condicoes.ts`
   e depende do gateway roteado. **Nunca cravar parcela no HTML**: já houve o
   "12x fantasma" e o cartão de curso que cravava "12x" no markup. Use o valor
   calculado.

**E uma decisão de arquitetura que o plano pede:** mover "Retenção" para
`/para-escolas` ou `/sobre/metodologia` significa **criar uma página nova** — com
rota, sitemap, links internos e lugar no rodapé. Não é um recorte.

**Uma observação minha sobre o diagnóstico, que o concorda e amplia:** o item
"vazamento de backstage" é a mesma família de defeito que este projeto persegue
em código — tela que fala a linguagem do sistema em vez da de quem lê. Aqui ele
custa venda; em `/admin` custava confiança. A regra vale para os dois lados.
