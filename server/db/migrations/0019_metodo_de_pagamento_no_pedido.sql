-- O método de pagamento passa a ser um dado do pedido.
--
-- Até aqui o método não era nosso: cada provider decidia sozinho, e os padrões
-- discordavam entre si. O Asaas lia `metadata.billingType` e, na falta, cobrava
-- **PIX**; o Pagar.me abria o checkout com os três e deixava o comprador
-- escolher lá dentro; o Stripe fixava cartão; a Sandra usava o `metodo` das
-- opções do gateway. Ou seja: a escola não sabia, olhando o pedido, como a
-- pessoa tinha pago — e não havia como rotear boleto para um gateway e cartão
-- para outro, porque o método só existia depois de o gateway já ter sido
-- escolhido.
--
-- **Nulo quer dizer "não se sabe"**, e é o valor de todo pedido anterior a
-- 5/set/2026. Não é "cartão": preencher retroativamente inventaria um fato
-- sobre dinheiro que ninguém registrou.
--
-- É também a chave que substitui o gateway na busca por pedido pendente
-- equivalente. Com roteamento e fallback, o gateway do pedido pode mudar entre
-- a criação e a cobrança; o método, não.

ALTER TABLE "payment_orders" ADD COLUMN "metodo" text;
