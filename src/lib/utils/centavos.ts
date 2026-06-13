/**
 * Utilitários para conversão entre Reais e Centavos.
 * O banco de dados armazena tudo em centavos (BIGINT) para evitar erros de precisão.
 */

// Formata um valor em centavos para a string "R$ XX,XX"
export function formatarCentavosParaReal(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

// Converte um valor em Reais (float) para centavos (integer)
export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100)
}

// Extrai centavos de uma string monetária (ex: "R$ 1.250,50" -> 125050)
export function stringMonetariaParaCentavos(valorStr: string): number {
  // Remove tudo que não for dígito, vírgula ou sinal de menos
  const limpo = valorStr.replace(/[^\d,-]/g, '').replace(',', '.')
  const floatVal = parseFloat(limpo)
  if (isNaN(floatVal)) return 0
  return reaisParaCentavos(floatVal)
}
