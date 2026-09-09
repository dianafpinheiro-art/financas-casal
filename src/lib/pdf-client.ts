'use client'

import { ordenarLinhasPdf } from './pdf-layout'

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
      const texto = ordenarLinhasPdf(
        content.items.filter(item => 'str' in item),
        page.getViewport({ scale: 1 }).width,
      )
        .map(linha => linha.items.map(item => item.str).join(' '))
        .join('\n')
      paginas.push(texto)
    }
  } finally {
    await doc.destroy()
  }

  return { paginas }
}
