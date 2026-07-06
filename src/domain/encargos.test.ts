import { describe, it, expect } from 'vitest'
import { ehEncargo, propagarEncargos, type LancamentoParaEncargo } from './encargos'

const lanc = (over: Partial<LancamentoParaEncargo>): LancamentoParaEncargo => ({
  data: '01/06',
  descricao: 'X',
  divisaoTipo: null,
  divisaoPctDiana: null,
  categoriaId: null,
  classificado: false,
  tags: null,
  observacao: null,
  ...over,
})

describe('ehEncargo', () => {
  it('detecta encargos (case/espaço-insensível, prefixo)', () => {
    expect(ehEncargo('JUROS PAGAMENTO TITULO')).toBe(true)
    expect(ehEncargo('IOF PF')).toBe(true)
    expect(ehEncargo('PAGAMENTOCONTAS')).toBe(true)
    expect(ehEncargo('IOF DIARIO SAQUE PIX 03/06')).toBe(true)
    expect(ehEncargo('  iof   adicional   pf ')).toBe(true)
  })

  it('detecta encargos novos do Itaú/Bradesco', () => {
    expect(ehEncargo('ENCARGOS ROTATIVO')).toBe(true)
    expect(ehEncargo('IOF FINANCEIRO')).toBe(true)
    expect(ehEncargo('IOF COMPRAS PARCELADAS')).toBe(true)
    expect(ehEncargo('ANUIDADE DIFERENCIADA 01/12')).toBe(true)
    expect(ehEncargo('JUROS REFINANCIAMENTO')).toBe(true)
    expect(ehEncargo('TARIFA AVALIACAO EMERGENCIAL')).toBe(true)
  })

  it('NÃO trata mensalidade/redução como encargo (merchant/itaú cuidam)', () => {
    expect(ehEncargo('MENSALIDADE PLANO ITAU')).toBe(false)
    expect(ehEncargo('REDUCAO MENSALIDADE')).toBe(false)
  })

  it('não marca lançamento normal como encargo', () => {
    expect(ehEncargo('MIX MATEUS RECIFE')).toBe(false)
    expect(ehEncargo('IOF')).toBe(false) // sozinho não casa nenhum prefixo
  })
})

describe('propagarEncargos', () => {
  it('copia divisão/categoria do principal no MESMO dia; tag e observação; não confirma', () => {
    const [principal, encargo] = propagarEncargos([
      lanc({ data: '05/06', descricao: 'AMAZON', divisaoTipo: 'so_diana', divisaoPctDiana: 100, categoriaId: 'cat-1', classificado: true }),
      lanc({ data: '05/06', descricao: 'IOF PF' }),
    ])
    expect(principal.divisaoTipo).toBe('so_diana') // principal intacto
    expect(encargo.divisaoTipo).toBe('so_diana')
    expect(encargo.divisaoPctDiana).toBe(100)
    expect(encargo.categoriaId).toBe('cat-1')
    expect(encargo.tags).toEqual(['encargo'])
    expect(encargo.observacao).toBe('Encargo de: AMAZON')
    expect(encargo.classificado).toBe(false) // NÃO confirma automático
  })

  it('aceita principal 1 dia antes (inclusive virada de mês 31/05 -> 01/06)', () => {
    const [, enc] = propagarEncargos([
      lanc({ data: '31/05', descricao: 'SAQUE PIX', divisaoTipo: 'dividir', classificado: true }),
      lanc({ data: '01/06', descricao: 'JUROS SAQUE PIX' }),
    ])
    expect(enc.divisaoTipo).toBe('dividir')
    expect(enc.observacao).toBe('Encargo de: SAQUE PIX')
  })

  it('mesmo-dia tem prioridade sobre 1-dia-antes', () => {
    const r = propagarEncargos([
      lanc({ data: '04/06', descricao: 'PRINC ONTEM', divisaoTipo: 'so_diana', classificado: true }),
      lanc({ data: '05/06', descricao: 'PRINC HOJE', divisaoTipo: 'so_nicco', classificado: true }),
      lanc({ data: '05/06', descricao: 'IOF PF' }),
    ])
    expect(r[2].divisaoTipo).toBe('so_nicco') // o de hoje (mesmo dia)
    expect(r[2].observacao).toBe('Encargo de: PRINC HOJE')
  })

  it('empate de mesmo-dia: principal mais próximo no índice', () => {
    const r = propagarEncargos([
      lanc({ data: '05/06', descricao: 'LONGE', divisaoTipo: 'so_diana', classificado: true }), // idx 0, dist 2
      lanc({ data: '05/06', descricao: 'MEIO', divisaoTipo: 'dividir', classificado: true }),     // idx 1, dist 1
      lanc({ data: '05/06', descricao: 'IOF PF' }),                                               // idx 2 (encargo)
      lanc({ data: '05/06', descricao: 'PERTO', divisaoTipo: 'so_nicco', classificado: true }),   // idx 3, dist 1
    ])
    // idx 1 e 3 empatam em distância (1); desempate por índice menor -> idx 1 (MEIO)
    expect(r[2].divisaoTipo).toBe('dividir')
    expect(r[2].observacao).toBe('Encargo de: MEIO')
  })

  it('sem principal candidato -> encargo fica como estava (fallback)', () => {
    const [enc] = propagarEncargos([lanc({ data: '05/06', descricao: 'IOF PF' })])
    expect(enc.divisaoTipo).toBeNull()
    expect(enc.tags).toBeNull()
    expect(enc.observacao).toBeNull()
  })

  it('lançamento normal não é tocado', () => {
    const [normal] = propagarEncargos([
      lanc({ data: '05/06', descricao: 'AMAZON', divisaoTipo: 'so_diana', classificado: true }),
      lanc({ data: '05/06', descricao: 'IOF PF' }),
    ])
    expect(normal.tags).toBeNull()
    expect(normal.observacao).toBeNull()
    expect(normal.classificado).toBe(true)
  })

  it('um encargo nunca vira principal de outro', () => {
    const r = propagarEncargos([
      lanc({ data: '05/06', descricao: 'AMAZON', divisaoTipo: 'so_diana', classificado: true }),
      lanc({ data: '05/06', descricao: 'IOF PF' }),
      lanc({ data: '05/06', descricao: 'JUROS SAQUE PIX' }),
    ])
    // os dois encargos apontam pro AMAZON, não um pro outro
    expect(r[1].observacao).toBe('Encargo de: AMAZON')
    expect(r[2].observacao).toBe('Encargo de: AMAZON')
  })
})
