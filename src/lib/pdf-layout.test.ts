import { describe, expect, it } from 'vitest'
import { ordenarLinhasPdf, type TextoPdf } from './pdf-layout'

const item = (str: string, x: number, y: number): TextoPdf => ({ str, width: 20, transform: [1,0,0,1,x,y] })
const texts = (items: TextoPdf[]) => ordenarLinhasPdf(items, 600).map(l => l.items.map(i => i.str).join(''))

describe('ordem visual da fatura', () => {
  it('lê cada coluna do BTG dentro do bloco físico ou virtual', () => {
    expect(texts([
      item('Lançamentos do cartão físico', 30, 700),
      item('08 Mai Fazenda', 30, 660), item('19 Mai Jmr', 311, 660),
      item('08 Mai Casa', 30, 646),
      item('Lançamentos do cartão virtual', 30, 600),
      item('06 Jun Wyndham', 30, 570), item('09 Mai Feira', 311, 570),
      item('06 Jun Wyndham 2', 30, 556),
    ])).toEqual(['Lançamentos do cartão físico','08 Mai Fazenda','08 Mai Casa','19 Mai Jmr','Lançamentos do cartão virtual','06 Jun Wyndham','06 Jun Wyndham 2','09 Mai Feira'])
  })

  it('reconhece cabeçalho fragmentado do Itaú e mantém parcelados na ordem impressa', () => {
    expect(texts([
      item('D',142,700),item('A',147,700),item('TA',151,700),item('ESTABELECIMENTO',170,700),
      item('DATA',360,700),item('ESTABELECIMENTO',389,700),
      item('06/07 Antigo',142,670),item('10/08 Próxima coluna',360,670),
      item('14/07 Outro',142,650),
    ])).toEqual(['DATAESTABELECIMENTO','06/07 Antigo','14/07 Outro','DATAESTABELECIMENTO','10/08 Próxima coluna'])
  })

  it('mantém a tabela de uma coluna sem alterar seus campos', () => {
    expect(texts([item('07/05 Compra',40,660),item('125,00',510,660),item('08/05 Outra',40,646)])).toEqual(['07/05 Compra125,00','08/05 Outra'])
  })

  it('separa as colunas mesmo quando seus cabeçalhos estão em alturas diferentes', () => {
    expect(texts([
      item('DATA',152,753),item('ESTABELECIMENTO',180,753),
      item('DATA',368,756),item('ESTABELECIMENTO',395,756),
      item('07/11 Esquerda',152,740),item('04/01 Direita',368,743),
      item('11/11 Esquerda 2',152,722),
    ])).toEqual(['DATAESTABELECIMENTO','07/11 Esquerda','11/11 Esquerda 2','DATAESTABELECIMENTO','04/01 Direita'])
  })
})
