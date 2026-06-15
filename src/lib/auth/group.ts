import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getCurrentGroupId(): Promise<string> {
  const supabase = await createClient()

  // 1. Pega a sessão atual
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // 2. Busca o grupo vinculado a esse usuário
  const { data: grupo, error: grupoError } = await supabase
    .from('grupos')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (grupoError || !grupo) {
    // Se não encontrou o grupo, provavelmente é um erro de integridade do cadastro
    // Em um sistema real, poderíamos redirecionar para uma página de "Setup" da conta.
    // Para simplificar, lança o erro que será capturado pelo error.js
    throw new Error('Grupo não encontrado para este usuário. Por favor, contate o suporte.')
  }

  return grupo.id
}
