# Pagamentos

Módulo completo: gateways multi-provider, produtos, pedidos, cupons de desconto, refund via API e webhooks de gateway.

## Componentes

- `server/payments/gateways-repo.ts` — CRUD de gateways (encrypted)
- `server/payments/products-repo.ts` — produtos (course, bundle, session_pack, tutor_pack)
- `server/payments/orders-repo.ts` — pedidos com lifecycle eventos
- `server/payments/coupons-repo.ts` — cupons percent ou amount
- `server/payments/providers/` — implementações por gateway

## Gateways suportados

Todos via REST puro (sem SDK). Cada um implementa `PaymentProviderImpl`:

| Provider | createPayment | parseWebhook | refundPayment |
|---|---|---|---|
| `mock` | ✓ (sandbox local) | ✓ | ✓ |
| `stripe` | ✓ Checkout Sessions | ✓ HMAC-SHA256 | ✓ via PaymentIntent |
| `asaas` | ✓ PIX/Boleto/Cartão | ✓ access_token | ✓ /payments/:id/refund |
| `pagarme` | ✓ Orders v5 | ✓ Basic auth | ✓ via Charge |
| `mercadopago` | ✓ Preferences | ✓ status approved | ✓ /v1/payments/:id/refunds |
| `paypal` | ✓ Orders v2 | ✓ event_type | ✓ via Capture |

### Adicionar novo provider

1. Crie `server/payments/providers/myprovider.ts` exportando `myproviderProvider: PaymentProviderImpl`
2. Registre em `server/payments/providers/registry.ts`
3. Não esqueça refund: o admin precisa pra `/admin/orders/:id/refund` funcionar

## Tipos de produto

```ts
type ProductKind = 'course' | 'bundle' | 'session_pack' | 'tutor_pack';
```

- **course**: `refId = courseId`, libera matrícula no curso
- **bundle**: `metadata.courseIds: string[]`, libera N matrículas de uma vez
- **session_pack** e **tutor_pack**: registrados, lógica futura

## Lifecycle de uma compra

```
1. Aluno faz checkout em /cursos
   POST /me/checkout { productId, gatewayId?, couponCode? }
2. Backend valida cupom + cria Order(status=pending)
3. Backend chama provider.createPayment(...) → externalId + checkoutUrl
4. Aluno é redirecionado pro checkoutUrl
5. Gateway processa, dispara webhook → POST /api/webhooks/payments/:gatewayId
6. parseWebhook valida assinatura → status: paid
7. Order vira paid → grantAccessForOrder() → enrollInCourse() (course/bundle)
8. notificationsRepo.createOne() (in-app)
9. sendSafe() e-mail "Pagamento confirmado" (best-effort)
10. webhooksDispatcher.emit('order.paid', payload)  → outbound webhooks
```

## Refund

Admin clica "Reembolsar" em `/admin/pedidos`. Modal pede valor (parcial opcional) e motivo.

```
POST /admin/orders/:id/refund { amountCents?, reason? }
  → provider.refundPayment(externalId, amountCents)
  → ordersRepo.updateStatus(refunded)
  → revokeAccessForOrder()  ← unenroll dos cursos
  → webhooksDispatcher.emit('order.refunded', ...)
  → sendSafe() e-mail de reembolso
```

Se `amountCents < order.amountCents` → status final permanece `paid` (refund parcial não revoga acesso).

## Cupons

```ts
// shared/schemas.ts
couponDiscountSchema = z.discriminatedUnion('kind', [
  { kind: 'percent', value: 1..100 },
  { kind: 'amount', value: cents 1..1_000_000 },
]);
```

Validação pública: `POST /coupons/validate { code, productId }`. Retorna desconto calculado ou erro (expirado, esgotado, não aplicável a esse produto).

Cupom aplicado entra em `order.events[].note` como `couponId=xxx`. Quando a order vira paid, `couponsRepo.incrementUsage(couponId)` é chamado.

## Endpoints — admin

| Verbo | Path | O que faz |
|---|---|---|
| GET | `/admin/gateways` | Lista (sem secrets) |
| POST | `/admin/gateways` | Cria, criptografa apiKey/secret/webhookSecret |
| PUT | `/admin/gateways/:id` | Atualiza |
| DELETE | `/admin/gateways/:id` | Remove |
| POST | `/admin/gateways/:id/test` | Ping (varia por provider) |
| GET | `/admin/products` | Lista todos |
| POST | `/admin/products` | Cria |
| PUT | `/admin/products/:id` | Atualiza |
| DELETE | `/admin/products/:id` | Two-step: header `X-Confirm-Name` deve bater com nome |
| GET | `/admin/orders` | Lista todos pedidos |
| GET | `/admin/orders/export.csv` | Export CSV BOM UTF-8 |
| PUT | `/admin/orders/:id/status` | Mudança manual (canceled/refunded/failed) |
| POST | `/admin/orders/:id/refund` | Refund real via gateway |
| GET | `/admin/coupons` | Lista |
| POST | `/admin/coupons` | Cria |
| PUT | `/admin/coupons/:id` | Atualiza |
| DELETE | `/admin/coupons/:id` | Remove |

## Endpoints — aluno

| Verbo | Path | O que faz |
|---|---|---|
| POST | `/me/checkout` | Inicia checkout |
| POST | `/coupons/validate` | Valida cupom |
| GET | `/me/orders` | Lista próprios pedidos |
| POST | `/me/orders/:id/cancel` | Cancela pendente |
| POST | `/api/webhooks/payments/:gatewayId` | Webhook entrada (público) |

## UI admin

- `/admin/gateways` — CRUD com test button
- `/admin/produtos` — CRUD com tipo bundle (multi-select cursos)
- `/admin/pedidos` — lista, filtros, refund modal, CSV export
- `/admin/coupons` — CRUD

## Variáveis de ambiente

| Var | Para |
|---|---|
| `AI_KEY_ENCRYPTION_SECRET` | Master key AES-GCM (obrigatório em prod) |
| `PUBLIC_ORIGIN` | URL pública para success_url/cancel_url dos providers |
