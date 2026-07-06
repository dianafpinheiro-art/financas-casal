/**
 * Cálculo do acerto mensal entre Diana e Nicco.
 *
 * Dada uma lista de lançamentos do mês, calcula quanto cada um pagou,
 * quanto cabe a cada um, e quanto deve ser transferido.
 */

export type DivisaoTipo = 'dividir' | 'so_diana' | 'so_nicco' | 'personalizado'

export interface Lancamento {
  valor: number
  pago_por: 'diana' | 'nicco'
  divisao_tipo: DivisaoTipo
  divisao_pct_diana?: number
}

export interface ResumoMembro {
  paga: number
  cabe: number
  saldo: number
}

export interface Acerto {
  diana: ResumoMembro
  nicco: ResumoMembro
  compartilhado: number
  so_diana: number
  so_nicco: number
  total: number
  transferencia: {
    de: 'diana' | 'nicco'
    para: 'diana' | 'nicco'
    valor: number
  } | null
}

/**
 * Calcula quanto cabe à Diana de um lançamento.
 */
export function quantoCabeDiana(lanc: Lancamento): number {
  switch (lanc.divisao_tipo) {
    case 'so_diana':
      return lanc.valor
    case 'so_nicco':
      return 0
    case 'dividir':
      return round2(lanc.valor * 0.5)
    case 'personalizado':
      return round2(lanc.valor * ((lanc.divisao_pct_diana ?? 50) / 100))
  }
}

export function quantoCabeNicco(lanc: Lancamento): number {
  return round2(lanc.valor - quantoCabeDiana(lanc))
}

/**
 * Calcula acerto completo do mês.
 */
export function calcAcerto(lancamentos: Lancamento[]): Acerto {
  let dianaPaga = 0
  let dianaCabe = 0
  let niccoPaga = 0
  let niccoCabe = 0
  let compartilhado = 0
  let soDiana = 0
  let soNicco = 0

  for (const lanc of lancamentos) {
    if (lanc.pago_por === 'diana') dianaPaga += lanc.valor
    else niccoPaga += lanc.valor

    const cabeDiana = quantoCabeDiana(lanc)
    const cabeNicco = quantoCabeNicco(lanc)
    dianaCabe += cabeDiana
    niccoCabe += cabeNicco

    if (lanc.divisao_tipo === 'so_diana') soDiana += lanc.valor
    else if (lanc.divisao_tipo === 'so_nicco') soNicco += lanc.valor
    else compartilhado += lanc.valor
  }

  const saldoDiana = round2(dianaPaga - dianaCabe)
  const saldoNicco = round2(niccoPaga - niccoCabe)

  // Quem tem saldo positivo pagou a mais, deve receber. Quem tem negativo deve pagar.
  let transferencia: Acerto['transferencia'] = null
  if (Math.abs(saldoDiana) > 0.01) {
    transferencia = {
      de: saldoDiana > 0 ? 'nicco' : 'diana',
      para: saldoDiana > 0 ? 'diana' : 'nicco',
      valor: Math.abs(round2(saldoDiana)),
    }
  }

  return {
    diana: { paga: round2(dianaPaga), cabe: round2(dianaCabe), saldo: saldoDiana },
    nicco: { paga: round2(niccoPaga), cabe: round2(niccoCabe), saldo: saldoNicco },
    compartilhado: round2(compartilhado),
    so_diana: round2(soDiana),
    so_nicco: round2(soNicco),
    total: round2(compartilhado + soDiana + soNicco),
    transferencia,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
