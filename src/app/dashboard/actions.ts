'use server'

/**
 * Server Actions do /dashboard — fechar e reabrir o mês.
 *
 * Fechar: grava um registro em fechamento_mes (com snapshot completo do
 * acerto) e marca todos os lançamentos do mês como mes_fechado=true. A partir
 * daí a trigger do banco (010) bloqueia qualquer edição/exclusão desses
 * lançamentos — o acerto fica congelado.
 *
 * Reabrir: destrava os lançamentos (mes_fechado=false, transição permitida
 * pela trigger) e apaga o registro de fechamento_mes.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { carregarAcertoDoMes, carregarDadosDocx } from '@/lib/acerto'

export type FecharResult = { ok: true } | { ok: false; erro: string }

type SupaClient = Awaited<ReturnType<typeof createClient>>

function proximoMesISO(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10)
}

async function usuarioEGrupo(
  supabase: SupaClient,
): Promise<{ userId: string; grupoId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('membros')
    .select('grupo_id')
    .eq('user_id', user.id)
    .single()
  if (!data) return null
  return { userId: user.id, grupoId: data.grupo_id }
}

export async function fecharMes(mes: string): Promise<FecharResult> {
  if (!/^\d{4}-\d{2}$/.test(mes)) return { ok: false, erro: 'Mês inválido.' }

  const supabase = await createClient()
  const ctx = await usuarioEGrupo(supabase)
  if (!ctx) return { ok: false, erro: 'Não autenticado.' }

  const mesRef = `${mes}-01`

  // Já fechado? (a constraint unique também protege, mas damos msg amigável)
  const { data: existente } = await supabase
    .from('fechamento_mes')
    .select('id')
    .eq('grupo_id', ctx.grupoId)
    .eq('mes_referencia', mesRef)
    .maybeSingle()
  if (existente) return { ok: false, erro: 'Esse mês já está fechado.' }

  // Calcula o acerto no estado atual (é o que será congelado).
  const { acerto, erroCalc, totalLancamentos } = await carregarAcertoDoMes(mes)
  if (erroCalc || !acerto) {
    return { ok: false, erro: erroCalc ?? 'Não foi possível calcular o acerto.' }
  }
  if (totalLancamentos === 0) {
    return { ok: false, erro: 'Não há lançamentos nesse mês pra fechar.' }
  }

  const { dados: docx } = await carregarDadosDocx(mes)

  const t = acerto.transferencia
  // de='diana' => Diana pagou a mais? Não: transferencia.de é quem PAGA a
  // transferência. de='diana' => Diana paga pro Nicco; de='nicco' => Nicco
  // paga pra Diana. Sem transferência (quitado) registramos nicco_paga_diana
  // com valor 0, só pra ter um valor válido na coluna NOT NULL/check.
  const direcao =
    t == null
      ? 'nicco_paga_diana'
      : t.de === 'diana'
        ? 'diana_paga_nicco'
        : 'nicco_paga_diana'
  const valor = t?.valorCentavos ?? 0

  const snapshot = {
    mes,
    geradoEm: new Date().toISOString(),
    totalLancamentos,
    acerto,
    docx,
  }

  const { error: eIns } = await supabase.from('fechamento_mes').insert({
    grupo_id: ctx.grupoId,
    mes_referencia: mesRef,
    fechado_por: ctx.userId,
    valor_transferencia_cents: valor,
    direcao_transferencia: direcao,
    snapshot_json: snapshot,
  })
  if (eIns) return { ok: false, erro: `Falha ao gravar fechamento: ${eIns.message}` }

  // Trava os lançamentos do mês (old.mes_fechado=false -> true: permitido).
  const { error: eUpd } = await supabase
    .from('lancamentos')
    .update({ mes_fechado: true })
    .eq('grupo_id', ctx.grupoId)
    .gte('data_competencia', mesRef)
    .lt('data_competencia', proximoMesISO(mes))
  if (eUpd) {
    return {
      ok: false,
      erro: `Fechamento gravado, mas falha ao travar lançamentos: ${eUpd.message}`,
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/lancamentos')
  return { ok: true }
}

export async function reabrirMes(mes: string): Promise<FecharResult> {
  if (!/^\d{4}-\d{2}$/.test(mes)) return { ok: false, erro: 'Mês inválido.' }

  const supabase = await createClient()
  const ctx = await usuarioEGrupo(supabase)
  if (!ctx) return { ok: false, erro: 'Não autenticado.' }

  const mesRef = `${mes}-01`

  // Destrava primeiro (old=true -> new=false: transição permitida na trigger).
  const { error: eUpd } = await supabase
    .from('lancamentos')
    .update({ mes_fechado: false })
    .eq('grupo_id', ctx.grupoId)
    .gte('data_competencia', mesRef)
    .lt('data_competencia', proximoMesISO(mes))
  if (eUpd) return { ok: false, erro: `Falha ao destravar lançamentos: ${eUpd.message}` }

  const { error: eDel } = await supabase
    .from('fechamento_mes')
    .delete()
    .eq('grupo_id', ctx.grupoId)
    .eq('mes_referencia', mesRef)
  if (eDel) return { ok: false, erro: `Falha ao apagar fechamento: ${eDel.message}` }

  revalidatePath('/dashboard')
  revalidatePath('/lancamentos')
  return { ok: true }
}
