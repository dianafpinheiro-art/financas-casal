import { createClient } from '@/lib/supabase/server'
import ImportarClient from './importar-client'
import { type CartaoOption } from './tipos'

// Server Component: busca os cartões do grupo (RLS) e entrega pro client island.
export default async function ImportarPage() {
  const supabase = await createClient()

  const { data: cartoesRows } = await supabase
    .from('cartoes')
    .select('id, apelido, membro:membros(apelido)')
    .eq('ativo', true)
    .order('apelido')

  const cartoes: CartaoOption[] = (cartoesRows ?? []).map((c) => {
    const membro = Array.isArray(c.membro) ? c.membro[0] : c.membro
    return { id: c.id, apelido: c.apelido, dono: membro?.apelido ?? '' }
  })

  return <ImportarClient cartoes={cartoes} />
}
