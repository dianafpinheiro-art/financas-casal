import { describe, it, expect } from 'vitest'
import {
  genericoRespostaSchema,
  mapRespostaGenerico,
  normalizarDataFatura,
  sanityCheckGenerico,
  ehLinhaResumo,
  type GenericoResposta,
} from './generico'

const resp = (over: Partial<GenericoResposta>): GenericoResposta => ({
  totalDeclarado: null,
  lancamentos: [],
  ...over,
})
const lanc = (over: Partial<GenericoResposta['lancamentos'][number]> = {}) => ({
  data: '03/06',
  descricao: 'MERCADO X',
  valor: 100,
  parcelaAtual: null,
  parcelaTotal: null,
  moedaOriginal: null,
  valorOriginal: null,
  ...over,
})

describe('genericoRespostaSchema', () => {
  it('valida resposta bem formada (com total)', () => {
    const r = resp({ totalDeclarado: 100, lancamentos: [lanc()] })
    expect(() => genericoRespostaSchema.parse(r)).not.toThrow()
  })
  it('aceita totalDeclarado null (total ausente)', () => {
    expect(() => genericoRespostaSchema.parse(resp({ lancamentos: [lanc()] }))).not.toThrow()
  })
  it('rejeita lançamento incompleto', () => {
    expect(() =>
      genericoRespostaSchema.parse({ totalDeclarado: 1, lancamentos: [{ data: '01/06', descricao: 'X', valor: 1 }] }),
    ).toThrow()
  })
})

describe('mapRespostaGenerico', () => {
  it('converte reais -> centavos', () => {
    const r = mapRespostaGenerico(resp({ totalDeclarado: 123.45, lancamentos: [lanc({ valor: 123.45 })] }))
    expect(r.lancamentos[0].valorCentavos).toBe(12345)
    expect(r.totalDeclaradoCentavos).toBe(12345)
  })
  it('detecta parcela', () => {
    const r = mapRespostaGenerico(resp({ lancamentos: [lanc({ parcelaAtual: 3, parcelaTotal: 12 })] }))
    expect(r.lancamentos[0].parcelaAtual).toBe(3)
    expect(r.lancamentos[0].parcelaTotal).toBe(12)
  })
  it('valor negativo (estorno) vira centavos negativo', () => {
    const r = mapRespostaGenerico(resp({ lancamentos: [lanc({ valor: -50 })] }))
    expect(r.lancamentos[0].valorCentavos).toBe(-5000)
  })
  it('internacional anota a moeda original na descrição', () => {
    const r = mapRespostaGenerico(
      resp({ lancamentos: [lanc({ descricao: 'NETFLIX', valor: 55.9, moedaOriginal: 'USD', valorOriginal: 9.99 })] }),
    )
    expect(r.lancamentos[0].descricao).toBe('NETFLIX (USD 9.99)')
    expect(r.lancamentos[0].valorCentavos).toBe(5590) // o BRL cobrado
  })
  it('total ausente -> totalDeclaradoCentavos null', () => {
    const r = mapRespostaGenerico(resp({ lancamentos: [lanc()] }))
    expect(r.totalDeclaradoCentavos).toBeNull()
  })
})

describe('normalizarDataFatura', () => {
  it('passa direto DD/MM e DD/MM/AAAA e DD/MM/AA', () => {
    expect(normalizarDataFatura('25/03')).toBe('25/03')
    expect(normalizarDataFatura('06/06/2026')).toBe('06/06/2026')
    expect(normalizarDataFatura('01/06/26')).toBe('01/06/26')
  })
  it('converte "06 Jun" -> "06/06"', () => {
    expect(normalizarDataFatura('06 Jun')).toBe('06/06')
    expect(normalizarDataFatura('06 jun')).toBe('06/06')
    expect(normalizarDataFatura('06 JUN')).toBe('06/06')
  })
  it('zero-pad dia de um dígito ("6 Jun" -> "06/06")', () => {
    expect(normalizarDataFatura('6 Jun')).toBe('06/06')
  })
  it('aceita mês completo em PT, com ou sem acento', () => {
    expect(normalizarDataFatura('06 junho')).toBe('06/06')
    expect(normalizarDataFatura('15 Março')).toBe('15/03')
  })
  it('aceita separador hífen com ano', () => {
    expect(normalizarDataFatura('06-jun-2026')).toBe('06/06/2026')
    expect(normalizarDataFatura('06-jun-26')).toBe('06/06/2026')
  })
  it('cobre todos os meses (jan..dez)', () => {
    const todos = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    todos.forEach((m, i) => {
      expect(normalizarDataFatura(`10 ${m}`)).toBe(`10/${String(i + 1).padStart(2, '0')}`)
    })
  })
  it('devolve crua se não reconhecer (deixa estourar lá adiante)', () => {
    expect(normalizarDataFatura('junho/3')).toBe('junho/3')
    expect(normalizarDataFatura('xyz')).toBe('xyz')
  })
})

describe('mapRespostaGenerico (data normalizada)', () => {
  it('normaliza "06 Jun" pro formato esperado por dataCompraDaFatura', () => {
    const r = mapRespostaGenerico(resp({ lancamentos: [lanc({ data: '06 Jun' })] }))
    expect(r.lancamentos[0].data).toBe('06/06')
  })
})

describe('ehLinhaResumo', () => {
  it('reconhece linhas de resumo/totais/saldos (com e sem acento/caixa)', () => {
    const resumos = [
      'Saldo financiado',
      'SALDO FINANCIADO',
      'Total da fatura anterior',
      'Pagamento efetuado em 05/06/2026',
      'Total desta fatura',
      'Total dos pagamentos',
      'Total dos lançamentos atuais',
      'Total lançamentos inter. em R$',
      'Total transações inter. em R$',
    ]
    for (const r of resumos) expect(ehLinhaResumo(r)).toBe(true)
  })
  it('"Repasse de IOF" é encargo real — NÃO é resumo (fidelidade máxima)', () => {
    expect(ehLinhaResumo('Repasse de IOF em R$')).toBe(false)
    expect(ehLinhaResumo('IOF compra exterior')).toBe(false)
  })
  it('não confunde compra normal com resumo', () => {
    expect(ehLinhaResumo('MERCADO X')).toBe(false)
    expect(ehLinhaResumo('UBER *TRIP SAO PAULO')).toBe(false)
    expect(ehLinhaResumo('IOF compra exterior')).toBe(false) // não é "repasse de iof"
  })
  it('"PAGAMENTO" seco (fatura Itaú/Latam) é resumo, mas só por match exato', () => {
    expect(ehLinhaResumo('PAGAMENTO')).toBe(true)
    expect(ehLinhaResumo('  Pagamento ')).toBe(true)
    expect(ehLinhaResumo('PAGTO')).toBe(true)
    expect(ehLinhaResumo('PAGAMENTO BOLETO CLARO')).toBe(false) // compra de verdade
  })
  it('"PGTO DEBITO CONTA ..." (pagamento da fatura anterior no BB) é resumo', () => {
    expect(ehLinhaResumo('PGTO DEBITO CONTA 3237 000000002 200')).toBe(true)
  })
})

describe('mapRespostaGenerico (descarta resumo)', () => {
  it('remove a linha "Saldo financiado" (caso Latam: data "-")', () => {
    const r = mapRespostaGenerico(
      resp({
        totalDeclarado: 100,
        lancamentos: [
          lanc({ descricao: 'MERCADO X', valor: 100 }),
          lanc({ descricao: 'Saldo financiado', valor: 467.21, data: '-' }),
        ],
      }),
    )
    expect(r.lancamentos).toHaveLength(1)
    expect(r.lancamentos[0].descricao).toBe('MERCADO X')
  })
  it('sanity check passa a bater depois de remover o resumo', () => {
    // Soma das compras = 100; total declarado = 100; a linha-resumo de 467,21
    // sairia "estragando" a soma se não fosse descartada.
    const r = mapRespostaGenerico(
      resp({
        totalDeclarado: 100,
        lancamentos: [
          lanc({ descricao: 'MERCADO X', valor: 100 }),
          lanc({ descricao: 'Saldo financiado', valor: 467.21, data: '-' }),
        ],
      }),
    )
    const s = sanityCheckGenerico(r)
    expect(s.ok).toBe(true)
    expect(s.difCentavos).toBe(0)
  })
})

describe('sanityCheckGenerico', () => {
  it('ok quando a soma bate', () => {
    const r = mapRespostaGenerico(resp({ totalDeclarado: 200, lancamentos: [lanc({ valor: 100 }), lanc({ valor: 100 })] }))
    const s = sanityCheckGenerico(r)
    expect(s.semTotal).toBe(false)
    expect(s.ok).toBe(true)
    expect(s.difCentavos).toBe(0)
  })
  it('NÃO ok quando passa de R$ 1', () => {
    const r = mapRespostaGenerico(resp({ totalDeclarado: 250, lancamentos: [lanc({ valor: 100 })] }))
    const s = sanityCheckGenerico(r)
    expect(s.ok).toBe(false)
    expect(s.difCentavos).toBe(15000)
  })
  it('total ausente: não bloqueia, marca semTotal', () => {
    const r = mapRespostaGenerico(resp({ lancamentos: [lanc({ valor: 100 })] }))
    const s = sanityCheckGenerico(r)
    expect(s.semTotal).toBe(true)
    expect(s.ok).toBe(true)
    expect(s.totalDeclaradoCentavos).toBe(10000) // usa a soma como referência
  })
})
