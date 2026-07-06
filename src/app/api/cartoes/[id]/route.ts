/**
 * PATCH  /api/cartoes/[id] — edita um cartão (RLS garante que é do grupo).
 * DELETE /api/cartoes/[id] — soft delete (ativo=false), preserva histórico.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cartaoSchema } from '../schema'

export const runtime = 'nodejs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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

  const { data: dono } = await supabase
    .from('membros')
    .select('id')
    .eq('id', c.membro_id)
    .eq('grupo_id', meuMembro.grupo_id)
    .maybeSingle()
  if (!dono) return NextResponse.json({ error: 'Dono não é do grupo' }, { status: 400 })

  const { error } = await supabase
    .from('cartoes')
    .update({
      membro_id: c.membro_id,
      apelido: c.apelido,
      banco: c.banco,
      bandeira: c.bandeira,
      ultimos_digitos: c.ultimos_digitos,
      dia_fechamento: c.dia_fechamento ?? null,
      dia_vencimento: c.dia_vencimento ?? null,
    })
    .eq('id', id) // RLS restringe ao grupo do usuário
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Soft delete: não apaga (preserva os lançamentos vinculados).
  const { error } = await supabase
    .from('cartoes')
    .update({ ativo: false })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
