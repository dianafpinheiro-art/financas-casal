-- ============================================================
-- 009 — Índice único por merchant (parte 2: roda DEPOIS do dedup)
-- ============================================================
-- ⚠️ Só rode DEPOIS de `node scripts/migrar-merchant.cjs` ter rodado o dedup
-- (uma regra por grupo+merchant). Se ainda houver duplicata, este CREATE falha
-- — o que é bom: avisa que o dedup não rodou.
-- ============================================================

begin;

create unique index if not exists regras_aprendidas_grupo_merchant_unico
  on regras_aprendidas (grupo_id, merchant)
  where merchant is not null;

commit;

-- ============================================================
-- DOWN: drop index if exists regras_aprendidas_grupo_merchant_unico;
-- ============================================================
