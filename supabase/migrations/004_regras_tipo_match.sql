-- ============================================================
-- 004 — tipo_match em regras_aprendidas
-- ============================================================
-- Como uma regra casa com a descrição normalizada de um lançamento:
--   exact    -> descrição normalizada == padrão (igualdade total)
--   prefix   -> descrição normalizada começa com o padrão  (ex: "uber" pega "uber *trip 123")
--   contains -> padrão aparece em qualquer lugar da descrição (ex: "maria jose")
--
-- Default 'prefix' porque é o caso mais comum em fatura de cartão
-- (merchant no começo + cidade/parcela/lixo no fim). Sem isso, uma regra
-- de "pagseguro" pegaria tanto a compra real quanto a tarifa do PIX.
-- ============================================================

begin;

alter table regras_aprendidas
  add column tipo_match text not null default 'prefix'
    check (tipo_match in ('exact', 'prefix', 'contains'));

commit;
