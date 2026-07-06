import { createClient } from '@/lib/supabase/server'
import AjustesClient, { type CartaoRow, type MembroOpcao } from './ajustes-client'

export default async function AjustesPage() {
  const supabase = await createClient()

  const { data: membros } = await supabase
    .from('membros')
    .select('id, apelido')
    .order('apelido')
  const opcoesMembro: MembroOpcao[] = (membros ?? []).map((m) => ({
    id: m.id,
    apelido: m.apelido,
  }))
  const apelidoPorMembro = new Map(opcoesMembro.map((m) => [m.id, m.apelido]))

  const { data: cartoesRows } = await supabase
    .from('cartoes')
    .select(
      'id, apelido, banco, bandeira, ultimos_digitos, dia_fechamento, dia_vencimento, membro_id',
    )
    .eq('ativo', true)
    .order('apelido')

  const cartoes: CartaoRow[] = (cartoesRows ?? []).map((c) => ({
    id: c.id,
    apelido: c.apelido,
    banco: c.banco ?? '',
    bandeira: c.bandeira ?? '',
    ultimosDigitos: c.ultimos_digitos ?? '',
    diaFechamento: c.dia_fechamento ?? null,
    diaVencimento: c.dia_vencimento ?? null,
    membroId: c.membro_id,
    dono: apelidoPorMembro.get(c.membro_id) ?? '?',
  }))

  return <AjustesClient cartoes={cartoes} membros={opcoesMembro} />
}
