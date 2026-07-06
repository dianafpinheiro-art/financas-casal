/**
 * Parser da fatura ELO Ourocard — partes PURAS (sem SDK, testáveis).
 *
 * Fluxo: a API route manda o PDF + PROMPT_ELO + eloRespostaSchema pro Claude
 * (lib/anthropic), recebe o JSON validado, e aqui a gente mapeia pra centavos
 * e roda o sanity check do total (decisão #7).
 */
// zod/v4: o subpath que o helper zodOutputFormat do SDK Anthropic espera
// (zod 3.25+ publica v3 e v4 lado a lado). API básica é a mesma.
import { z } from 'zod/v4'
import { reaisParaCentavos } from '../lancamento'
import { type ResultadoParse, type LancamentoExtraido } from './types'

// ============================================================
// Schema do que o Claude devolve (valores em REAIS, como na fatura)
// ============================================================

export const eloLancamentoSchema = z.object({
  /** Data como aparece na fatura: "DD/MM" ou "DD/MM/AAAA". */
  data: z.string(),
  descricao: z.string(),
  /** REAIS com ponto decimal (ex: 1234.56). Crédito/estorno de compra = negativo. */
  valor: z.number(),
  parcelaAtual: z.number().int().nullable(),
  parcelaTotal: z.number().int().nullable(),
})

export const eloRespostaSchema = z.object({
  /** "Total desta fatura" lido como campo separado (REAIS) — NÃO é a soma calculada. */
  totalDeclarado: z.number(),
  lancamentos: z.array(eloLancamentoSchema),
})

export type EloResposta = z.infer<typeof eloRespostaSchema>

// ============================================================
// Prompt (vai no system; foca nas regras, o schema garante o formato)
// ============================================================

export const PROMPT_ELO = `Você extrai lançamentos de uma fatura de cartão de crédito ELO Ourocard (Banco do Brasil), em português do Brasil.

Regras de extração:
- Inclua TODOS os lançamentos do período: compras, PIX, boletos, saques, anuidade, juros, IOF, seguros, tarifas.
- IGNORE: "SALDO ANTERIOR", "PAGAMENTO RECEBIDO"/"PAGTO" e estornos do PAGAMENTO da fatura anterior.
- Estornos/créditos de COMPRA (devolução de produto, cancelamento) entram com valor NEGATIVO.
- "valor" em REAIS com ponto decimal (ex: 1234.56). Crédito = negativo.
- "data" exatamente como aparece na fatura ("DD/MM" ou "DD/MM/AAAA").
- Parcelas: "AMAZON PARC 03/12" => parcelaAtual=3, parcelaTotal=12. À vista => ambos null.
- "descricao": copie o texto do lançamento como aparece (não invente, não abrevie, não traduza).
- "totalDeclarado": o valor do campo "Total desta fatura" / "Total a pagar" do cartão, em REAIS. É um campo SEPARADO impresso na fatura — não some você mesmo.

Não invente lançamentos. Se um valor estiver ilegível, ainda assim inclua a linha com sua melhor leitura.`

// ============================================================
// Mapeamento REAIS -> CENTAVOS
// ============================================================

export function mapRespostaElo(resp: EloResposta): ResultadoParse {
  const lancamentos: LancamentoExtraido[] = resp.lancamentos.map((l) => ({
    data: l.data,
    descricao: l.descricao,
    valorCentavos: reaisParaCentavos(l.valor),
    parcelaAtual: l.parcelaAtual,
    parcelaTotal: l.parcelaTotal,
  }))
  return {
    lancamentos,
    totalDeclaradoCentavos: reaisParaCentavos(resp.totalDeclarado),
  }
}

// ============================================================
// Sanity check do total (decisão #7): soma vs total declarado
// ============================================================

/** Tolerância de R$ 1,00 (em centavos) entre a soma e o total da fatura. */
export const TOLERANCIA_SANITY_CENTAVOS = 100

export interface SanityCheck {
  /** true se a diferença ficou dentro da tolerância. */
  ok: boolean
  somaCentavos: number
  totalDeclaradoCentavos: number
  /** |soma - totalDeclarado| em centavos. */
  difCentavos: number
}

export function sanityCheckTotal(resultado: ResultadoParse): SanityCheck {
  const somaCentavos = resultado.lancamentos.reduce(
    (acc, l) => acc + l.valorCentavos,
    0,
  )
  const difCentavos = Math.abs(somaCentavos - resultado.totalDeclaradoCentavos)
  return {
    ok: difCentavos <= TOLERANCIA_SANITY_CENTAVOS,
    somaCentavos,
    totalDeclaradoCentavos: resultado.totalDeclaradoCentavos,
    difCentavos,
  }
}
