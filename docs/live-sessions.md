# Live sessions (Zoom/Meet/qualquer URL)

Agendamento de encontros ao vivo. O AVA não embute o player — só mantém metadata + link de join. Funciona com Zoom, Google Meet, Jitsi, Teams ou qualquer URL.

## Modelo

`server/live-sessions/store.ts`:

```ts
LiveSession {
  id, title, description?,
  courseId?: string | null,    // vincula a um curso (opcional)
  hostName?, joinUrl,
  startAt: ISO,
  durationMinutes: 1..720,
  status: 'scheduled' | 'live' | 'ended' | 'canceled',
  audience: 'all' | 'enrolled',
  createdAt, updatedAt
}
```

`computeStatus(session)` calcula status baseado em horário (não persiste):

- `now < startAt` → scheduled
- `startAt ≤ now < startAt + duration` → live
- senão → ended (a menos que canceled manualmente)

## Audiência

- `all`: qualquer aluno autenticado vê
- `enrolled`: só alunos matriculados em `courseId` vêem (requer courseId)

## Endpoints

| Verbo | Path | Quem pode |
|---|---|---|
| GET | `/me/live-sessions` | Aluno: filtra por audiência |
| GET | `/admin/live-sessions` | Admin: lista todas |
| POST | `/admin/live-sessions` | Admin: cria |
| PUT | `/admin/live-sessions/:id` | Admin: atualiza (incluindo `status` manual) |
| DELETE | `/admin/live-sessions/:id` | Admin: remove |

## UI

### Admin (`/admin/sessoes-ao-vivo`)

- Lista cronológica
- Editor modal: title, description, datetime-local, duration, joinUrl, hostName, audience, courseId
- Status auto-computado mostrado como badge
- Botão "Abrir link" (target=_blank)

### Aluno (`/eventos`)

- Banner verde "🔴 ACONTECENDO AGORA" para sessões em `live`
- Lista de próximos encontros
- Botão "Entrar agora" (live) ou "Acessar link" (scheduled)

## Validação

- `joinUrl` deve começar com `http(s)://`
- `durationMinutes` entre 1 e 720
- `audience='enrolled'` sem `courseId` → o filtro retorna nada (UX falha)

## Notificações relacionadas

Não há disparo automático de e-mail antes da sessão (não-implementado). Workaround: usar `/admin/broadcasts` perto da hora pra avisar inscritos.

## Roadmap

- E-mail automático "começa em 1h" (worker simples)
- Lembrete in-app para alunos elegíveis
- Gravação automática de presença (admin marca quem entrou)
- Embed Zoom/Meet direto via SDK (em vez de só link)
- Timezone-aware no editor (hoje datetime-local usa fuso do browser)

## Tests

Não há testes específicos para esse módulo ainda (lógica é simples — store CRUD). Adicionar conforme necessário.
