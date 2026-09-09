'use server'

// O parse do PDF saiu daqui: Server Action tem teto de 1 MB de body (e o
// Vercel corta 4,5 MB na borda), o que travava fatura grande. Agora o texto
// é extraído no BROWSER (lib/pdf-client.ts) e vai pra /api/parse-fatura,
// que extrai em chunks paralelos com structured outputs.

import { ParsedTransaction } from '@/lib/parser/types'
import { normalizarDescricao } from '@/domain/lancamento'
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
  } catch (err: unknown) {
    console.error("Erro no salvarLancamentosNoBanco:", err)
    return { success: false, message: err instanceof Error ? err.message : "Erro desconhecido" }
  }
}

type LinhaExistente = {
  id: string
  data_lancamento: string | null
  descricao: string | null
  merchant: string | null
  valor: number
  parcela_atual: number | null
  parcela_total: number | null
}

function pontuarDescricao(transacao: ParsedTransaction, linha: LinhaExistente) {
  const origem = normalizarDescricao(transacao.descricao)
  const destino = normalizarDescricao(`${linha.descricao || ''} ${linha.merchant || ''}`)
  if (origem === destino) return 10_000
  if (origem && destino && (origem.includes(destino) || destino.includes(origem))) return 5_000
  const palavras = new Set(origem.split(' ').filter((palavra) => palavra.length > 1))
  return destino.split(' ').reduce((pontos, palavra) => pontos + (palavras.has(palavra) ? 1 : 0), 0)
}

function conciliar(transacoes: ParsedTransaction[], existentes: LinhaExistente[]) {
  const disponiveis = [...existentes]
  const pares: Array<{ transacao: ParsedTransaction; linha: LinhaExistente }> = []
  const ausentes: ParsedTransaction[] = []

  for (const transacao of transacoes) {
    let candidatos = disponiveis
      .map((linha, indice) => ({ linha, indice }))
      .filter(({ linha }) =>
        linha.data_lancamento?.slice(0, 10) === transacao.data.slice(0, 10) &&
        linha.valor === transacao.valor_cents
      )
      .sort((a, b) => pontuarDescricao(transacao, b.linha) - pontuarDescricao(transacao, a.linha))

    // Importações antigas às vezes ficaram com o dia/ano interpretado de outro
    // jeito pelo PDF. Quando data+valor não encontram nada, aceitamos o mesmo
    // valor apenas se a descrição for essencialmente a mesma. Isso preserva a
    // classificação já conferida sem transformar uma diferença de data em uma
    // falsa despesa ausente.
    if (!candidatos.length) {
      candidatos = disponiveis
        .map((linha, indice) => ({ linha, indice }))
        .filter(({ linha }) => linha.valor === transacao.valor_cents)
        .filter(({ linha }) => pontuarDescricao(transacao, linha) >= 5_000)
        .sort((a, b) => pontuarDescricao(transacao, b.linha) - pontuarDescricao(transacao, a.linha))
    }

    if (!candidatos.length) {
      ausentes.push(transacao)
      continue
    }

    const escolhido = candidatos[0]
    pares.push({ transacao, linha: escolhido.linha })
    disponiveis.splice(escolhido.indice, 1)
  }

  return { pares, ausentes, extras: disponiveis }
}

export async function reconciliarFaturaExistente(
  transacoes: ParsedTransaction[],
  cartaoId: string,
  mesReferencia: string,
  arquivoNome: string,
  aplicar: boolean,
) {
  try {
    const supabase = await createClient()
    const grupoId = await getCurrentGroupId()
    if (!mesValido(mesReferencia) || !transacoes.length) {
      return { success: false, message: 'Fatura ou mês inválido.', encontrados: 0, ausentes: [], extras: 0 }
    }

    const { data: cartao, error: erroCartao } = await supabase
      .from('cartoes')
      .select('id, membro_id, apelido')
      .eq('id', cartaoId)
      .eq('grupo_id', grupoId)
      .single()
    if (erroCartao || !cartao) {
      return { success: false, message: 'Cartão inválido para este grupo.', encontrados: 0, ausentes: [], extras: 0 }
    }

    const [ano, mes] = mesReferencia.split('-').map(Number)
    const proximaCompetencia = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10)
    const competencia = `${mesReferencia}-01`
    const { data, error } = await supabase
      .from('lancamentos')
      .select('id, data_lancamento, descricao, merchant, valor, parcela_atual, parcela_total')
      .eq('grupo_id', grupoId)
      .eq('cartao_id', cartaoId)
      .gte('data_competencia', competencia)
      .lt('data_competencia', proximaCompetencia)
    if (error) throw error

    const resultado = conciliar(transacoes, (data || []) as LinhaExistente[])
    if (!aplicar) {
      return {
        success: true,
        message: `${resultado.pares.length} lançamento(s) encontrados; ${resultado.ausentes.length} ausente(s); ${resultado.extras.length} extra(s) no app.`,
        encontrados: resultado.pares.length,
        ausentes: resultado.ausentes,
        extras: resultado.extras.length,
      }
    }

    let pagoPorId = cartao.membro_id
    if (!pagoPorId) {
      const { data: admin } = await supabase
        .from('membros')
        .select('id')
        .eq('grupo_id', grupoId)
        .order('papel', { ascending: true })
        .limit(1)
        .single()
      pagoPorId = admin?.id
    }
    if (!pagoPorId) throw new Error('Não foi possível identificar o dono do cartão.')

    const { data: regras } = await supabase
      .from('regras_aprendidas')
      .select('*')
      .eq('grupo_id', grupoId)
    const regrasAtivas = regras || []
    const base = Date.UTC(2000, 0, 1, 12)
    const porTransacao = new Map(resultado.pares.map(({ transacao, linha }) => [transacao, linha]))

    for (const [indice, transacao] of transacoes.entries()) {
      const criadoEm = new Date(base + indice * 1000).toISOString()
      const existente = porTransacao.get(transacao)
      if (existente) {
        const { error: erroUpdate } = await supabase
          .from('lancamentos')
          .update({ criado_em: criadoEm })
          .eq('grupo_id', grupoId)
          .eq('id', existente.id)
        if (erroUpdate) throw erroUpdate
        continue
      }

      const regra = regrasAtivas.find((item) =>
        transacao.descricao.toUpperCase().includes(item.merchant.toUpperCase())
      )
      const { error: erroInsert } = await supabase.from('lancamentos').insert({
        grupo_id: grupoId,
        cartao_id: cartaoId,
        pago_por_id: pagoPorId,
        data_lancamento: transacao.data,
        data_competencia: competencia,
        descricao: transacao.descricao,
        valor: transacao.valor_cents,
        parcela_atual: transacao.parcela_atual || null,
        parcela_total: transacao.parcela_total || null,
        divisao_tipo: regra?.divisao_tipo || 'nao_classificado',
        divisao_pct_diana: regra?.divisao_pct_diana ?? 50,
        categoria_id: regra?.categoria_id || null,
        classificado: Boolean(regra),
        observacao: `Fatura conciliada: ${arquivoNome}; mês: ${mesReferencia}`,
        criado_em: criadoEm,
      })
      if (erroInsert) throw erroInsert
    }

    revalidatePath('/')
    revalidatePath('/lancamentos')
    revalidatePath('/conferencia')
    return {
      success: true,
      message: `${resultado.pares.length} lançamento(s) preservados, ${resultado.ausentes.length} incluído(s) e fatura organizada.`,
      encontrados: resultado.pares.length,
      ausentes: resultado.ausentes,
      extras: resultado.extras.length,
    }
  } catch (error: unknown) {
    console.error('Erro ao conciliar fatura existente:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Não foi possível conciliar a fatura.',
      encontrados: 0,
      ausentes: [] as ParsedTransaction[],
      extras: 0,
    }
  }
}
