/**
 * POST /api/cartoes — cria um cartão no grupo do usuário logado.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cartaoSchema } from './schema'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: meuMembro } = await supabase
    .from('membros')
    .select('grupo_id')
    .eq('user_id', user.id)
    .single()
  if (!meuMembro) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 403 })

  const parsed = cartaoSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  const c = parsed.data

  // O dono precisa ser um membro do mesmo grupo.
  const { data: dono } = await supabase
    .from('membros')
    .select('id')
    .eq('id', c.membro_id)
    .eq('grupo_id', meuMembro.grupo_id)
    .maybeSingle()
  if (!dono) return NextResponse.json({ error: 'Dono não é do grupo' }, { status: 400 })

  const { data: novo, error } = await supabase
    .from('cartoes')
    .insert({
      grupo_id: meuMembro.grupo_id,
      membro_id: c.membro_id,
      apelido: c.apelido,
      banco: c.banco,
      bandeira: c.bandeira,
      ultimos_digitos: c.ultimos_digitos,
      dia_fechamento: c.dia_fechamento ?? null,
      dia_vencimento: c.dia_vencimento ?? null,
      ativo: true,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: novo.id })
}
