-- ============================================================
-- 008 — Refactor pra MERCHANT (parte 1: colunas + solta o único antigo)
-- ============================================================
-- Regras passam a ser por merchant (extrairMerchant), não pela descrição
-- completa. Aqui só adicionamos as colunas e removemos o índice único antigo
-- (que era por padrao_descricao). A POPULAÇÃO do merchant + dedup é feita
-- pelo script `node scripts/migrar-merchant.cjs` (reusa o extrairMerchant).
-- O índice ÚNICO por merchant entra na 009, DEPOIS do dedup.
--
-- Ordem de execução:
--   1) rodar esta 008 (SQL Editor)
--   2) rodar `node scripts/migrar-merchant.cjs` (popula + dedup + backfill)
--   3) rodar a 009 (índice único por merchant)
-- ============================================================

begin;

alter table regras_aprendidas add column if not exists merchant text;
alter table lancamentos       add column if not exists merchant text;

-- Solta o único antigo (grupo_id, padrao_descricao) — não é mais a chave.
drop index if exists idx_regras_unique;

-- Índice auxiliar (não-único) pra busca/analytics por merchant.
create index if not exists idx_lancamentos_merchant on lancamentos(merchant);
create index if not exists idx_regras_merchant on regras_aprendidas(merchant);

commit;

-- ============================================================
-- DOWN (reverter manualmente, se precisar):
-- ============================================================
-- begin;
--   drop index if exists idx_regras_merchant;
--   drop index if exists idx_lancamentos_merchant;
--   create unique index idx_regras_unique on regras_aprendidas(grupo_id, padrao_descricao);
--   alter table lancamentos       drop column if exists merchant;
--   alter table regras_aprendidas drop column if exists merchant;
-- commit;
