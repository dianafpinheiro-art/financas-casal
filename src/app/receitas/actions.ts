'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentGroupId } from '@/lib/auth/group'

export async function salvarReceita(payload: {
  membro_id: string
  fonte: string
  valor_cents: number
  data_competencia: string
}) {
  try {
    const supabase = await createClient()
    const grupoId = await getCurrentGroupId()

    const { error } = await supabase.from('receitas').insert([{
      grupo_id: grupoId,
      membro_id: payload.membro_id,
      fonte: payload.fonte,
      valor: payload.valor_cents,
      data_competencia: payload.data_competencia
    }])

    if (error) throw error

    revalidatePath('/receitas')
    revalidatePath('/') // Dashboard
    return { success: true, message: "Receita adicionada!" }
  } catch (err: any) {
    console.error("Erro ao salvar receita:", err)
    return { success: false, message: err.message || "Erro desconhecido" }
  }
}

export async function deletarReceita(id: string) {
  try {
    const supabase = await createClient()
    const grupoId = await getCurrentGroupId()
    const { error } = await supabase.from('receitas').delete().eq('id', id).eq('grupo_id', grupoId)
    
    if (error) throw error

    revalidatePath('/receitas')
    revalidatePath('/')
    return { success: true }
  } catch (err: any) {
    console.error("Erro ao deletar receita:", err)
    return { success: false, message: err.message || "Erro desconhecido" }
  }
}
