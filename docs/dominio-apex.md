# Levar o AVA para `psicanaliseclinica.online`

> Plano escrito em 30/ago/2026. Nada aplicado ainda — a etapa 3 é uma decisão
> do dono e trava as seguintes.

## O que existe hoje, medido

| Endereço | Resolve para | O que serve |
| --- | --- | --- |
| `psicanaliseclinica.online` | `72.60.153.234`, direto | **loja WooCommerce (WordPress)** |
| `www.psicanaliseclinica.online` | Cloudflare | 301 para o apex |
| `ava.psicanaliseclinica.online` | Cloudflare → `195.200.0.253` | **o AVA** |
| `portalpco.online` | `72.60.153.234` | LMS antigo (LearnDash) |

Apex e portal dividem a mesma máquina; o AVA está em outra, atrás da
Cloudflare. O apex **não** passa pela Cloudflare hoje — `ava.` e `www.` passam.

## O conflito que precisa ser decidido antes de qualquer DNS

O apex não está vago: é a loja, e **a loja está vendendo**. O sincronismo do
delta mediu 18 pedidos pagos entre 6 de julho e hoje. Apontar o apex para o AVA
sem um destino pronto para a loja tira do ar o canal que recebe o dinheiro.

Isso torna a mudança uma decisão comercial, não uma troca de registro DNS.

### Três caminhos

**A — AVA no apex, loja vira `loja.psicanaliseclinica.online`.**
Preserva a operação de venda. O custo é que todo link, anúncio, e-mail e
resultado de busca apontando para o apex passa a cair no AVA: exige mapa de
redirecionamento página a página, não um 301 genérico para a home.

**B — AVA no apex, loja aposentada.**
A venda migra para o checkout do próprio AVA, que já existe e está testado:
seis gateways, produtos, cupons, pedidos e webhooks verificados. É o destino
natural do projeto, e o único que acaba com a duplicidade de cadastro que gerou
o delta. Exige paridade de catálogo e um período de convivência com os dois no
ar.

**C — Dividir por caminho (`/` no AVA, `/loja` no WooCommerce).**
Exigiria um proxy reverso único na frente de duas máquinas diferentes. É o mais
frágil dos três e o mais difícil de depurar quando quebra. Não recomendo.

**Recomendação: B, tendo A como estado intermediário.** A entrega o apex ao AVA
rápido e sem risco de receita; B é onde isso deve terminar, quando o catálogo
estiver espelhado no checkout próprio.

## O que o código já resolve sozinho

Boa notícia: de 37 referências ao domínio no código, **30 já leem
`process.env.PUBLIC_ORIGIN`** e só usam `ava.psicanaliseclinica.online` como
valor de reserva. Definir a variável cobre a maioria — inclusive as URLs de
retorno de Stripe, Pagar.me, MercadoPago e PayPal.

**`PUBLIC_ORIGIN` não está definida em produção hoje**, então o que está no ar é
o valor de reserva. Defini-la é a primeira etapa, e vale mesmo que a mudança de
domínio não aconteça: tira o endereço do caminho crítico do código.

## Os pontos que ignoram a variável

Cinco lugares escrevem o domínio direto e precisam de correção:

| Arquivo | O que quebra |
| --- | --- |
| `server/public/config.ts:40` | `ORG.url` — dados estruturados e SEO apontariam para o endereço velho |
| `server/notifications/welcome.ts:19` | link de login no e-mail de boas-vindas |
| `server/notifications/student-progress-email.ts:165,185` | link do painel no e-mail de progresso |
| `server/notifications/templates.ts:64` | assinatura no rodapé de todos os e-mails |
| `server/app.ts:268` | marca na página de erro servida pelo servidor |

`server/dev.ts` (robots e sitemap) já monta a URL a partir do `host` da
requisição — muda sozinho. Os endereços em `templates.ts:247-270` são dados de
pré-visualização e não vão para ninguém.

## Fora do código — a lista que costuma derrubar migração de domínio

- **Certificado TLS do apex** no servidor do AVA, emitido antes de apontar o DNS.
- **Cloudflare**: o apex passa a precisar entrar na zona proxiada, como `ava.` já está.
- **Callbacks dos gateways**: Stripe, Asaas, MercadoPago, Pagar.me e PayPal têm
  URL de retorno e de webhook cadastradas no painel de cada um. Precisam aceitar
  os **dois** domínios antes da virada, não depois.
- **OAuth Google e Microsoft**: o *redirect URI* autorizado é exato; um domínio
  novo é um cadastro novo.
- **Envio de e-mail**: se o remetente mudar de domínio, SPF e DKIM vão junto.
- **Search Console**: propriedade nova, e o mapa de 301 é o que preserva o que
  já ranqueia.
- **Links soltos**: campanhas, WhatsApp, Instagram, assinatura de e-mail.

## Ordem segura

As duas primeiras não dependem de decisão e podem ser feitas já.

1. **Definir `PUBLIC_ORIGIN` em produção** com o valor atual. Sem mudança
   visível; tira o domínio do valor de reserva.
2. **Corrigir os cinco pontos fixos**, com teste que falhe se alguém escrever o
   domínio direto de novo.
3. **Decidir A ou B.** ← trava as seguintes
4. Preparar o apex no servidor do AVA: *vhost* e certificado, **sem** apontar o DNS.
5. Publicar a loja no endereço novo e conferir uma compra de ponta a ponta.
6. Cadastrar os dois domínios nos gateways e no OAuth.
7. Baixar o TTL do DNS do apex com antecedência (algumas horas).
8. Virar o DNS em janela de venda baixa.
9. Manter os 301 do endereço antigo por pelo menos seis meses.

## A regra que não pode ser quebrada

O AVA não assume o apex enquanto a loja estiver vendendo por lá sem destino
pronto. Dezoito pedidos em oito semanas é a prova de que ela está viva.
