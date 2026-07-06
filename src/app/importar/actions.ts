'use server'

/**
 * Server Action: salva uma fatura analisada (cria a fonte + insere os
 * lançamentos). Tudo server-side, sob RLS do usuário logado.
 *
 * Competência: numa fatura única, todos os lançamentos caem no mesmo mês
 * (o mês de referência escolhido na tela). data_lancamento sai do "DD/MM"
 * da fatura com o ano inferido (dataCompraDaFatura).
 *
 * ⚠️ Sem transação multi-statement (supabase-js não expõe fácil): se a
 * criação da fonte der certo mas o insert dos lançamentos falhar, sobra uma
 * fonte órfã. Pro MVP tudo bem (é só reimportar). Se virar problema, viramos
 * isto numa função RPC no Postgres.
 */

import { createClient } from '@/lib/supabase/server'
import { dataCompraDaFatura } from '@/domain/lancamento'
import { type SalvarFaturaInput, type SalvarFaturaResult } from './tipos'

export async function salvarFatura(
  input: SalvarFaturaInput,
): Promise<SalvarFaturaResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: 'Não autenticado' }

  // Membro do usuário logado (importado_por / classificado_por) + grupo.
  const { data: meuMembro, error: e1 } = await supabase
    .from('membros')
    .select('id, grupo_id')
    .eq('user_id', user.id)
    .single()
  if (e1 || !meuMembro) {
    return { ok: false, erro: 'Não achei seu membro nesse grupo.' }
  }

  // Cartão -> dono (pago_por_id). RLS garante que é do grupo.
  const { data: cartao, error: e2 } = await supabase
    .from('cartoes')
    .select('id, membro_id')
    .eq('id', input.cartaoId)
    .single()
  if (e2 || !cartao) return { ok: false, erro: 'Cartão não encontrado.' }

  const mRef = input.mesReferencia.match(/^(\d{4})-(\d{2})$/)
  if (!mRef) return { ok: false, erro: 'Mês de referência inválido.' }
  const refAno = Number(mRef[1])
  const refMes = Number(mRef[2])
  const competencia = `${input.mesReferencia}-01`

  // Cria a fonte.
  const { data: fonte, error: e3 } = await supabase
    .from('fontes')
    .insert({
      grupo_id: meuMembro.grupo_id,
      tipo: 'fatura',
      cartao_id: cartao.id,
      mes_referencia: competencia,
      nome_arquivo: input.nomeArquivo,
      total_lancamentos: input.lancamentos.length,
      total_valor: input.totalDeclaradoCentavos,
      importado_por: meuMembro.id,
    })
    .select('id')
    .single()
  if (e3 || !fonte) {
    return { ok: false, erro: `Falha ao criar a fonte: ${e3?.message ?? '?'}` }
  }

  // Monta as linhas de lançamento (com data resolvida).
  let rows
  try {
    const agora = new Date().toISOString()
    rows = input.lancamentos.map((l) => ({
      grupo_id: meuMembro.grupo_id,
      fonte_id: fonte.id,
      cartao_id: cartao.id,
      pago_por_id: cartao.membro_id,
      data_lancamento: dataCompraDaFatura(l.data, refAno, refMes)
        .toISOString()
        .slice(0, 10),
      data_competencia: competencia,
      descricao: l.descricao,
      descricao_normalizada: l.descricaoNormalizada,
      merchant: l.merchant,
      valor: l.valorCentavos,
      categoria_id: l.categoriaId,
      divisao_tipo: l.divisaoTipo ?? 'dividir',
      divisao_pct_diana: l.divisaoPctDiana ?? 50,
      parcela_atual: l.parcelaAtual,
      parcela_total: l.parcelaTotal,
      tags: l.tags,
      observacao: l.observacao,
      classificado: l.classificado,
      classificado_por: l.classificado ? meuMembro.id : null,
      classificado_em: l.classificado ? agora : null,
    }))
  } catch (err) {
    return {
      ok: false,
      erro: `Data inválida em algum lançamento: ${(err as Error).message}`,
    }
  }

  const { error: e4 } = await supabase.from('lancamentos').insert(rows)
  if (e4) {
    return { ok: false, erro: `Falha ao salvar lançamentos: ${e4.message}` }
  }

  return { ok: true, fonteId: fonte.id, total: rows.length }
}
