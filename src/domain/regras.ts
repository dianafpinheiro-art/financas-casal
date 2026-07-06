/**
 * Domínio: matching de regras aprendidas — agora por MERCHANT.
 *
 * Cada regra guarda um `merchant` (slug do extrairMerchant). Pra classificar
 * um lançamento, extraímos o merchant da descrição e procuramos a regra com
 * aquele merchant. Assim uma regra cobre todas as variações de string do
 * mesmo estabelecimento, em qualquer cartão.
 *
 * (A antiga lógica de tipo_match exact/prefix/contains foi aposentada — o
 * merchant resolve a variação. A coluna tipo_match fica no banco por
 * compatibilidade, mas não entra mais no matching.)
 */

import { extrairMerchant } from './merchant'

/** Forma mínima que uma regra precisa ter pra ser casada. */
export interface RegraMatchavel {
  merchant: string | null
}

/**
 * Acha a regra cujo merchant bate com o da descrição. Retorna null se nada
 * casa ou se o merchant é 'desconhecido' (não dá pra agrupar com segurança).
 */
export function encontrarRegra<T extends RegraMatchavel>(
  descricao: string,
  regras: readonly T[],
): T | null {
  const merchant = extrairMerchant(descricao)
  if (merchant === '' || merchant === 'desconhecido') return null
  return regras.find((r) => r.merchant === merchant) ?? null
}
