-- O pedido passa a saber a que parcelamento pertence.
--
-- Com o carnê (boleto ou cartão parcelado no Asaas), cada parcela é uma
-- cobrança com id próprio, e o pedido guarda o da **primeira**.
-- `findByExternalId` casa o webhook por `externalId` + `gatewayId`: o aviso da
-- parcela 1 encontra o pedido, e o das parcelas 2 a N **não encontra nada** e é
-- descartado em silêncio.
--
-- Efeito prático, e é caro: quem para de pagar no meio do carnê continua
-- estudando, e o AVA não fica sabendo. O elo existe do lado do gateway — o
-- Asaas devolve `installment` na criação e repete o mesmo id em todas as
-- parcelas —, e esta coluna é onde ele passa a existir do lado de cá.
--
-- Nulo em todo pedido à vista, que é a maioria, e nos pedidos anteriores a
-- 5/set/2026. Nulo aqui quer dizer "não é carnê", não "não se sabe".

ALTER TABLE "payment_orders" ADD COLUMN "gateway_installment_id" text;
