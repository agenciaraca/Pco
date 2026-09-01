# 1º de setembro de 2026 — pedidos viram CRUD, e o cadastro sai do popup

Escrito às pressas, no meio de um reboot. Serve para a próxima sessão não
redescobrir nada.

## O que subiu

Três commits, todos em `origin/main`:

- `020162c` — menu lateral do admin gruda, rola por dentro e recolhe.
- `f6d1b5b` — CRUD de pedidos no admin; a coluna **produto** deu lugar a **de
  onde veio a venda**. Backend completo: `POST/PUT/DELETE /admin/orders`,
  `adminCreateOrderSchema` / `adminUpdateOrderSchema` em `shared/schemas.ts`,
  resumo da origem em `shared/atribuicao.ts` (compartilhado entre os dois
  lados, não duplicado).
- `aaa639e` — cadastro em tela cheia: `src/app/pages/admin/AdminOrderForm.tsx`,
  rotas `/admin/pedidos/novo` e `/admin/pedidos/:id/editar`. O modal
  `FormularioPedido` foi removido de `AdminOrders.tsx`.

## O que FALTA — leia antes de tocar em qualquer coisa

**Não houve deploy.** Produção segue no código anterior; a tela cheia existe só
no repositório.

**A verificação ficou pela metade.** `npm run typecheck` passou limpo.
`npm run lint` e `npm run test` **não terminaram** — a máquina foi reiniciada
no meio. Antes do deploy, na ordem e **um de cada vez**:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Rodar os quatro em paralelo satura a máquina: numa tentativa a suíte foi de 95s
para 414s e `test/impersonation.test.ts` estourou timeout de worker — falha da
máquina, não do código. Se ela reaparecer sozinha, é isso; confirme rodando o
arquivo isolado antes de caçar bug que não existe.

Depois: `bash scripts/deploy_producao.sh`, e confira o hash do bundle (o
`/api/health` responde 200 mesmo com código velho). O `curl` do bundle precisa
de `-L` — sem ele o 301 faz todo deploy parecer falho.

## Regras de negócio que o dono fixou nesta sessão

Sobre matrícula e status do pedido — vale para qualquer tela que mostre acesso:

- **Só `paid` matricula.**
- **Estorno** (`refunded`): a matrícula **cai** — foi feita e desfeita.
- **Cancelamento / desistência** (`canceled`): a matrícula **cai**.
- **Atraso** (`pending` / `failed` com prazo vencido): matrícula **suspensa**,
  não removida.
- Tudo isso **sempre respeitando a expiração do curso** (`courseAccessFor`).

Sobre o cadastro de pedido:

- Escolher produto do catálogo **preenche, não tranca** — venda com desconto
  combinado é caso comum, e o valor segue editável.
- Campo de origem em branco **fica em branco**; não vira "direto". Não medir e
  ter vindo direto são coisas diferentes — mesma regra do `null` que não vira
  zero, de `docs/analytics.md`.
- `externalId`, `checkoutUrl` e `qrCode` **não se editam**: são escritos pelo
  gateway, e pedido apontando para cobrança inexistente é pior que pedido sem
  dado.
