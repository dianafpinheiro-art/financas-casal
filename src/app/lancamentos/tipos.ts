/** Tipos compartilhados da tela /lancamentos (neutro: sem 'use client'/'use server'). */

export interface LancamentoRow {
  id: string
  dataLancamento: string // "YYYY-MM-DD"
  descricao: string
  valorCentavos: number
  divisaoTipo: string
  divisaoPctDiana: number | null
  classificado: boolean
  tags: string[] | null
  observacao: string | null
  /** null pra lançamento manual (PIX/boleto/dinheiro). */
  cartaoId: string | null
  cartao: string
  pagoPor: string
  categoria: string | null
  /** Lançamento de mês fechado — imutável (não pode editar/excluir). */
  mesFechado: boolean
}

export interface ResumoMes {
  total: number
  totalCentavos: number
  aRevisar: number // classificado = false
}

export type ClassificarResult = { ok: true } | { ok: false; erro: string }
