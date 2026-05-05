# API pública v1 (read-only)

API REST autenticada por API token. Disponível para integrações externas (BI, Zapier, n8n, dashboards próprios).

## Autenticação

Header `Authorization: Bearer pcok_<token>`. Tokens criados em `/admin/api-tokens` com escopo. Veja [security.md](./security.md#api-tokens-públicos) para detalhes do gerenciamento.

## Escopos

| Escopo | Endpoints liberados |
|---|---|
| `stats:read` | `/v1/stats/*` |
| `students:read` | `/v1/students` |
| `orders:read` | `/v1/orders` |
| `courses:read` | `/v1/courses`, `/v1/courses/:id` |
| `certificates:read` | `/v1/certificates`, `/v1/certificates/:id` |
| `products:read` | `/v1/products` |
| `all:read` | qualquer GET v1 |

Token sem escopo suficiente recebe **403 INSUFFICIENT_SCOPE**.

## Endpoints

### `GET /api/v1/me`

Info do próprio token. Sem escopo específico.

```json
{
  "id": "apt-...",
  "name": "BI Looker Studio",
  "scopes": ["stats:read", "orders:read"],
  "prefix": "pcok_xxxxxxxx",
  "createdAt": "...",
  "expiresAt": null,
  "usageCount": 42
}
```

### `GET /api/v1/stats/summary`

Escopo: `stats:read`.

```json
{
  "generatedAt": "2024-03-15T10:00:00Z",
  "users": {
    "total": 1234,
    "active": 1100,
    "students": 1180,
    "admins": 5
  },
  "orders": {
    "total": 540,
    "paid": 489,
    "refunded": 12,
    "canceled": 25
  },
  "revenue": {
    "currency": "BRL",
    "netCents": 12345600,
    "grossCents": 13000000,
    "refundedCents": 654400
  }
}
```

### `GET /api/v1/students?limit=100`

Escopo: `students:read`. Default 100, máximo 1000.

```json
[
  {
    "id": "user-...",
    "email": "aluno@x.com",
    "name": "Aluno X",
    "active": true,
    "createdAt": "...",
    "lastLoginAt": "..."
  }
]
```

### `GET /api/v1/orders?status=paid&limit=100`

Escopo: `orders:read`. Filtros opcionais: `status` (qualquer OrderStatus).

```json
[
  {
    "id": "ord-...",
    "userId": "...",
    "userEmail": "...",
    "productId": "...",
    "productName": "Curso Y",
    "amountCents": 49700,
    "currency": "BRL",
    "status": "paid",
    "gatewayProvider": "stripe",
    "externalId": "cs_...",
    "createdAt": "...",
    "paidAt": "..."
  }
]
```

### `GET /api/v1/courses`

Escopo: `courses:read`.

```json
[
  {
    "id": "course-...",
    "title": "Curso de Edipiana",
    "slug": "edipiana",
    "moduleCount": 8,
    "lessonCount": 42
  }
]
```

### `GET /api/v1/courses/:id`

Escopo: `courses:read`. Detalhe completo com módulos e aulas (sem player content).

```json
{
  "id": "course-1",
  "title": "Edipiana",
  "slug": "edipiana",
  "shortTitle": "EDIP",
  "description": "...",
  "totalHours": 80,
  "tags": ["fundamentos"],
  "modules": [
    {
      "id": "m1",
      "title": "Introdução",
      "description": "...",
      "order": 1,
      "lessons": [
        { "id": "l1", "title": "...", "durationMinutes": 22, "isMandatory": true, "order": 1 }
      ]
    }
  ]
}
```

### `GET /api/v1/certificates`

Escopo: `certificates:read`. Lista certificados emitidos.

```json
[
  {
    "id": "cert-...",
    "studentId": "u-...",
    "courseId": "course-...",
    "validationCode": "ABC123XYZ",
    "issuedAt": "2025-03-15T..."
  }
]
```

### `GET /api/v1/certificates/:id`

Escopo: `certificates:read`. Inclui URL pública de validação.

```json
{
  "id": "cert-...",
  "studentId": "...",
  "courseId": "...",
  "status": "issued",
  "validationCode": "ABC123XYZ",
  "validationUrl": "https://ava.psicanaliseclinica.online/verificar/ABC123XYZ",
  "issuedAt": "..."
}
```

### `GET /api/v1/products`

Escopo: `products:read`. Lista produtos (cursos, bundles, packs).

```json
[
  {
    "id": "prod-...",
    "kind": "course",
    "name": "Edipiana — acesso vitalício",
    "priceCents": 49700,
    "currency": "BRL",
    "active": true,
    "refId": "course-1"
  }
]
```

## Exemplos de uso

### curl

```bash
curl -H "Authorization: Bearer pcok_xxx" \
  https://ava.psicanaliseclinica.online/api/v1/stats/summary
```

### Python (BI / data science)

```python
import requests

TOKEN = os.environ['AVA_PCO_TOKEN']
BASE = 'https://ava.psicanaliseclinica.online/api/v1'

r = requests.get(f'{BASE}/orders?status=paid&limit=1000',
                 headers={'Authorization': f'Bearer {TOKEN}'})
orders = r.json()
df = pandas.DataFrame(orders)
```

### Zapier

1. Cria zap "Webhooks by Zapier" → "GET"
2. URL: `https://.../api/v1/orders?status=paid&limit=10`
3. Headers: `Authorization: Bearer pcok_...`
4. Conecta ao destino (Sheets, Slack, etc)

### Power BI / Looker / Metabase

Use Web/REST connector apontando para `/api/v1/stats/summary` com auth Bearer. Refresh agendado.

## Rate limits

API pública herda o rate limit global do Hono (sem limite específico ainda — fica open). Sem rate limit dedicado por token implementado por enquanto. Se virar problema, adicionar em sprint futura.

## Erros

Todos os 4xx retornam:

```json
{ "error": { "code": "...", "message": "..." } }
```

| Código | Significado |
|---|---|
| `NO_TOKEN` (401) | Header Bearer ausente |
| `INVALID_TOKEN` (401) | Token inexistente, revogado, expirado |
| `INSUFFICIENT_SCOPE` (403) | Token não tem escopo para esse endpoint |

## Roadmap da API

Read-only no momento. Mutations (POST/PUT) podem entrar futuro com escopos write-* dedicados — mas hoje não há demanda crítica.

## Versionamento

`/api/v1/*`. Quando chegar v2, v1 continua funcionando indefinidamente (a menos que anuncie deprecation 90+ dias antes).
