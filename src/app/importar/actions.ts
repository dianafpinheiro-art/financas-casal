'use server'

import { extrairTextoPdf } from '@/lib/parser/pdf'
import { parseFaturaComClaude, ParseResult, ParsedTransaction } from '@/lib/parser/claude'
import { createClient } from '@/lib/supabase/server'

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
  const { data } = await supabase.from('cartoes').select('id, apelido').order('apelido')
  return data || []
}

export async function salvarLancamentosNoBanco(transacoes: ParsedTransaction[], cartaoId: string) {
  try {
    const supabase = await createClient()

    // Para o MVP, pega o primeiro grupo
    const { data: grupo } = await supabase.from('grupos').select('id').limit(1).single()

    if (!grupo) throw new Error("Grupo não encontrado")

    // Descobrir o dono do cartão
    const { data: cartao } = await supabase.from('cartoes').select('membro_id').eq('id', cartaoId).single()
    // Se o cartão não tiver dono atrelado, pega a Diana por default no MVP
    const pagoPorId = cartao?.membro_id || '0151cf3f-23cf-4294-9b10-2ceb90e9bf1d'

    const baseTime = Date.now()
    const payload = transacoes.map((t, index) => ({
      grupo_id: grupo.id,
      cartao_id: cartaoId,
      pago_por_id: pagoPorId,
      data_lancamento: t.data, // Preenche a data_lancamento para não dar Invalid Date!
      data_competencia: t.data, // Usa a mesma data para competência
      descricao: t.descricao,
      valor: t.valor_cents,
      parcela_atual: t.parcela_atual || null,
      parcela_total: t.parcela_total || null,
      divisao_tipo: 'nao_classificado',
      divisao_pct_diana: 50,
      classificado: false,
      criado_em: new Date(baseTime + index * 1000).toISOString()
    }))

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
