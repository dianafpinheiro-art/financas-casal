import { describe, it, expect } from 'vitest'
import { montarChunks, promptTrecho, mesclarRespostas } from './chunks'
import { type GenericoResposta } from './generico'

const lanc = (descricao: string, valor = 100) => ({
  data: '03/06',
  descricao,
  valor,
  parcelaAtual: null,
  parcelaTotal: null,
  moedaOriginal: null,
  valorOriginal: null,
})

describe('montarChunks', () => {
  it('agrupa páginas de 2 em 2 preservando a ordem', () => {
    expect(montarChunks(['p1', 'p2', 'p3', 'p4', 'p5'])).toEqual([
      'p1\n\np2',
      'p3\n\np4',
      'p5',
    ])
  })

  it('uma página só vira um chunk só', () => {
    expect(montarChunks(['p1'])).toEqual(['p1'])
  })

  it('respeita porChunk customizado', () => {
    expect(montarChunks(['a', 'b', 'c'], 3)).toEqual(['a\n\nb\n\nc'])
  })

  it('sem páginas => sem chunks', () => {
    expect(montarChunks([])).toEqual([])
  })
})

describe('promptTrecho', () => {
  it('mantém o prompt base e anexa o aviso de trecho com a numeração', () => {
    const p = promptTrecho('PROMPT BASE', 1, 5)
    expect(p.startsWith('PROMPT BASE')).toBe(true)
    expect(p).toContain('TRECHO')
    expect(p).toContain('parte 2 de 5')
    expect(p).toContain('devolva null')
  })
})

describe('mesclarRespostas', () => {
  it('concatena lançamentos na ordem e pega o primeiro total não-null', () => {
    const respostas: GenericoResposta[] = [
      { totalDeclarado: null, lancamentos: [lanc('A')] },
      { totalDeclarado: 2035074 / 100, lancamentos: [lanc('B'), lanc('C')] },
      { totalDeclarado: 999, lancamentos: [lanc('D')] },
    ]
    const r = mesclarRespostas(respostas)
    expect(r.lancamentos.map((l) => l.descricao)).toEqual(['A', 'B', 'C', 'D'])
    expect(r.totalDeclarado).toBe(20350.74)
  })

  it('sem total em nenhum chunk => null (sanity vira aviso, não bloqueio)', () => {
    const r = mesclarRespostas([
      { totalDeclarado: null, lancamentos: [lanc('A')] },
      { totalDeclarado: null, lancamentos: [] },
    ])
    expect(r.totalDeclarado).toBeNull()
  })

  it('NÃO deduplica: compras legítimas repetidas sobrevivem', () => {
    const r = mesclarRespostas([
      { totalDeclarado: null, lancamentos: [lanc('UBER TRIP', 1999)] },
      { totalDeclarado: null, lancamentos: [lanc('UBER TRIP', 1999)] },
    ])
    expect(r.lancamentos).toHaveLength(2)
  })
})
