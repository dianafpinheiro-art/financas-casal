-- ============================================================
-- 003 — VALORES EM CENTAVOS + RENOMEAR CASAIS -> GRUPOS
-- ============================================================
-- Duas mudanças estruturais decididas no review de arquitetura:
--
--  (A) Dinheiro em CENTAVOS (bigint), não numeric(12,2).
--      Motivo: divisão personalizada (ex 33/67) sobre 50+ lançamentos
--      gera centavo perdido em float/numeric. Centavo integer = padrão
--      fintech. Conversão pra reais acontece só na exibição (lib/utils).
--
--  (B) casais -> grupos (e casal_id -> grupo_id, casal_do_usuario ->
--      grupo_do_usuario). A MARCA continua "casal", mas a estrutura
--      técnica não amarra o nicho — futuro: roommates, pais separados,
--      grupo de viagem. Renomear agora é custo zero; com dados de
--      produção seria pesadelo.
--
-- Tudo dentro de uma transação: ou aplica inteiro, ou nada.
-- ============================================================

begin;

-- ============================================================
-- PARTE A — VALORES PARA CENTAVOS (numeric -> bigint)
-- ============================================================
-- round(col * 100) garante integer limpo mesmo se houver lixo decimal.
-- Colunas nullable preservam NULL; defaults '0' continuam válidos em bigint.

alter table fontes
  alter column total_valor type bigint using round(total_valor * 100)::bigint;

alter table lancamentos
  alter column valor type bigint using round(valor * 100)::bigint;

alter table acertos
  alter column total_compartilhado  type bigint using round(total_compartilhado  * 100)::bigint,
  alter column total_so_diana       type bigint using round(total_so_diana       * 100)::bigint,
  alter column total_so_nicco       type bigint using round(total_so_nicco       * 100)::bigint,
  alter column total_geral          type bigint using round(total_geral          * 100)::bigint,
  alter column diana_paga           type bigint using round(diana_paga           * 100)::bigint,
  alter column nicco_paga           type bigint using round(nicco_paga           * 100)::bigint,
  alter column transferencia_valor  type bigint using round(transferencia_valor  * 100)::bigint;

-- ============================================================
-- PARTE B — RENOMEAR CASAIS -> GRUPOS
-- ============================================================

-- B.1 — Dropar policies (referenciam casal_do_usuario(); recriadas na Parte C).
drop policy "Casal vê próprios dados"        on casais;
drop policy "Membro vê próprios membros"     on membros;
drop policy "Membro vê próprios cartões"     on cartoes;
drop policy "Membro vê próprias categorias"  on categorias;
drop policy "Membro vê próprias fontes"      on fontes;
drop policy "Membro vê próprios lançamentos" on lancamentos;
drop policy "Membro vê próprias regras"      on regras_aprendidas;
drop policy "Membro vê próprios acertos"     on acertos;

-- B.2 — Dropar função antiga (agora sem dependências, pois policies caíram).
drop function if exists casal_do_usuario();

-- B.3 — Renomear a tabela.
alter table casais rename to grupos;

-- B.4 — Renomear a coluna casal_id -> grupo_id em todas as tabelas filhas.
alter table membros           rename column casal_id to grupo_id;
alter table cartoes           rename column casal_id to grupo_id;
alter table categorias        rename column casal_id to grupo_id;
alter table fontes            rename column casal_id to grupo_id;
alter table lancamentos       rename column casal_id to grupo_id;
alter table regras_aprendidas rename column casal_id to grupo_id;
alter table acertos           rename column casal_id to grupo_id;

-- B.5 — Renomear as constraints de FK (cosmético, mantém o padrão de nome).
alter table membros           rename constraint membros_casal_id_fkey           to membros_grupo_id_fkey;
alter table cartoes           rename constraint cartoes_casal_id_fkey           to cartoes_grupo_id_fkey;
alter table categorias        rename constraint categorias_casal_id_fkey        to categorias_grupo_id_fkey;
alter table fontes            rename constraint fontes_casal_id_fkey            to fontes_grupo_id_fkey;
alter table lancamentos       rename constraint lancamentos_casal_id_fkey       to lancamentos_grupo_id_fkey;
alter table regras_aprendidas rename constraint regras_aprendidas_casal_id_fkey to regras_aprendidas_grupo_id_fkey;
alter table acertos           rename constraint acertos_casal_id_fkey           to acertos_grupo_id_fkey;

-- B.6 — Renomear os índices (cosmético, pra schema ficar consistente).
alter index idx_membros_casal     rename to idx_membros_grupo;
alter index idx_cartoes_casal     rename to idx_cartoes_grupo;
alter index idx_categorias_casal  rename to idx_categorias_grupo;
alter index idx_fontes_casal      rename to idx_fontes_grupo;
alter index idx_lancamentos_casal rename to idx_lancamentos_grupo;
alter index idx_regras_casal      rename to idx_regras_grupo;
alter index idx_acertos_casal     rename to idx_acertos_grupo;

-- ============================================================
-- PARTE C — FUNÇÃO + POLICIES (recriadas com nomes novos)
-- ============================================================

create or replace function grupo_do_usuario()
returns uuid
language sql
stable
security definer
as $$
  select grupo_id from membros where user_id = auth.uid() limit 1
$$;

create policy "Grupo vê próprios dados" on grupos
  for all using (id = grupo_do_usuario());

create policy "Membro vê próprios membros" on membros
  for all using (grupo_id = grupo_do_usuario());

create policy "Membro vê próprios cartões" on cartoes
  for all using (grupo_id = grupo_do_usuario());

create policy "Membro vê próprias categorias" on categorias
  for all using (grupo_id = grupo_do_usuario());

create policy "Membro vê próprias fontes" on fontes
  for all using (grupo_id = grupo_do_usuario());

create policy "Membro vê próprios lançamentos" on lancamentos
  for all using (grupo_id = grupo_do_usuario());

create policy "Membro vê próprias regras" on regras_aprendidas
  for all using (grupo_id = grupo_do_usuario());

create policy "Membro vê próprios acertos" on acertos
  for all using (grupo_id = grupo_do_usuario());

commit;
