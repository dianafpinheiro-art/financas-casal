-- Lock down group data access for the couple finance app.
-- Run this in Supabase SQL Editor before sending traffic to the app.
-- Before applying, make sure each active group has at least one membros.user_id
-- linked to the correct auth.users.id, or the group will be hidden by RLS.

BEGIN;

-- Tables added after the initial schema, kept compatible with the current app.
CREATE TABLE IF NOT EXISTS public.receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  membro_id UUID REFERENCES public.membros(id) ON DELETE SET NULL,
  fonte TEXT NOT NULL,
  valor BIGINT NOT NULL,
  data_competencia TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reembolsos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em TIMESTAMPTZ DEFAULT now() NOT NULL,
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor BIGINT NOT NULL,
  data_competencia DATE NOT NULL,
  credito_para_id UUID REFERENCES public.membros(id) NOT NULL
);

ALTER TABLE IF EXISTS public.reembolsos
  ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE;

UPDATE public.reembolsos r
SET grupo_id = m.grupo_id
FROM public.membros m
WHERE r.credito_para_id = m.id
  AND r.grupo_id IS NULL;

-- Security definer avoids recursive RLS when policies need to check membros.
CREATE OR REPLACE FUNCTION public.is_group_member(target_grupo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.membros m
    WHERE m.grupo_id = target_grupo_id
      AND m.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID) TO authenticated;

-- Remove MVP/public policies.
DROP POLICY IF EXISTS "Acesso total a grupos" ON public.grupos;
DROP POLICY IF EXISTS "Acesso total a membros" ON public.membros;
DROP POLICY IF EXISTS "Acesso total a cartoes" ON public.cartoes;
DROP POLICY IF EXISTS "Acesso total a categorias" ON public.categorias;
DROP POLICY IF EXISTS "Acesso total a lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Acesso total a regras_aprendidas" ON public.regras_aprendidas;
DROP POLICY IF EXISTS "Acesso total a fechamento_mes" ON public.fechamento_mes;
DROP POLICY IF EXISTS "Acesso total a fontes_importacao" ON public.fontes_importacao;
DROP POLICY IF EXISTS "Permitir leitura publica" ON public.reembolsos;
DROP POLICY IF EXISTS "Permitir leitura pública" ON public.reembolsos;
DROP POLICY IF EXISTS "Permitir insercao publica" ON public.reembolsos;
DROP POLICY IF EXISTS "Permitir inserção pública" ON public.reembolsos;
DROP POLICY IF EXISTS "Permitir delecao publica" ON public.reembolsos;
DROP POLICY IF EXISTS "Permitir deleção pública" ON public.reembolsos;

ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios podem criar grupos" ON public.grupos;
DROP POLICY IF EXISTS "Usuarios acessam seus grupos" ON public.grupos;
DROP POLICY IF EXISTS "Usuarios atualizam seus grupos" ON public.grupos;
DROP POLICY IF EXISTS "Usuarios removem seus grupos" ON public.grupos;
CREATE POLICY "Usuarios podem criar grupos"
ON public.grupos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios acessam seus grupos"
ON public.grupos
FOR SELECT
TO authenticated
USING (public.is_group_member(id));

CREATE POLICY "Usuarios atualizam seus grupos"
ON public.grupos
FOR UPDATE
TO authenticated
USING (public.is_group_member(id))
WITH CHECK (public.is_group_member(id));

CREATE POLICY "Usuarios removem seus grupos"
ON public.grupos
FOR DELETE
TO authenticated
USING (public.is_group_member(id));

DROP POLICY IF EXISTS "Usuarios veem membros do grupo" ON public.membros;
DROP POLICY IF EXISTS "Usuarios criam membros do grupo" ON public.membros;
DROP POLICY IF EXISTS "Usuarios atualizam membros do grupo" ON public.membros;
DROP POLICY IF EXISTS "Usuarios removem membros do grupo" ON public.membros;

CREATE POLICY "Usuarios veem membros do grupo"
ON public.membros
FOR SELECT
TO authenticated
USING (public.is_group_member(grupo_id));

CREATE POLICY "Usuarios criam membros do grupo"
ON public.membros
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_group_member(grupo_id)
);

CREATE POLICY "Usuarios atualizam membros do grupo"
ON public.membros
FOR UPDATE
TO authenticated
USING (public.is_group_member(grupo_id))
WITH CHECK (public.is_group_member(grupo_id));

CREATE POLICY "Usuarios removem membros do grupo"
ON public.membros
FOR DELETE
TO authenticated
USING (public.is_group_member(grupo_id));

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'cartoes',
    'categorias',
    'lancamentos',
    'regras_aprendidas',
    'fechamento_mes',
    'fontes_importacao',
    'receitas',
    'reembolsos'
  ]
  LOOP
    IF to_regclass('public.' || quote_ident(table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('DROP POLICY IF EXISTS "Usuarios acessam %s do proprio grupo" ON public.%I', table_name, table_name);
      EXECUTE format(
        'CREATE POLICY "Usuarios acessam %s do proprio grupo" ON public.%I FOR ALL TO authenticated USING (public.is_group_member(grupo_id)) WITH CHECK (public.is_group_member(grupo_id))',
        table_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

-- Some prior notes call this table "regras"; support it if it exists in production.
DO $$
BEGIN
  IF to_regclass('public.regras') IS NOT NULL THEN
    ALTER TABLE public.regras ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Acesso total a regras" ON public.regras;
    DROP POLICY IF EXISTS "Usuarios acessam regras do proprio grupo" ON public.regras;
    CREATE POLICY "Usuarios acessam regras do proprio grupo"
    ON public.regras
    FOR ALL
    TO authenticated
    USING (public.is_group_member(grupo_id))
    WITH CHECK (public.is_group_member(grupo_id));
  END IF;
END $$;

COMMIT;
