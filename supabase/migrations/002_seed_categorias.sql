-- ============================================================
-- SEED DAS 28 CATEGORIAS DA DIANA
-- ============================================================
-- Rodar DEPOIS de criar o casal e os membros.
-- Substitua 'COLE_AQUI_O_ID_DO_CASAL' pelo ID real do casal Diana & Nicco.

insert into categorias (casal_id, nome, icone, cor, divisao_padrao_tipo, divisao_padrao_pct_diana, ordem)
values
  ('COLE_AQUI_O_ID_DO_CASAL', 'SaaS',                'cloud',          '#534AB7', 'dividir',   50,  1),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Educação Cursos',     'school',         '#534AB7', 'dividir',   50,  2),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Viagens',             'plane',          '#534AB7', 'dividir',   50,  3),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Compras online',      'shopping-bag',   '#534AB7', 'dividir',   50,  4),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Moradia',             'home',           '#534AB7', 'so_nicco',   0,  5),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Educação Dinah',      'baby',           '#D85A30', 'dividir',   50,  6),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Parcelamento fatura', 'credit-card',    '#888780', 'dividir',   50,  7),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Diaristas',           'broom',          '#0F6E56', 'dividir',   50,  8),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Condomínio',          'building',       '#534AB7', 'dividir',   50,  9),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Supermercado',        'shopping-cart',  '#0F6E56', 'dividir',   50, 10),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Pet',                 'paw',            '#D85A30', 'dividir',   50, 11),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Transporte',          'car',            '#534AB7', 'dividir',   50, 12),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Festas',              'gift',           '#D4537E', 'dividir',   50, 13),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Saúde',               'heart',          '#D85A30', 'dividir',   50, 14),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Contas básicas',      'plug',           '#534AB7', 'dividir',   50, 15),
  ('COLE_AQUI_O_ID_DO_CASAL', 'iFood',               'tools-kitchen',  '#D85A30', 'dividir',   50, 16),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Lazer',               'movie',          '#534AB7', 'dividir',   50, 17),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Impostos IPTU',       'receipt',        '#BA7517', 'dividir',   50, 18),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Restaurantes',        'tools-kitchen-2','#D85A30', 'dividir',   50, 19),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Saúde Estética',      'sparkles',       '#D4537E', 'so_diana', 100, 20),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Terapias',            'brain',          '#D4537E', 'so_diana', 100, 21),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Programa pontos',     'star',           '#BA7517', 'so_diana', 100, 22),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Reparos casa',        'tools',          '#534AB7', 'dividir',   50, 23),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Outros',              'dots',           '#888780', 'dividir',   50, 24),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Tarifas',             'percentage',     '#888780', 'so_diana', 100, 25),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Seguros',             'shield',         '#534AB7', 'dividir',   50, 26),
  ('COLE_AQUI_O_ID_DO_CASAL', 'Bancos',              'building-bank',  '#888780', 'so_diana', 100, 27),
  ('COLE_AQUI_O_ID_DO_CASAL', 'IOF',                 'percentage',     '#888780', 'dividir',   50, 28);
