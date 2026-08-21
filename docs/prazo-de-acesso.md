# Prazo de acesso por curso

Cada curso define por quantos meses a matrícula dá acesso. Vencido o prazo, o
aluno para de estudar até renovar — o progresso, as anotações e o certificado
continuam guardados, porque **expirar não é desmatricular**.

Regra do dono (17/ago/2026): Hipnoterapia 6 meses, Psicanálise Clínica 16, e
assim por diante. Quem declara os meses é o admin, na aba Geral do editor de
curso; nada é fixado em código.

## Onde a regra mora

| Arquivo | Papel |
|---|---|
| `server/access/course-access.ts` | A regra pura: `addMonths`, `computeExpiry`, `resolveExpiry`, `describeAccess`/`accessFor`. Sem I/O. |
| `server/access/guard.ts` | `courseAccessFor(userId, courseId)` — o portão único. Conclusão de aula, transcrição, quiz e comentário passam por aqui. |
| `server/access/impacto.ts` | Simulação e carência em massa (abaixo). |
| `server/repositories/students.ts` | `enrollInCourse` grava `expiresAt`; `extendCourseAccess` renova um aluno. |

Duas decisões que o resto do código herda:

1. **`accessMonths` ausente ou 0 = vitalício.** Curso que nunca declarou prazo
   não passa a expirar só porque o recurso existe.
2. **`expiresAt` gravado na matrícula manda.** É o que permite estender por
   compra ou cortesia sem mexer no curso, e o que preserva o prazo já concedido
   quando o curso muda de política depois. O literal `'lifetime'` isenta a
   matrícula do prazo do curso.

`addMonths` ancora no fim do mês: 31/jan + 1 mês = 28/fev, não 03/mar.
`setMonth` sozinho transborda, e transbordar daria um ou dois dias de brinde a
cada renovação.

## Declarar o prazo é retroativo — e isso surpreende

`resolveExpiry` só respeita o prazo **gravado na matrícula**. Matrícula sem
prazo gravado — o caso de todas as que vieram da importação — passa a valer
`enrolledAt + accessMonths` no instante em que o curso declara o prazo. Como as
datas de matrícula reais vão de 2021 a 2026, declarar "6 meses" num curso antigo
tranca centenas de pessoas no mesmo segundo, sem erro e sem aviso.

Isso é o comportamento desejado — é a política do negócio. O que não pode é ser
descoberto depois. Por isso existem duas ferramentas:

### Simular antes de salvar

`GET /admin/courses/:id/impacto-acesso?meses=N` (admin, só lê) devolve quantos
ficariam vencidos agora, quantos vencem em 30 dias, quantos têm prazo próprio, e
os matriculados mais antigos nominalmente. A tela chama isso enquanto o admin
digita, com meio segundo de espera para não recalcular a cada tecla.

`contarImpacto()` é puro e separado da busca — é o que os testes exercitam.

### Dar carência em massa

`POST /admin/courses/:id/carencia` com `{ meses, ate }` grava `expiresAt = ate`
em toda matrícula que ficaria vencida sob aquela política. Não encosta em quem
já tem prazo próprio, e recusa data no passado — carência retroativa seria
trancar todo mundo com cara de gentileza.

Existe porque a renovação individual é o instrumento errado nesta escala:
ninguém renova 471 matrículas à mão, e sem isto a política chega ao aluno só na
forma de porta fechada.

## Onde `accessMonths` é guardado

**Não tem coluna própria.** Vive em `courses.meta` (jsonb), junto com os outros
campos ricos. Em SQL: `c.meta->>'accessMonths'`.

## O que o aluno vê

`CourseAccessNotice` aparece na página do curso apenas quando há algo a dizer —
vencido, ou vencendo em até 30 dias (`EXPIRING_SOON_DAYS`). Prazo folgado não
gera selo: um aviso permanente de "você ainda tem 400 dias" treina o aluno a
ignorar o aviso quando ele importar.

Vencido, o aviso leva a `/suporte?assunto=acesso&titulo=…`, com a categoria e o
assunto já preenchidos. Os cartões em `/cursos` também mostram o selo.

**Não existe e-mail de aviso de vencimento.** Nenhuma parte do sistema envia um.
Se for criado, o padrão da casa é um worker (`startWorker` + `getStatus()`), não
cron externo.

## Verificação em produção

```bash
# Só lê: confere a simulação contra a mesma pergunta feita ao banco.
DATABASE_URL=... AUTH_STORE=db JWT_SECRET=... npx tsx scripts/smoke_impacto_prazo.ts

# Monta um curso descartável com os três casos que importam, aplica a carência
# e confere linha a linha. Não encosta em matrícula de aluno de verdade.
DATABASE_URL=... npx tsx scripts/smoke_carencia.ts
```
