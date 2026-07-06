/**
 * POST /api/parse-fatura
 *
 * Caminho principal (JSON): o browser extrai o TEXTO do PDF com pdf.js
 * (lib/pdf-client.ts) e manda { paginas, tipo, mes_referencia } — o PDF
 * nunca sobe. Necessário porque o Vercel rejeita request body > 4,5 MB na
 * BORDA (sem log de função), o que "travava" fatura grande (Latam), e a
 * Server Action antiga ainda tinha o teto de 1 MB. O texto é processado em
 * CHUNKS PARALELOS de 2 páginas (domain/parsers/chunks.ts), o que também
 * elimina truncamento de max_tokens e timeout em fatura com ~400 lançamentos.
 *
 * Fallback (multipart): PDF escaneado (sem camada de texto) pequeno ainda
 * vai inteiro pro Claude ler nativamente.
 *
 * A extração usa structured outputs (Zod) — nada de JSON.parse na mão — e
 * roda o sanity check: soma dos lançamentos vs total declarado na fatura.
 * Devolve o ParseResult que a tela /importar já consome; as datas saem em
 * YYYY-MM-DD resolvidas com o mês de referência (dataCompraDaFatura infere
 * o ano, ex.: compra de dezembro numa fatura de janeiro).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extrairFaturaPDF, extrairFaturaTexto } from '@/lib/anthropic'
import { PROMPT_ELO } from '@/domain/parsers/elo'
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
import { dataCompraDaFatura } from '@/domain/lancamento'
import { type ParseResult } from '@/lib/parser/types'

export const runtime = 'nodejs'
// Fatura grande: os chunks rodam em paralelo, mas o mais lento leva ~2 min
// (Opus). 300s é o teto com Fluid Compute (padrão nos projetos novos).
export const maxDuration = 300

type Tipo = 'generico' | 'elo_ourocard'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Lê o body. Principal: JSON com o texto extraído no browser.
  // Fallback: multipart com o PDF inteiro (só escaneado pequeno).
  let tipo: Tipo
  let mesReferencia: string
  let paginas: string[] | null = null
  let pdfBase64: string | null = null

  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    const body = (await req.json()) as {
      paginas?: unknown
      tipo?: unknown
      mes_referencia?: unknown
    }
    if (
      !Array.isArray(body.paginas) ||
      body.paginas.length === 0 ||
      !body.paginas.every((p): p is string => typeof p === 'string') ||
      body.paginas.join('').trim() === ''
    ) {
      return NextResponse.json(
        { error: 'paginas ausente ou vazio (array de strings com o texto do PDF)' },
        { status: 400 },
      )
    }
    if (body.tipo !== 'generico' && body.tipo !== 'elo_ourocard') {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }
    if (typeof body.mes_referencia !== 'string' || !/^\d{4}-\d{2}$/.test(body.mes_referencia)) {
      return NextResponse.json({ error: 'mes_referencia inválido (YYYY-MM)' }, { status: 400 })
    }
    paginas = body.paginas
    tipo = body.tipo
    mesReferencia = body.mes_referencia
  } else {
    const form = await req.formData()
    const file = form.get('file')
    const tipoForm = form.get('tipo')
    const mesForm = form.get('mes_referencia')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'PDF ausente (campo "file")' }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'O arquivo precisa ser PDF' }, { status: 400 })
    }
    if (tipoForm !== 'generico' && tipoForm !== 'elo_ourocard') {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }
    if (typeof mesForm !== 'string' || !/^\d{4}-\d{2}$/.test(mesForm)) {
      return NextResponse.json({ error: 'mes_referencia inválido (YYYY-MM)' }, { status: 400 })
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
    tipo = tipoForm
    mesReferencia = mesForm
    pdfBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  }

  const base = tipo === 'elo_ourocard' ? PROMPT_ELO : PROMPT_GENERICO

  // Extração: chunks paralelos (texto) ou PDF inteiro (fallback). O schema é
  // sempre o genérico — totalDeclarado nullable é necessário em chunks (só um
  // trecho da fatura tem o total) e não atrapalha o caminho PDF.
  let resultado: ReturnType<typeof mapRespostaGenerico>
  try {
    if (paginas != null) {
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
      resultado = mapRespostaGenerico(mesclarRespostas(respostas))
    } else {
      const r = await extrairFaturaPDF({
        pdfBase64: pdfBase64!,
        instrucoes: base,
        schema: genericoRespostaSchema,
      })
      resultado = mapRespostaGenerico(r)
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao ler a fatura: ${(e as Error).message}` },
      { status: 502 },
    )
  }

  const sanity = sanityCheckGenerico(resultado)

  // Converte pro shape que a tela e o salvar já usam (datas em YYYY-MM-DD,
  // ano inferido a partir do mês de referência da fatura).
  const [refAno, refMes] = mesReferencia.split('-').map(Number)
  let resposta: ParseResult
  try {
    resposta = {
      transacoes: resultado.lancamentos.map((l) => ({
        data: dataCompraDaFatura(l.data, refAno, refMes).toISOString().slice(0, 10),
        descricao: l.descricao,
        valor_cents: l.valorCentavos,
        moeda: 'BRL',
        parcela_atual: l.parcelaAtual,
        parcela_total: l.parcelaTotal,
      })),
      total_fatura_cents: sanity.totalDeclaradoCentavos,
      sanity_ok: sanity.ok,
      sem_total: sanity.semTotal,
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Data inválida em algum lançamento: ${(e as Error).message}` },
      { status: 422 },
    )
  }

  return NextResponse.json(resposta)
}
