'use client'

/**
 * Extração de texto de PDF NO BROWSER (pdf.js) — o PDF nunca sobe pro
 * servidor. Uma fatura de 5,7 MB vira ~30-50 KB de texto, bem abaixo do
 * hard limit de 4,5 MB de request body do Vercel (a causa do "travamento"
 * silencioso em fatura grande: a borda rejeitava antes de invocar a função).
 *
 * O import do pdfjs-dist é dinâmico pra não entrar no bundle inicial da
 * página — só carrega quando a usuária de fato analisa uma fatura.
 */

export async function extrairTextoPdf(file: File): Promise<{ paginas: string[] }> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const paginas: string[] = []

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      // Agrupa itens por linha (coordenada Y) pra preservar a estrutura
      // tabular da fatura — sem isso, data/descrição/valor viram sopa.
      const linhas = new Map<number, { x: number; str: string }[]>()
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        const y = Math.round(item.transform[5])
        if (!linhas.has(y)) linhas.set(y, [])
        linhas.get(y)!.push({ x: item.transform[4], str: item.str })
      }
      const texto = [...linhas.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, items]) =>
          items.sort((a, b) => a.x - b.x).map((it) => it.str).join(' '),
        )
        .join('\n')
      paginas.push(texto)
    }
  } finally {
    await doc.destroy()
  }

  return { paginas }
}
