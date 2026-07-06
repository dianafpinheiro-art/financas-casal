/**
 * Tipos compartilhados entre a tela /importar (client) e a server action.
 * Arquivo "neutro" (sem 'use server' nem 'use client') pra os dois importarem.
 */

export interface LancamentoPreview {
  data: string
  descricao: string
  descricaoNormalizada: string
  merchant: string
  valorCentavos: number
  parcelaAtual: number | null
  parcelaTotal: number | null
  divisaoTipo: string | null
  divisaoPctDiana: number | null
  categoriaId: string | null
  classificado: boolean
  /** ['encargo'] quando foi propagado de um lançamento principal. */
  tags: string[] | null
  /** "Encargo de: <descrição do principal>" quando for encargo propagado. */
  observacao: string | null
}

export interface SanityInfo {
  ok: boolean
  somaCentavos: number
  totalDeclaradoCentavos: number
  difCentavos: number
  /** true quando a fatura não trouxe o "total" (parser genérico) — não dá pra conferir. */
  semTotal?: boolean
}

export interface ParseResposta {
  status: 'ok' | 'precisa_revisao'
  sanity: SanityInfo
  totalDeclaradoCentavos: number
  lancamentos: LancamentoPreview[]
}

export interface CartaoOption {
  id: string
  apelido: string
  dono: string
}

export interface SalvarFaturaInput {
  cartaoId: string
  mesReferencia: string // "YYYY-MM"
  nomeArquivo: string
  totalDeclaradoCentavos: number
  lancamentos: LancamentoPreview[]
}

export type SalvarFaturaResult =
  | { ok: true; fonteId: string; total: number }
  | { ok: false; erro: string }
