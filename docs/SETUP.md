# 🚀 Setup completo — Passo a passo

Diana, segue o roteiro mastigadinho pra você botar isso pra rodar no seu computador. Cada passo tem o que clicar/digitar.

---

## 📋 Pré-requisitos

Você já deve ter (do projeto NiccoCFP):
- ✅ Node.js (versão 20+)
- ✅ Windows + WSL
- ✅ Conta Vercel
- ✅ Plano Anthropic
- ✅ Claude Code instalado

**Vamos instalar agora:**
- Conta Supabase (grátis)

---

## 🗂️ Passo 1 — Descompactar o projeto

Você vai receber um zip com tudo. Extrai pra uma pasta tipo:

```
C:\Users\diana\Downloads\financas-casal
```

Abre o **WSL** (Terminal Ubuntu) e navega:

```bash
cd /mnt/c/Users/diana/Downloads/financas-casal
```

---

## 🔧 Passo 2 — Instalar dependências

```bash
npm install
```

Isso vai baixar tudo (Next.js, React, Supabase, Anthropic SDK, etc). Demora uns 2-3 minutos.

---

## 🏗️ Passo 3 — Criar projeto no Supabase

1. Vai em https://supabase.com → **Start your project** → cria conta com GitHub ou Google
2. Clica em **New Project**
3. Preenche:
   - **Name:** `financas-casal`
   - **Database password:** gera uma forte e **SALVA NUM PAPEL/GERENCIADOR DE SENHA** (você não vai usar muito, mas vai precisar de vez em quando)
   - **Region:** South America (São Paulo)
   - **Pricing Plan:** Free
4. Clica em **Create new project** e espera 1-2 minutos enquanto eles fazem o setup

---

## 🔑 Passo 4 — Pegar as chaves do Supabase

Quando o projeto estiver pronto:

1. No menu lateral, vai em **Project Settings** (engrenagem) → **API**
2. Você vai ver 3 informações importantes:
   - **Project URL** (ex: `https://abc123.supabase.co`)
   - **anon public** (chave pública, começa com `eyJ...`)
   - **service_role** (chave SECRETA, começa com `eyJ...`) — clica no olhinho pra ver

Deixa essa aba aberta, vamos voltar nela.

---

## 🤖 Passo 5 — Pegar a chave da Anthropic

1. Vai em https://console.anthropic.com
2. Login com a mesma conta da Diana (você já tem Max)
3. No menu lateral: **API Keys**
4. Clica em **Create Key**
5. Nome: `financas-casal-dev`
6. **COPIA A CHAVE AGORA** (começa com `sk-ant-...`) — ela só aparece uma vez!
7. Cola num bloco de notas temporário

---

## ⚙️ Passo 6 — Configurar `.env.local`

No WSL, na pasta do projeto:

```bash
cp .env.example .env.local
nano .env.local
```

Preenche com as chaves que pegou:

```
NEXT_PUBLIC_SUPABASE_URL=https://abc123.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Salva com `Ctrl + O`, `Enter`, `Ctrl + X`.

---

## 🗃️ Passo 7 — Criar tabelas no Supabase

1. Volta pra dashboard do Supabase
2. No menu lateral: **SQL Editor** (ícone de banco)
3. Clica em **+ New query**
4. Abre o arquivo `supabase/migrations/001_initial_schema.sql` no seu editor
5. Copia TODO o conteúdo, cola na janela do SQL Editor
6. Clica em **Run** (canto inferior direito)
7. Espera aparecer "Success. No rows returned"

✅ Pronto, todas as tabelas foram criadas!

---

## 👫 Passo 8 — Criar SEU usuário e o do Nicco

1. No Supabase, vai em **Authentication** → **Users**
2. Clica em **Add user** → **Create new user**
3. Diana:
   - Email: seu email
   - Senha: cria uma forte
   - ✅ Marca "Auto Confirm User"
   - Create
4. Repete pro Nicco:
   - Email: email dele
   - Senha: cria uma forte (vc anota pra passar pra ele)
   - ✅ Marca "Auto Confirm User"
   - Create

---

## 🏡 Passo 9 — Criar seu CASAL e vincular vocês

Volta no **SQL Editor** e roda esse SQL:

```sql
-- 1. Cria o casal
insert into casais (nome) values ('Diana & Nicco')
returning id;
-- COPIA O ID que retorna! (ex: 'abc-123-...')

-- 2. Pega o user_id da Diana (substitua o email pelo seu)
select id from auth.users where email = 'SEU_EMAIL_AQUI';
-- COPIA o id

-- 3. Pega o user_id do Nicco
select id from auth.users where email = 'EMAIL_NICCO_AQUI';
-- COPIA o id

-- 4. Cria os membros (substitua os 3 IDs)
insert into membros (user_id, casal_id, nome, apelido, cor) values
  ('ID_USER_DIANA', 'ID_CASAL', 'Diana Figueiredo Pinheiro Marangon', 'Diana', '#D85A30'),
  ('ID_USER_NICCO', 'ID_CASAL', 'Niccolo Galvao Marangon', 'Nicco', '#534AB7');
```

---

## 🏷️ Passo 10 — Seedar as 28 categorias

1. Abre `supabase/migrations/002_seed_categorias.sql`
2. Substitui TODAS as ocorrências de `COLE_AQUI_O_ID_DO_CASAL` pelo ID do casal que você criou no Passo 9
3. Cola no SQL Editor e roda

---

## 🎉 Passo 11 — Roda o app!

No WSL:

```bash
npm run dev
```

Abre o navegador em http://localhost:3000

- Vai te jogar pra `/login`
- Entra com seu email + senha
- Vai pra `/dashboard` e vê uma versão básica funcionando

---

## ✅ O que tá funcionando agora (MVP zero)

- [x] Login com Supabase Auth
- [x] Banco de dados completo (8 tabelas com RLS)
- [x] 28 categorias seedadas
- [x] Estrutura de pastas pronta
- [x] Dashboard inicial mostra o usuário logado

## 🚧 O que vamos construir agora (na sequência)

1. **Cartões CRUD** (cadastrar ELO, Latam, BTG, etc no app)
2. **Importar fatura PDF** (upload + parser Claude)
3. **Classificação de lançamentos** (a tela mais importante)
4. **Dashboard completo do mês**
5. **Gerar PDF de acerto**

---

## 🧙 Bora usar Claude Code

A partir de agora, todo o desenvolvimento pode ser via Claude Code:

```bash
cd /mnt/c/Users/diana/Downloads/financas-casal
claude
```

O Claude Code vai ler automaticamente o `.claude/skills/financas-casal/SKILL.md` e vai saber TUDO sobre o projeto (padrões, estrutura, convenções). Aí você pode pedir coisas tipo:

> "Bora criar a tela de cadastro de cartão"

Ou:

> "Cria o parser do BTG Pactual"

E ele vai fazer mantendo a coerência do projeto.

---

## ❓ Se algo der errado

Quando bater algum erro, abre um chat aqui no Claude.ai web (esse mesmo) e me cola:
1. O comando que você rodou
2. A mensagem de erro completa
3. O que você esperava que acontecesse

E eu resolvo. 💜

---

## 💰 Custos esperados (resumo)

| Item | Plano | Custo |
|---|---|---|
| Supabase | Free | R$ 0 |
| Anthropic API | já tem | ~R$ 0-20/mês (só parser) |
| Vercel | Free | R$ 0 |
| Domínio (opcional) | financas.diananicco.com | R$ 40/ano |
| **Total** | | **~R$ 0-20/mês** |

Só quando passar de 500MB de banco ou 50k MAU é que cobra. Tamo MUITO longe disso.
