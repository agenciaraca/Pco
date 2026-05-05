# AVA PCO — Roadmap completo

Histórico de tudo que foi entregue + backlog em aberto. Cada commit mencionado existe no histórico de `main`.

---

## Sprints entregues

### 1. Pagamentos (commit `e8e52de` e anteriores)
- Mock provider local (sandbox)
- Stripe Checkout Sessions + webhook HMAC-SHA256
- Asaas (PIX/Boleto/Cartão) com `access_token`
- Pagar.me Orders v5
- Mercado Pago Preferences
- PayPal Orders v2 (OAuth + capture)
- CRUD de gateways com credenciais AES-GCM
- Produtos, pedidos, cupons percent/amount
- UI: `/admin/gateways`, `/admin/produtos`, `/admin/pedidos`, `/admin/coupons`

### 2. Importação WP/LD/WC — Sprints A-E (`16c883a`, `add50c6`, `6ed48da`)
- **Sprint A**: foundation (types, stores, csv-templates 8 entidades)
- **Sprint B**: parser CSV + dry-run + wizard UI
- **Sprint C**: connectors REST (WordPress, LearnDash, WooCommerce) com credenciais encrypted
- **Sprint D**: enrollment engine (5 startRules × 7 expirationRules) + execução real via adapters
- **Sprint E**: histórico, relatórios CSV/JSON, rollback best-effort, conexões CRUD UI

### 3. E-mail transacional (`698b2e9`)
- 5 providers (Resend, SendGrid, Postmark, mock, SMTP stub)
- Sender com sendSafe (best-effort) + log
- 4 templates (password_reset, order_paid, course_enrolled, welcome) com layout branded
- Hooks: reset de senha, order paid, refund
- Admin: configs CRUD, ping, send-test, preview, logs

### 4. Segurança — 2FA + webhooks (`74374fb`, `0b95d99`)
- TOTP RFC 6238 puro (sem deps), backup codes
- Login 2-step (ticket + code)
- Setup/enable/disable/regen via UI
- Webhooks de saída com HMAC-SHA256 estilo Stripe
- Retry exponencial (1m/5m/30m/2h, 5 tentativas)
- Worker em background

### 5. Refund + Health dashboard (`74374fb`)
- `refundPayment()` em todos os 6 providers
- Endpoint admin com refund parcial e revoga acesso
- Health dashboard agregando 9 sinais

### 6. Course bundles + Reengagement (`3c57b59`)
- Novo kind `bundle` com `metadata.courseIds[]`
- Grant múltiplo no checkout, revoke no refund
- Worker diário de reengajamento configurável + cooldown
- Notification preferences (opt-out)

### 7. Operações admin (`34e293d`)
- Bulk actions de alunos (ativar/desativar/excluir/desmatricular/sendEmail/forceLogout)
- Search global cross-entity com `Ctrl+K` palette
- Email broadcasts segmentados (6 audiências)
- Sessions inspector + force logout

### 8. Integrações + Activity (`e795a0b`)
- API tokens públicos read-only (5 escopos)
- Endpoints `/api/v1/me|stats|students|orders|courses`
- Activity feed cross-entity (audit + email + webhook + reengagement + orders)

### 9. Manutenção (`4e41f87`)
- CSV exports (users/orders/courses) com BOM UTF-8
- Course duplicate (clone completo)
- Settings backup/restore (JSON v1 com whitelist)

### 10. Conteúdo & UX (`f79d22a`)
- Admin notes per-aluno
- Course tags + filtro nas listagens
- Course reviews/ratings (1-5 estrelas + comentário, só matriculados)

### 11. Engajamento (`03b1050`)
- Notification preferences (opt-out broadcasts/reengajamento)
- 6 achievements/badges automáticos com streak

### 12. Operacional + Comunidade (`05297fe`)
- Cron/jobs viewer com tick manual
- Lesson discussion thread (1 nível de resposta + moderação)

### 13. Safety + Ops (`a69607c`)
- Two-step destructive delete (X-Confirm-Name)
- System logs viewer (ring buffer 5000 linhas)
- Course preview mode

### 14. Integrações + Engajamento (`94608f9`)
- Slack/Discord webhooks (formatadores dedicados)
- Streak counter no dashboard

### 15. Deliverability + Analytics (`e0da891`)
- Unsubscribe link em broadcasts (JWT scope)
- Lesson watch time tracking (heartbeat 30s/30s)

### 16. Ops + Analytics (`6512f99`)
- Rate-limit dashboard com top IPs/paths/blocks
- Course analytics consolidado

### 17. Analytics + Content (`fc25785`)
- Per-student analytics agregado
- Tags em biblioteca/podcasts

### 18. Content + Ops (`96e3a81`)
- Live sessions (Zoom/Meet integração)
- Saved searches/filters per-admin

### 19. Ops + PWA (`9428c36`)
- Setup checklist (8 itens com progresso)
- PWA básico (manifest + sw + offline.html)

### 20. Tests (`3252b47`)
- 7 suites de teste (TOTP, CSV, transforms, enrollment, signer, formatters, confirm, log-buffer)
- 131 testes passando, 15 arquivos
- Bug encontrado e corrigido pelos próprios testes (backup codes truncados)

---

## Resumo numérico

| Métrica | Valor |
|---|---|
| Sprints entregues | ~50 |
| Commits no main | ~30+ |
| Arquivos de teste | 15 |
| Testes passando | 131 |
| Módulos backend | 30+ |
| Páginas admin | 35+ |
| Páginas aluno | 15+ |
| Providers de pagamento | 6 |
| Providers de e-mail | 5 |
| Connectors de import | 3 (WP, LD, WC) + CSV |

## Endpoints principais por área

- `/admin/setup` — checklist
- `/admin/saude` — health
- `/admin/atividade` — activity feed
- `/admin/jobs` — workers
- `/admin/logs` — server logs
- `/admin/rate-limits` — rate-limit telemetry
- `/admin/sessoes` — sessions inspector
- `/admin/imports` — importer hub
- `/admin/gateways` — payment gateways
- `/admin/email` — e-mail config + logs
- `/admin/broadcasts` — campanhas
- `/admin/webhooks` — outbound
- `/admin/api-tokens` — API público
- `/admin/sessoes-ao-vivo` — live sessions
- `/admin/cursos/:id/analytics` — analytics
- `/admin/cursos/:id/preview` — preview como aluno
- `/admin/backup` — config backup/restore
- `/api/v1/*` — API pública

---

## Backlog (não iniciado)

### Documentação
- ✅ docs técnica de cada módulo (este turno)
- Documentação de deployment passo-a-passo (`docs/deploy.md`) — pendente
- Guias de usuário admin (não-técnico) — pendente

### Features extras
- **Admin onboarding wizard interativo** (oposto do checklist passivo) — não-iniciado
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
- **Tests de UI/integration** com Testing Library + MSW (hoje só unit em puros)
- **E2E** com Playwright — não-iniciado
- **CI** — pode rodar `npm test && npm run typecheck && npm run build` em GitHub Actions
- **Coverage report** com badge no README
- **Migrações Drizzle** dos novos campos `tags` em libraryItems/podcasts (hoje só JSON guarda)
- **Rate limit por API token** dedicado

### Integrações que poderiam virar
- **Webhook templates** (presets prontos para Zapier/n8n/Make)
- **Mais providers de e-mail** (Mailgun, Brevo, SES)
- **OAuth login social** (Google/Microsoft) — só email/senha hoje
- **SSO SAML** para escolas grandes
- **WhatsApp via Twilio** para notificações (já tem mock no Reengagement)

### LMS específicos
- **Streak counter detalhado** com heatmap (já tem o counter, falta visualização)
- **Goal setting** (meta semanal de minutos estudados)
- **Drip content** (libera aulas progressivamente) — já modelado no schema, falta UI
- **Pré-requisitos entre cursos**
- **Trilhas de estudo** (sequência guiada de cursos)
- **Certificate templates customizáveis** (hoje é fixo)

### Painel admin
- **Top dashboard com KPIs unificados** (revenue + alunos + completion + avaliação)
- **Reports agendados** (e-mail semanal pra admin com snapshot)
- **Multi-tenant / white-label** — outro projeto inteiro

---

## Bloqueios conhecidos

- **Deploy à produção via `scripts/update_vps.py`** requer envs `HOST`, `PORT`, `USER_NAME`, `KEY_PATH` SSH. Cada admin precisa configurar localmente.
- **`AI_KEY_ENCRYPTION_SECRET` em prod**: se não definido, modo `dev:` (sem criptografia real). Definir no `.env` do servidor antes de subir credenciais reais.

---

## Como continuar

1. Releia este ROADMAP antes de começar nova feature pra evitar duplicação.
2. Sprint nova: cria task em `TaskCreate`, faz, marca `completed`, commita com mensagem descritiva.
3. Sempre roda `npm run typecheck && npm test && npm run build` antes de commitar.
4. Push pra `main` (não temos branch protection — repo é pessoal).
5. Documenta no doc do módulo correspondente em `docs/`.
6. Marca neste ROADMAP em "Sprints entregues".

---

Última atualização: rodada de documentação completa.
