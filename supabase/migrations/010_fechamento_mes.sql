-- ============================================================
-- 010 — FECHAMENTO DE MÊS (travar o acerto depois de fechado)
-- ============================================================
-- Depois que o casal confere o mês e bate o acerto (ex: Maio/2026 com
-- 677 lançamentos, Nicco transfere R$ 12.295,60 pra Diana), o mês é
-- "fechado": grava-se um snapshot do acerto e os lançamentos daquele mês
-- ficam imutáveis (não podem ser editados nem excluídos). Isso evita que
-- uma reclassificação posterior mude um acerto já pago.
--
-- Três peças:
--   A) tabela fechamento_mes (1 registro por grupo+mês, com snapshot)
--   B) coluna lancamentos.mes_fechado + índice
--   C) trigger que BLOQUEIA update/delete de lançamento travado
--
-- Reabrir o mês: setar mes_fechado=false (a trigger permite essa transição)
-- e apagar o registro de fechamento_mes — feito pela action reabrirMes.
--
-- Tudo numa transação: ou aplica inteiro, ou nada.
-- ============================================================

begin;

-- ============================================================
-- PARTE A — TABELA fechamento_mes
-- ============================================================

create table fechamento_mes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,

  -- Primeiro dia do mês de competência fechado (ex: 2026-05-01).
  mes_referencia date not null,

  fechado_em timestamptz not null default now(),
  -- Quem fechou — referencia auth.users (não membros), conforme pedido.
  fechado_por uuid references auth.users(id),

  -- Valor e direção do acerto no momento do fechamento.
  valor_transferencia_cents bigint not null default 0,
  direcao_transferencia text not null
    check (direcao_transferencia in ('diana_paga_nicco', 'nicco_paga_diana')),

  -- Payload completo do acerto (acerto + dados do docx + metadados),
  -- congelado no instante do fechamento.
  snapshot_json jsonb not null,

  -- Um único fechamento por grupo+mês.
  unique (grupo_id, mes_referencia)
);

create index idx_fechamento_grupo on fechamento_mes(grupo_id);
create index idx_fechamento_mes on fechamento_mes(mes_referencia);

-- ============================================================
-- PARTE B — COLUNA mes_fechado EM lancamentos
-- ============================================================

alter table lancamentos
  add column if not exists mes_fechado boolean not null default false;

-- Índice pro filtro do dashboard/lançamentos (grupo + competência + travado).
-- Obs: a coluna de competência no schema chama-se data_competencia.
create index if not exists idx_lancamentos_mes_fechado
  on lancamentos (grupo_id, data_competencia, mes_fechado);

-- ============================================================
-- PARTE C — TRIGGER DE BLOQUEIO (lançamento travado é imutável)
-- ============================================================
-- Regras:
--   DELETE de linha com mes_fechado=true  -> sempre bloqueia.
--   UPDATE de linha com mes_fechado=true  -> bloqueia, EXCETO quando a
--     própria atualização está destravando (new.mes_fechado=false). Isso
--     permite o "reabrir mês" sem precisar desabilitar a trigger.
--   O fechamento em si (old.mes_fechado=false -> new=true) passa normal.

create or replace function bloqueia_lancamento_fechado()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    if old.mes_fechado then
      raise exception
        'Lançamento de mês fechado não pode ser excluído (id=%).', old.id
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- UPDATE: só barra se a linha já estava travada e continua travada.
  if old.mes_fechado and new.mes_fechado then
    raise exception
      'Lançamento de mês fechado não pode ser editado (id=%). Reabra o mês primeiro.', old.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger lancamentos_bloqueia_fechado
  before update or delete on lancamentos
  for each row execute function bloqueia_lancamento_fechado();

-- ============================================================
-- PARTE D — RLS (só membros do grupo veem/mexem nos fechamentos)
-- ============================================================

alter table fechamento_mes enable row level security;

create policy "Membro vê próprios fechamentos" on fechamento_mes
  for all using (grupo_id = grupo_do_usuario());

commit;

-- ============================================================
-- DOWN (reverter manualmente, se precisar):
-- ============================================================
-- begin;
--   drop trigger if exists lancamentos_bloqueia_fechado on lancamentos;
--   drop function if exists bloqueia_lancamento_fechado();
--   drop index if exists idx_lancamentos_mes_fechado;
--   alter table lancamentos drop column if exists mes_fechado;
--   drop table if exists fechamento_mes;
-- commit;
