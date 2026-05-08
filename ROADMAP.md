# AVA PCO — Roadmap completo

LMS para Psicanálise Clínica Online. Stack: Hono + React 18 + TanStack Query + JsonStore (default) / Drizzle Postgres (opcional).

Histórico de tudo que foi entregue + backlog em aberto. Cada commit mencionado existe no histórico de `main`.

---

## Estado atual (atualizado em 2026-05-08 — sprints 469-545)

| Métrica | Valor |
|---|---|
| Sprints entregues | **545+** |
| Commits no main | **320+** |
| Arquivos de teste | **121** unit + **1** E2E (5 specs) |
| Testes passando | **1291** unit ✅ + **5** E2E smoke ✅ |
| Coverage statements | **70.67%** (badge dinâmico no README) |
| Módulos backend | 30 |
| Páginas admin | 63+ |
| Páginas aluno | 15+ |
| Providers de pagamento | 6 (Mock, Stripe, Asaas, Pagar.me, MercadoPago, PayPal) |
| Providers de e-mail | 8 (Mock, Resend, SendGrid, Postmark, Mailgun, Brevo, AWS SES, SMTP-stub) |
| Connectors de import | 3 (WP, LD, WC) + CSV |
| Tipos de webhook outbound | 6 (Generic, Slack, Discord, Telegram, Teams, Mattermost) |
| Achievements automáticos | 6 |
| Provedores de IA | OpenAI / Anthropic / Mock |
| Permissões de API tokens | 7 escopos |
| API pública v1 | 9 rotas + OpenAPI 3.0 spec |
| Roles inventariados | 3 sistema + custom |
| Permissões catalogadas | 30 system codes |

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
- **Impersonation (sprint 469-470)**: admin "entra" como aluno
  - JWT claim `act` com TTL 30 min, audit em start/exit
  - Banner persistente "Visualizando como X" (sticky, role=alert)
  - Botão "Entrar como aluno" em /admin/usuarios/:id
- **Bloqueio durante impersonation (sprint 471)**: middleware
  blockDuringImpersonation('action') retorna 403 IMPERSONATION_BLOCKED
  pra 10 ações sensíveis (delete user, change password, refund, etc)
- **Roles & Permissions inventory (sprint 473)**: CRUD em /admin/papeis
  com 3 system roles imutáveis + custom roles editáveis. 30 permissions
  catalogadas. Hoje é documentação; quando RBAC dinâmico for implementado,
  passa a ser enforced.

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

## Sprints recentes (Maio 2026 — 466 entregues)

### Bloco sprints 494-545 (LMS deepening + tests + UX polish + production hardening)
| Sprint | Tema |
|---|---|
| 545 | backup remoto S3 via SigV4 reuse + 14 testes (env-gated S3_*) |
| 544 | Sentry server-side wrapper env-gated (zero deps) + 13 testes |
| 543 | provider AWS SES via SigV4 manual (sem AWS SDK) + 17 testes |
| 542 | webhook channels Telegram + Teams + Mattermost + 3 presets + 18 testes |
| 541 | provider Brevo (SendinBlue) + 13 testes + registry test (5 testes) |
| 540 | provider Mailgun (US/EU regions) + 12 testes |
| 539 | E2E Playwright smoke (5 specs: health, home, login form, SPA fallback, 401) + CI job |
| 538 | coverage badge dinâmico no README (18 testes) + fix typecheck AdminTranscripts |
| 537 | filtros adicionais em /admin/cursos/:id/questoes |
| 536 | tests propagação de novos fields em courses-repo (+9) |
| 535 | coupon stat cards no /admin/coupons |
| 534 | tests CoursePublishChecklist (+5) |
| 533 | publish checklist em AdminCourseEditor |
| 532 | tests integração drip + prereqs (+9) |
| 531 | tests roles-store edge cases (+11) |
| 530 | badges adicionais em /admin/cursos (preview/changelog/collabs) |
| 529 | tests impersonation rules (+12) |
| 528 | heatmap no Dashboard student |
| 527 | tag filter chips no /catalogo |
| 526 | testes adicionais chunk-error-recovery (+3) |
| 525 | quick filter chips em /admin/auditoria |
| 524 | course changelog visível no LMS |
| 523 | AdminLogs counters + pause + export |
| 522 | página detalhe de usuário do sistema |
| 521 (deploy) | auto-reload em chunk-load-error pós-deploy (+9 testes) |
| 521 | testes edge case render certificado (+11) |
| 520 | testes adicionais study-paths (+10) |
| 519 | testes weekly-report config (+7) |
| 518 | seletor de preset no formulário webhook |
| 517 | admin UI config weekly-report + 3 routes |
| 516 | admin UI editor de templates de e-mail com preview live |
| 515 | editor de templates de e-mail customizáveis (15 testes) |
| 514 | quiz: fluxo do aluno responder + resultado + revisão |
| 513 | quiz: admin UI CRUD pro banco de questões |
| 512 | guia do administrador não-técnico (docs) |
| 511 | kanban view em /admin/evasao |
| 510 | cookbook webhooks (docs com 7 receitas) |
| 509 | presets webhook (Slack/Discord/Zapier/n8n/Make/Pipedream) |
| 508 | relatório semanal admin (11 testes) |
| 507 | schedules-worker tickWorker tests (7) |
| 506 | webhook dispatcher tests (8) |
| 505 | invoice tests review (já cobertos) |
| 504 | course collaborators (até 10 co-instrutores) |
| 503 | quiz banco de questões fase 1 (25 testes) |
| 502 | KPIs unificados em /admin/dashboard |
| 501 | certificate templates customizáveis (6 testes) |
| 500 | trilhas de estudo CRUD (15 testes) |
| 499 | badges no README (CI/tests/sprints) |

### Bloco sprints 469-493 (auth + API + roles + LMS deepening)
| Sprint | Commit | Tema |
|---|---|---|
| 493 | `527004b` | profile completeness indicator (6 testes) |
| 492 | `949cbd7` | filter por custom role em /admin/usuarios |
| 491 | `cda84a6` | papel único por usuário + tier de auth (5 testes) |
| 490 | `724a6e0` | indicador de anotação em LMSModule |
| 489 | `85b91d7` | course instructor (nome/bio/foto) |
| 488 | `b498403` | course learning outcomes (bullets) |
| 487 | `32aa2ff` | lesson preview público — player + CTA |
| 486 | `8c3137b` | flag isPreview em lessons |
| 485 | `28add99` | catálogo unificado de roles (5 testes) |
| 484 | `5fac235` | bulk-enroll respeita prereqs com override |
| 483 | `399b507` | badge de pré-requisito em listagens |
| 482 | `820595b` | course prerequisites (8 testes) |
| 481 | `425de85` | custom roles no dropdown de usuário |
| 480 | `a954370` | drip content phase 1 — releaseAt (10 testes) |
| 479 | `85ca496` | study heatmap 365 dias (6 testes) |
| 478 | `2f5ae8b` | meta semanal self-service |
| 477 | `147f754` | matriz comparativa de roles |
| 476 | `c213275` | system roles sync com seed (2 testes) |
| 475 | `8a02fda` | permissões granulares + PT-BR labels (7 testes) |
| 474 | `9fd8ddb` | user counts em /admin/papeis |
| 473 | `bc8caab` | Roles & Permissions CRUD (18 testes) |
| 472 | `91a7576` | OpenAPI 3.0 público (11 testes) |
| 471 | `62d7315` | blockDuringImpersonation middleware (7 testes) |
| 470 | `1dccd50` | impersonation UI |
| 469 | `7040c80` | impersonation backend (17 testes) |

### Bloco testes 432-466 (turno anterior)
| Sprint | Commit | Tema |
|---|---|---|
| 466 | `d6c76a3` | imports/mapping (11 testes) |
| 464 | `66116cf` | imports/connectors/http (11 testes) |
| 463 | `b08059e` | imports/adapters internals (12 testes) |
| 462 | `6c495ef` | imports/reports (11 testes) |
| 461 | `9537903` | imports/rollback (5 testes) |
| 459 | `4937080` | email-log-store (5 testes) |
| 457 | `c42da44` | json-store (14 testes) |
| 455 | `8d390c1` | rate-limit middleware (9 testes) |
| 454 | `380ec4b` | auth-middleware (11 testes) |
| 452 | `52827c2` | saved-searches + admin-notes (12 testes) |
| 450 | `159e5b6` | podcast-engagement (5 testes) |
| 449 | `58b6b65` | notifications-repo (13 testes) |
| 447 | `18dd663` | broadcasts-resolve-audience (8 testes) |
| 445 | `0649884` | uploads-store (6 testes) |
| 444 | `0ca213d` | settings + retention (7 testes) |
| 442 | `d99ede7` | lesson-notes (6 testes) |
| 441 | `4bdb416` | content-repos news/library/podcasts (11 testes) |
| 440 | `a135f91` | certificates-repo (8 testes) |
| 439 | `0bd2cf8` | courses-repo (14 testes) |
| 438 | `3292aa8` | watch-time-aggregates (13 testes) |
| 436 | `7a621cc` | progress-repo (13 testes) |
| 435 | `740eeab` | students-repo (13 testes) |
| 434 | `b659b3b` | CI coverage report + @vitest/coverage-v8 |
| 433 | `7eb43fd` | docs/deploy.md (321 linhas) |
| 432 | `c45cc35` | api-token-middleware (10 testes) |

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

### Cobertura de testes restante
- ~~**api-token-middleware**~~ ✅ (sprint 432, 10 testes)
- **invoice generator** — render PDF/HTML de comprovante (não-iniciado)
- **dispatcher webhooks** — fetch HTTP real, retry com backoff (não-iniciado)
- **runReal full E2E** — integration com runner (apenas unit no adapters)
- **schedules-worker tick logic** — cron-like trigger (não-iniciado)

### Documentação
- ✅ docs técnica de cada módulo (já tem 13 docs)
- ✅ **Documentação de deployment passo-a-passo** (`docs/deploy.md` — sprint 433)
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

### Robustez
- **Tests de UI/integration** com Testing Library + MSW (hoje só unit em puros) — não-iniciado
- 🟡 **E2E** com Playwright — sprint 539 entregue smoke (5 tests cobrindo health, home, login form, SPA fallback, 401 sem token); falta golden path login → enroll → complete
- ✅ **CI** GitHub Actions (`npm test && npm run typecheck && npm run build` + coverage)
- ✅ **Coverage badge no README** (sprint 538 — script scripts/update-coverage-badge.mjs lê coverage-summary.json)
- **Migrações Drizzle** dos novos campos `tags` em libraryItems/podcasts — não-iniciado
- ✅ **Rate limit por API token** dedicado (sprint 432, X-RateLimit headers)
- ✅ **Backup remoto S3** (sprint 545 — env-gated S3_BUCKET/REGION/KEYS, reuse SigV4)

### Integrações (não-iniciadas)
- **Webhook templates** (presets prontos para Zapier/n8n/Make)
- ✅ **Mais providers de e-mail** (Mailgun + Brevo + SES sprints 540-541-543; falta SMTP real)
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
| 🔴 ALTA | Configurar `JWT_SECRET` fixo em produção | sessões caem ao reiniciar | 5 min |
| 🔴 ALTA | Configurar `AI_KEY_ENCRYPTION_SECRET` em produção | criptografia real | 5 min |
| 🔴 ALTA | Resolver erro 401 import portalpco.online (rodar diagnose tool) | bloqueio de usuário | 30 min |
| 🟡 MÉDIA | E2E Playwright — expandir golden path (login → enroll → complete) | smoke ✅ no sprint 539 | 1 dia |
| ~~🟡~~ ✅ | ~~Backup remoto S3~~ (sprint 545) | DR | 1 dia |
| 🟡 MÉDIA | OAuth Google login | reduzir fricção signup | 1 dia |
| ~~🟡~~ ✅ | ~~Coverage badge no README~~ (sprint 538) | visibilidade | 0.3 dia |
| 🟡 MÉDIA | API pública openapi.json | docs de integração | 1 dia |
| 🟢 BAIXA | Editor visual de e-mail templates | UX admin | 3 dias |
| 🟢 BAIXA | Quiz com banco de questões | feature ampla | 5+ dias |
| 🟢 BAIXA | Migrações Drizzle aplicadas em prod | unlock Postgres | 1 dia |
| 🟢 BAIXA | Multi-tenant | praticamente outro projeto | indefinido |

## Conquistas deste turno (sprints 398-466)

- **+227 testes novos** (590 → 818)
- **+30 commits** (210+ → 240+)
- **+23 arquivos de teste** (62 → 85)
- **Bug fixes detectados pelos testes**:
  - `normalizers.ts:bool()` retornava `false` em vez de `undefined`, quebrando default `isMandatory=true`
  - `categories suporte` desalinhadas com schema (acesso/duvida_aula)
- **CI coverage report** + dev dep `@vitest/coverage-v8`
- **docs/deploy.md** completo (321 linhas com primeiro deploy, update_vps_pwd.py, troubleshooting, rollback)
- **api-token-middleware** + **auth-middleware** + **rate-limit middleware** com Hono.request integration
- **Cobertura significativa**: notifications (templates, sender, broadcasts, prefs, log), repositories (students, courses, lessons, certificates, podcasts), webhooks (delivery, endpoints, signer, formatters), imports (validators, normalizers, mapping, http, adapters, rollback, reports, refs-store, job-store), auth (jwt, password-reset, totp, users-store CRUD, document, middleware), uploads, rate-limit, json-store, audit-log, errors-store, activity-feed
