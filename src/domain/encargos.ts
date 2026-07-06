/**
 * Domínio: propagação de classificação de ENCARGOS (Ponto 1).
 *
 * Fatura de cartão vem cheia de encargos (juros, IOF, tarifa de saque PIX...)
 * que sozinhos são "a classificar" — mas eles SEGUEM o lançamento principal
 * que os gerou. Em vez de classificar 70 à mão, a gente acha o principal mais
 * próximo (mesma data, ou 1 dia antes) e copia a divisão/categoria dele,
 * pré-preenchendo o encargo. NÃO marca classificado=true: a Diana confirma
 * com 1 clique (a divisão já vem pronta).
 *
 * Código PURO e testável. Roda na API route depois das regras do banco.
 */

/** Prefixos (em minúsculas) que identificam um encargo. Derivados das
 *  descrições reais da fatura ELO. Match por startsWith. */
export const PREFIXOS_ENCARGO = [
  'juros pagamento titulo',
  'juros pagamento convenios',
  'juros pagamento convenio',
  'iof adicional pf',
  'iof pf',
  'pagamentocontas',
  'juros saque pix',
  'iof diario saque pix',
  'iof adicional saque pix',
  // Itaú/Bradesco (Sprint 4) — derivados de transação/saldo:
  'encargos rotativo',
  'iof financeiro',
  'iof compras parceladas',
  'anuidade',
  'juros refinanciamento',
  'tarifa',
] as const

/** Campos mínimos que a propagação lê/escreve. */
export interface LancamentoParaEncargo {
  /** "DD/MM" ou "DD/MM/AAAA". */
  data: string
  descricao: string
  divisaoTipo: string | null
  divisaoPctDiana: number | null
  categoriaId: string | null
  classificado: boolean
  tags: string[] | null
  observacao: string | null
}

function limpa(desc: string): string {
  return desc.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function ehEncargo(descricao: string): boolean {
  const d = limpa(descricao)
  return PREFIXOS_ENCARGO.some((p) => d.startsWith(p))
}

// Ano fixo só pra comparar ADJACÊNCIA de dias dentro de uma mesma fatura
// (o ano real não importa aqui; o que importa é "mesmo dia" / "1 dia antes").
const ANO_FIXO = 2024
const UM_DIA_MS = 86_400_000

function diaEmMs(dataStr: string): number | null {
  const m = dataStr.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2])
  let ano = ANO_FIXO
  if (m[3] != null) {
    ano = Number(m[3])
    if (ano < 100) ano += 2000
  }
  return Date.UTC(ano, mes - 1, dia)
}

/** Compara tuplas [diff, distância, índice] lexicograficamente (menor ganha). */
function menorScore(a: [number, number, number], b: [number, number, number]): boolean {
  if (a[0] !== b[0]) return a[0] < b[0]
  if (a[1] !== b[1]) return a[1] < b[1]
  return a[2] < b[2]
}

/**
 * Acha o índice do lançamento principal de um encargo, ou null.
 * Candidato = não-encargo, não ele mesmo, com data igual (diff 0) ou 1 dia
 * antes (diff 1). Prioriza mesmo-dia; empate -> mais próximo no índice.
 */
function acharPrincipalIdx(
  encargoIdx: number,
  diasMs: (number | null)[],
  ehEncargoFlags: boolean[],
): number | null {
  const enc = diasMs[encargoIdx]
  if (enc == null) return null

  let melhor: number | null = null
  let melhorScore: [number, number, number] | null = null

  for (let j = 0; j < diasMs.length; j++) {
    if (j === encargoIdx) continue
    if (ehEncargoFlags[j]) continue // principal não pode ser encargo
    const d = diasMs[j]
    if (d == null) continue
    const diff = Math.round((enc - d) / UM_DIA_MS) // 0 = mesmo dia, 1 = principal 1 dia antes
    if (diff !== 0 && diff !== 1) continue
    const score: [number, number, number] = [diff, Math.abs(j - encargoIdx), j]
    if (melhorScore == null || menorScore(score, melhorScore)) {
      melhorScore = score
      melhor = j
    }
  }
  return melhor
}

/**
 * Propaga a classificação dos encargos a partir do principal mais próximo.
 * Não muta a entrada; devolve uma nova lista. Encargos sem principal candidato
 * ficam como estavam (fallback).
 */
export function propagarEncargos<T extends LancamentoParaEncargo>(lancs: T[]): T[] {
  const flags = lancs.map((l) => ehEncargo(l.descricao))
  const dias = lancs.map((l) => diaEmMs(l.data))

  return lancs.map((l, i) => {
    if (!flags[i]) return l
    const idx = acharPrincipalIdx(i, dias, flags)
    if (idx == null) return l
    const p = lancs[idx]
    // as T: só sobrescrevemos campos que já existem em T, com tipos compatíveis.
    return {
      ...l,
      categoriaId: p.categoriaId,
      divisaoTipo: p.divisaoTipo,
      divisaoPctDiana: p.divisaoPctDiana,
      tags: ['encargo'],
      observacao: `Encargo de: ${p.descricao}`,
    } as T
  })
}
