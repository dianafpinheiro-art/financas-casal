'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentGroupId } from '@/lib/auth/group'

export async function salvarGastoExtra(payload: {
  data_lancamento: string
  descricao: string
  valor_cents: number
  quem_pagou: string
  divisao_tipo: string
  divisao_pct_diana?: number
  categoria_id?: string
}) {
  try {
    const supabase = await createClient()
    const grupoId = await getCurrentGroupId()

    // Busca o ID do membro que pagou
    const { data: membro } = await supabase.from('membros').select('id').eq('apelido', payload.quem_pagou).eq('grupo_id', grupoId).single()
    if (!membro) throw new Error("Membro não encontrado")

    const insertPayload = {
      grupo_id: grupoId,
      cartao_id: null, // Extra-cartão!
      pago_por_id: membro.id, // O pagador
      data_lancamento: payload.data_lancamento,
      data_competencia: payload.data_lancamento,
      descricao: payload.descricao,
      valor: payload.valor_cents,
      divisao_tipo: payload.divisao_tipo,
      divisao_pct_diana: payload.divisao_pct_diana || 50,
      categoria_id: payload.categoria_id,
      classificado: true // Como o usuário insere manualmente e já escolhe a divisão, marcamos como classificado
    }

    const { error } = await supabase.from('lancamentos').insert([insertPayload])

    if (error) {
      console.error("Erro inserindo no Supabase:", error)
      return { success: false, message: "Erro ao salvar o gasto." }
    }

    return { success: true, message: "Gasto extra salvo com sucesso!" }
  } catch (err: any) {
    console.error("Erro no salvarGastoExtra:", err)
    return { success: false, message: err.message }
  }
}
