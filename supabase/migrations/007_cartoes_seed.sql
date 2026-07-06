-- ============================================================
-- 007 — Seed dos cartões (4 da Diana + 2 do Nicco)
-- ============================================================
-- A tabela cartoes estava vazia e a tela /importar precisa dela. CRUD bonito
-- de cartão é Fase 2; aqui é só seed pra desbloquear o teste da fatura ELO.
--
-- Cada INSERT resolve grupo_id (grupo 'Diana & Nicco') e membro_id (apelido)
-- via JOIN, e só insere se ainda não houver cartão com o mesmo apelido no
-- grupo (NOT EXISTS) — idempotente, pode rodar 2x sem duplicar.
--
-- Dias: cartões da Diana vencem dia 5 (dia_fechamento NULL, ela ajusta).
--       cartões do Nicco com vencimento e fechamento NULL (ela pega com ele).
-- banco/bandeira de Smiles/Latam/BTG são suposições — confirmar depois.
-- ============================================================

begin;

-- ---------- Diana (vencimento dia 5, fechamento NULL) ----------

insert into cartoes (grupo_id, membro_id, apelido, banco, bandeira, dia_fechamento, dia_vencimento, ativo)
select g.id, m.id, 'ELO Ourocard', 'Banco do Brasil', 'Elo', null, 5, true
from grupos g
join membros m on m.grupo_id = g.id and m.apelido = 'Diana'
where g.nome = 'Diana & Nicco'
  and not exists (select 1 from cartoes c where c.grupo_id = g.id and c.apelido = 'ELO Ourocard');

insert into cartoes (grupo_id, membro_id, apelido, banco, bandeira, dia_fechamento, dia_vencimento, ativo)
select g.id, m.id, 'Smiles Infinite', 'Bradesco', 'Visa', null, 5, true
from grupos g
join membros m on m.grupo_id = g.id and m.apelido = 'Diana'
where g.nome = 'Diana & Nicco'
  and not exists (select 1 from cartoes c where c.grupo_id = g.id and c.apelido = 'Smiles Infinite');

insert into cartoes (grupo_id, membro_id, apelido, banco, bandeira, dia_fechamento, dia_vencimento, ativo)
select g.id, m.id, 'Latam Pass Itaú', 'Itaú', 'Mastercard', null, 5, true
from grupos g
join membros m on m.grupo_id = g.id and m.apelido = 'Diana'
where g.nome = 'Diana & Nicco'
  and not exists (select 1 from cartoes c where c.grupo_id = g.id and c.apelido = 'Latam Pass Itaú');

insert into cartoes (grupo_id, membro_id, apelido, banco, bandeira, dia_fechamento, dia_vencimento, ativo)
select g.id, m.id, 'Azul Itaucard', 'Itaú', 'Visa', null, 5, true
from grupos g
join membros m on m.grupo_id = g.id and m.apelido = 'Diana'
where g.nome = 'Diana & Nicco'
  and not exists (select 1 from cartoes c where c.grupo_id = g.id and c.apelido = 'Azul Itaucard');

-- ---------- Nicco (vencimento e fechamento NULL) ----------

insert into cartoes (grupo_id, membro_id, apelido, banco, bandeira, dia_fechamento, dia_vencimento, ativo)
select g.id, m.id, 'BTG Pactual', 'BTG Pactual', 'Mastercard', null, null, true
from grupos g
join membros m on m.grupo_id = g.id and m.apelido = 'Nicco'
where g.nome = 'Diana & Nicco'
  and not exists (select 1 from cartoes c where c.grupo_id = g.id and c.apelido = 'BTG Pactual');

insert into cartoes (grupo_id, membro_id, apelido, banco, bandeira, dia_fechamento, dia_vencimento, ativo)
select g.id, m.id, 'Bradesco Platinum Amex', 'Bradesco', 'American Express', null, null, true
from grupos g
join membros m on m.grupo_id = g.id and m.apelido = 'Nicco'
where g.nome = 'Diana & Nicco'
  and not exists (select 1 from cartoes c where c.grupo_id = g.id and c.apelido = 'Bradesco Platinum Amex');

commit;

-- ============================================================
-- Conferência (deve listar os 6 cartões com o dono)
-- ============================================================
select c.apelido, c.banco, c.bandeira, c.dia_vencimento, m.apelido as dono
from cartoes c
join membros m on m.id = c.membro_id
where c.grupo_id = (select id from grupos where nome = 'Diana & Nicco')
order by m.apelido, c.apelido;
