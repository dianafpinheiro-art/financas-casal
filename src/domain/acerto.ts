/**
 * Domínio: Acerto mensal.
 *
 * Dada a lista de lançamentos do mês, calcula quanto cada um pagou, quanto
 * cabe a cada um, e quanto/quem transfere. Tudo em CENTAVOS (integer).
 */

import {
  type Lancamento,
  type Pagador,
  quantoCabeDiana,
  quantoCabeNicco,
} from './lancamento'

export interface ResumoMembro {
  /** Quanto a pessoa efetivamente pagou (soma dos lançamentos no nome dela). */
  pagaCentavos: number
  /** Quanto deveria ter pago segundo a divisão. */
  cabeCentavos: number
  /** pagaCentavos - cabeCentavos. Positivo = pagou a mais (tem a receber). */
  saldoCentavos: number
}

export interface Transferencia {
  de: Pagador
  para: Pagador
  valorCentavos: number
}

export interface Acerto {
  diana: ResumoMembro
  nicco: ResumoMembro
  compartilhadoCentavos: number
  soDianaCentavos: number
  soNiccoCentavos: number
  totalCentavos: number
  /** null quando o saldo zera (ninguém deve nada). */
  transferencia: Transferencia | null
}

/**
 * Calcula o acerto completo do mês.
 *
 * Invariantes garantidas (cobertas por teste):
 *  - dianaCabe + niccoCabe === totalCentavos (nenhum centavo some)
 *  - saldoDiana === -saldoNicco
 *  - saldo 0 => transferência null (em centavos integer não existe
 *    "quase zero"; o menor saldo possível é 1 centavo)
 *
 * Propaga o erro de quantoCabeDiana se houver 'personalizado' sem pct.
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
    if (lanc.pagoPor === 'diana') dianaPaga += lanc.valorCentavos
    else niccoPaga += lanc.valorCentavos

    dianaCabe += quantoCabeDiana(lanc)
    niccoCabe += quantoCabeNicco(lanc)

    if (lanc.divisaoTipo === 'so_diana') soDiana += lanc.valorCentavos
    else if (lanc.divisaoTipo === 'so_nicco') soNicco += lanc.valorCentavos
    else compartilhado += lanc.valorCentavos
  }

  const saldoDiana = dianaPaga - dianaCabe
  const saldoNicco = niccoPaga - niccoCabe

  let transferencia: Transferencia | null = null
  if (saldoDiana !== 0) {
    // Saldo positivo da Diana = ela pagou a mais => Nicco transfere pra ela.
    transferencia = {
      de: saldoDiana > 0 ? 'nicco' : 'diana',
      para: saldoDiana > 0 ? 'diana' : 'nicco',
      valorCentavos: Math.abs(saldoDiana),
    }
  }

  return {
    diana: { pagaCentavos: dianaPaga, cabeCentavos: dianaCabe, saldoCentavos: saldoDiana },
    nicco: { pagaCentavos: niccoPaga, cabeCentavos: niccoCabe, saldoCentavos: saldoNicco },
    compartilhadoCentavos: compartilhado,
    soDianaCentavos: soDiana,
    soNiccoCentavos: soNicco,
    totalCentavos: compartilhado + soDiana + soNicco,
    transferencia,
  }
}
