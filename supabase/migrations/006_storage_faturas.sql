-- ============================================================
-- 006 — Storage: bucket privado "faturas" com RLS por grupo
-- ============================================================
-- Os PDFs de fatura ficam num bucket PRIVADO. O caminho de cada arquivo
-- começa com o grupo_id:  <grupo_id>/<ano-mes>/<arquivo>.pdf
-- A RLS amarra o acesso ao grupo do usuário logado (grupo_do_usuario()),
-- usando o 1º segmento do path. A leitura no app é via signed URL com
-- expiração de 5 min (createSignedUrl(..., 300)) — isso é no código.
--
-- Obs: 005 está reservada pro seed das regras de Maio (a Diana vai mandar).
-- ============================================================

begin;

-- Bucket privado (public = false). Idempotente.
insert into storage.buckets (id, name, public)
values ('faturas', 'faturas', false)
on conflict (id) do nothing;

-- storage.objects já vem com RLS habilitada no Supabase; só criamos as policies.
-- Path esperado: "<grupo_id>/...". (storage.foldername(name))[1] é o 1º segmento.

create policy "faturas: grupo lê"
  on storage.objects for select
  using (
    bucket_id = 'faturas'
    and (storage.foldername(name))[1] = grupo_do_usuario()::text
  );

create policy "faturas: grupo envia"
  on storage.objects for insert
  with check (
    bucket_id = 'faturas'
    and (storage.foldername(name))[1] = grupo_do_usuario()::text
  );

create policy "faturas: grupo atualiza"
  on storage.objects for update
  using (
    bucket_id = 'faturas'
    and (storage.foldername(name))[1] = grupo_do_usuario()::text
  )
  with check (
    bucket_id = 'faturas'
    and (storage.foldername(name))[1] = grupo_do_usuario()::text
  );

create policy "faturas: grupo apaga"
  on storage.objects for delete
  using (
    bucket_id = 'faturas'
    and (storage.foldername(name))[1] = grupo_do_usuario()::text
  );

commit;
