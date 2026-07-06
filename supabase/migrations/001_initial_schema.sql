-- ============================================================
-- FINANÇAS DO CASAL — Schema do banco
-- ============================================================
-- Banco PostgreSQL no Supabase com Row Level Security (RLS)
-- Cada casal só vê seus próprios dados.

-- ============================================================
-- 1. CASAIS (couples)
-- ============================================================
-- Um casal = uma "conta" no app. Diana e Nicco são membros do mesmo casal.

create table casais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- ============================================================
-- 2. MEMBROS (membros do casal)
-- ============================================================
-- Cada membro é um usuário do Supabase Auth + vínculo com casal.

create table membros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  casal_id uuid not null references casais(id) on delete cascade,
  nome text not null,
  apelido text not null,
  cor text default '#534AB7',
  criado_em timestamptz not null default now(),
  unique(user_id)
);

create index idx_membros_casal on membros(casal_id);
create index idx_membros_user on membros(user_id);

-- ============================================================
-- 3. CARTÕES
-- ============================================================
-- Cartões de crédito de cada membro.

create table cartoes (
  id uuid primary key default gen_random_uuid(),
  casal_id uuid not null references casais(id) on delete cascade,
  membro_id uuid not null references membros(id) on delete cascade,
  apelido text not null,
  banco text,
  bandeira text,
  ultimos_digitos text,
  dia_fechamento int,
  dia_vencimento int,
  ativo boolean default true,
  criado_em timestamptz not null default now()
);

create index idx_cartoes_casal on cartoes(casal_id);
create index idx_cartoes_membro on cartoes(membro_id);

-- ============================================================
-- 4. CATEGORIAS
-- ============================================================
-- 28 categorias da Diana (Supermercado, Pet, Educação, etc) + custom.
-- Cada categoria tem uma divisão PADRÃO que pode ser sobrescrita por lançamento.

create table categorias (
  id uuid primary key default gen_random_uuid(),
  casal_id uuid not null references casais(id) on delete cascade,
  nome text not null,
  icone text,
  cor text,
  divisao_padrao_tipo text not null default 'dividir',
  divisao_padrao_pct_diana int default 50,
  ordem int default 0,
  ativo boolean default true,
  criado_em timestamptz not null default now()
);

create index idx_categorias_casal on categorias(casal_id);

-- ============================================================
-- 5. FONTES (origens dos lançamentos)
-- ============================================================
-- Cada importação de fatura ou extrato vira uma "fonte".
-- Permite saber de qual PDF/upload o lançamento veio.

create table fontes (
  id uuid primary key default gen_random_uuid(),
  casal_id uuid not null references casais(id) on delete cascade,
  tipo text not null,
  cartao_id uuid references cartoes(id) on delete set null,
  mes_referencia date not null,
  nome_arquivo text,
  total_lancamentos int default 0,
  total_valor numeric(12, 2) default 0,
  importado_em timestamptz not null default now(),
  importado_por uuid references membros(id)
);

create index idx_fontes_casal on fontes(casal_id);
create index idx_fontes_mes on fontes(mes_referencia);

-- ============================================================
-- 6. LANÇAMENTOS (a tabela central!)
-- ============================================================
-- Cada compra/PIX/boleto/débito é um lançamento.

create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  casal_id uuid not null references casais(id) on delete cascade,
  fonte_id uuid references fontes(id) on delete set null,
  cartao_id uuid references cartoes(id) on delete set null,
  pago_por_id uuid not null references membros(id),

  data_lancamento date not null,
  data_competencia date not null,
  descricao text not null,
  descricao_normalizada text,
  valor numeric(12, 2) not null,

  categoria_id uuid references categorias(id) on delete set null,

  divisao_tipo text not null default 'dividir',
  divisao_pct_diana int default 50,

  parcela_atual int,
  parcela_total int,
  parcelamento_id uuid,

  observacao text,
  tags text[],

  classificado boolean default false,
  classificado_em timestamptz,
  classificado_por uuid references membros(id),

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_lancamentos_casal on lancamentos(casal_id);
create index idx_lancamentos_competencia on lancamentos(data_competencia);
create index idx_lancamentos_categoria on lancamentos(categoria_id);
create index idx_lancamentos_classificado on lancamentos(classificado);
create index idx_lancamentos_pago_por on lancamentos(pago_por_id);
create index idx_lancamentos_descricao_norm on lancamentos(descricao_normalizada);

-- ============================================================
-- 7. APRENDIZADO (regras automáticas)
-- ============================================================
-- Quando você marca "Granado Pharmacias" como "Só Diana" 2x seguidas,
-- o app aprende e sugere essa classificação na próxima.

create table regras_aprendidas (
  id uuid primary key default gen_random_uuid(),
  casal_id uuid not null references casais(id) on delete cascade,
  padrao_descricao text not null,
  categoria_id uuid references categorias(id) on delete set null,
  divisao_tipo text,
  divisao_pct_diana int,
  vezes_confirmada int default 1,
  ativa boolean default true,
  criada_em timestamptz not null default now(),
  ultima_atualizacao timestamptz not null default now()
);

create index idx_regras_casal on regras_aprendidas(casal_id);
create index idx_regras_padrao on regras_aprendidas(padrao_descricao);
create unique index idx_regras_unique on regras_aprendidas(casal_id, padrao_descricao);

-- ============================================================
-- 8. ACERTOS MENSAIS
-- ============================================================
-- Snapshot do acerto de cada mês (depois de fechado).

create table acertos (
  id uuid primary key default gen_random_uuid(),
  casal_id uuid not null references casais(id) on delete cascade,
  mes_referencia date not null,

  total_compartilhado numeric(12, 2) not null default 0,
  total_so_diana numeric(12, 2) not null default 0,
  total_so_nicco numeric(12, 2) not null default 0,
  total_geral numeric(12, 2) not null default 0,

  diana_paga numeric(12, 2) not null default 0,
  nicco_paga numeric(12, 2) not null default 0,
  transferencia_de_membro_id uuid references membros(id),
  transferencia_para_membro_id uuid references membros(id),
  transferencia_valor numeric(12, 2) default 0,

  status text default 'aberto',
  fechado_em timestamptz,
  pago_em timestamptz,
  criado_em timestamptz not null default now(),

  unique(casal_id, mes_referencia)
);

create index idx_acertos_casal on acertos(casal_id);
create index idx_acertos_mes on acertos(mes_referencia);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Cada casal só vê seus dados
-- ============================================================

alter table casais enable row level security;
alter table membros enable row level security;
alter table cartoes enable row level security;
alter table categorias enable row level security;
alter table fontes enable row level security;
alter table lancamentos enable row level security;
alter table regras_aprendidas enable row level security;
alter table acertos enable row level security;

create or replace function casal_do_usuario()
returns uuid
language sql
stable
security definer
as $$
  select casal_id from membros where user_id = auth.uid() limit 1
$$;

create policy "Casal vê próprios dados" on casais
  for all using (id = casal_do_usuario());

create policy "Membro vê próprios membros" on membros
  for all using (casal_id = casal_do_usuario());

create policy "Membro vê próprios cartões" on cartoes
  for all using (casal_id = casal_do_usuario());

create policy "Membro vê próprias categorias" on categorias
  for all using (casal_id = casal_do_usuario());

create policy "Membro vê próprias fontes" on fontes
  for all using (casal_id = casal_do_usuario());

create policy "Membro vê próprios lançamentos" on lancamentos
  for all using (casal_id = casal_do_usuario());

create policy "Membro vê próprias regras" on regras_aprendidas
  for all using (casal_id = casal_do_usuario());

create policy "Membro vê próprios acertos" on acertos
  for all using (casal_id = casal_do_usuario());

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

create or replace function update_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger lancamentos_atualizado_em
  before update on lancamentos
  for each row execute function update_atualizado_em();
