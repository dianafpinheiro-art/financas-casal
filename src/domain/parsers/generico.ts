/**
 * Parser GENÉRICO de fatura de cartão de crédito brasileira — partes PURAS.
 *
 * Mesma arquitetura do elo.ts (prompt + schema Zod + map pra centavos + sanity
 * check). A diferença é o prompt mais robusto, que funciona pra qualquer banco
 * (Itaú, Bradesco, BTG, etc). O ELO continua com o parser específico dele.
 *
 * O total da fatura pode FALTAR em alguns layouts — nesse caso o sanity check
 * não bloqueia, só avisa (semTotal).
 */
import { z } from 'zod/v4'
import { reaisParaCentavos } from '../lancamento'
import { type LancamentoExtraido } from './types'

// ============================================================
// Schema do que o Claude devolve (valores em REAIS)
// ============================================================

export const genericoLancamentoSchema = z.object({
  /** Data como aparece na fatura — vários formatos ("25/03", "06 Jun",
   *  "06-jun-2026", "06 junho"). Normalizado em mapRespostaGenerico. */
  data: z.string(),
  descricao: z.string(),
  /** Valor em REAIS (BRL) efetivamente cobrado. Crédito/estorno = negativo. */
  valor: z.number(),
  parcelaAtual: z.number().int().nullable(),
  parcelaTotal: z.number().int().nullable(),
  /** Moeda original se for compra internacional (ex "USD"); null se nacional. */
  moedaOriginal: z.string().nullable(),
  /** Valor na moeda original; null se nacional. */
  valorOriginal: z.number().nullable(),
})

export const genericoRespostaSchema = z.object({
  /** "Total desta fatura" em REAIS; null se não encontrar na fatura. */
  totalDeclarado: z.number().nullable(),
  lancamentos: z.array(genericoLancamentoSchema),
})

export type GenericoResposta = z.infer<typeof genericoRespostaSchema>

// ============================================================
// Prompt
// ============================================================

export const PROMPT_GENERICO = `Você extrai os lançamentos de uma fatura de cartão de crédito brasileira (qualquer banco: Itaú, Bradesco, BTG, Santander, Banco do Brasil/Smiles, etc), em português do Brasil.

LEIA A FATURA INTEIRA, DO INÍCIO AO FIM:
- A fatura tem VÁRIAS PÁGINAS (3, 4, 5, 6 ou mais). Os lançamentos continuam nas páginas seguintes — NÃO pare na primeira tabela/quadro que encontrar.
- Pode haver VÁRIOS quadros de lançamentos: titular e cartões adicionais, "compras nacionais", "compras/saques internacionais", "viagem", "débitos diversos", "encargos". Inclua TODOS os quadros de TODAS as páginas.
- A última página costuma ser só contatos/avisos — ignore.

INCLUA todos os lançamentos do período atual da fatura:
- Compras nacionais (data, descrição, valor em reais).
- Compras internacionais: use em "valor" o VALOR EM REAIS (BRL) que foi efetivamente cobrado (a fatura mostra a conversão). Preencha "moedaOriginal" (ex: "USD", "EUR") e "valorOriginal" com o valor na moeda estrangeira. Para nacionais, deixe moedaOriginal e valorOriginal como null.
- Parceladas: quando a descrição traz "03/12" (parcela atual/total), preencha parcelaAtual=3 e parcelaTotal=12. À vista => ambos null.
- Encargos e tarifas do período: juros, IOF, anuidade, mensalidade, tarifa, encargos do rotativo, etc.
- "Repasse de IOF em R$": é um encargo REAL do período — extraia como lançamento mesmo estando no bloco de resumo dos internacionais. Se a linha não trouxer data, use a data do último lançamento internacional visível.
- Estornos/créditos de COMPRA (devolução, cancelamento): valor NEGATIVO.

IGNORE (não extraia):
- Linhas de RESUMO / TOTAIS / SALDOS da fatura. Foque APENAS em lançamentos de compras, saques, encargos e créditos INDIVIDUAIS, cada um com data válida. NÃO extraia linhas-resumo como: "Saldo financiado", "Total da fatura anterior", "Pagamento efetuado em…", "Total desta fatura", "Total dos pagamentos", "Total dos lançamentos atuais", "Total lançamentos inter. em R$", "Total transações inter. em R$" — e qualquer outra linha que seja um total/subtotal/saldo do bloco de resumo (em geral sem data ou com "-" no lugar da data).
- Seções de "próximas faturas", "compras parceladas futuras", "lançamentos futuros", "demonstrativo do próximo mês", "previsão" — só o período ATUAL desta fatura.
- Linhas de "PAGAMENTO RECEBIDO" / "PAGAMENTO EFETUADO" / "PAGTO" (o crédito do pagamento da fatura anterior, geralmente um valor negativo no topo).
- "SALDO ANTERIOR".

FORMATO:
- Preserve a sequência das linhas recebidas: página por página, coluna esquerda inteira antes da direita, respeitando os blocos de cada cartão. Não ordene por data e não agrupe por estabelecimento ou parcela.
- "valor" em reais com ponto decimal (ex: 1234.56). Crédito = negativo.
- "data" exatamente como na fatura.
- "descricao": copie o texto do lançamento como aparece (não invente, não abrevie, não traduza).
- "totalDeclarado": o "Total desta fatura" / "Total a pagar" do cartão, em reais. NÃO confunda com "Saldo da fatura anterior", "Saldo fatura anterior", "Saldo anterior" nem "Saldo financiado" — esses são saldos/totais do mês PASSADO, não o total desta fatura. Se NÃO encontrar o total desta fatura, devolva null (não calcule você mesmo).

Não invente lançamentos. Se um valor estiver ilegível, ainda assim inclua a linha com sua melhor leitura.`

// ============================================================
// Normalização de data
// ============================================================
// Cada banco escreve a data num jeito: ELO usa "25/03", BTG usa "06 Jun",
// outros usam "06-jun-2026" ou "06 junho". Aqui a gente leva tudo pra
// "DD/MM" ou "DD/MM/AAAA" — o formato que dataCompraDaFatura já aceita
// (ela cuida da inferência de ano via mês de referência).

const MESES_PT: Record<string, number> = {
  jan: 1, janeiro: 1,
  fev: 2, fevereiro: 2,
  mar: 3, marco: 3,
  abr: 4, abril: 4,
  mai: 5, maio: 5,
  jun: 6, junho: 6,
  jul: 7, julho: 7,
  ago: 8, agosto: 8,
  set: 9, setembro: 9,
  out: 10, outubro: 10,
  nov: 11, novembro: 11,
  dez: 12, dezembro: 12,
}

/**
 * Converte a data crua que veio na fatura pra "DD/MM" ou "DD/MM/AAAA".
 *
 * Aceita:
 *  - "DD/MM"           -> passa direto
 *  - "DD/MM/AAAA"      -> passa direto
 *  - "DD/MM/AA"        -> passa direto
 *  - "06 Jun"          -> "06/06"
 *  - "06 junho"        -> "06/06"
 *  - "06-jun-2026"     -> "06/06/2026"
 *  - "6 Jun"           -> "06/06"
 *  - "06 JUN"          -> "06/06"  (case-insensitive)
 *  - "06 Junho"        -> "06/06"  (acento opcional)
 *
 * Se não reconhecer, devolve a string original (deixa estourar lá no
 * dataCompraDaFatura com a mensagem padrão de data inválida).
 */
export function normalizarDataFatura(dataStr: string): string {
  const cru = dataStr.trim()

  // Já está em DD/MM ou DD/MM/AAAA — passa direto.
  if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(cru)) return cru

  // Forma com nome de mês (PT abreviado ou completo), separado por espaço ou hífen.
  const norm = cru
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  const m = norm.match(/^(\d{1,2})[\s\-]+([a-z]{3,9})(?:[\s\-]+(\d{2,4}))?$/)
  if (!m) return cru

  const mesNum = MESES_PT[m[2]]
  if (mesNum == null) return cru

  const dia = String(Number(m[1])).padStart(2, '0')
  const mes = String(mesNum).padStart(2, '0')
  if (m[3] == null) return `${dia}/${mes}`
  const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${dia}/${mes}/${ano}`
}

// ============================================================
// Filtro de linhas de RESUMO / TOTAIS / SALDOS
// ============================================================
// O Claude às vezes inclui linhas do bloco de resumo da fatura (totais,
// subtotais, saldo financiado) como se fossem lançamentos. Elas não têm data
// válida (vêm com "-") e estouram no dataCompraDaFatura, além de bagunçarem o
// sanity check. Aqui a gente descarta pela descrição — defesa em profundidade,
// já que o prompt também pede pra ignorá-las.

// Descrições que só são resumo quando a linha é EXATAMENTE isso (match por
// igualdade, não includes — "PAGAMENTO BOLETO XYZ" é compra de verdade).
// A fatura Itaú/Latam imprime o pagamento da fatura anterior como
// "PAGAMENTO" seco, que o padrão "pagamento efetuado em" não pega.
const RESUMO_EXATOS: string[] = ['pagamento', 'pagto', 'pagamento recebido']

const PADROES_RESUMO: string[] = [
  'pgto debito conta', // pagamento da fatura anterior no BB: "PGTO DEBITO CONTA 3237 ..."
  'saldo financiado',
  'saldo anterior',
  'saldo fatura anterior',
  'saldo da fatura anterior',
  'total da fatura anterior',
  'pagamento efetuado em',
  'total desta fatura',
  'total dos pagamentos',
  'total dos lancamentos atuais',
  'total lancamentos inter', // "Total lançamentos inter. em R$" (= transações + repasse de IOF)
  'total transacoes inter',  // "Total transações inter. em R$"
  // "Repasse de IOF em R$" NÃO entra aqui: é encargo REAL do período (fidelidade
  // máxima — decisão da Diana 2026-07-06). Os dois subtotais acima continuam
  // fora pra não contar dobrado: soma = transações individuais + repasse de IOF.
]

/** Normaliza pra comparar: minúsculas, sem acento, espaços colapsados. */
function normalizarDesc(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * true se a descrição é uma linha de resumo/total/saldo da fatura (não é um
 * lançamento de verdade e deve ser descartada).
 */
export function ehLinhaResumo(descricao: string): boolean {
  const norm = normalizarDesc(descricao)
  return RESUMO_EXATOS.includes(norm) || PADROES_RESUMO.some((p) => norm.includes(p))
}

// ============================================================
// Map REAIS -> CENTAVOS
// ============================================================

export function mapRespostaGenerico(resp: GenericoResposta): {
  lancamentos: LancamentoExtraido[]
  totalDeclaradoCentavos: number | null
} {
  const lancamentos: LancamentoExtraido[] = resp.lancamentos
    .filter((l) => !ehLinhaResumo(l.descricao))
    .map((l) => {
    // Compra internacional: anota a moeda original na descrição (sem coluna nova).
    const descricao =
      l.moedaOriginal && l.valorOriginal != null
        ? `${l.descricao} (${l.moedaOriginal} ${l.valorOriginal})`
        : l.descricao
    return {
      data: normalizarDataFatura(l.data),
      descricao,
      valorCentavos: reaisParaCentavos(l.valor),
      parcelaAtual: l.parcelaAtual,
      parcelaTotal: l.parcelaTotal,
    }
  })
  return {
    lancamentos,
    totalDeclaradoCentavos:
      resp.totalDeclarado == null ? null : reaisParaCentavos(resp.totalDeclarado),
  }
}

// ============================================================
// Sanity check (lida com total ausente)
// ============================================================

export const TOLERANCIA_SANITY_CENTAVOS = 100 // R$ 1,00

export interface SanityCheckGenerico {
  ok: boolean
  /** true quando a fatura não trouxe o total — não dá pra conferir. */
  semTotal: boolean
  somaCentavos: number
  totalDeclaradoCentavos: number
  difCentavos: number
}

export function sanityCheckGenerico(resultado: {
  lancamentos: LancamentoExtraido[]
  totalDeclaradoCentavos: number | null
}): SanityCheckGenerico {
  const somaCentavos = resultado.lancamentos.reduce((s, l) => s + l.valorCentavos, 0)

  if (resultado.totalDeclaradoCentavos == null) {
    // Sem total declarado: não bloqueia, mas avisa. Usa a soma como referência.
    return {
      ok: true,
      semTotal: true,
      somaCentavos,
      totalDeclaradoCentavos: somaCentavos,
      difCentavos: 0,
    }
  }

  const difCentavos = Math.abs(somaCentavos - resultado.totalDeclaradoCentavos)
  return {
    ok: difCentavos <= TOLERANCIA_SANITY_CENTAVOS,
    semTotal: false,
    somaCentavos,
    totalDeclaradoCentavos: resultado.totalDeclaradoCentavos,
    difCentavos,
  }
}
