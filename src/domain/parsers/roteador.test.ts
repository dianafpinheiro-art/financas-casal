import { describe, it, expect } from 'vitest'
import { escolherParser } from './roteador'

describe('escolherParser', () => {
  it('Ourocard ELO do Banco do Brasil -> elo', () => {
    expect(
      escolherParser({ banco: 'Banco do Brasil', bandeira: 'Elo', apelido: 'ELO Ourocard' }),
    ).toBe('elo')
  })

  it('BB sem bandeira mas apelido Ourocard -> elo', () => {
    expect(
      escolherParser({ banco: 'Banco do Brasil', bandeira: null, apelido: 'Ourocard Mais' }),
    ).toBe('elo')
  })

  it('Smiles Infinite (Banco do Brasil, Visa) -> generico (era o bug)', () => {
    expect(
      escolherParser({ banco: 'Banco do Brasil', bandeira: 'Visa', apelido: 'Smiles Infinite' }),
    ).toBe('generico')
  })

  it('Smiles taggeado como Elo por engano -> generico (trava explícita)', () => {
    expect(
      escolherParser({ banco: 'Banco do Brasil', bandeira: 'Elo', apelido: 'Smiles Infinite' }),
    ).toBe('generico')
  })

  it('outros bancos -> generico', () => {
    expect(escolherParser({ banco: 'Itaú', bandeira: 'Mastercard', apelido: 'Latam Pass Itaú' })).toBe('generico')
    expect(escolherParser({ banco: 'BTG Pactual', bandeira: 'Mastercard', apelido: 'BTG' })).toBe('generico')
    expect(escolherParser({ banco: 'Bradesco', bandeira: 'Visa', apelido: 'Smiles' })).toBe('generico')
  })

  it('campos ausentes -> generico (sem crash)', () => {
    expect(escolherParser({})).toBe('generico')
    expect(escolherParser({ banco: null, bandeira: null, apelido: null })).toBe('generico')
  })
})
