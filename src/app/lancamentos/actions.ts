'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateDivisaoLancamento(
  id: string, 
  novaDivisao: "dividir" | "so_diana" | "so_nicco" | "personalizado" | "nao_classificado",
  pctDiana?: number
) {
  const supabase = await createClient()

  let divisao_pct_diana = 50
  if (novaDivisao === 'so_diana') divisao_pct_diana = 100
  else if (novaDivisao === 'so_nicco') divisao_pct_diana = 0
  else if (novaDivisao === 'personalizado' && pctDiana !== undefined) divisao_pct_diana = pctDiana

  try {
    const { error } = await supabase
      .from('lancamentos')
      .update({ 
        divisao_tipo: novaDivisao,
        divisao_pct_diana: divisao_pct_diana,
        classificado: true // Marcamos como revisado/classificado
      })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/lancamentos')
    return { success: true }
  } catch (error: any) {
    console.error("Erro no update:", error)
    return { success: false, message: error.message || "Erro desconhecido" }
  }
}

export async function getCategorias() {
  const supabase = await createClient()
  const { data } = await supabase.from('categorias').select('id, nome').order('nome', { ascending: true })
  return data || []
}

export async function updateCategoriaLancamento(
  lancamentoId: string, 
  categoriaId: string | null
) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('lancamentos')
      .update({ categoria_id: categoriaId })
      .eq('id', lancamentoId)

    if (error) throw error

    revalidatePath('/lancamentos')
    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function updateEstabelecimentoLancamento(
  lancamentoId: string, 
  estabelecimento: string
) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('lancamentos')
      .update({ merchant: estabelecimento })
      .eq('id', lancamentoId)

    if (error) throw error

    revalidatePath('/lancamentos')
    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

export async function updateObservacaoLancamento(
  lancamentoId: string, 
  observacao: string
) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('lancamentos')
      .update({ observacao: observacao })
      .eq('id', lancamentoId)

    if (error) throw error

    revalidatePath('/lancamentos')
    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}
