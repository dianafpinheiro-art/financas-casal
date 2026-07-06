# 💰 Finanças do Casal — Diana & Nicco

App pra controlar gastos compartilhados, calcular acerto mensal entre você e Nicco.

## 🎯 O que faz

- Upload de PDFs de faturas (ELO, Latam, BTG, Bradesco, etc) → Claude extrai os lançamentos
- Importar extrato bancário (boletos, PIX)
- Cadastro manual de despesas avulsas
- Classificação: Dividir / Só Diana / Só Nicco / Personalizado (70/30 etc)
- Aprendizado: app vai lembrando das classificações pra próximos meses
- Cálculo de acerto: quanto cada um paga, quanto transferir
- Geração de PDF do acerto (mesmo formato do `transferencia_nicco_maio2026.docx`)

## 🛠️ Stack

- **Frontend:** Next.js 15 + Tailwind CSS + Shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **IA:** Anthropic API (Claude para parsing de PDF)
- **Hospedagem:** Vercel
- **App nativo (Fase 2):** Expo / React Native (mesmo código que web)

## 🚀 Setup (passo a passo)

### 1. Pré-requisitos no Windows + WSL
```bash
# Já deve ter, mas pra garantir:
node --version  # >= 20
npm --version
```

### 2. Criar conta no Supabase
1. Vai em https://supabase.com e cria conta (grátis)
2. Cria um novo projeto: nome "financas-casal", região "South America (São Paulo)"
3. Anota a URL do projeto e a chave anon (Settings > API)

### 3. Criar conta na Anthropic (Console)
1. https://console.anthropic.com — você já tem Max
2. Settings > API Keys > Create Key
3. Cria uma chave nomeada "financas-casal"
4. Anota a chave (vai começar com `sk-ant-...`)

### 4. Clonar e instalar
```bash
cd ~/projetos  # ou onde você guarda projetos
# (vai vir já criado em zip)
cd financas-casal
npm install
```

### 5. Configurar variáveis de ambiente
Copia `.env.example` pra `.env.local` e preenche:
```bash
cp .env.example .env.local
```

Edita `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### 6. Rodar migrations do banco
No Supabase, vai em SQL Editor e roda o conteúdo de `supabase/migrations/001_initial_schema.sql`.

### 7. Subir o app em local
```bash
npm run dev
```

Abre http://localhost:3000 — pronto, tá rodando!

### 8. Criar seu usuário e do Nicco
- Acessa http://localhost:3000/login
- Cria sua conta
- Cria a conta do Nicco
- Configura no Supabase que vocês são do mesmo casal (ver `docs/setup.md`)

## 📋 Roadmap

### Fase 1 — MVP (2-3 semanas)
- [x] Estrutura inicial
- [ ] Login + auth
- [ ] Cadastro de cartões e categorias
- [ ] Upload de fatura → parse com Claude
- [ ] Tela de classificação de lançamentos
- [ ] Tela do mês com acerto
- [ ] Geração de PDF do acerto

### Fase 2 — Melhorias
- [ ] Importar extrato bancário
- [ ] Despesas avulsas manuais
- [ ] Divisão personalizada por categoria
- [ ] Aprendizado por merchant
- [ ] Relatórios e gráficos
- [ ] Importar histórico
- [ ] App nativo iOS/Android via Expo

## 📁 Estrutura

```
financas-casal/
├── src/
│   ├── app/              # Rotas (Next.js App Router)
│   │   ├── login/        # Tela de login
│   │   ├── dashboard/    # Dashboard do mês
│   │   ├── lancamentos/  # Lista de lançamentos
│   │   ├── relatorios/   # Gráficos e análises
│   │   ├── ajustes/      # Cartões, categorias, etc
│   │   ├── importar/     # Upload de PDFs
│   │   └── api/          # API routes (server-side)
│   ├── components/       # Componentes React
│   ├── lib/              # Helpers, Supabase client, etc
│   ├── hooks/            # React hooks customizados
│   └── types/            # TypeScript types
├── supabase/
│   └── migrations/       # SQL schemas
└── .claude/
    └── skills/           # Skills pra Claude Code te ajudar
```

## 🧙 Trabalhando com Claude Code

Esse projeto tem um `SKILL.md` em `.claude/skills/financas-casal/` que ensina o Claude Code:
- Padrões do projeto
- Como criar telas novas
- Como adicionar parser de novos cartões
- Convenções de código

Pra ativar, basta abrir o projeto no Claude Code e ele vai ler automático.

## 💜

Feito com amor pra Diana e Nicco aguentarem fechar as contas todo mês sem brigar.
