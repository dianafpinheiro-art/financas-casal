/**
 * Roteador de parser por cartão — parte PURA (sem SDK, testável).
 *
 * Decide qual parser usar pra cada fatura. O parser ELO é específico do layout
 * Ourocard ELO do Banco do Brasil; TODO o resto (inclusive outros cartões do
 * próprio Banco do Brasil, como o Smiles Infinite que é Visa) usa o genérico.
 *
 * ⚠️ Histórico do bug: a regra antiga era "banco contém 'banco do brasil' =>
 * ELO". Mas o Smiles Infinite é emitido pelo Banco do Brasil e é VISA, com
 * layout multi-quadro de 6 páginas — o parser ELO pegava só o primeiro quadro
 * e confundia "Saldo fatura anterior" com o total. Agora o ELO só é escolhido
 * quando é realmente Ourocard ELO (BB + bandeira Elo/apelido Ourocard).
 */

export type ParserId = 'elo' | 'generico'

export interface CartaoParaRoteamento {
  banco?: string | null
  bandeira?: string | null
  apelido?: string | null
}

export function escolherParser(cartao: CartaoParaRoteamento): ParserId {
  const banco = (cartao.banco ?? '').toLowerCase()
  const bandeira = (cartao.bandeira ?? '').toLowerCase()
  const apelido = (cartao.apelido ?? '').toLowerCase()

  // Cartões que SEMPRE usam o genérico, mesmo sendo Banco do Brasil. Trava
  // explícita (defesa em profundidade): se alguém tagueasse o Smiles como Elo
  // por engano no CRUD, ainda assim cairia no genérico.
  if (apelido.includes('smiles')) return 'generico'

  // ELO Ourocard do Banco do Brasil: precisa ser BB E (bandeira Elo OU apelido
  // Ourocard). Banco do Brasil + outra bandeira (ex: Smiles Visa) => genérico.
  const ehOurocardElo =
    banco.includes('banco do brasil') &&
    (bandeira.includes('elo') || apelido.includes('ourocard'))

  return ehOurocardElo ? 'elo' : 'generico'
}
