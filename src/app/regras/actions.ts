'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function salvarRegra(payload: any) {
  try {
    const supabase = await createClient()

    // Pega o primeiro grupo para o MVP
    const { data: grupo } = await supabase.from('grupos').select('id').limit(1).single()
    if (!grupo) throw new Error("Grupo não encontrado")

    const dataToSave = {
      ...payload,
      grupo_id: grupo.id,
      merchant: payload.merchant.toUpperCase()
    }

    if (payload.id) {
      dataToSave.ultima_atualizacao = new Date().toISOString()
      const { error } = await supabase.from('regras_aprendidas').update(dataToSave).eq('id', payload.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('regras_aprendidas').insert([dataToSave])
      if (error) throw error
    }

    revalidatePath('/regras')
    return { success: true }
  } catch (err: any) {
    console.error("Erro ao salvar regra:", err)
    return { success: false, message: err.message || "Erro desconhecido" }
  }
}

export async function deletarRegra(id: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('regras_aprendidas').delete().eq('id', id)
    
    if (error) throw error

    revalidatePath('/regras')
    return { success: true }
  } catch (err: any) {
    console.error("Erro ao deletar regra:", err)
    return { success: false, message: err.message || "Erro ao deletar regra." }
  }
}
