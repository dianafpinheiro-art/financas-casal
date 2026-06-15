'use server'

import { extrairTextoPdf } from '@/lib/parser/pdf'
import { parseFaturaComClaude, ParseResult, ParsedTransaction } from '@/lib/parser/claude'
import { createClient } from '@/lib/supabase/server'
import { getCurrentGroupId } from '@/lib/auth/group'

export async function processarUploadPdf(formData: FormData): Promise<{ success: boolean, message: string, data?: ParseResult }> {
  try {
    const file = formData.get('file') as File
    const tipo = formData.get('tipo') as 'generico' | 'elo_ourocard'

    if (!file) {
      return { success: false, message: 'Nenhum arquivo enviado.' }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 1. Converte o PDF para Base64 diretamente (ignorando bibliotecas externas)
    const base64Pdf = buffer.toString('base64')

    // 2. Envia para o Claude interpretar e extrair de forma nativa (Multimodal PDF)
    const resultado = await parseFaturaComClaude(base64Pdf, tipo)

    // 3. Verifica o Sanity Check
    if (!resultado.sanity_ok) {
      console.warn("SANITY CHECK FALHOU:", resultado)
      // Podemos escolher bloquear ou apenas avisar. Neste caso, retornamos o aviso.
    }

    // Nota: Aqui na Fase 4 faríamos o INSERT na tabela "fontes_importacao" e "lancamentos" no Supabase
    // Por enquanto, apenas retornamos os dados processados para a interface revisar.

    return { 
      success: true, 
      message: 'Fatura lida com sucesso!', 
      data: resultado 
    }

  } catch (error: any) {
    console.error('Erro no processamento do PDF:', error)
    return { success: false, message: error.message || 'Erro desconhecido ao processar fatura.' }
  }
}

export async function getCartoes() {
  const supabase = await createClient()
  const grupoId = await getCurrentGroupId()
  const { data } = await supabase.from('cartoes').select('id, apelido').eq('grupo_id', grupoId).order('apelido')
  return data || []
}

export async function salvarLancamentosNoBanco(transacoes: ParsedTransaction[], cartaoId: string) {
  try {
    const supabase = await createClient()
    const grupoId = await getCurrentGroupId()

    // Descobrir o dono do cartão
    const { data: cartao } = await supabase.from('cartoes').select('membro_id').eq('id', cartaoId).eq('grupo_id', grupoId).single()
    
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
        data_competencia: t.data,
        descricao: t.descricao,
        valor: t.valor_cents,
        parcela_atual: t.parcela_atual || null,
        parcela_total: t.parcela_total || null,
        divisao_tipo: divisaoTipo,
        divisao_pct_diana: divisaoPct,
        categoria_id: categoriaId,
        classificado: classificado,
        criado_em: new Date(baseTime + index * 1000).toISOString()
      }
    })

    const { error } = await supabase.from('lancamentos').insert(payload)

    if (error) {
      console.error("Erro inserindo no Supabase:", error)
      return { success: false, message: "Erro ao salvar no banco." }
    }

    return { success: true, message: `${transacoes.length} lançamentos salvos com sucesso!` }
  } catch (err: any) {
    console.error("Erro no salvarLancamentosNoBanco:", err)
    return { success: false, message: err.message }
  }
}
