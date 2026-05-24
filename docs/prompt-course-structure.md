# Prompt: Estrutura de Cursos, Aulas e Avaliações — LMS AVA PCO

> Use este prompt para instruir um LLM (ou equipe) a reproduzir a hierarquia de cursos do AVA PCO em outro sistema já existente. Contém apenas estrutura e lógica — zero design/UI.

---

## Hierarquia principal

```
Course (Curso)
 └─ Module (Módulo)        — agrupador temático, com ordem e liberação progressiva
      ├─ Lesson (Aula)     — conteúdo consumível (vídeo, texto, HTML)
      └─ Assessment (Avaliação) — no máximo 1 por módulo, puxa questões do banco
```

Cada nível é aninhado: um Curso contém N módulos; cada módulo contém N aulas + 0 ou 1 avaliação. Não existe aula solta (toda aula pertence a um módulo).

---

## 1. Course (Curso)

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | auto | Gerado a partir do slug (estável, não UUID aleatório). Ex.: `c-psicanalise-clinica` |
| `slug` | string | sim (unique) | URL-friendly, imutável após criação. Ex.: `psicanalise-clinica` |
| `title` | string | sim | Nome completo. Ex.: "Psicanálise Clínica" |
| `shortTitle` | string | não | Abreviação para cards/mobile. Ex.: "Psicanálise" |
| `description` | string | não | Resumo do curso (texto plano ou markdown curto) |
| `coverColor` | string | não | Classe CSS de gradiente para card. Ex.: `from-blue-600 to-cyan-400` |
| `coverImageUrl` | string | não | URL da imagem de capa (featured image) |
| `totalHours` | number | não | Carga horária estimada |
| `certificateAvailable` | boolean | não (default false) | Se emite certificado de conclusão |
| `active` | boolean | não (default true) | Publicado = visível para alunos |
| `tags` | string[] | não | Etiquetas temáticas. Ex.: `["fundamentos", "lacan"]` |
| `prerequisiteCourseIds` | string[] | não | IDs de cursos que o aluno precisa completar antes de se matricular |
| `learningOutcomes` | string[] | não | Bullets de "O que você vai aprender" |
| `instructorName` | string | não | Nome do professor principal |
| `instructorBio` | string | não | Bio curta (max 2000 chars) |
| `instructorPhotoUrl` | string | não | Foto do professor |
| `collaborators` | object[] | não | Array de `{ name, role, bio, photoUrl }` — co-instrutores |
| `changelog` | object[] | não | Histórico de versões: `{ version, date, notes }` |
| `certificateTemplate` | object | não | Customização do template de certificado (título, cores, assinaturas, logo) |
| `modules` | Module[] | não | Lista de módulos (ordenada por `order`) |

### Regras de negócio

- **Slug é imutável** — uma vez criado, não renomear (URLs externas e external-references dependem dele).
- **Pré-requisitos**: antes de matricular aluno, validar que `prerequisiteCourseIds` estão todos com 100% de conclusão. Retornar `{ ok, missing[], status[] }`.
- **Soft delete**: ao deletar curso no banco, setar `active = false` (nunca apagar registro). Em modo JSON, remove do array.
- **Duplicação**: suporte a `duplicateCourse(sourceId)` — deep-clone do curso + todos os módulos/aulas com IDs novos.

---

## 2. Module (Módulo)

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | auto | Prefixado pelo curso: `{courseId}-mod-{timestamp}-{random}` |
| `courseId` | string (FK) | sim | Referência ao curso pai |
| `title` | string | sim | Nome do módulo |
| `description` | string | não | Ementa/resumo |
| `order` | number | sim | Posição de ordenação (0-based) |
| `releaseAt` | ISO timestamp | não | Data absoluta de liberação (drip content) |
| `releaseAfterEnrollmentDays` | number (1-365) | não | Dias após matrícula para liberar (drip relativo) |
| `lessons` | Lesson[] | não | Lista de aulas (ordenada por `order`) |
| `assessment` | Assessment | não | No máximo 1 avaliação por módulo |

### Regras de negócio — Drip Content (liberação progressiva)

O módulo pode ter duas camadas de bloqueio temporal:

1. **Absoluto** (`releaseAt`): módulo trancado até a data fixa.
2. **Relativo** (`releaseAfterEnrollmentDays`): módulo trancado até N dias após a matrícula do aluno naquele curso.

Se **ambos** estão definidos, aplica-se o **máximo** dos dois (o mais restritivo vence):

```
effectiveRelease = MAX(releaseAt, enrollmentDate + releaseAfterEnrollmentDays)
locked = effectiveRelease > now
```

O retorno para o frontend inclui:

```typescript
ModuleLockInfo {
  locked: boolean
  lockedUntil: string | null   // ISO timestamp de quando libera
  secondsUntilUnlock: number   // countdown
}
```

- **Cascata**: deletar módulo deleta todas as suas aulas e avaliação.
- **Reordenação**: suporte a drag-and-drop de módulos dentro do curso E de aulas entre módulos (cross-module move).

---

## 3. Lesson (Aula)

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | auto | Prefixado: `{moduleId}-les-{timestamp}-{random}` |
| `moduleId` | string (FK) | sim | Referência ao módulo pai |
| `courseId` | string (FK) | sim | Referência ao curso (desnormalizado para queries rápidas) |
| `title` | string | sim | Título da aula |
| `durationMinutes` | number | não | Duração estimada |
| `videoUrl` | string | não | URL do vídeo (YouTube, Vimeo, hospedado) |
| `description` | string | não | Descrição curta (max 4000 chars, texto plano) |
| `content` | string (HTML) | não | Conteúdo rico (max 200k chars) — HTML com embeds, PDFs inline, etc. |
| `isMandatory` | boolean | não (default true) | Se conta para o cálculo de progresso |
| `order` | number | sim | Posição de ordenação no módulo |
| `isPreview` | boolean | não (default false) | Aula de prévia gratuita (visitante não matriculado pode ver) |
| `transcripts` | object | não | Transcrições multilíngue: `{ pt?, es?, en? }` — cada uma max 100k chars |

### Status da aula (computado, não persistido)

```typescript
type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'pending_assessment'
```

- `locked` → módulo pai está bloqueado por drip.
- `available` → módulo liberado, aluno ainda não acessou.
- `in_progress` → aluno acessou mas não marcou como concluída.
- `completed` → aluno chamou `POST /lessons/:id/complete`.
- `pending_assessment` → aulas do módulo estão completas mas a avaliação não.

### Regras de negócio

- **Completar aula**: antes de aceitar `POST /lessons/:id/complete`, verificar que o módulo pai NÃO está locked.
- **Progresso**: calculado como `(aulas concluídas com isMandatory=true) / (total de aulas com isMandatory=true)` × 100, por curso.
- **Preview**: aulas com `isPreview=true` são servidas em `GET /lessons/:id/preview` sem autenticação.
- Aula pode ser movida entre módulos (cross-module drag) — atualiza `moduleId` e `order`.

---

## 4. Assessment (Avaliação)

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | auto | Gerado automaticamente |
| `moduleId` | string (FK) | sim | Referência ao módulo (1:1 com módulo) |
| `courseId` | string (FK) | sim | Referência ao curso |
| `title` | string | sim | Título da avaliação |
| `questionCount` | number | não | Quantas questões sortear do banco para esta avaliação |
| `passingScore` | number (0-100) | não (default 70) | Nota mínima para aprovação |
| `timeLimitMinutes` | number | não | Tempo limite em minutos (null = sem limite) |

### Regras de negócio

- **Máximo 1 por módulo**: operação é `upsert` — se já existe, substitui.
- **Questões vêm do banco**: a avaliação não contém as questões inline. No momento de gerar o quiz para o aluno, sorteia `questionCount` questões do banco de questões filtrando por `courseId` (e opcionalmente `moduleId`).
- **Cascata com módulo**: deletar módulo deleta a avaliação.

---

## 5. Question Bank (Banco de Questões)

O banco de questões é uma entidade separada, não aninhada na hierarquia curso→módulo→aula. Questões são reutilizáveis e sorteadas nas avaliações.

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | auto | Gerado automaticamente |
| `courseId` | string (FK) | sim | A qual curso pertence |
| `moduleId` | string (FK) | não | Se preenchido, questão específica daquele módulo |
| `type` | enum | sim | `'multiple_choice' \| 'true_false' \| 'open_ended'` |
| `prompt` | string | sim | Enunciado da questão (1-2000 chars) |
| `options` | object[] | condicional | Array de `{ id, text (1-500 chars), correct: boolean }` |
| `expectedAnswer` | string | não | Rubrica/gabarito para questão aberta (usado em correção por IA) |
| `explanation` | string | não | Explicação exibida após o aluno responder |
| `tags` | string[] | não | Etiquetas. Ex.: `["fundamentos", "lacan", "transferência"]` |
| `difficulty` | number (1-5) | não | Nível de dificuldade (usado para balancear sorteio) |
| `active` | boolean | não (default true) | Se pode ser sorteada em quizzes |

### Validações por tipo

| Tipo | Opções | Regras |
|---|---|---|
| `multiple_choice` | 2-6 opções | No mínimo 1 marcada como `correct` |
| `true_false` | Exatamente 2 opções | Exatamente 1 marcada como `correct` |
| `open_ended` | Nenhuma opção | Deve ter `expectedAnswer` (rubrica) |

### Sorteio para quiz

```typescript
sampleForQuiz(courseId: string, maxQuestions: number, moduleId?: string): Question[]
```

- Filtra por `courseId` e `active = true`.
- Se `moduleId` fornecido, filtra também por módulo.
- Embaralha (shuffle) e retorna até `maxQuestions`.
- Balanceia por `difficulty` (não apenas aleatório).

---

## 6. Matrícula e Progresso

### Modelo do aluno

```typescript
Student {
  id: string
  name: string
  email: string
  enrolledCourseIds: string[]                    // cursos matriculados
  progressByCourse: { [courseId]: number }        // 0-100 por curso
  enrollmentDates: { [courseId]: string }         // ISO timestamp por curso
  status: 'ativo' | 'em_risco' | 'bloqueado' | 'inativo'
  riskScore: number (0-100)
  lastAccessAt: string
}
```

### Progresso por aula

```typescript
LessonProgress {
  userId: string
  lessonId: string
  courseId: string
  moduleId: string
  completedAt: string  // ISO timestamp
}
```

- Progresso é atômico por aula (`POST /lessons/:id/complete`).
- Percentual do curso = `count(completed mandatory lessons) / count(total mandatory lessons) × 100`.
- Streak tracking: dias consecutivos de atividade, dia mais longo, dias ativos nos últimos 30.

### Checagem de pré-requisitos na matrícula

```typescript
checkPrerequisites(prerequisiteCourseIds, completedCourseIds) → {
  ok: boolean,
  missing: string[],       // IDs dos cursos faltantes
  status: { courseId, title, completed }[]
}
```

Se `ok = false`, bloqueio de matrícula no frontend e no backend (double check).

---

## 7. Reordenação (Drag & Drop)

Endpoint: `POST /admin/courses/:id/reorder`

Payload:

```typescript
{
  modules: [
    {
      moduleId: string,
      lessonIds: string[]   // IDs das aulas na nova ordem
    }
  ]
}
```

- Suporta mover aula de um módulo para outro (cross-module).
- O `order` de cada módulo é inferido pela posição no array.
- O `order` de cada aula é inferido pela posição em `lessonIds`.
- Ao mover aula entre módulos, atualiza `moduleId` da aula.

---

## 8. API CRUD — Resumo dos endpoints

### Cursos

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/courses` | Listar cursos ativos (público) |
| `GET` | `/courses/:id` | Detalhe com módulos, aulas e status de drip |
| `POST` | `/admin/courses` | Criar curso |
| `PUT` | `/admin/courses/:id` | Atualizar metadados |
| `DELETE` | `/admin/courses/:id` | Deletar (soft) |
| `POST` | `/admin/courses/:id/reorder` | Reordenar módulos e aulas |
| `POST` | `/admin/courses/:id/publish` | Publicar (emite webhook) |

### Módulos

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/admin/courses/:courseId/modules` | Criar módulo |
| `PUT` | `/admin/modules/:id` | Atualizar |
| `DELETE` | `/admin/modules/:id` | Deletar (cascata) |

### Aulas

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/admin/modules/:moduleId/lessons` | Criar aula |
| `PUT` | `/admin/lessons/:id` | Atualizar |
| `DELETE` | `/admin/lessons/:id` | Deletar |
| `GET` | `/lessons/:id/preview` | Preview gratuito (público) |
| `POST` | `/lessons/:id/complete` | Marcar como concluída (aluno) |

### Avaliações

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/admin/modules/:moduleId/assessment` | Criar/upsert avaliação |
| `PUT` | `/admin/assessments/:id` | Atualizar |
| `DELETE` | `/admin/assessments/:id` | Deletar |
| `POST` | `/me/quiz/:courseId/grade` | Corrigir quiz do aluno |

### Banco de questões

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/admin/questions` | Criar questão |
| `PUT` | `/admin/questions/:id` | Atualizar |
| `DELETE` | `/admin/questions/:id` | Deletar |
| `GET` | `/admin/questions?courseId=X` | Listar por curso |

---

## 9. Geração de IDs

IDs não são UUIDs aleatórios. São prefixados pela hierarquia para facilitar debug:

```
Curso:     c-{slug}                          → c-psicanalise-clinica
Módulo:    {courseId}-mod-{timestamp}-{rand}  → c-psicanalise-clinica-mod-1716567890-a3b
Aula:      {moduleId}-les-{timestamp}-{rand} → c-psicanalise-clinica-mod-1716567890-a3b-les-1716568000-f2c
```

Vantagem: olhando qualquer ID, sabe-se a qual curso e módulo pertence.

---

## 10. O que implementar — Checklist

Para reproduzir esta estrutura em um sistema existente:

### Dados
- [ ] Criar entidades: `Course`, `Module`, `Lesson`, `Assessment`, `Question`
- [ ] Garantir hierarquia aninhada com foreign keys: Course → Module → Lesson/Assessment
- [ ] Implementar campo `order` em Module e Lesson para ordenação explícita
- [ ] Implementar `active`/soft-delete em Course
- [ ] Implementar `isMandatory` e `isPreview` em Lesson

### Drip Content
- [ ] Implementar `releaseAt` (absoluto) e `releaseAfterEnrollmentDays` (relativo) em Module
- [ ] Lógica de lock: `MAX(releaseAt, enrollmentDate + days)` > now → locked
- [ ] Endpoint público retorna `ModuleLockInfo` por módulo
- [ ] Impedir `complete` de aula em módulo locked

### Avaliações
- [ ] Banco de questões separado, vinculado a curso (e opcionalmente módulo)
- [ ] 3 tipos: múltipla escolha, V/F, aberta
- [ ] Validações de opções por tipo
- [ ] Sorteio balanceado por dificuldade
- [ ] Assessment é upsert (max 1 por módulo)

### Progresso
- [ ] Tracking atômico por aula (`lessonId + userId + completedAt`)
- [ ] Cálculo de % do curso: `mandatory completed / mandatory total`
- [ ] Pré-requisitos: validar cursos completos antes de matricular

### Reordenação
- [ ] Endpoint de reorder que aceita array de módulos com array de lessonIds
- [ ] Suportar move cross-module (aula muda de módulo)
- [ ] Atualizar `order` e `moduleId` atomicamente

### API
- [ ] CRUD completo para cada nível da hierarquia
- [ ] Separar rotas públicas (GET curso/aula) de admin (POST/PUT/DELETE)
- [ ] Separar rotas de aluno (`/lessons/:id/complete`, `/me/quiz/:courseId/grade`)

---

## 11. Exemplo de objeto completo (JSON)

```json
{
  "id": "c-psicanalise-clinica",
  "slug": "psicanalise-clinica",
  "title": "Psicanálise Clínica",
  "shortTitle": "Psicanálise",
  "description": "Formação completa em psicanálise clínica...",
  "coverColor": "from-blue-600 to-cyan-400",
  "totalHours": 120,
  "certificateAvailable": true,
  "active": true,
  "tags": ["psicanálise", "clínica", "fundamentos"],
  "prerequisiteCourseIds": [],
  "learningOutcomes": [
    "Compreender os fundamentos da psicanálise",
    "Conduzir sessões clínicas supervisionadas"
  ],
  "instructorName": "Dr. João Silva",
  "modules": [
    {
      "id": "c-psicanalise-clinica-mod-1716567890-a3b",
      "courseId": "c-psicanalise-clinica",
      "title": "Módulo 1 — Fundamentos",
      "description": "Introdução aos conceitos básicos",
      "order": 0,
      "releaseAt": null,
      "releaseAfterEnrollmentDays": null,
      "lessons": [
        {
          "id": "c-psicanalise-clinica-mod-1716567890-a3b-les-001",
          "moduleId": "c-psicanalise-clinica-mod-1716567890-a3b",
          "courseId": "c-psicanalise-clinica",
          "title": "Aula 1 — O que é Psicanálise",
          "durationMinutes": 45,
          "videoUrl": "https://vimeo.com/...",
          "description": "Introdução histórica à psicanálise",
          "content": "<h2>Origens</h2><p>A psicanálise surgiu...</p>",
          "isMandatory": true,
          "order": 0,
          "isPreview": true,
          "transcripts": {
            "pt": "Olá, bem-vindos à primeira aula..."
          }
        },
        {
          "id": "c-psicanalise-clinica-mod-1716567890-a3b-les-002",
          "moduleId": "c-psicanalise-clinica-mod-1716567890-a3b",
          "courseId": "c-psicanalise-clinica",
          "title": "Aula 2 — Freud e o Inconsciente",
          "durationMinutes": 60,
          "videoUrl": "https://vimeo.com/...",
          "isMandatory": true,
          "order": 1,
          "isPreview": false
        }
      ],
      "assessment": {
        "id": "assess-mod1-001",
        "moduleId": "c-psicanalise-clinica-mod-1716567890-a3b",
        "courseId": "c-psicanalise-clinica",
        "title": "Avaliação — Fundamentos",
        "questionCount": 10,
        "passingScore": 70,
        "timeLimitMinutes": 30
      }
    },
    {
      "id": "c-psicanalise-clinica-mod-1716568000-b4c",
      "courseId": "c-psicanalise-clinica",
      "title": "Módulo 2 — Técnica Clínica",
      "order": 1,
      "releaseAt": "2026-07-01T00:00:00Z",
      "releaseAfterEnrollmentDays": 30,
      "lessons": [],
      "assessment": null
    }
  ]
}
```

---

## 12. Diagrama de relacionamentos

```
┌─────────────────────────────────────────────────────┐
│                     COURSE                          │
│  id, slug, title, active, prerequisites[], ...      │
└──────────────┬──────────────────────────────────────┘
               │ 1:N
               ▼
┌─────────────────────────────────────────────────────┐
│                     MODULE                          │
│  id, courseId, title, order, releaseAt, dripDays     │
└──────┬──────────────────────────────┬───────────────┘
       │ 1:N                          │ 0..1
       ▼                              ▼
┌──────────────────┐    ┌─────────────────────────────┐
│     LESSON       │    │       ASSESSMENT             │
│  id, moduleId,   │    │  id, moduleId, courseId,     │
│  courseId, title, │    │  title, questionCount,       │
│  order, content, │    │  passingScore, timeLimit     │
│  isMandatory,    │    └──────────────┬──────────────┘
│  isPreview       │                   │ draws from
└──────────────────┘                   ▼
                         ┌─────────────────────────────┐
                         │      QUESTION BANK           │
                         │  id, courseId, moduleId?,     │
                         │  type, prompt, options[],     │
                         │  difficulty, tags[], active   │
                         └─────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    STUDENT                          │
│  id, enrolledCourseIds[], progressByCourse{},       │
│  enrollmentDates{}                                  │
└──────────────┬──────────────────────────────────────┘
               │ per lesson
               ▼
┌─────────────────────────────────────────────────────┐
│              LESSON PROGRESS                        │
│  userId, lessonId, courseId, moduleId, completedAt   │
└─────────────────────────────────────────────────────┘
```
