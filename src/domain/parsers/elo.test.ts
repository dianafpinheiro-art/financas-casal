import { describe, it, expect } from 'vitest'
import {
  eloRespostaSchema,
  mapRespostaElo,
  sanityCheckTotal,
  type EloResposta,
} from './elo'

const respostaOk: EloResposta = {
  totalDeclarado: 357.0,
  lancamentos: [
    { data: '03/06', descricao: 'MIX MATEUS RECIFE', valor: 123.45, parcelaAtual: null, parcelaTotal: null },
    { data: '05/06', descricao: 'AMAZON PARC 03/12', valor: 200.0, parcelaAtual: 3, parcelaTotal: 12 },
    { data: '07/06', descricao: 'ESTORNO COMPRA XPTO', valor: -10.0, parcelaAtual: null, parcelaTotal: null },
    { data: '09/06', descricao: 'IOF', valor: 43.55, parcelaAtual: null, parcelaTotal: null },
  ],
}

describe('eloRespostaSchema', () => {
  it('valida uma resposta bem formada', () => {
    expect(() => eloRespostaSchema.parse(respostaOk)).not.toThrow()
  })

  it('rejeita lançamento sem campo de parcela (structured output exige todos)', () => {
    const ruim = {
      totalDeclarado: 10,
      lancamentos: [{ data: '01/06', descricao: 'X', valor: 10 }],
    }
    expect(() => eloRespostaSchema.parse(ruim)).toThrow()
  })

  it('rejeita valor não-numérico', () => {
    const ruim = {
      totalDeclarado: 10,
      lancamentos: [{ data: '01/06', descricao: 'X', valor: '10,00', parcelaAtual: null, parcelaTotal: null }],
    }
    expect(() => eloRespostaSchema.parse(ruim)).toThrow()
  })
})

describe('mapRespostaElo', () => {
  it('converte reais -> centavos e preserva parcelas', () => {
    const r = mapRespostaElo(respostaOk)
    expect(r.totalDeclaradoCentavos).toBe(35700)
    expect(r.lancamentos[0]).toEqual({
      data: '03/06',
      descricao: 'MIX MATEUS RECIFE',
      valorCentavos: 12345,
      parcelaAtual: null,
      parcelaTotal: null,
    })
    expect(r.lancamentos[1].parcelaAtual).toBe(3)
    expect(r.lancamentos[1].parcelaTotal).toBe(12)
  })

  it('estorno vira centavos negativo', () => {
    const r = mapRespostaElo(respostaOk)
    expect(r.lancamentos[2].valorCentavos).toBe(-1000)
  })
})

describe('sanityCheckTotal', () => {
  it('ok quando a soma bate com o total declarado', () => {
    const r = mapRespostaElo(respostaOk) // 12345 + 20000 - 1000 + 4355 = 35700
    const s = sanityCheckTotal(r)
    expect(s.somaCentavos).toBe(35700)
    expect(s.difCentavos).toBe(0)
    expect(s.ok).toBe(true)
  })

  it('ok dentro da tolerância de R$ 1,00', () => {
    const r = mapRespostaElo({ ...respostaOk, totalDeclarado: 357.99 }) // dif 99 centavos
    const s = sanityCheckTotal(r)
    expect(s.difCentavos).toBe(99)
    expect(s.ok).toBe(true)
  })

  it('NÃO ok quando passa de R$ 1,00 (precisa_revisao)', () => {
    const r = mapRespostaElo({ ...respostaOk, totalDeclarado: 400.0 }) // dif 4300 centavos
    const s = sanityCheckTotal(r)
    expect(s.difCentavos).toBe(4300)
    expect(s.ok).toBe(false)
  })
})
