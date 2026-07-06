/**
 * POST /api/parse-fatura
 *
 * Caminho principal (JSON): o browser extrai o TEXTO do PDF com pdf.js
 * (lib/pdf-client.ts) e manda { cartao_id, paginas } — o PDF nunca sobe.
 * Necessário porque o Vercel rejeita request body > 4,5 MB na BORDA (sem
 * log de função), o que "travava" fatura grande (Latam 5,7 MB). O texto é
 * processado em chunks paralelos de 2 páginas (domain/parsers/chunks.ts),
 * o que também elimina truncamento de max_tokens e timeout em fatura com
 * ~400 lançamentos.
 *
 * Fallback (multipart): PDF escaneado (sem camada de texto) pequeno ainda
 * vai inteiro pro Claude ler nativamente.
 *
 * Em ambos, valida com Zod (structured output), roda o sanity check do
 * total e devolve os lançamentos JÁ pré-classificados pelas regras
 * aprendidas do grupo. NÃO salva nada no banco — a tela /importar mostra o
 * preview e o "salvar todos" persiste.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extrairFaturaPDF, extrairFaturaTexto } from '@/lib/anthropic'
import {
  PROMPT_ELO,
  eloRespostaSchema,
  mapRespostaElo,
  sanityCheckTotal,
} from '@/domain/parsers/elo'
import {
  PROMPT_GENERICO,
  genericoRespostaSchema,
  mapRespostaGenerico,
  sanityCheckGenerico,
} from '@/domain/parsers/generico'
import {
  montarChunks,
  promptTrecho,
  mesclarRespostas,
} from '@/domain/parsers/chunks'
import { type LancamentoExtraido } from '@/domain/parsers/types'
import { escolherParser } from '@/domain/parsers/roteador'
import { encontrarRegra } from '@/domain/regras'
import { normalizarDescricao, extrairMerchant, type DivisaoTipo } from '@/domain/lancamento'
import { propagarEncargos } from '@/domain/encargos'

// Roda em Node (precisa de Buffer e do SDK); janela maior pra leitura do PDF.
// 300s é o teto do Vercel Pro — fatura grande (Latam ~300 lançamentos) com
// max_tokens=32000 pode levar 2-3 min de geração.
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // 1. Autenticação (RLS depende do usuário logado).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // 2. Lê o body. Caminho principal: JSON { cartao_id, paginas } com o texto
  //    já extraído no browser. Fallback: multipart com o PDF (só escaneado).
  let cartaoId: string
  let paginas: string[] | null = null
  let pdfBase64: string | null = null

  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    const body = (await req.json()) as { cartao_id?: unknown; paginas?: unknown }
    if (typeof body.cartao_id !== 'string' || body.cartao_id === '') {
      return NextResponse.json({ error: 'cartao_id ausente' }, { status: 400 })
    }
    if (
      !Array.isArray(body.paginas) ||
      body.paginas.length === 0 ||
      !body.paginas.every((p): p is string => typeof p === 'string') ||
      body.paginas.join('').trim() === ''
    ) {
      return NextResponse.json(
        { error: 'paginas ausente ou vazio (esperado: array de strings com o texto do PDF)' },
        { status: 400 },
      )
    }
    cartaoId = body.cartao_id
    paginas = body.paginas
  } else {
    const form = await req.formData()
    const file = form.get('file')
    const cartaoIdForm = form.get('cartao_id')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'PDF ausente (campo "file")' }, { status: 400 })
    }
    if (typeof cartaoIdForm !== 'string' || cartaoIdForm === '') {
      return NextResponse.json({ error: 'cartao_id ausente' }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'O arquivo precisa ser PDF' }, { status: 400 })
    }
    // O Vercel corta request body > 4,5 MB na borda — em produção nem
    // chegaríamos aqui. A guarda vale pro dev local e dá erro legível.
    if (file.size > 4.5 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            'PDF grande demais pra subir inteiro (limite 4,5 MB). Se a fatura tiver texto, a tela extrai no navegador; se for escaneada, exporta o PDF nativo no app do banco.',
        },
        { status: 413 },
      )
    }
    cartaoId = cartaoIdForm
    pdfBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  }

  // 3. Escolhe o parser pelo cartão. O ELO só vale pro layout Ourocard ELO do
  //    Banco do Brasil; todo o resto (inclusive Smiles Infinite, que é BB mas
  //    Visa) usa o genérico. Ver domain/parsers/roteador.ts.
  const { data: cartao } = await supabase
    .from('cartoes')
    .select('banco, bandeira, apelido')
    .eq('id', cartaoId)
    .maybeSingle()
  const ehELO = escolherParser(cartao ?? {}) === 'elo'

  // 4. Claude lê a fatura + mapeia pra centavos + sanity check do total.
  let lancamentosBrutos: LancamentoExtraido[]
  let totalDeclaradoCentavos: number
  let sanity: {
    ok: boolean
    somaCentavos: number
    totalDeclaradoCentavos: number
    difCentavos: number
    semTotal?: boolean
  }
  try {
    if (paginas != null) {
      // Caminho texto: chunks de 2 páginas em paralelo. O prompt base segue
      // o parser do cartão, mas schema/map/sanity são sempre os do genérico —
      // em chunks o totalDeclarado precisa ser nullable (só um trecho o tem).
      const base = ehELO ? PROMPT_ELO : PROMPT_GENERICO
      const chunks = montarChunks(paginas)
      const respostas = await Promise.all(
        chunks.map((chunk, i) =>
          extrairFaturaTexto({
            texto: chunk,
            instrucoes: promptTrecho(base, i, chunks.length),
            schema: genericoRespostaSchema,
          }),
        ),
      )
      const resultado = mapRespostaGenerico(mesclarRespostas(respostas))
      lancamentosBrutos = resultado.lancamentos
      sanity = sanityCheckGenerico(resultado)
      totalDeclaradoCentavos = sanity.totalDeclaradoCentavos
    } else if (ehELO) {
      const r = await extrairFaturaPDF({
        pdfBase64: pdfBase64!,
        instrucoes: PROMPT_ELO,
        schema: eloRespostaSchema,
      })
      const resultado = mapRespostaElo(r)
      lancamentosBrutos = resultado.lancamentos
      sanity = sanityCheckTotal(resultado)
      totalDeclaradoCentavos = sanity.totalDeclaradoCentavos
    } else {
      const r = await extrairFaturaPDF({
        pdfBase64: pdfBase64!,
        instrucoes: PROMPT_GENERICO,
        schema: genericoRespostaSchema,
      })
      const resultado = mapRespostaGenerico(r)
      lancamentosBrutos = resultado.lancamentos
      sanity = sanityCheckGenerico(resultado)
      totalDeclaradoCentavos = sanity.totalDeclaradoCentavos
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao ler a fatura: ${(e as Error).message}` },
      { status: 502 },
    )
  }

  // 5. Regras aprendidas do grupo (RLS já filtra pelo grupo do usuário).
  const { data: regrasRows } = await supabase
    .from('regras_aprendidas')
    .select('merchant, divisao_tipo, divisao_pct_diana, categoria_id, vezes_confirmada')
    .eq('ativa', true)

  const regras = (regrasRows ?? []).map((r) => ({
    merchant: r.merchant as string | null,
    divisaoTipo: r.divisao_tipo as DivisaoTipo | null,
    divisaoPctDiana: r.divisao_pct_diana as number | null,
    categoriaId: r.categoria_id as string | null,
    vezesConfirmada: (r.vezes_confirmada as number | null) ?? 0,
  }))

  // 6. Pré-classifica: aplica a regra do merchant (toda regra vem de uma
  //    classificação humana — seed de Maio ou ação no /lancamentos/manual —
  //    então 1 confirmação já basta pra auto-aplicar na próxima fatura).
  const lancamentosBase = lancamentosBrutos.map((l) => ({
    data: l.data,
    descricao: l.descricao,
    descricaoNormalizada: normalizarDescricao(l.descricao),
    merchant: extrairMerchant(l.descricao),
    valorCentavos: l.valorCentavos,
    parcelaAtual: l.parcelaAtual,
    parcelaTotal: l.parcelaTotal,
    cartaoId,
    divisaoTipo: (null as DivisaoTipo | null),
    divisaoPctDiana: (null as number | null),
    categoriaId: (null as string | null),
    classificado: false,
    tags: (null as string[] | null),
    observacao: (null as string | null),
  }))
  for (const lanc of lancamentosBase) {
    const regra = encontrarRegra(lanc.descricao, regras)
    if (regra != null && regra.vezesConfirmada >= 1) {
      lanc.divisaoTipo = regra.divisaoTipo
      lanc.divisaoPctDiana = regra.divisaoPctDiana
      lanc.categoriaId = regra.categoriaId
      lanc.classificado = true
    }
  }

  // 7. Propaga encargos (juros/IOF/...) a partir do principal mais próximo.
  //    Pré-preenche a divisão mas deixa classificado=false (Diana confirma).
  const lancamentos = propagarEncargos(lancamentosBase)

  return NextResponse.json({
    status: sanity.ok ? 'ok' : 'precisa_revisao',
    sanity,
    totalDeclaradoCentavos,
    lancamentos,
  })
}
