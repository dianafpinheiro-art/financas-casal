import { describe, it, expect } from 'vitest'
import {
  normalizarDescricao,
  competenciaDaCompra,
  dataCompraDaFatura,
  reaisParaCentavos,
  centavosParaReais,
  quantoCabeDiana,
  quantoCabeNicco,
  type Lancamento,
} from './lancamento'

// data UTC pra entrada determinística (mês 0..11)
const utc = (ano: number, mes1a12: number, dia: number) =>
  new Date(Date.UTC(ano, mes1a12 - 1, dia))
// competência -> "AAAA-MM-DD"
const comp = (d: Date) => d.toISOString().slice(0, 10)

describe('normalizarDescricao', () => {
  it('minúsculas + remove sufixo "*125" (REGRA DE OURO)', () => {
    expect(normalizarDescricao('GRANADO PHARMACIAS RECIFE *125')).toBe(
      'granado pharmacias recife',
    )
  })

  it('remove marcador de parcela "PARC 03/12" com os dígitos', () => {
    expect(normalizarDescricao('AMAZON PARC 03/12')).toBe('amazon')
  })

  it('remove parcela em parênteses "(03/12)"', () => {
    expect(normalizarDescricao('UBER (03/12)')).toBe('uber')
  })

  it('remove acentos pra casar josé/jose', () => {
    expect(normalizarDescricao('PIX MARIA JOSÉ')).toBe('pix maria jose')
  })

  it('troca pontuação por espaço e colapsa', () => {
    expect(normalizarDescricao('PAGSEGURO*MARIA JOSE')).toBe('pagseguro maria jose')
    expect(normalizarDescricao('GRANADO   PHARMACIAS')).toBe('granado pharmacias')
  })

  it('é idempotente (rodar 2x dá o mesmo)', () => {
    const entradas = ['GRANADO PHARMACIAS RECIFE *125', 'AMAZON PARC 03/12', 'PIX MARIA JOSÉ']
    for (const e of entradas) {
      const uma = normalizarDescricao(e)
      expect(normalizarDescricao(uma)).toBe(uma)
    }
  })

  it('o padrão do seed casa por prefixo com a saída do parser', () => {
    // seed: "granado pharmacias"; parser entrega a descrição completa
    const padraoSeed = normalizarDescricao('Granado Pharmacias')
    const doParser = normalizarDescricao('GRANADO PHARMACIAS RECIFE *125')
    expect(doParser.startsWith(padraoSeed)).toBe(true)
  })
})

describe('competenciaDaCompra', () => {
  it('1) compra ANTES do fechamento -> mês corrente', () => {
    // fecha 15, vence 22 (vence > fecha => mesmo mês)
    expect(comp(competenciaDaCompra(utc(2026, 4, 10), 15, 22))).toBe('2026-04-01')
  })

  it('2) compra NO dia do fechamento -> inclusive no mês corrente', () => {
    expect(comp(competenciaDaCompra(utc(2026, 4, 15), 15, 22))).toBe('2026-04-01')
  })

  it('3) compra DEPOIS do fechamento -> mês seguinte (ex do review: ELO fecha 15)', () => {
    expect(comp(competenciaDaCompra(utc(2026, 4, 16), 15, 22))).toBe('2026-05-01')
  })

  it('4) virada de ano: compra 20/dez vai pra fatura de janeiro', () => {
    expect(comp(competenciaDaCompra(utc(2026, 12, 20), 15, 22))).toBe('2027-01-01')
  })

  it('5) vencimento "vira o mês" (vence 5 <= fecha 28)', () => {
    // compra 10/jun, fecha 28 (entra na fatura de junho), vence dia 5 => julho
    expect(comp(competenciaDaCompra(utc(2026, 6, 10), 28, 5))).toBe('2026-07-01')
  })

  it('6) fechamento no dia 1', () => {
    expect(comp(competenciaDaCompra(utc(2026, 3, 1), 1, 8))).toBe('2026-03-01') // inclusive
    expect(comp(competenciaDaCompra(utc(2026, 3, 2), 1, 8))).toBe('2026-04-01')
  })

  it('7) mês de 30 dias com fechamento 31 não quebra (retorna 1º dia)', () => {
    // compra 30/abr (abril tem 30 dias), fecha 31, vence 10 => maio
    expect(comp(competenciaDaCompra(utc(2026, 4, 30), 31, 10))).toBe('2026-05-01')
  })

  it('8) virada de ano + vencimento que vira o mês', () => {
    // compra 20/dez, fecha 28 (fatura de dez), vence 5 => jan/2027
    expect(comp(competenciaDaCompra(utc(2026, 12, 20), 28, 5))).toBe('2027-01-01')
  })
})

describe('dataCompraDaFatura', () => {
  it('"DD/MM" usa o ano de referência', () => {
    expect(comp(dataCompraDaFatura('03/06', 2026, 6))).toBe('2026-06-03')
  })

  it('compra de dezembro numa fatura de janeiro -> ano anterior', () => {
    expect(comp(dataCompraDaFatura('20/12', 2027, 1))).toBe('2026-12-20')
  })

  it('compra de mês anterior no mesmo ano (ref jun, compra mai)', () => {
    expect(comp(dataCompraDaFatura('15/05', 2026, 6))).toBe('2026-05-15')
  })

  it('respeita o ano quando vem na string (DD/MM/AAAA e DD/MM/AA)', () => {
    expect(comp(dataCompraDaFatura('15/05/2026', 2099, 1))).toBe('2026-05-15')
    expect(comp(dataCompraDaFatura('01/06/26', 2099, 1))).toBe('2026-06-01')
  })

  it('data malformada lança erro', () => {
    expect(() => dataCompraDaFatura('junho/3', 2026, 6)).toThrow(/inválida/)
  })
})

describe('reais <-> centavos', () => {
  it('reaisParaCentavos arredonda e protege de float', () => {
    expect(reaisParaCentavos(12.34)).toBe(1234)
    expect(reaisParaCentavos(1.1)).toBe(110) // 1.1*100 = 110.00000000000001
    expect(reaisParaCentavos(0)).toBe(0)
  })

  it('centavosParaReais', () => {
    expect(centavosParaReais(1234)).toBe(12.34)
    expect(centavosParaReais(0)).toBe(0)
  })
})

describe('quantoCabeDiana / quantoCabeNicco', () => {
  const l = (over: Partial<Lancamento>): Lancamento => ({
    valorCentavos: 1000,
    pagoPor: 'diana',
    divisaoTipo: 'dividir',
    ...over,
  })

  it('dividir par: metade exata', () => {
    expect(quantoCabeDiana(l({ valorCentavos: 1000 }))).toBe(500)
    expect(quantoCabeNicco(l({ valorCentavos: 1000 }))).toBe(500)
  })

  it('dividir ímpar: Diana fica com o centavo a mais; soma fecha', () => {
    const lanc = l({ valorCentavos: 101 })
    expect(quantoCabeDiana(lanc)).toBe(51)
    expect(quantoCabeNicco(lanc)).toBe(50)
    expect(quantoCabeDiana(lanc) + quantoCabeNicco(lanc)).toBe(101)
  })

  it('R$ 0,01 dividido: Diana fica com o centavo (determinístico)', () => {
    const lanc = l({ valorCentavos: 1 })
    expect(quantoCabeDiana(lanc)).toBe(1)
    expect(quantoCabeNicco(lanc)).toBe(0)
  })

  it('so_diana / so_nicco', () => {
    expect(quantoCabeDiana(l({ valorCentavos: 999, divisaoTipo: 'so_diana' }))).toBe(999)
    expect(quantoCabeNicco(l({ valorCentavos: 999, divisaoTipo: 'so_diana' }))).toBe(0)
    expect(quantoCabeDiana(l({ valorCentavos: 999, divisaoTipo: 'so_nicco' }))).toBe(0)
    expect(quantoCabeNicco(l({ valorCentavos: 999, divisaoTipo: 'so_nicco' }))).toBe(999)
  })

  it('personalizado 70/30 e 33/67', () => {
    expect(quantoCabeDiana(l({ valorCentavos: 1000, divisaoTipo: 'personalizado', divisaoPctDiana: 70 }))).toBe(700)
    const trinta3 = l({ valorCentavos: 100, divisaoTipo: 'personalizado', divisaoPctDiana: 33 })
    expect(quantoCabeDiana(trinta3)).toBe(33)
    expect(quantoCabeNicco(trinta3)).toBe(67)
  })

  it('personalizado SEM pct lança erro (fail-fast, não vira 50/50)', () => {
    expect(() => quantoCabeDiana(l({ divisaoTipo: 'personalizado' }))).toThrow(/divisaoPctDiana/)
  })
})
