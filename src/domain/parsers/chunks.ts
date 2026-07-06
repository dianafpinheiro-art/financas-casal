/**
 * Extração em CHUNKS — partes PURAS (sem SDK, testáveis).
 *
 * Fatura grande (Latam: 9 páginas, ~400 lançamentos) numa única chamada
 * Claude flerta com truncamento de max_tokens e timeout. Aqui a gente
 * fatia o texto (extraído no browser, ver lib/pdf-client.ts) em grupos de
 * páginas, monta o prompt de cada trecho e mescla as respostas.
 *
 * As páginas são DISJUNTAS entre chunks, então não há dedup no merge —
 * dedup por data+descrição+valor descartaria compras legítimas repetidas
 * (dois Ubers iguais no mesmo dia). Se algo duplicar, o sanity check do
 * total acusa.
 */
import { type GenericoResposta } from './generico'

/** Páginas de fatura por chamada ao Claude. */
export const PAGINAS_POR_CHUNK = 2

/** Junta as páginas em grupos de `porChunk`, preservando a ordem. */
export function montarChunks(
  paginas: string[],
  porChunk: number = PAGINAS_POR_CHUNK,
): string[] {
  const chunks: string[] = []
  for (let i = 0; i < paginas.length; i += porChunk) {
    chunks.push(paginas.slice(i, i + porChunk).join('\n\n'))
  }
  return chunks
}

/**
 * Prompt de um trecho: o prompt base do parser (ELO ou genérico) + o aviso
 * de que o modelo está vendo só uma FATIA da fatura. Sem isso, o prompt base
 * ("leia a fatura inteira", "totalDeclarado é obrigatório") induz o modelo a
 * inventar total ou reclamar de fatura incompleta.
 */
export function promptTrecho(
  basePrompt: string,
  indice: number,
  total: number,
): string {
  return `${basePrompt}

ATENÇÃO — VOCÊ ESTÁ VENDO APENAS UM TRECHO DA FATURA (parte ${indice + 1} de ${total}):
- Extraia SOMENTE os lançamentos visíveis neste trecho. As demais partes serão processadas separadamente — não se preocupe com o que falta.
- "totalDeclarado": preencha apenas se o "Total desta fatura" aparecer NESTE trecho; caso contrário devolva null. NUNCA calcule ou invente o total.
- Um quadro de lançamentos pode ter começado numa página anterior: linhas com data + descrição + valor SEM cabeçalho de quadro ainda são lançamentos — extraia.`
}

/**
 * Mescla as respostas dos chunks: lançamentos concatenados na ordem das
 * páginas; totalDeclarado é o primeiro não-null (o total aparece uma vez só
 * na fatura, em geral na primeira página).
 */
export function mesclarRespostas(respostas: GenericoResposta[]): GenericoResposta {
  return {
    totalDeclarado: respostas.find((r) => r.totalDeclarado != null)?.totalDeclarado ?? null,
    lancamentos: respostas.flatMap((r) => r.lancamentos),
  }
}
