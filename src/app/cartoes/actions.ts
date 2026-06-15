'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentGroupId } from '@/lib/auth/group'

export async function salvarCartao(payload: any) {
  try {
    const supabase = await createClient()
    const grupoId = await getCurrentGroupId()

    const dataToSave = {
      ...payload,
      grupo_id: grupoId
    }

    if (payload.id) {
      const { error } = await supabase.from('cartoes').update(dataToSave).eq('id', payload.id).eq('grupo_id', grupoId)
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
    const grupoId = await getCurrentGroupId()
    const { error } = await supabase.from('cartoes').delete().eq('id', id).eq('grupo_id', grupoId)
    
    if (error) throw error

    revalidatePath('/cartoes')
    return { success: true }
  } catch (err: any) {
    console.error("Erro ao deletar cartao:", err)
    return { success: false, message: err.message || "Erro desconhecido" }
  }
}
