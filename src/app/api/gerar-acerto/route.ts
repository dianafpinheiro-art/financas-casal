/**
 * GET /api/gerar-acerto?mes=YYYY-MM
 *
 * Gera o .docx do acerto no formato do transferencia_nicco_maio2026.docx
 * (tom íntimo). Cálculo + agrupamento por cartão em carregarDadosDocx; o
 * layout em lib/acerto-docx.js (compartilhado com o script de preview).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { carregarDadosDocx } from '@/lib/acerto'
// builder em .js (CommonJS) — uma fonte de verdade pro layout (rota + preview).
// Devolve o buffer pronto pra o tipo Document não cruzar a fronteira TS/JS.
import { gerarBufferAcerto } from '@/lib/acerto-docx'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const mesParam = new URL(req.url).searchParams.get('mes') ?? undefined
  const { mes, dados } = await carregarDadosDocx(mesParam)
  if (!dados) {
    return NextResponse.json({ error: 'Sem lançamentos nesse mês.' }, { status: 400 })
  }

  const buffer = await gerarBufferAcerto(dados)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="acerto-${mes}.docx"`,
    },
  })
}
