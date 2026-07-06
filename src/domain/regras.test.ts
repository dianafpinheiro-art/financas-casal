import { describe, it, expect } from 'vitest'
import { encontrarRegra, type RegraMatchavel } from './regras'

describe('encontrarRegra (por merchant)', () => {
  const regras: (RegraMatchavel & { id: string })[] = [
    { id: 'r1', merchant: 'carrefour' },
    { id: 'r2', merchant: 'uber' },
    { id: 'r3', merchant: 'paypal' },
  ]

  it('casa por merchant extraído da descrição (qualquer variação)', () => {
    expect(encontrarRegra('IFD CARREFOUR COMERCIO RECIFE', regras)?.id).toBe('r1')
    expect(encontrarRegra('CARREFOUR COMCAJAMARBRA', regras)?.id).toBe('r1')
    expect(encontrarRegra('MP *UBERSANDROO', regras)?.id).toBe('r2')
  })

  it('gateway sem merchant interno casa a regra do gateway', () => {
    expect(encontrarRegra('PAYPAL SUBSCRIPTION', regras)?.id).toBe('r3')
  })

  it('merchant interno ganha do gateway (rappi sem regra -> null, não paypal)', () => {
    expect(encontrarRegra('PAYPAL *RAPPIBRASIL', regras)).toBeNull()
  })

  it('sem regra pro merchant -> null', () => {
    expect(encontrarRegra('SHEIN *ORDER', regras)).toBeNull()
  })

  it("descrição 'desconhecida' nunca casa (nem com regra desconhecido)", () => {
    const comDesconhecido = [...regras, { id: 'rx', merchant: 'desconhecido' }]
    expect(encontrarRegra('*** 123 ***', comDesconhecido)).toBeNull()
  })
})
