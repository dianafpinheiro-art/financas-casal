-- ============================================================
-- 002 — BOOTSTRAP do grupo Diana & Nicco
-- ============================================================
-- Substitui a antiga 002_seed_categorias.sql (que tinha o placeholder
-- COLE_AQUI_O_ID_DO_CASAL e nunca rodava). Faz tudo numa transação:
--   1. cria o grupo "Diana & Nicco"
--   2. insere os 2 membros amarrados ao grupo (user_ids reais do Auth)
--   3. insere as 28 categorias amarradas ao grupo
--
-- IDEMPOTENTE: pode rodar 2x sem duplicar.
--   - grupo: ancorado no membro da Diana (reusa se já existir)
--   - membros: ON CONFLICT (user_id) DO NOTHING (user_id é unique)
--   - categorias: só insere se o grupo ainda não tiver nenhuma
--
-- ⚠️ ORDEM DE MIGRATION: este arquivo referencia `grupos`/`grupo_id`, que só
-- existem DEPOIS da 003. No seu banco (já com 001/003/004 aplicadas) ele roda
-- liso no SQL Editor. Mas num `supabase db push` de banco ZERADO, a ordem
-- 002 -> 003 quebraria. Se um dia você for recriar o banco do zero, me avisa
-- que eu renumero este bootstrap pra depois da 004 (ver nota no fim).
-- ============================================================

begin;

do $$
declare
  v_grupo_id uuid;
  v_diana uuid := '01e9b98a-0a0d-4d53-ae0b-69a180b3bd6f';
  v_nicco uuid := '6f779452-f5b3-443e-815a-bec5db59d778';
begin
  -- 1. Grupo: reusa o da Diana se já existir; senão cria.
  select grupo_id into v_grupo_id from membros where user_id = v_diana limit 1;
  if v_grupo_id is null then
    insert into grupos (nome) values ('Diana & Nicco') returning id into v_grupo_id;
  end if;

  -- 2. Membros (user_id é unique -> não duplica em re-run).
  insert into membros (user_id, grupo_id, nome, apelido, cor) values
    (v_diana, v_grupo_id, 'Diana', 'Diana', '#534AB7'),
    (v_nicco, v_grupo_id, 'Nicco', 'Nicco', '#0F6E56')
  on conflict (user_id) do nothing;

  -- 3. Categorias (só se o grupo ainda não tiver nenhuma).
  if not exists (select 1 from categorias where grupo_id = v_grupo_id) then
    insert into categorias
      (grupo_id, nome, icone, cor, divisao_padrao_tipo, divisao_padrao_pct_diana, ordem)
    values
      (v_grupo_id, 'SaaS',                'cloud',           '#534AB7', 'dividir',   50,  1),
      (v_grupo_id, 'Educação Cursos',     'school',          '#534AB7', 'dividir',   50,  2),
      (v_grupo_id, 'Viagens',             'plane',           '#534AB7', 'dividir',   50,  3),
      (v_grupo_id, 'Compras online',      'shopping-bag',    '#534AB7', 'dividir',   50,  4),
      (v_grupo_id, 'Moradia',             'home',            '#534AB7', 'so_nicco',   0,  5),
      (v_grupo_id, 'Educação Dinah',      'baby',            '#D85A30', 'dividir',   50,  6),
      (v_grupo_id, 'Parcelamento fatura', 'credit-card',     '#888780', 'dividir',   50,  7),
      (v_grupo_id, 'Diaristas',           'broom',           '#0F6E56', 'dividir',   50,  8),
      (v_grupo_id, 'Condomínio',          'building',        '#534AB7', 'dividir',   50,  9),
      (v_grupo_id, 'Supermercado',        'shopping-cart',   '#0F6E56', 'dividir',   50, 10),
      (v_grupo_id, 'Pet',                 'paw',             '#D85A30', 'dividir',   50, 11),
      (v_grupo_id, 'Transporte',          'car',             '#534AB7', 'dividir',   50, 12),
      (v_grupo_id, 'Festas',              'gift',            '#D4537E', 'dividir',   50, 13),
      (v_grupo_id, 'Saúde',               'heart',           '#D85A30', 'dividir',   50, 14),
      (v_grupo_id, 'Contas básicas',      'plug',            '#534AB7', 'dividir',   50, 15),
      (v_grupo_id, 'iFood',               'tools-kitchen',   '#D85A30', 'dividir',   50, 16),
      (v_grupo_id, 'Lazer',               'movie',           '#534AB7', 'dividir',   50, 17),
      (v_grupo_id, 'Impostos IPTU',       'receipt',         '#BA7517', 'dividir',   50, 18),
      (v_grupo_id, 'Restaurantes',        'tools-kitchen-2', '#D85A30', 'dividir',   50, 19),
      (v_grupo_id, 'Saúde Estética',      'sparkles',        '#D4537E', 'so_diana', 100, 20),
      (v_grupo_id, 'Terapias',            'brain',           '#D4537E', 'so_diana', 100, 21),
      (v_grupo_id, 'Programa pontos',     'star',            '#BA7517', 'so_diana', 100, 22),
      (v_grupo_id, 'Reparos casa',        'tools',           '#534AB7', 'dividir',   50, 23),
      (v_grupo_id, 'Outros',              'dots',            '#888780', 'dividir',   50, 24),
      (v_grupo_id, 'Tarifas',             'percentage',      '#888780', 'so_diana', 100, 25),
      (v_grupo_id, 'Seguros',             'shield',          '#534AB7', 'dividir',   50, 26),
      (v_grupo_id, 'Bancos',              'building-bank',   '#888780', 'so_diana', 100, 27),
      (v_grupo_id, 'IOF',                 'percentage',      '#888780', 'dividir',   50, 28);
  end if;
end $$;

commit;

-- ============================================================
-- Conferência (roda fora da transação) — deve mostrar: Diana & Nicco | 2 | 28
-- ============================================================
select g.nome as grupo,
       count(distinct m.id) as membros,
       count(distinct c.id) as categorias
from grupos g
left join membros m    on m.grupo_id = g.id
left join categorias c on c.grupo_id = g.id
where g.nome = 'Diana & Nicco'
group by g.nome;
