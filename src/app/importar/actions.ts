'use server'

// O parse do PDF saiu daqui: Server Action tem teto de 1 MB de body (e o
// Vercel corta 4,5 MB na borda), o que travava fatura grande. Agora o texto
// é extraído no BROWSER (lib/pdf-client.ts) e vai pra /api/parse-fatura,
// que extrai em chunks paralelos com structured outputs.

import { ParsedTransaction } from '@/lib/parser/types'
import { createClient } from '@/lib/supabase/server'
import { getCurrentGroupId } from '@/lib/auth/group'
import { mesValido, conferirImportacao } from '@/domain/importacao'
import { revalidatePath } from 'next/cache'

export async function getCartoes() {
  const supabase = await createClient()
  const grupoId = await getCurrentGroupId()
  const { data } = await supabase.from('cartoes').select('id, apelido').eq('grupo_id', grupoId).order('apelido')
  return data || []
}

export async function salvarLancamentosNoBanco(transacoes: ParsedTransaction[], cartaoId: string, mesReferencia: string, conferencia: { total: number; semTotal: boolean; revisado: boolean; arquivoNome: string }) {
  try {
    const supabase = await createClient()
    const grupoId = await getCurrentGroupId()

    if (!mesValido(mesReferencia)) {
      return { success: false, message: 'Mês da fatura inválido.' }
    }

    const dataCompetencia = `${mesReferencia}-01`
    const check = conferirImportacao(transacoes, conferencia.total, conferencia.semTotal)
    if (check.precisaRevisao && !conferencia.revisado) {
      return { success: false, message: 'Confira a divergência dos valores antes de salvar.' }
    }

    // Descobrir o dono do cartão
    const { data: cartao } = await supabase.from('cartoes').select('membro_id').eq('id', cartaoId).eq('grupo_id', grupoId).single()
    if (!cartao) return { success: false, message: 'Cartão inválido para este grupo.' }
    
    // Se o cartão não tiver dono atrelado, precisamos pegar o admin (membro 1) do grupo como fallback
    let pagoPorId = cartao?.membro_id
    if (!pagoPorId) {
      const { data: admin } = await supabase.from('membros').select('id').eq('grupo_id', grupoId).order('papel', { ascending: true }).limit(1).single()
      pagoPorId = admin?.id
    }

    // Pega todas as regras da IA cadastradas
    const { data: regras } = await supabase.from('regras_aprendidas').select('*').eq('grupo_id', grupoId)
    const regrasAtivas = regras || []

    const baseTime = Date.now()
    const payload = transacoes.map((t, index) => {
      // Tenta encontrar uma regra que bata com a descrição
      const regraEncontrada = regrasAtivas.find(r => 
        t.descricao.toUpperCase().includes(r.merchant.toUpperCase())
      )

      let divisaoTipo = 'nao_classificado'
      let divisaoPct = 50
      let classificado = false
      let categoriaId = null

      if (regraEncontrada) {
        divisaoTipo = regraEncontrada.divisao_tipo
        divisaoPct = regraEncontrada.divisao_pct_diana
        categoriaId = regraEncontrada.categoria_id
        classificado = true // Já cai classificado automaticamente!
      }

      return {
        grupo_id: grupoId,
        cartao_id: cartaoId,
        pago_por_id: pagoPorId,
        data_lancamento: t.data,
        data_competencia: dataCompetencia,
        descricao: t.descricao,
        valor: t.valor_cents,
        parcela_atual: t.parcela_atual || null,
        parcela_total: t.parcela_total || null,
        divisao_tipo: divisaoTipo,
        divisao_pct_diana: divisaoPct,
        categoria_id: categoriaId,
        classificado: classificado,
        observacao: `Fatura: ${conferencia.arquivoNome}; mês: ${mesReferencia}${check.precisaRevisao ? '; divergência de valores aceita para revisão' : ''}`,
        criado_em: new Date(baseTime + index * 1000).toISOString()
      }
    })

    const { error } = await supabase.from('lancamentos').insert(payload)

    if (error) {
      console.error("Erro inserindo no Supabase:", error)
      return { success: false, message: "Erro ao salvar no banco." }
    }

    revalidatePath('/')
    revalidatePath('/lancamentos')
    return { success: true, message: `${transacoes.length} lançamentos salvos em ${mesReferencia}!` }
  } catch (err: any) {
    console.error("Erro no salvarLancamentosNoBanco:", err)
    return { success: false, message: err.message }
  }
}
