export type TextoPdf = { str: string; transform: number[]; width: number }
type LinhaPdf = { y: number; items: TextoPdf[] }

function porLinha(items: TextoPdf[]): LinhaPdf[] {
  const linhas: LinhaPdf[] = []
  for (const item of [...items].sort((a, b) => b.transform[5] - a.transform[5])) {
    if (!item.str.trim()) continue
    const ultima = linhas.at(-1)
    if (ultima && Math.abs(ultima.y - item.transform[5]) < 1) ultima.items.push(item)
    else linhas.push({ y: item.transform[5], items: [item] })
  }
  for (const linha of linhas) linha.items.sort((a, b) => a.transform[4] - b.transform[4])
  return linhas
}

function colunas(linhas: LinhaPdf[], corte: number): LinhaPdf[] {
  return [false, true].flatMap((direita) => linhas.map(linha => ({
    y: linha.y,
    items: linha.items.filter(item => (item.transform[4] >= corte) === direita),
  })).filter(linha => linha.items.length))
}

/** Mantém a leitura de cima para baixo em cada coluna e em cada bloco do cartão. */
export function ordenarLinhasPdf(items: TextoPdf[], largura: number): LinhaPdf[] {
  const linhas = porLinha(items)
  const secoesBtg = linhas.filter(linha => /Lançamentos\s*do\s*cartão/.test(linha.items.map(i => i.str).join(' ')))
  if (secoesBtg.length) {
    const resultado = linhas.filter(linha => linha.y > secoesBtg[0].y)
    for (const [indice, secao] of secoesBtg.entries()) {
      const fim = secoesBtg[indice + 1]?.y ?? -Infinity
      const bloco = linhas.filter(linha => linha.y < secao.y && linha.y > fim)
      resultado.push(secao, ...colunas(bloco, largura / 2))
    }
    return resultado
  }

  // O Itaú pode desenhar DATA como quatro fragmentos. Localiza os dois
  // cabeçalhos pela posição, sem depender da ordem interna dos objetos do PDF.
  const cabecalhos: Array<{ x: number; y: number }> = []
  for (const linha of linhas) {
    const texto = linha.items.map(i => i.str).join('').replace(/\s/g, '')
    if (!texto.includes('ESTABELECIMENTO') && !texto.includes('PRODUTOS/SERVIÇOS')) continue
    for (let i = 0; i < linha.items.length; i++) {
      let palavra = ''
      for (let j = i; j < Math.min(i + 4, linha.items.length); j++) {
        palavra += linha.items[j].str.replace(/\s/g, '')
        if (palavra === 'DATA') cabecalhos.push({ x: linha.items[i].transform[4], y: linha.y })
        if (!'DATA'.startsWith(palavra)) break
      }
    }
  }
  if (cabecalhos.length) {
    const esquerda = Math.min(...cabecalhos.map(c => c.x))
    const direita = cabecalhos.find(c => c.x > esquerda + largura * 0.25)
    if (!direita) return linhas
    const corte = direita.x - 8
    // Texto introdutório acima das tabelas continua na largura inteira.
    const inicio = Math.max(...cabecalhos.map(c => c.y)) + 20
    const topo = linhas.filter(l => l.y > inicio)
    const tabelas = linhas.filter(l => l.y <= inicio)
    return [...topo, ...colunas(tabelas, corte)]
  }
  return linhas
}
