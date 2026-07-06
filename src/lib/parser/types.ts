/**
 * Tipos do resultado de parse que a tela /importar e o salvar compartilham.
 * (O motor de extração vive em src/domain/parsers + /api/parse-fatura.)
 */

export type ParsedTransaction = {
  data: string // YYYY-MM-DD
  descricao: string
  valor_cents: number
  moeda: string // BRL, USD
  parcela_atual?: number | null
  parcela_total?: number | null
}

export type ParseResult = {
  transacoes: ParsedTransaction[]
  total_fatura_cents: number
  sanity_ok: boolean
  /** true quando a fatura não imprime o "total desta fatura" — o total acima é a soma. */
  sem_total?: boolean
}
