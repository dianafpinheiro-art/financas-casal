import { describe, it, expect } from 'vitest'
import { mesValido, conferirImportacao } from './importacao'

describe('importação por mês', () => {
  it('exige um mês real explicitamente selecionado', () => {
    for (const mes of ['', '2026-00', '2026-13', '26-07', '2026-7']) expect(mesValido(mes)).toBe(false)
    for (const mes of ['2026-07', '2026-08', '2026-09']) expect(mesValido(mes)).toBe(true)
  })
  const transacoes = [{ data: '2026-07-01', descricao: 'Compra', valor_cents: 1000, moeda: 'BRL' }]
  it('não apresenta total desconhecido ou divergente como conferido', () => {
    expect(conferirImportacao(transacoes, 1000).precisaRevisao).toBe(false)
    expect(conferirImportacao(transacoes, 1000, true).precisaRevisao).toBe(true)
    expect(conferirImportacao(transacoes, 2000).precisaRevisao).toBe(true)
  })
  it('rejeita importações vazias ou valores inválidos', () => {
    expect(() => conferirImportacao([], 0)).toThrow()
    expect(() => conferirImportacao(transacoes, NaN)).toThrow()
  })
})
