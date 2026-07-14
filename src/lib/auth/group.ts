import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// cache() deduplica a busca dentro da mesma request: várias funções chamam
// getCurrentGroupId no mesmo render e antes cada uma disparava 2 queries.
export const getCurrentGroupId = cache(async (): Promise<string> => {
  const supabase = await createClient()

  // 1. Pega a sessão atual
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // 2. Busca o grupo vinculado a esse usuário via tabela membros
  const { data: membro, error: membroError } = await supabase
    .from('membros')
    .select('grupo_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (membroError || !membro) {
    throw new Error('Grupo não encontrado para este usuário. Por favor, contate o suporte.')
  }

  return membro.grupo_id
})
