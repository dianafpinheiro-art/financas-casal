# Runbook — Aplicar migrations 003/004 + testar RLS

> Esse é o último item do **Sprint 0** que só roda com o Supabase de verdade.
> Eu (Claude) não tenho a CLI nem credenciais aqui, então escrevi o passo a passo.
> Quando isso passar, o Sprint 0 está fechado e me chama pra criar a migration 005
> (seed das regras de Maio).

## 1. Aplicar as migrations 003 e 004

As migrations 001/002 já existiam. As novas são `003_centavos_e_grupos.sql`
(centavos + renomeia casais→grupos) e `004_regras_tipo_match.sql`.

**Opção A — Supabase CLI** (recomendado):
```bash
npm i -g supabase            # se ainda não tem
supabase link --project-ref SEU_REF
supabase db push             # aplica 003 e 004 em ordem
```

**Opção B — SQL Editor do dashboard:** abra cada arquivo
(`supabase/migrations/003_*.sql`, depois `004_*.sql`) e cole/rode na ordem.

> ⚠️ Eu **não** consegui validar essas migrations contra um Postgres real (sem
> CLI no ambiente). Se a 003 reclamar de algum nome de constraint/índice (ex:
> `membros_casal_id_fkey` não existe), me manda o erro — significa que o nome
> default era outro e eu ajusto. Rode dentro de transação (já vem com
> `begin/commit`), então se falhar não deixa o banco no meio do caminho.

### Conferir que aplicou certo
```sql
-- tabela renomeada?
select to_regclass('public.grupos');           -- deve retornar 'grupos'
select to_regclass('public.casais');           -- deve retornar NULL

-- valor virou bigint (centavos)?
select column_name, data_type from information_schema.columns
where table_name = 'lancamentos' and column_name = 'valor';   -- bigint

-- tipo_match existe?
select column_name from information_schema.columns
where table_name = 'regras_aprendidas' and column_name = 'tipo_match';

-- função nova existe?
select proname from pg_proc where proname = 'grupo_do_usuario';
```

## 2. Criar 2 usuários em 2 grupos diferentes

O teste de RLS verifica isolamento **entre grupos diferentes** (o "outro casal"
do futuro). Diana e Nicco ficam no MESMO grupo e devem se ver — isso é correto.
Aqui criamos 2 grupos separados de propósito.

1. **Auth → Users → Add user** (ou cadastre pelo `/login` do app): crie
   `usuariaA@teste.com` e `usuarioB@teste.com`. Anote os `id` (uuid) de cada um.
2. No **SQL Editor** (roda como service_role, ignora RLS — ok pra montar o cenário):

```sql
-- Grupo + membro da usuária A
with g as (
  insert into grupos (nome) values ('Grupo A (teste)') returning id
)
insert into membros (user_id, grupo_id, nome, apelido)
select 'UUID_DO_USUARIO_A', g.id, 'Usuária A', 'A' from g;

-- Grupo + membro do usuário B
with g as (
  insert into grupos (nome) values ('Grupo B (teste)') returning id
)
insert into membros (user_id, grupo_id, nome, apelido)
select 'UUID_DO_USUARIO_B', g.id, 'Usuário B', 'B' from g;

-- Um lançamento no grupo da A (valor em CENTAVOS: 12345 = R$ 123,45)
insert into lancamentos (grupo_id, pago_por_id, data_lancamento, data_competencia, descricao, valor)
select m.grupo_id, m.id, '2026-06-01', '2026-06-01', 'TESTE RLS - so do grupo A', 12345
from membros m where m.apelido = 'A';
```

## 3. Verificar o isolamento (o teste de fato)

A query precisa rodar **autenticada como o usuário** (não no SQL Editor, que usa
service_role e fura a RLS). Dois jeitos:

**Jeito 1 — pelo app (mais real):**
1. Browser 1 (normal): login como `usuariaA@teste.com`.
2. Browser 2 (anônimo/outro perfil): login como `usuarioB@teste.com`.
3. No browser do B, abra o console do navegador na página logada e rode:
   ```js
   const { createClient } = await import('/src/lib/supabase/client.ts') // ou use a query da tela
   ```
   Mais simples: assim que existir a tela `/lancamentos`, ela deve mostrar
   **zero** lançamentos pro B e **1** pra A.

**Jeito 2 — REST com o JWT do usuário (dá pra fazer já, sem tela):**
1. Pegue o `access_token` de cada usuário (no app logado:
   `localStorage` → chave `sb-...-auth-token`, campo `access_token`; ou via
   `supabase.auth.getSession()`).
2. Rode (troque URL, anon key e os tokens):
```bash
# Como usuária A -> espera 1 linha
curl -s "$SUPABASE_URL/rest/v1/lancamentos?select=descricao,valor" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_A"

# Como usuário B -> espera [] (zero linhas do grupo A)
curl -s "$SUPABASE_URL/rest/v1/lancamentos?select=descricao,valor" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_B"
```

### ✅ Critério de aprovação
- A vê **1** lançamento ("TESTE RLS - so do grupo A").
- B vê **0** (`[]`).

Se o B enxergar o lançamento do A, a RLS está furada — me chama com o resultado
que eu investigo as policies da migration 003.

## 4. Limpar o cenário de teste (opcional)
```sql
delete from grupos where nome in ('Grupo A (teste)', 'Grupo B (teste)');
-- cascata apaga membros e lançamentos de teste
```
