-- Corrective RLS reset: remove any legacy permissive policies and recreate
-- only group-scoped policies.

BEGIN;

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

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'grupos',
        'membros',
        'cartoes',
        'categorias',
        'lancamentos',
        'regras',
        'regras_aprendidas',
        'fechamento_mes',
        'fontes_importacao',
        'receitas',
        'reembolsos'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;

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
      EXECUTE format(
        'CREATE POLICY "Usuarios acessam %s do proprio grupo" ON public.%I FOR ALL TO authenticated USING (public.is_group_member(grupo_id)) WITH CHECK (public.is_group_member(grupo_id))',
        table_name,
        table_name
      );
    END IF;
  END LOOP;

  IF to_regclass('public.regras') IS NOT NULL THEN
    ALTER TABLE public.regras ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Usuarios acessam regras do proprio grupo"
    ON public.regras
    FOR ALL
    TO authenticated
    USING (public.is_group_member(grupo_id))
    WITH CHECK (public.is_group_member(grupo_id));
  END IF;
END $$;

COMMIT;
