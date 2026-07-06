/**
 * Tipo comum a todos os parsers de fatura/extrato.
 *
 * Representa um lançamento BRUTO extraído do PDF, antes de classificação,
 * normalização de descrição ou vínculo com cartão/categoria. Cada parser
 * (elo, latam, btg, ...) recebe o texto do PDF e devolve LancamentoExtraido[].
 */
export interface LancamentoExtraido {
  /** Data da compra como aparece na fatura. Normalmente "DD/MM" ou "DD/MM/AAAA". */
  data: string
  /** Descrição crua, exatamente como na fatura (a normalização vem depois). */
  descricao: string
  /** Valor em CENTAVOS (integer). O parser converte o "R$ 12,34" pra 1234. */
  valorCentavos: number
  /** Parcela atual (ex: 3 de "PARC 03/12"); null se à vista. */
  parcelaAtual: number | null
  /** Total de parcelas (ex: 12 de "PARC 03/12"); null se à vista. */
  parcelaTotal: number | null
}

/**
 * Resultado de um parser, com o total declarado pela própria fatura, pro
 * sanity check obrigatório (decisão #7 do review): somar valorCentavos e
 * comparar com totalDeclaradoCentavos; se a diferença passar de R$ 1,00,
 * marcar a fonte como 'precisa_revisao'.
 */
export interface ResultadoParse {
  lancamentos: LancamentoExtraido[]
  /** "Total da Fatura" extraído como campo separado, em CENTAVOS. */
  totalDeclaradoCentavos: number
}
