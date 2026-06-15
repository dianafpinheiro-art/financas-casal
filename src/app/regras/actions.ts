'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentGroupId } from '@/lib/auth/group'

export async function salvarRegra(payload: any) {
  try {
    const supabase = await createClient()
    const grupoId = await getCurrentGroupId()

    const dataToSave = {
      ...payload,
      grupo_id: grupoId,
      merchant: payload.merchant.toUpperCase()
    }

    if (payload.id) {
      dataToSave.ultima_atualizacao = new Date().toISOString()
      const { error } = await supabase.from('regras_aprendidas').update(dataToSave).eq('id', payload.id).eq('grupo_id', grupoId)
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
    const grupoId = await getCurrentGroupId()
    const { error } = await supabase.from('regras_aprendidas').delete().eq('id', id).eq('grupo_id', grupoId)
    
    if (error) throw error

    revalidatePath('/regras')
    return { success: true }
  } catch (err: any) {
    console.error("Erro ao deletar regra:", err)
    return { success: false, message: err.message || "Erro ao deletar regra." }
  }
}
