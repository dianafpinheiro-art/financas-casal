import { describe, it, expect } from 'vitest'
import { calcAcerto } from './acerto'
import { type Lancamento, type DivisaoTipo, type Pagador } from './lancamento'

const l = (over: Partial<Lancamento>): Lancamento => ({
  valorCentavos: 1000,
  pagoPor: 'diana',
  divisaoTipo: 'dividir',
  ...over,
})

describe('calcAcerto', () => {
  it('50/50 simples: Diana paga 1000 dividir -> Nicco transfere 500', () => {
    const a = calcAcerto([l({ valorCentavos: 1000, pagoPor: 'diana', divisaoTipo: 'dividir' })])
    expect(a.compartilhadoCentavos).toBe(1000)
    expect(a.totalCentavos).toBe(1000)
    expect(a.diana.cabeCentavos).toBe(500)
    expect(a.diana.saldoCentavos).toBe(500)
    expect(a.transferencia).toEqual({ de: 'nicco', para: 'diana', valorCentavos: 500 })
  })

  it('Só Diana paga pelo Nicco -> Diana devolve pro Nicco', () => {
    const a = calcAcerto([l({ valorCentavos: 1000, pagoPor: 'nicco', divisaoTipo: 'so_diana' })])
    expect(a.soDianaCentavos).toBe(1000)
    expect(a.diana.cabeCentavos).toBe(1000)
    expect(a.diana.saldoCentavos).toBe(-1000)
    expect(a.transferencia).toEqual({ de: 'diana', para: 'nicco', valorCentavos: 1000 })
  })

  it('Só Nicco pago pela Diana -> Nicco devolve pra Diana', () => {
    const a = calcAcerto([l({ valorCentavos: 1000, pagoPor: 'diana', divisaoTipo: 'so_nicco' })])
    expect(a.soNiccoCentavos).toBe(1000)
    expect(a.nicco.cabeCentavos).toBe(1000)
    expect(a.transferencia).toEqual({ de: 'nicco', para: 'diana', valorCentavos: 1000 })
  })

  it('personalizado 70/30: Diana paga -> Nicco transfere os 30%', () => {
    const a = calcAcerto([
      l({ valorCentavos: 1000, pagoPor: 'diana', divisaoTipo: 'personalizado', divisaoPctDiana: 70 }),
    ])
    expect(a.diana.cabeCentavos).toBe(700)
    expect(a.transferencia).toEqual({ de: 'nicco', para: 'diana', valorCentavos: 300 })
  })

  it('personalizado SEM pct propaga o erro', () => {
    expect(() =>
      calcAcerto([l({ divisaoTipo: 'personalizado' })]),
    ).toThrow(/divisaoPctDiana/)
  })

  it('lista vazia -> tudo zero, sem transferência', () => {
    const a = calcAcerto([])
    expect(a.totalCentavos).toBe(0)
    expect(a.diana.saldoCentavos).toBe(0)
    expect(a.transferencia).toBeNull()
  })

  it('R$ 0,01 dividido 50/50 -> Diana fica com o centavo', () => {
    // 1 centavo dividir, pago pela Diana: cabe 1 a ela, 0 ao Nicco
    const a = calcAcerto([l({ valorCentavos: 1, pagoPor: 'diana', divisaoTipo: 'dividir' })])
    expect(a.diana.cabeCentavos).toBe(1)
    expect(a.nicco.cabeCentavos).toBe(0)
    // Diana pagou 1 e cabia 1 a ela -> saldo 0 -> sem transferência
    expect(a.transferencia).toBeNull()
  })

  it('saldo zero (< 1 centavo) -> transferência null', () => {
    // cada um paga 1000 dividir: cada um deve 1000, cada um pagou 1000
    const a = calcAcerto([
      l({ valorCentavos: 1000, pagoPor: 'diana', divisaoTipo: 'dividir' }),
      l({ valorCentavos: 1000, pagoPor: 'nicco', divisaoTipo: 'dividir' }),
    ])
    expect(a.diana.saldoCentavos).toBe(0)
    expect(a.transferencia).toBeNull()
  })

  it('100 lançamentos aleatórios: invariantes de centavo (nada some)', () => {
    // PRNG determinístico (mulberry32) pra o teste ser reproduzível.
    let seed = 0x9e3779b9
    const rand = () => {
      seed |= 0
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const tipos: DivisaoTipo[] = ['dividir', 'so_diana', 'so_nicco', 'personalizado']
    const pagadores: Pagador[] = ['diana', 'nicco']

    const lancs: Lancamento[] = Array.from({ length: 100 }, () => {
      const tipo = tipos[Math.floor(rand() * tipos.length)]
      return {
        valorCentavos: 1 + Math.floor(rand() * 5_000_00), // 1 centavo .. ~R$5000
        pagoPor: pagadores[Math.floor(rand() * pagadores.length)],
        divisaoTipo: tipo,
        // personalizado SEMPRE com pct (senão lança erro de propósito)
        divisaoPctDiana: tipo === 'personalizado' ? Math.floor(rand() * 101) : undefined,
      }
    })

    const a = calcAcerto(lancs)

    // invariante central: o que cabe à Diana + o que cabe ao Nicco = total
    expect(a.diana.cabeCentavos + a.nicco.cabeCentavos).toBe(a.totalCentavos)
    // saldos são espelho um do outro
    expect(a.diana.saldoCentavos).toBe(-a.nicco.saldoCentavos)
    // total pago = total geral (todo lançamento foi pago por alguém)
    expect(a.diana.pagaCentavos + a.nicco.pagaCentavos).toBe(a.totalCentavos)
    // tudo integer (nenhum float vazou)
    for (const v of [
      a.totalCentavos,
      a.diana.cabeCentavos,
      a.nicco.cabeCentavos,
      a.diana.saldoCentavos,
    ]) {
      expect(Number.isInteger(v)).toBe(true)
    }
  })
})
