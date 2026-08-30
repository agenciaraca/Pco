# AVA PCO — inventário completo de páginas para o design

> Documento para ser entregue ao Claude Design. Levantado em 30/ago/2026 a
> partir do código, não de memória: as rotas vêm de `src/app/routes.tsx` e
> `server/public/router.ts`.

---

## 1. O problema central: o produto foi construído em duas metades

Este é o ponto mais importante do documento. Hoje existem **dois sistemas de
interface diferentes** no mesmo domínio, e a costura entre eles aparece:

| | Site público | Aplicação (AVA) |
| --- | --- | --- |
| Onde mora | `server/public/` | `src/app/` |
| Como renderiza | HTML no servidor | React no navegador |
| CSS | folha própria, embutida no `<head>` | Tailwind |
| Tokens | `server/public/styles.ts` | `tailwind.config.js` |
| Fonte | `system-ui` (zero webfont, por desempenho) | `Inter` |
| Header/footer | próprios | próprios, diferentes |

**O que o visitante sente:** ele navega em `psicanaliseclinica.online`, clica em
"Entrar", e cai num site que parece de outra empresa — outro cabeçalho, outro
espaçamento, outro peso de tipografia, outro jeito de botão.

**O que precisa acontecer:** um sistema visual só, que atravesse as duas
metades. Não é redesenhar duas vezes — é desenhar **uma vez** e especificar de
um jeito que sirva às duas implementações.

### O que isso exige do entregável

1. **Tokens como fonte única** — cor, espaçamento, raio, sombra, tipografia,
   expressos como variáveis CSS. As duas metades passam a ler os mesmos nomes.
2. **Header e footer idênticos** nas duas — mesma altura, mesma marca, mesmos
   itens, mesmo comportamento em telas pequenas. Hoje são dois componentes
   distintos com resultados distintos.
3. **Uma biblioteca de componentes** especificada por comportamento, não por
   framework: botão (4 variantes), campo, cartão, aba, tabela, aviso, selo,
   modal, paginação, estado vazio, estado de carregamento, estado de erro.
4. **Transição entre as metades sem salto**: a página de login é a fronteira, e
   hoje é onde o corte mais aparece.

### Restrição técnica que o desenho precisa respeitar

O site público **não carrega webfont** — é decisão de desempenho (nada de
bloqueio de renderização nem de reflow por troca de fonte), e ele é o que o
Google mede. Se o desenho pedir uma fonte específica, ela precisa valer só
dentro da aplicação, ou o site público precisa de um plano de carregamento que
não custe pontos de Core Web Vitals.

---

## 2. Marca e cores oficiais (já aplicadas no código)

```
Ciano principal     #0097b2      Ciano claro      #0cc0df / #5ce1e6
Petróleo (escuro)   #063b49      Laranja          #ff914d
Grafite (texto)     #101828

Degradê oficial — sempre do principal para o escuro:
linear-gradient(118deg, #0097b2 0%, #008ba4 52%, #0b7486 100%)

CTA de conversão:
linear-gradient(118deg, #ff914d, #f07a2f)

WhatsApp: #25D366
```

**O laranja é detalhe, não cor dominante.** Usado em: estrelas de avaliação,
rótulos de categoria do blog, badge do carrinho, links de destaque no rodapé, e
no degradê dos CTAs onde existe decisão de compra (matricular-se, ir para o
pagamento). Em qualquer outro lugar, o ciano manda.

**Tema escuro é obrigatório** nas duas metades — já existe e precisa continuar
funcionando.

---

## 3. Site público — 11 páginas

Renderizado no servidor. É o que aparece na busca e o que recebe anúncio.

| Rota | Página | O que tem dentro |
| --- | --- | --- |
| `/` | **Início** | Hero com foto do consultório sob o degradê, barra de números (desde 2018, alunos, avaliação), vitrine de cursos, artigos recentes, CTA final |
| `/formacoes` | **Formações** | Lista de cursos publicados, com preço e parcelamento |
| `/formacao/:slug` | **Página do curso** | Hero, ementa, grade curricular, para quem é, resultados, FAQ, aviso de formação livre, coluna fixa com preço + "Matricular-se" + WhatsApp |
| `/checkout` | **Checkout** | Resumo do pedido, dados do comprador, escolha de pagamento, "Ir para o pagamento" |
| `/sobre` | **Sobre** | Missão, como ensinamos, números, aviso de formação livre |
| `/contato` | **Contato** | Canais (WhatsApp, e-mail), endereços comercial e pedagógico |
| `/blog` | **Blog** | Lista de artigos com categoria, resumo e tempo de leitura |
| `/blog/:slug` | **Artigo** | Texto longo, autoria institucional, artigos relacionados |
| `/autor` | **Responsável técnico** | Existe só quando houver pessoa nomeada; hoje a autoria é da organização |
| `/curso-preview/:id` | **Prévia de curso** | Amostra sem conteúdo pago |
| `/llms.txt` | (texto puro) | Descrição do site para modelos de linguagem — sem design |

**Componentes que atravessam todas:** cabeçalho fixo com carrinho e alternador
de tema, rodapé de três colunas (contatos + selo RNTP + privacidade), divisor
"pincel" entre seções, botão flutuante de WhatsApp, aviso amarelo de formação
livre.

---

## 4. Portas de entrada e páginas públicas da aplicação — 14 páginas

React. **É aqui que o corte entre as duas metades mais aparece** — a pessoa vem
do site público e cai num visual diferente.

| Rota | Página | Observação para o desenho |
| --- | --- | --- |
| `/login` | **Entrar** | A fronteira entre as metades. Tem e-mail/senha, "lembrar de mim", entrar com Google/Microsoft, e agora uma mensagem específica para quem não tem compra |
| `/esqueci-senha` | Recuperar senha | |
| `/redefinir-senha` | Nova senha | Chega por link de e-mail |
| `/auth/oauth/finish` | Conclusão de login externo | Tela de passagem, dura um instante |
| `/onboarding` | **Boas-vindas** | Primeiros passos de quem acabou de entrar |
| `/catalogo` | Catálogo | Versão em React do que `/formacoes` mostra no site público — **duplicação a resolver no desenho** |
| `/comparar` | Comparar cursos | Tabela lado a lado |
| `/curso-preview/:id` | Prévia de curso | Também duplica a do site público |
| `/aula-preview/:id` | Prévia de aula | Amostra grátis |
| `/verificar/:code` | **Verificação de certificado** | Página pública que terceiros abrem para conferir um certificado — precisa transmitir seriedade |
| `/termos` | Termos de uso | Texto longo |
| `/privacidade` | Política de privacidade | Texto longo, LGPD |
| `/checkout/mock` | Checkout de teste | Interno, sem prioridade |
| `*` | **404** | |

---

## 5. Área do aluno (o AVA) — 25 páginas

É a metade que precisa deixar de parecer outro produto. Todas exigem login.

### Navegação principal

| Rota | Página | O que mostra |
| --- | --- | --- |
| `/dashboard` | **Painel** | Próxima ação recomendada, progresso, avisos, atalhos |
| `/jornada` | **Jornada** | Trilha visual de aprendizagem — módulos, aulas, desbloqueios. Explicitamente **sem mascote e sem ranking infantil**: é público adulto |
| `/cursos` | Meus cursos | Cartões com progresso e prazo de acesso |
| `/pacotes` | Pacotes | Combos de cursos |
| `/biblioteca` | Biblioteca | Materiais de apoio |
| `/news` | PCO News | Notícias e artigos internos |
| `/podcasts` e `/podcasts/:id` | PCO POD | Lista e episódio com player |
| `/tutor` | **Tutor Virtual** | Conversa com IA — precisa de um padrão de chat |
| `/anotacoes` | Minhas anotações | |
| `/certificados` | Certificados | Lista + emissão. **Tem folha de impressão própria** |
| `/eventos`, `/eventos/:id`, `/eventos/:id/transcript` | Eventos ao vivo | Agenda, detalhe, transcrição |
| `/analise-supervisao` | **Análise e supervisão** | Agendamento de sessão: escolher profissional, serviço e horário. O preço vem da titulação de quem atende |
| `/pedidos` | Meus pedidos | Histórico, status, segunda via |
| `/notificacoes` | Notificações | |
| `/perfil` | Perfil | Dados, senha, 2FA |
| `/suporte` | Suporte | Abertura de chamado |

### Dentro do curso (leitor)

| Rota | Página | Observação |
| --- | --- | --- |
| `/curso/:id` | Curso | Índice de módulos e aulas |
| `/curso/:id/modulo/:moduleId` | Módulo | |
| `/curso/:id/aula/:lessonId` | **Aula** | Vídeo + texto longo + navegação entre aulas. É onde o aluno passa a maior parte do tempo — merece o maior cuidado de leitura |
| `/curso/:id/quiz` | Quiz | |
| `/curso/:id/avaliacao/:assessmentId` | Avaliação | |
| `/curso/:id/forum` | Fórum do curso | Discussão por aula |

**Este bloco tem layout próprio** (leitor com barra lateral de navegação do
curso), diferente do resto da área do aluno. São, na prática, **três layouts**
a especificar: site público, área do aluno, e leitor de aula.

---

## 6. Administração — cerca de 80 telas

Listadas por completude. **Sugiro deixar fora do primeiro entregável** — são
internas, não recebem visitante, e o ganho por tela é muito menor. O que elas
precisam é herdar os tokens e os componentes definidos nos itens acima.

Grupos: painel e métricas · cursos, módulos, aulas e transcrições · alunos,
convites, evasão e retenção · biblioteca, news, podcasts e tutor · certificados
· vendas, produtos, cupons, pedidos e gateways · e-mail, templates, mensageria e
broadcasts · webhooks, tokens de API e integrações · importações · saúde, logs,
backups, auditoria e jobs · configurações, papéis e usuários do sistema · LGPD.

---

## 7. Regras de conteúdo que o desenho não pode quebrar

Não são preferências — são obrigações legais ou decisões já tomadas:

1. **Aviso de formação livre** aparece em toda página de curso e artigo: *"Não
   substitui graduação em Psicologia ou Medicina, nem constitui aconselhamento
   clínico. Em caso de crise, ligue para o CVV: 188."* Precisa de um lugar
   visível, não de rodapé escondido.
2. **Análise e supervisão nunca podem ser requisito de curso.** Condicionar a
   venda é venda casada, vedada pelo art. 39, I do CDC. O desenho não pode
   sugerir obrigatoriedade — nem por proximidade, nem por texto.
3. **Autoria é institucional.** O conteúdo é assinado pela organização, não por
   uma pessoa. Não desenhar "cara do professor" sem que exista responsável
   técnico nomeado.
4. **Números sempre com a base.** "58%" sozinho não permite desconfiar; "58% de
   1.122 matrículas" permite. E onde não houve medição, o lugar mostra um
   travessão, não zero.
5. **Preço de sessão vem da titulação de quem atende** (escola, mestrado,
   doutorado), não do serviço.

---

## 8. O que eu preciso receber de volta

Em ordem de utilidade para a implementação:

1. **Tokens** em CSS custom properties, tema claro e escuro, com os nomes que eu
   possa mapear direto nas duas metades.
2. **Header e footer** definitivos, um só par para os dois lados.
3. **Os três layouts**: site público, área do aluno, leitor de aula.
4. **Biblioteca de componentes** com estados (normal, foco, desabilitado, erro,
   carregando, vazio).
5. **As páginas em ordem de impacto**: `/` → `/formacao/:slug` → `/checkout` →
   `/login` → `/dashboard` → `/curso/:id/aula/:lessonId`.

Formato: HTML e CSS estáticos servem perfeitamente. Eu faço a transposição para
as duas implementações.
