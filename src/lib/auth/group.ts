import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getCurrentGroupId(): Promise<string> {
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
}
