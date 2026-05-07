# Guia do administrador — AVA PCO

Este guia é pra você que vai operar o AVA no dia-a-dia: cadastrar cursos,
gerenciar alunos, configurar pagamentos, responder suporte. Não cobre
deploy/devops — pra isso, ver [deploy.md](./deploy.md).

---

## 1. Primeiro acesso

Use a credencial de admin/superadmin enviada na criação da conta. URL:

- Local: http://localhost:5173/login
- Produção: https://ava.psicanaliseclinica.online/login

Após login, você cai em `/admin/dashboard` com KPIs (receita, alunos,
certificados, satisfação) e alertas pendentes.

### Primeira coisa a fazer
1. Vá em **`/admin/setup`** — checklist do que precisa estar configurado.
2. Resolva os itens em vermelho (gateway de pagamento, e-mail, secret de
   criptografia, etc.) seguindo os links.

---

## 2. Cursos e conteúdo

### 2.1. Criar/editar curso
- **Catálogo de cursos**: `/admin/cursos` — lista, contagem de alunos,
  carga horária, tags.
- **Editor**: clique em qualquer curso → editor com 3 abas:
  - **Geral**: título, slug (URL), descrição, tags, capa colorida,
    pré-requisitos (curso A precisa ser concluído antes de B),
    "O que você vai aprender" (bullets), instrutor, co-instrutores,
    customização do certificado (cores, logo, texto), trilhas etc.
  - **Módulos & Aulas**: estrutura hierárquica. Cada módulo pode
    ter `releaseAt` (data fixa) ou `releaseAfterEnrollmentDays`
    (drip relativo) para liberação programada.
  - **Avaliação**: setup do quiz por módulo (em desenvolvimento — banco
    de questões já disponível em sprint 503).

### 2.2. Lessons preview livre
Cada aula tem flag `isPreview`. Se ativada, a aula vira teaser público
(visível em `/aula-preview/:id` sem auth). Útil pra marketing.

### 2.3. Drip content
Em cada módulo, defina **um** dos dois (ou ambos):
- **Liberação em data fixa** (datetime-local): todos os alunos só veem
  o módulo a partir dessa data.
- **N dias após matrícula**: cada aluno vê o módulo só após N dias
  desde a sua matrícula. Útil pra cohorts pedagógicas que entram em
  momentos diferentes.

Se ambos preenchidos, o módulo libera quando AMBOS já tiverem passado
(o mais tardio vence).

### 2.4. Trilhas de estudo
`/admin/trilhas` — sequência ordenada de cursos. Aluno se matricula na
trilha e vê "próximo passo" automaticamente quando termina cada curso.

### 2.5. Certificados customizáveis
No editor do curso → seção **Certificado**: customize título,
preâmbulo, corpo (suporta tokens `{{course}}` e `{{hours}}`), cores,
logo, assinatura. Defaults globais quando vazios.

---

## 3. Alunos

### 3.1. Listar e filtrar
`/admin/alunos` — tabela com nome, email, cursos matriculados, score
de risco, último acesso. Filtros por status (ativo/em_risco/bloqueado/inativo).

### 3.2. Detalhe do aluno
Clique num aluno → 5 abas:
- **Geral**: dados pessoais, status, ações (impersonate, force logout,
  reset senha).
- **Progresso**: curso por curso, percent completion.
- **Risco**: motivos do score de evasão.
- **Certificados**: emitidos + em progresso.
- **Recursos**: Notas pessoais, anexos.

### 3.3. Visualizar como aluno (impersonate)
No detalhe do aluno → **Entrar como aluno** (admin/superadmin).
Sessão de 30 min com banner permanente "Visualizando como X" + botão
"Sair desta visão". Ações sensíveis (excluir conta, mudar senha,
refund, criar API token) ficam bloqueadas durante a sessão.

### 3.4. Matrícula em lote
`/admin/cursos/:id/alunos` → **Matricular alunos** → seleciona
múltiplos. Pré-requisitos são checados; alunos que não cumprem
caem em `ineligible`. Override possível com confirmação.

### 3.5. Evasão (retention)
`/admin/evasao` — score de risco com toggle Tabela | Kanban.
Selecione alunos → **Notificar selecionados** dispara mensagem
in-app. Para mensagem mais elaborada, use **Plano de Retomada IA**
(precisa configurar provider em /admin/ias).

---

## 4. Pagamentos

### 4.1. Gateways
`/admin/gateways` — 6 providers: Mock, Stripe, Asaas, Pagar.me,
MercadoPago, PayPal. Cada um precisa de credenciais (criptografadas
em repouso com AES-GCM).

**Importante:** sem `AI_KEY_ENCRYPTION_SECRET` em produção, as chaves
ficam em modo `dev:` (sem criptografia real). Configure antes de
colar credenciais reais.

### 4.2. Produtos
`/admin/produtos` — cursos, bundles, session_pack, tutor_pack.
Cada produto associa a um curso/bundle e tem priceCents + currency.

### 4.3. Cupons
`/admin/cupons` — desconto percent ou amount. Min order, max uses,
expiração. Bulk export CSV.

### 4.4. Pedidos e refund
`/admin/pedidos` — todos os pedidos. Refund parcial possível
(provider executa via API + revoga acesso ao curso).

### 4.5. Vendas / analytics
`/admin/vendas` — revenue série temporal, top produtos, status
distribution, comparison previousRange.

---

## 5. Comunicação

### 5.1. E-mail transacional
`/admin/email` — provider config (Resend/SendGrid/Postmark/SMTP/Mock).
4 templates pré-prontos: password_reset, order_paid,
course_enrolled, welcome.

### 5.2. Broadcasts
`/admin/broadcasts` — campanhas in-app + e-mail pra audiences:
- Todos os alunos ativos
- Por curso matriculado
- Por status (em_risco, etc.)
- Lista de userIds explicítos

### 5.3. Reengajamento automático
`/admin/reengajamento-auto` — worker que envia push pra alunos
inativos. Config: cooldownDays, inactivityDays, onlyEnrolled.

### 5.4. Webhooks
`/admin/webhooks` — saída pra integrações externas. Use os presets
(Slack, Discord, Zapier, n8n, Make, Pipedream) ou genérico.
Ver [webhooks-cookbook.md](./webhooks-cookbook.md) para receitas.

### 5.5. Digest semanal
Configure em `/admin/digest` (admin-digest existente) ou via
weekly-report (segunda 9h UTC). Recebe e-mail consolidado de KPIs.

---

## 6. Suporte e moderação

### 6.1. Tickets de suporte
`/admin/suporte` — tickets abertos. Cada um pode ser assumido,
respondido, fechado.

### 6.2. Moderação de discussões/reviews
`/admin/moderacao` — filtros por flagged, reports, etc. Remoção
soft (oculta) ou hard (deleta).

### 6.3. LGPD — exclusões
`/admin/lgpd-exclusoes` — solicitações de exclusão de dados feitas
por alunos. Fluxo aprovação → confirmação. Dados são apagados
permanentemente após confirmação.

---

## 7. Segurança e usuários do sistema

### 7.1. Usuários do sistema (operadores)
`/admin/usuarios` — não-alunos: admins, superadmin, atendentes
custom. Apenas superadmin pode atribuir o papel "Superadmin".

Outros papéis criados em **`/admin/papeis`** (sprint 473) ficam
disponíveis no dropdown — selecione um e o tier de auth é
herdado automaticamente.

### 7.2. Papéis e permissões
`/admin/papeis` — 100+ permissões granulares com labels PT-BR.
Cada papel declara seu **tier** de auth (student/admin/superadmin).
Use a aba **Matriz** pra comparar lado-a-lado.

### 7.3. API tokens
`/admin/api-tokens` — tokens read-only pra integrações externas
(BI, Zapier, etc.). 7 escopos: stats:read, students:read,
orders:read, courses:read, certificates:read, products:read,
all:read. Endpoints documentados via OpenAPI em
`/api/v1/openapi.json`.

### 7.4. Auditoria
`/admin/auditoria` — log de mutações sensíveis (últimas 5000).
Filtros por action, actorId, targetType, period. Export CSV.

### 7.5. Sessões
`/admin/sessoes` — usuários do sistema com sessões vivas
(lastLoginAt < 30d). Force logout dispara bumpTokenVersion,
invalidando tokens antigos.

### 7.6. Erros e logs
- `/admin/erros` — 5xx persistidos em `data/errors.json`.
- `/admin/logs` — ring buffer in-memory de 5000 linhas console.*.
- `/admin/saude` — health snapshot agregado.
- `/admin/jobs` — status dos workers (webhooks, reengajamento,
  imports schedule, digest, weekly-report, backup).

---

## 8. Importação de dados externos

### 8.1. CSV
`/admin/imports/wizard` — upload CSV → mapping de colunas →
dry-run → run real. 8 entidades suportadas (students, courses,
modules, lessons, etc.).

### 8.2. WordPress / LearnDash / WooCommerce
`/admin/imports/wizard-api` — connector REST com Application
Password. Importa users, courses, modules, lessons, products,
orders, enrollments. **Diagnóstico**: se receber 401
`forbidden_context`, rode o **diagnose tool** (ver imports.md).

### 8.3. Schedules (imports recorrentes)
`/admin/imports/schedules` — cron-like (daily/weekly + hourUtc).
Worker dispara no slot configurado.

### 8.4. Histórico e rollback
`/admin/imports/history` — todos os jobs, filtros por status.
Cada job tem **rollback best-effort** (desfaz mutações onde
possível).

---

## 9. Configurações gerais

### 9.1. Configurações
`/admin/configuracoes` — ajustes da plataforma (org name,
horários, etc.).

### 9.2. Customizar Login
`/admin/login-customizacao` — branding da página de login
(cores, logo, mensagem de boas-vindas).

### 9.3. Backup
`/admin/backups` (auto, snapshots diários 4h UTC) +
`/admin/backup` (configs em separado).

---

## 10. Atalhos e dicas

- **Ctrl+K** em qualquer página de aluno: abre student search palette.
- **/admin/atividade**: timeline cross-entity (toda a atividade
  recente do sistema).
- **/admin/alertas**: central de alertas (erros, jobs com falha,
  KPIs anormais).
- **/admin/sobre**: versão, build, links úteis.

### Exportações CSV
Várias páginas (cursos, alunos, pedidos, audit log) têm botão
**Exportar CSV** no header.

### Filtros via URL
Alguns filtros persistem na URL (ex.: `?status=em_risco` em
/admin/evasao). Bookmark fica.

### Múltiplas abas
A maioria das ações destrutivas requer **X-Confirm-Name** —
você digita o nome do recurso pra confirmar exclusão. Evita
acidentes.

---

## Onde buscar ajuda

- **Erros do servidor**: `/admin/erros` ou `~/ava-pco/app.log` no host.
- **Status geral**: `/admin/saude`.
- **Documentação técnica**:
  - [architecture.md](./architecture.md)
  - [deploy.md](./deploy.md)
  - [security.md](./security.md)
  - [webhooks-cookbook.md](./webhooks-cookbook.md)
- **Suporte interno**: ticket via `/suporte` (você verá em `/admin/suporte`).
