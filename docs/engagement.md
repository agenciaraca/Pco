# Engajamento e retenção

## Achievements / badges

`server/achievements/store.ts` define 6 badges automáticos:

| Badge | Critério |
|---|---|
| `first_lesson` 🎯 | Primeira aula concluída |
| `first_course` 🎓 | Primeiro curso integralmente concluído |
| `three_courses` 🏆 | 3 cursos concluídos |
| `streak_7` 🔥 | 7 dias com atividade nos últimos 30 |
| `streak_30` ⚡ | 30 dias com atividade nos últimos 30 |
| `tutor_helper` 🤖 | Reservado p/ uso futuro |

`server/achievements/engine.ts` — `evaluate(userId)` é idempotente. Roda automaticamente após `markCompleted` (lesson) e via botão "Atualizar" no perfil.

Endpoints:

```
GET  /me/achievements              → { catalog, awarded[] }
POST /me/achievements/refresh      → { granted[] }
GET  /admin/students/:id/achievements
```

UI: card `AchievementsPanel` no `/perfil` mostra grid de ícones — desbloqueados em destaque, bloqueados opacos.

## Streak counter

`server/repositories/progress.ts:streakInfo(userId)`:

- **current**: dias consecutivos com atividade contando de hoje (ou ontem se hoje sem atividade) pra trás
- **longest**: maior streak histórico
- **lastActiveDay**: ISO YYYY-MM-DD da última atividade

Tolerância de 1 dia: streak não quebra se hoje sem atividade ainda.

```
GET /me/streak → { current, longest, lastActiveDay }
```

UI: card "Sequência atual" no `/dashboard` quando current > 0.

## Reviews/ratings de curso

`server/reviews/store.ts` — 1-5 estrelas + comentário opcional. Upsert por `(courseId, userId)`.

Endpoints públicos (servem páginas marketing):

```
GET /courses/:id/rating   → { courseId, count, avg, distribution: {1..5} }
GET /courses/:id/reviews  → [...]
```

Endpoints autenticados:

```
GET /me/courses/:id/review                  → review do aluno (ou null)
PUT /me/courses/:id/review { rating, comment }   → upsert (só matriculados)
DELETE /admin/courses/:courseId/reviews/:id      → admin modera
```

UI: `<CourseReviews courseId canReview />` na `LMSCourse`. Admin moderation por user pode deletar.

## Discussões por aula

`server/discussions/store.ts` — comentários com 1 nível de resposta (anti-aninhamento). Aluno matriculado posta; admin sempre posta.

Admin: pin (top), hide (oculta dos alunos), delete (cascata).

UI: componente `LessonComments` inline em `LMSLesson`.

## Notification preferences

Já documentado em [email.md](./email.md). Aluno opta out de:
- `receiveBroadcasts` (campanhas)
- `receiveReengagement` (e-mails de retorno)

Transacionais sempre vão.

## Reengagement automático

Já documentado em [email.md](./email.md). Worker diário:

- Identifica alunos com `lastAccessAt > N dias` (configurável)
- Filtra `onlyEnrolled` (opcional)
- Aplica cooldown (não reenviar antes de M dias)
- Honra `notificationPrefs.blockedFromReengagement()`
- Manda template configurável com `{{name}}, {{lastAccess}}, {{loginUrl}}`

Admin em `/admin/reengajamento-auto` configura tudo + dry-run + disparo manual.

## Watch time

`server/repositories/watch-time.ts` agrega segundos por `(userId, lessonId)` via heartbeat:

```
POST /me/lessons/:id/watch { courseId, deltaSeconds, lessonDurationSeconds? }
```

Cap de segurança: `min(delta, 60)` por chunk; `min(total, 1.5x duração ou 4h)`.

Frontend: hook `useLessonWatchHeartbeat({ lessonId, courseId, enabled })` envia 30s a cada 30s quando aba visível e aluno matriculado.

Stats:

```
GET /admin/lessons/:id/watch-stats   → { uniqueViewers, totalSeconds, avgSecondsPerViewer }
GET /admin/courses/:id/watch-stats   → byLesson[] + totals
```

## Live sessions

Documentado em separado em `live-sessions.md`. Resumo: encontros agendados (Zoom/Meet/etc), audiência all|enrolled, status auto (scheduled/live/ended). Aluno vê em `/eventos` com banner "ACONTECENDO AGORA".

## Course tags

Curso ganha campo `tags?: string[]` editável pelo admin no `AdminCourseEditor` (chips com Enter). `/cursos` (aluno) ganha barra de filtro por tag.

Mesma feature em biblioteca e podcasts (filtro por tag).

## Tests

- `test/totp.test.ts` (Achievements indireto via streak)
- `test/enrollment-engine.test.ts`
