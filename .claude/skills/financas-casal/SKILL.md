---
name: financas-casal
description: Skill do projeto Finanças do Casal (Diana & Nicco) — app web/mobile para controle de gastos compartilhados com login dos 2, importação de faturas PDF via Claude API, categorização inteligente, divisão personalizável (50/50, 70/30, etc) e cálculo de acerto mensal. Use SEMPRE que a Diana mencionar "app de finanças", "controle de cartão", "split de gastos", "acerto Nicco", ou trouxer arquivos do projeto financas-casal. Stack Next.js 15 + Supabase + Anthropic API + Tailwind/Shadcn + Vercel.
---

# Skill: Finanças do Casal

App web (e futuramente nativo) pra Diana e Nicco controlarem gastos compartilhados.

## Contexto rápido

**Quem usa:** Diana Figueiredo Pinheiro Marangon e Niccolo Galvao Marangon. Casados, moram em Recife/PE, têm uma filha (Dinah) e um cachorro shitzu (Cadu).

**Por que esse app existe:** Hoje (Maio/2026) a Diana faz controle manual via planilhas e PDFs gerados pelo Claude.ai. O processo: cada mês ela sobe os PDFs das faturas (4 dela + 2 dele), o Claude extrai os lançamentos, ela classifica como "Dividir / Só Diana / Só Nicco", e o Claude gera um PDF com o cálculo de quanto o Nicco transfere pra ela. Funciona, mas dá trabalho. O app automatiza isso.

**Cartões atuais:**
- Diana: ELO Ourocard, Smiles Infinite Visa, Latam Pass Itaú, Azul Itaucard
- Nicco: BTG Pactual, Bradesco Platinum Amex

**Outras despesas:** Boletos (Colégio Ethos, Condomínio, Energia, Red Balloon, IPTU, Pet Top), conta Claro, PIX (Maria Jose diarista, Ana Maria diarista, Gustavo, Cida, Uber Reginaldo/Edmilson, festas, pet Cadu).

## Stack

```
Frontend:   Next.js 15 (App Router) + TypeScript + Tailwind CSS + Shadcn/ui
Backend:    Supabase (PostgreSQL + Auth + Storage)
IA:         Anthropic SDK (Claude para parsing de PDF)
Hospedagem: Vercel (web) + Expo (futuro nativo iOS/Android)
Pacotes:    docx, pdf-parse, recharts, zustand, zod, date-fns, react-dropzone
```

## Estrutura de pastas

```
src/
├── app/                       # Rotas (Next.js App Router)
│   ├── (auth)/                # Group de rotas autenticadas
│   │   ├── dashboard/         # Dashboard do mês
│   │   ├── lancamentos/       # Lista + filtros
│   │   ├── relatorios/        # Gráficos
│   │   ├── ajustes/           # Cadastros
│   │   └── importar/          # Upload PDFs
│   ├── login/                 # Tela de login (público)
│   └── api/
│       ├── parse-fatura/      # POST: PDF → JSON estruturado via Claude
│       ├── parse-extrato/     # POST: extrato bancário → JSON
│       └── gerar-acerto/      # POST: gera docx do acerto
├── components/
│   ├── ui/                    # Shadcn (button, card, dialog, etc)
│   ├── layout/                # Header, sidebar, bottom nav
│   └── forms/                 # Formulários reutilizáveis
├── lib/
│   ├── supabase/              # Clients (browser, server, middleware)
│   ├── anthropic.ts           # Cliente Anthropic
│   ├── parsers/               # Parsers de PDF por tipo de cartão
│   │   ├── elo.ts
│   │   ├── latam.ts
│   │   ├── btg.ts
│   │   └── bradesco.ts
│   ├── calc-acerto.ts         # Lógica de cálculo do acerto
│   └── utils.ts               # cn(), formatters, etc
├── hooks/
│   ├── use-casal.ts           # Hook do casal logado
│   └── use-mes.ts             # Mês atual selecionado
└── types/
    └── database.ts            # Types gerados do Supabase
```

## Convenções de código

### TypeScript
- **Strict mode sempre** (`strict: true` no tsconfig)
- Types gerados do Supabase: `npx supabase gen types typescript --project-id SEU_ID > src/types/database.ts`
- Nunca usar `any` — use `unknown` e narrow com type guards

### Naming
- **Componentes:** PascalCase (`FaturaUpload.tsx`)
- **Helpers/utils:** camelCase (`calcAcerto.ts`)
- **Pastas:** kebab-case (`importar-fatura/`)
- **Variáveis no banco:** snake_case (`data_competencia`, `pago_por_id`)
- **Variáveis no código:** camelCase (`dataCompetencia`, `pagoPorId`)
- **Sempre em português** quando faz sentido (descrição, valor, categoria) — não traduz pra "description", "value" só por ser código

### Tailwind / Shadcn
- Use os componentes do Shadcn (`Button`, `Card`, `Dialog`) — não reinvente
- Cores semânticas: `--color-success`, `--color-danger`, `--color-warning` (definidas no globals.css)
- Mobile-first: design pensa em 380px antes de qualquer breakpoint maior

### Supabase
- **TODA query do client passa pelo Supabase client com RLS** — nunca usar service_role no browser
- Para queries server-side complexas, criar API route em `src/app/api/`
- Sempre tratar erros: `if (error) throw error`

### Forms
- Use **react-hook-form + zod** pra validação
- Mensagens de erro em português
- Loading states em todo botão de submit

## Padrões importantes

### 1. Lógica de divisão (CORE do app)

Cada lançamento tem dois campos:
- `divisao_tipo`: `'dividir' | 'so_diana' | 'so_nicco' | 'personalizado'`
- `divisao_pct_diana`: 0 a 100 (só usado quando tipo é `'personalizado'`)

Para calcular quanto cabe a cada um:
```typescript
function quantoDiana(lanc: Lancamento): number {
  if (lanc.divisao_tipo === 'so_diana') return lanc.valor
  if (lanc.divisao_tipo === 'so_nicco') return 0
  if (lanc.divisao_tipo === 'dividir')  return lanc.valor * 0.5
  if (lanc.divisao_tipo === 'personalizado') {
    return lanc.valor * (lanc.divisao_pct_diana / 100)
  }
}
```

### 2. Cálculo do acerto mensal

```typescript
// Para cada lançamento, calcular:
// - quem pagou (pago_por_id)
// - quem deveria pagar (baseado na divisão)
// - diferença

// No final do mês:
// Total que Diana pagou = sum(lancamentos where pago_por = Diana)
// Total que cabe a Diana = sum(quantoDiana(lanc) for lanc in lancamentos)
// Saldo Diana = Total pago - Total cabe
// Se saldo positivo: ela pagou mais → Nicco deve transferir pra ela
// Se saldo negativo: ela pagou menos → ela deve transferir pra Nicco

const valorTransferencia = abs(saldoDiana)
const direcao = saldoDiana > 0 ? 'NICCO_PARA_DIANA' : 'DIANA_PARA_NICCO'
```

### 3. Parser de PDF de fatura

Cada cartão tem um parser específico em `src/lib/parsers/`. Padrão:

```typescript
// src/lib/parsers/elo.ts
import { Anthropic } from '@anthropic-ai/sdk'

export async function parseEloFatura(pdfText: string): Promise<LancamentoExtraido[]> {
  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `Extraia os lançamentos da fatura ELO Ourocard abaixo.
Retorne JSON puro (sem markdown) no formato:
[{"data": "DD/MM", "descricao": "...", "valor": 123.45, "parcela_atual": null, "parcela_total": null}]

Regras:
- Inclua TODOS os lançamentos (compras, PIX, boletos, saques, juros, IOF)
- IGNORE: SALDO ANTERIOR, PAGAMENTOS RECEBIDOS, ESTORNOS de pagamento
- Para parcelados (ex "AMAZON PARC 03/12"), preencha parcela_atual=3, parcela_total=12

FATURA:
${pdfText}`
    }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(text)
}
```

### 4. Aprendizado por merchant

Quando o usuário classifica um lançamento, salvar regra em `regras_aprendidas`:

```typescript
// Ao classificar "GRANADO PHARMACIAS RECIFE" como "so_diana"
await supabase.from('regras_aprendidas').upsert({
  casal_id,
  padrao_descricao: normalizarDescricao('GRANADO PHARMACIAS RECIFE'),
  divisao_tipo: 'so_diana',
  vezes_confirmada: 1,
})

// Ao importar próxima fatura, aplicar regras conhecidas:
const regras = await supabase.from('regras_aprendidas').select()
for (const lanc of novosLancamentos) {
  const regra = regras.find(r => 
    lanc.descricao_normalizada.includes(r.padrao_descricao)
  )
  if (regra && regra.vezes_confirmada >= 2) {
    lanc.divisao_tipo = regra.divisao_tipo
    lanc.classificado = true  // pré-classificado, mas usuário pode mudar
  }
}
```

### 5. Geração de PDF do acerto

Use a lib `docx` (já temos validado, mesmo formato do `transferencia_nicco_maio2026.docx`).
A função fica em `src/app/api/gerar-acerto/route.ts`.

## Comandos úteis

```bash
# Desenvolvimento
npm run dev               # roda em localhost:3000
npm run build             # build de produção
npm run type-check        # checa erros TypeScript

# Supabase (precisa CLI instalado: npm i -g supabase)
supabase login
supabase link --project-ref SEU_REF
supabase db push          # aplica migrations
supabase gen types typescript --linked > src/types/database.ts

# Deploy
vercel                    # primeiro deploy
vercel --prod             # produção
```

## Quando criar componentes novos

1. **Confere se já existe no Shadcn** (https://ui.shadcn.com/docs/components)
2. Se for específico do domínio (ex: `LancamentoCard`), cria em `src/components/`
3. Sempre exporta default + tipa os props com interface
4. Mobile-first: começa do 380px

## Quando criar parsers novos

Cada cartão tem formato de PDF diferente. Pra adicionar suporte a um cartão novo:

1. Crie `src/lib/parsers/NOME_CARTAO.ts`
2. Use o template do parser ELO acima
3. Ajuste o prompt do Claude pro formato específico do cartão
4. Teste com 2-3 faturas reais antes de considerar pronto
5. Adicione no roteador `src/lib/parsers/index.ts`

## O que NÃO fazer

- **NÃO** colocar lógica de negócio no client. Cálculos vão no servidor (API routes) ou em funções puras testáveis.
- **NÃO** quebrar RLS (Row Level Security) — sempre rodar queries via Supabase client autenticado.
- **NÃO** expor `SUPABASE_SERVICE_ROLE_KEY` no client (só em API routes server-side).
- **NÃO** confiar no PDF: PDFs de cartão podem ter formatos esquisitos. Sempre validar com Zod antes de salvar no banco.
- **NÃO** classificar lançamento sem opção do usuário confirmar — aprendizado sugere, não decide.

## Roadmap interno (Fase 1 — MVP)

1. **Setup base** ✅
   - Next.js + Tailwind + Shadcn
   - Supabase configurado
   - Schema do banco rodando

2. **Auth + Casal** (próximo)
   - Login Supabase
   - Criar casal + 2 membros via SQL inicialmente
   - Layout autenticado (header, bottom nav)

3. **Cadastros**
   - Cartões (CRUD)
   - Categorias (já vem seed das 28)

4. **Importação**
   - Upload PDF
   - Parser específico do cartão
   - Tela de revisão de lançamentos extraídos

5. **Classificação**
   - Tela lista pra marcar Dividir / Só Diana / Só Nicco / Personalizado
   - Aplicar regras aprendidas
   - Salvar nova regra ao classificar

6. **Dashboard do mês**
   - Cards de resumo (Diana paga, Nicco paga, transferência)
   - Lista de fontes (faturas + outros)
   - Top categorias

7. **Acerto + PDF**
   - Cálculo completo
   - Geração de docx
   - Botão "Fechar mês" → salva snapshot em `acertos`

## Para futuros prompts

Quando a Diana abrir um chat com Claude Code pra trabalhar nesse projeto, ela vai dizer coisas tipo:
- "Bora criar a tela de importar fatura"
- "Tem um bug no cálculo do acerto"
- "Adiciona suporte pra fatura do Nubank"
- "Cria um gráfico de evolução de gastos"

Sempre que possível, mostre código completo de arquivos novos (não fragmentos), e adicione tests quando criar lógica de negócio crítica (ex: cálculo de acerto).

## Tom

Diana é desenvolvedora intermediária, prefere instruções "mastigadinhas" e gosta quando você explica o **porquê** de cada decisão. Ela é jurista de profissão (assessora no TRF5) e content creator. Trata o Claude como "Clô" / "Clôzinha" com carinho. Português brasileiro casual.
