'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function salvarCartao(payload: any) {
  try {
    const supabase = await createClient()

    // Pega o primeiro grupo para o MVP
    const { data: grupo } = await supabase.from('grupos').select('id').limit(1).single()
    if (!grupo) throw new Error("Grupo não encontrado")

    const dataToSave = {
      ...payload,
      grupo_id: grupo.id
    }

    if (payload.id) {
      const { error } = await supabase.from('cartoes').update(dataToSave).eq('id', payload.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('cartoes').insert([dataToSave])
      if (error) throw error
    }

    revalidatePath('/cartoes')
    return { success: true }
  } catch (err: any) {
    console.error("Erro ao salvar cartao:", err)
    return { success: false, message: err.message || "Erro desconhecido" }
  }
}

export async function deletarCartao(id: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('cartoes').delete().eq('id', id)
    
    if (error) throw error

    revalidatePath('/cartoes')
    return { success: true }
  } catch (err: any) {
    console.error("Erro ao deletar cartao:", err)
    return { success: false, message: err.message || "Erro desconhecido" }
  }
}
