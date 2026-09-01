-- De onde veio a venda: origem, meio, campanha.
--
-- Nulo é resposta legítima aqui: 1.125 dos 1.845 pedidos importados não têm
-- atribuição nenhuma na origem, e inventar "direto" para eles seria transformar
-- "não medi" em "medi e foi direto". Ver server/marketing/atribuicao.ts.
ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "attribution" jsonb;
