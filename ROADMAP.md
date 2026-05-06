# AVA PCO — Roadmap completo

LMS para Psicanálise Clínica Online. Stack: Hono + React 18 + TanStack Query + JsonStore (default) / Drizzle Postgres (opcional).

Histórico de tudo que foi entregue + backlog em aberto. Cada commit mencionado existe no histórico de `main`.

---

## Estado atual (atualizado em 2026-05-05)

| Métrica | Valor |
|---|---|
| Sprints entregues | **430+** |
| Commits no main | **210+** |
| Arquivos de teste | **62** |
| Testes passando | **590** ✅ |
| Módulos backend | 29 |
| Páginas admin | 62+ |
| Páginas aluno | 15+ |
| Providers de pagamento | 6 (Mock, Stripe, Asaas, Pagar.me, MercadoPago, PayPal) |
| Providers de e-mail | 5 (Mock, Resend, SendGrid, Postmark, SMTP) |
| Connectors de import | 3 (WP, LD, WC) + CSV |
| Tipos de webhook outbound | Generic + Slack + Discord |
| Achievements automáticos | 6 |
| Provedores de IA | OpenAI / Anthropic / Mock |
| Permissões de API tokens | 7 escopos |

Stack: Hono v4 + Node 20 + tsx (sem build, runtime). React 18 + Vite + TanStack Query + React Router 6. JWT HS256 + tokenVersion + bcrypt. AES-GCM 256 (server/db/encryption.ts). 2FA TOTP RFC 6238. PWA (manifest + service worker).

---

## Sprints entregues por área

### Pagamentos
- 6 providers: Mock, Stripe (Checkout Sessions + webhook HMAC), Asaas (PIX/Boleto/Cartão), Pagar.me Orders v5, MercadoPago Preferences, PayPal Orders v2 (OAuth + capture)
- CRUD de gateways com credenciais AES-GCM 256
- Produtos (course/bundle), pedidos, cupons (percent/amount, min order, max uses, expiração)
- Refund parcial em todos os 6 providers + revoga acesso
- Sales analytics (revenue série temporal, top produtos, status distribution, comparison previousRange)
- UI: `/admin/gateways`, `/admin/produtos`, `/admin/pedidos`, `/admin/coupons`, `/admin/sales`

### Importação WP/LD/WC
- **Sprint A**: foundation (types, stores, csv-templates 8 entidades)
- **Sprint B**: parser CSV + dry-run + wizard UI
- **Sprint C**: connectors REST (WordPress, LearnDash, WooCommerce) com credenciais encrypted
- **Sprint D**: enrollment engine (5 startRules × 7 expirationRules) + execução real via adapters
- **Sprint E**: histórico, relatórios CSV/JSON, rollback best-effort, conexões CRUD UI
- **Diagnose tool**: testa /wp-json + /users/me + /users?context=edit pra debugar 401 forbidden_context

### E-mail transacional
- 5 providers (Resend, SendGrid, Postmark, mock, SMTP stub)
- Sender com sendSafe (best-effort) + log estruturado
- 4 templates (password_reset, order_paid, course_enrolled, welcome) com layout branded + escape XSS
- Hooks: reset de senha, order paid, refund, welcome
- Admin: configs CRUD, ping, send-test, preview, logs

### Segurança
- 2FA TOTP RFC 6238 puro (sem deps), backup codes (sha256 hash)
- Login 2-step (ticket + code)
- Setup/enable/disable/regen via UI
- Webhooks de saída com HMAC-SHA256 estilo Stripe
- Retry exponencial (1m/5m/30m/2h, 5 tentativas)
- Worker em background
- API tokens públicos read-only (7 escopos: stats/students/orders/courses/certificates/products + all)
- Two-step destructive delete (X-Confirm-Name)
- Rate limit middleware (in-memory ring) com dashboard
- LGPD: deletion-requests com fluxo de aprovação

### Course features
- Course bundles (kind=bundle + metadata.courseIds[]) — grant múltiplo no checkout
- Course duplicate (clone completo)
- Course tags + filtro nas listagens
- Course reviews/ratings (1-5 estrelas + comentário, só matriculados)
- Course preview mode (admin vê como aluno)
- Course analytics consolidado
- Per-student analytics agregado

### Engajamento + Achievements
- Reengagement automático configurável (cooldownDays, inactivityDays, onlyEnrolled)
- 6 achievements/badges (first_lesson, first_course, three_courses, streak_7, streak_30, tutor_helper)
- Notification preferences (opt-out broadcasts/reengajamento)
- Wishlist por aluno
- Streak counter no dashboard
- Lesson watch time tracking (heartbeat 30s)

### Operacional
- Health dashboard agregando 9 sinais
- Activity feed cross-entity (audit + email + webhook + reengagement + orders)
- Audit log append-only (5000 entries)
- Errors store (client + server, 2000 entries)
- Cron/jobs viewer com tick manual
- System logs viewer (ring buffer 5000 linhas)
- Rate-limit dashboard com top IPs/paths/blocks
- Setup checklist (8 itens com progresso)
- Settings backup/restore (JSON v1 com whitelist)

### Comunidade
- Lesson discussion thread (1 nível de resposta + moderação)
- Admin notes per-aluno
- Tutor virtual (chat com IA via OpenAI/Anthropic) com histórico

### Comunicações
- Email broadcasts segmentados (6 audiências)
- Slack/Discord webhooks (formatadores dedicados)
- Unsubscribe link em broadcasts (JWT scope)
- Welcome email automatic on signup

### Operações admin
- Bulk actions de alunos (ativar/desativar/excluir/desmatricular/sendEmail/forceLogout)
- Search global cross-entity com `Ctrl+K` palette
- Sessions inspector + force logout
- Saved searches/filters per-admin

### Conteúdo
- Live sessions (Zoom/Meet integração)
- Tags em biblioteca/podcasts
- Library + Podcasts CRUD
- News (postagens admin)
- Certificate render + validation público
- CSV exports (users/orders/courses) com BOM UTF-8

### PWA + UX
- PWA básico (manifest + sw + offline.html)
- Login customization (cores, posição, theme, logo)
- Markdown lite renderer

---

## Sprints recentes (últimos 30 commits)

| Commit | Sprint | Tema |
|---|---|---|
| `3aac472` | 430+ | typecheck fixes (categorias suporte + cast unknown) |
| `9ffa946` | 429 | support-tickets repo (7 testes) |
| `d599023` | 427 | tutor-history (8 testes) |
| `209f8b8` | 426 | login-config + cert-validations (8 testes) |
| `cec8c3b` | 424 | webhooks-endpoints-store (10 testes) |
| `8c9bd45` | 423 | webhooks-delivery-store (9 testes) |
| `56d9af4` | 422 | reengagement-config (8 testes) |
| `fcb8178` | 421 | discussions-crud (9 testes) |
| `1a0e7e2` | 420 | reviews-store (9 testes) |
| `4150813` | 419 | activity-feed (10 testes) |
| `b67ca56` | 418 | audit-log (10 testes) |
| `0886998` | 417 | errors-store (9 testes) |
| `3cdbb3b` | 416 | health (6 testes) |
| `2d2619b` | 414 | notification-sender (8 testes) |
| `a8860b5` | 413 | notification-templates (18 testes) |
| `4a5167b` | 411 | achievements-store (9 testes) |
| `ff0c181` | 408 | users-store-crud (15 testes) |
| `1cfc9d9` | 407 | export-csv (12 testes) |
| `223456c` | 406 | jwt (8 testes) |
| `48cb7c5` | 405 | password-reset (7 testes) |
| `dfcd7ed` | 404 | api-tokens (11 testes) |
| `e428abc` | 401 | import-validators (24 testes) |
| `f2ab6e2` | 402 | import-normalizers (25 testes + bug fix em bool()) |
| `874f651` | 399 | import-job-store (8 testes) |
| `11ce71a` | 398 | refs-store (8 testes) |

---

## Endpoints principais por área

### Admin
- `/admin/setup` — checklist
- `/admin/saude` — health
- `/admin/atividade` — activity feed
- `/admin/jobs` — workers
- `/admin/logs` — server logs
- `/admin/rate-limits` — rate-limit telemetry
- `/admin/sessoes` — sessions inspector
- `/admin/sessoes-ao-vivo` — live sessions
- `/admin/imports` — importer hub
- `/admin/gateways` — payment gateways
- `/admin/email` — e-mail config + logs
- `/admin/broadcasts` — campanhas
- `/admin/webhooks` — outbound
- `/admin/api-tokens` — API público
- `/admin/cursos/:id/analytics` — analytics
- `/admin/cursos/:id/preview` — preview como aluno
- `/admin/backup` — config backup/restore
- `/admin/about` — info do sistema
- `/admin/alunos/:id` — perfil aluno + analytics
- `/admin/alertas` — central de alertas
- `/admin/tutor` — chat com IA admin
- `/admin/exclusoes` — deletion requests LGPD

### API pública
- `/api/v1/me` — info do token
- `/api/v1/stats` — métricas agregadas
- `/api/v1/students` — list students
- `/api/v1/orders` — list orders
- `/api/v1/courses` — list courses
- `/api/v1/certificates/validate/:code` — validate público

---

## Backlog (não iniciado)

### Cobertura de testes restante (alta prioridade)
- **api-token-middleware** — auth flow + scope check (medium effort)
- **invoice generator** — render PDF/HTML de comprovante
- **sales-analytics edge cases** — already 12 testes, faltam empty range & comparison null
- **websocket / SSE** se houver — verificar
- **leaderboard scoring** — pesos por badge/lesson/curso

### Documentação
- ✅ docs técnica de cada módulo (já tem 12 docs)
- **Documentação de deployment passo-a-passo** (`docs/deploy.md`) — não-iniciado
- **Guias de usuário admin** (não-técnico) — não-iniciado
- **API pública openapi.json** — não-iniciado
- **Cookbook de webhooks** — não-iniciado

### Features extras (não-iniciadas)
- **Admin onboarding wizard interativo** (oposto do checklist passivo)
- **Live session embed direto na aula** (Zoom SDK) em vez de só link externo
- **Course collaborators / co-instrutores** — papel "instrutor" com acesso parcial
- **Quiz auto-correção via Tutor IA** — ramificação do tutor
- **Forum/canal por curso** (acima de comentários por aula) — discussão geral
- **Kanban admin de evasão** — extensão do AdminEvasion já existente
- **Live transcription / chat IA durante aula** — fora do escopo atual
- **Mobile app nativo** — PWA atual cobre o essencial
- **Editor visual de e-mail templates** — hoje é HTML cru
- **Bilhetes IA semanal** (digest pra admin sobre saúde da plataforma)

### Robustez (não-iniciados)
- **Tests de UI/integration** com Testing Library + MSW (hoje só unit em puros)
- **E2E** com Playwright
- **CI** GitHub Actions (`npm test && npm run typecheck && npm run build`)
- **Coverage report** com badge no README
- **Migrações Drizzle** dos novos campos `tags` em libraryItems/podcasts
- **Rate limit por API token** dedicado
- **Backup remoto S3** (hoje só local em `data/backups/`)

### Integrações (não-iniciadas)
- **Webhook templates** (presets prontos para Zapier/n8n/Make)
- **Mais providers de e-mail** (Mailgun, Brevo, SES)
- **OAuth login social** (Google/Microsoft) — só email/senha hoje
- **SSO SAML** para escolas grandes
- **WhatsApp via Twilio** para notificações (já tem mock no Reengagement)
- **Calendly/Cal.com** para agendamento de mentoria

### LMS específicos (não-iniciados)
- **Streak counter detalhado** com heatmap (já tem o counter, falta visualização)
- **Goal setting** (meta semanal de minutos estudados)
- **Drip content** (libera aulas progressivamente) — já modelado no schema, falta UI
- **Pré-requisitos entre cursos**
- **Trilhas de estudo** (sequência guiada de cursos)
- **Certificate templates customizáveis** (hoje é fixo)
- **Quiz com banco de questões** (hoje é estático na lesson)
- **Notas de aluno por aula** (já tem lesson-notes, não exposto na UI)

### Painel admin (não-iniciados)
- **Top dashboard com KPIs unificados** (revenue + alunos + completion + avaliação)
- **Reports agendados** (e-mail semanal pra admin com snapshot)
- **Multi-tenant / white-label** — outro projeto inteiro

---

## Bloqueios conhecidos

- **Deploy à produção via `scripts/update_vps_pwd.py`** requer envs `HOST`, `PORT`, `USER_NAME`, `KEY_PATH` SSH. Cada admin precisa configurar localmente.
- **`AI_KEY_ENCRYPTION_SECRET` em prod**: se não definido, modo `dev:` (sem criptografia real). Definir no `.env` do servidor antes de subir credenciais reais.
- **Import via API portalpco.online**: 401 `rest_forbidden_context` — diagnose tool já criado, aguarda usuário rodar para identificar plugin de segurança bloqueando.
- **Drizzle migrations** existem mas não foram aplicadas em prod — modo JSON é o vigente.

---

## Como continuar

1. Releia este ROADMAP antes de começar nova feature pra evitar duplicação.
2. Sprint nova: cria task em `TaskCreate`, faz, marca `completed`, commita com mensagem descritiva.
3. Sempre roda `npm run typecheck && npm test && npm run build` antes de commitar.
4. Push pra `main` (não temos branch protection — repo é pessoal).
5. Documenta no doc do módulo correspondente em `docs/`.
6. Marca neste ROADMAP em "Sprints entregues".

---

## Próximas tarefas sugeridas (ordenadas por valor/risco)

| Prioridade | Tarefa | Por quê | Effort |
|---|---|---|---|
| 🔴 ALTA | docs/deploy.md passo-a-passo | bloqueio operacional | 1 dia |
| 🔴 ALTA | CI GitHub Actions (typecheck + test + build) | regressões silenciosas | 0.5 dia |
| 🔴 ALTA | Tests para api-token-middleware | superfície de auth crítica não testada | 0.5 dia |
| 🟡 MÉDIA | Coverage report (vitest --coverage) | medir o que falta | 0.3 dia |
| 🟡 MÉDIA | E2E Playwright (golden path: login → enroll → complete) | smoke test real | 2 dias |
| 🟡 MÉDIA | Backup remoto S3 (em vez de só local) | DR | 1 dia |
| 🟡 MÉDIA | OAuth Google login | reduzir fricção signup | 1 dia |
| 🟢 BAIXA | Editor visual de e-mail templates | UX admin | 3 dias |
| 🟢 BAIXA | Quiz com banco de questões | feature ampla | 5+ dias |
| 🟢 BAIXA | Multi-tenant | praticamente outro projeto | indefinido |
