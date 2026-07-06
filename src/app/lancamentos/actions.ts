'use server'

/**
 * Server Actions da tela /lancamentos.
 *
 * Ao classificar um lançamento (inline ou em lote): grava a divisão, marca
 * classificado=true, e — se NÃO for encargo (tag 'encargo') — aprende/reforça
 * a regra do merchant (upsert em regras_aprendidas, incrementando
 * vezes_confirmada). Encargos não viram regra: eles seguem o principal.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  normalizarDescricao,
  extrairMerchant,
  reaisParaCentavos,
} from '@/domain/lancamento'
import { type ClassificarResult } from './tipos'

const TIPOS_VALIDOS = new Set(['dividir', 'so_diana', 'so_nicco', 'personalizado'])

type SupaClient = Awaited<ReturnType<typeof createClient>>

function validaDivisao(
  divisaoTipo: string,
  pct: number | null,
): string | null {
  if (!TIPOS_VALIDOS.has(divisaoTipo)) return 'Tipo de divisão inválido.'
  if (divisaoTipo === 'personalizado') {
    if (pct == null || pct < 0 || pct > 100) {
      return 'Personalizado precisa de uma % entre 0 e 100.'
    }
  }
  return null
}

async function membroDoUsuario(
  supabase: SupaClient,
): Promise<{ id: string; grupoId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('membros')
    .select('id, grupo_id')
    .eq('user_id', user.id)
    .single()
  if (!data) return null
  return { id: data.id, grupoId: data.grupo_id }
}

/** Aprende/reforça a regra do merchant. Idempotente por (grupo, padrão). */
async function aprenderRegra(
  supabase: SupaClient,
  grupoId: string,
  descricao: string,
  divisaoTipo: string,
  pct: number | null,
): Promise<void> {
  const merchant = extrairMerchant(descricao)
  if (merchant === '' || merchant === 'desconhecido') return

  const { data: existente } = await supabase
    .from('regras_aprendidas')
    .select('id, vezes_confirmada')
    .eq('grupo_id', grupoId)
    .eq('merchant', merchant)
    .maybeSingle()

  const pctFinal = divisaoTipo === 'personalizado' ? pct : null

  if (existente) {
    await supabase
      .from('regras_aprendidas')
      .update({
        divisao_tipo: divisaoTipo,
        divisao_pct_diana: pctFinal,
        vezes_confirmada: (existente.vezes_confirmada ?? 0) + 1,
        ultima_atualizacao: new Date().toISOString(),
      })
      .eq('id', existente.id)
  } else {
    await supabase.from('regras_aprendidas').insert({
      grupo_id: grupoId,
      merchant,
      padrao_descricao: normalizarDescricao(descricao), // referência (não é mais a chave)
      tipo_match: 'exact', // coluna legada; matching é por merchant
      divisao_tipo: divisaoTipo,
      divisao_pct_diana: pctFinal,
      vezes_confirmada: 1,
    })
  }
}

export async function classificarLancamento(input: {
  id: string
  divisaoTipo: string
  divisaoPctDiana: number | null
}): Promise<ClassificarResult> {
  const erroVal = validaDivisao(input.divisaoTipo, input.divisaoPctDiana)
  if (erroVal) return { ok: false, erro: erroVal }

  const supabase = await createClient()
  const membro = await membroDoUsuario(supabase)
  if (!membro) return { ok: false, erro: 'Não autenticado.' }

  // Lê descrição + tags (RLS garante que é do grupo).
  const { data: lanc, error: eLanc } = await supabase
    .from('lancamentos')
    .select('descricao, tags')
    .eq('id', input.id)
    .single()
  if (eLanc || !lanc) return { ok: false, erro: 'Lançamento não encontrado.' }

  const pctFinal =
    input.divisaoTipo === 'personalizado' ? input.divisaoPctDiana : 50

  const { error: eUpd } = await supabase
    .from('lancamentos')
    .update({
      divisao_tipo: input.divisaoTipo,
      divisao_pct_diana: pctFinal,
      classificado: true,
      classificado_por: membro.id,
      classificado_em: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (eUpd) return { ok: false, erro: `Falha ao salvar: ${eUpd.message}` }

  const ehEncargo = (lanc.tags as string[] | null)?.includes('encargo') ?? false
  if (!ehEncargo) {
    await aprenderRegra(
      supabase,
      membro.grupoId,
      lanc.descricao,
      input.divisaoTipo,
      input.divisaoPctDiana,
    )
  }

  revalidatePath('/lancamentos')
  return { ok: true }
}

export async function classificarLote(input: {
  ids: string[]
  divisaoTipo: string
  divisaoPctDiana: number | null
}): Promise<ClassificarResult> {
  if (input.ids.length === 0) return { ok: false, erro: 'Nada selecionado.' }
  const erroVal = validaDivisao(input.divisaoTipo, input.divisaoPctDiana)
  if (erroVal) return { ok: false, erro: erroVal }

  const supabase = await createClient()
  const membro = await membroDoUsuario(supabase)
  if (!membro) return { ok: false, erro: 'Não autenticado.' }

  // Lê os selecionados (pra aprender regras dos não-encargos).
  const { data: lancs } = await supabase
    .from('lancamentos')
    .select('id, descricao, tags')
    .in('id', input.ids)

  const pctFinal =
    input.divisaoTipo === 'personalizado' ? input.divisaoPctDiana : 50

  const { error: eUpd } = await supabase
    .from('lancamentos')
    .update({
      divisao_tipo: input.divisaoTipo,
      divisao_pct_diana: pctFinal,
      classificado: true,
      classificado_por: membro.id,
      classificado_em: new Date().toISOString(),
    })
    .in('id', input.ids)
  if (eUpd) return { ok: false, erro: `Falha ao salvar: ${eUpd.message}` }

  // Aprende regra uma vez por merchant normalizado (não-encargos).
  const vistos = new Set<string>()
  for (const l of lancs ?? []) {
    const ehEncargo = (l.tags as string[] | null)?.includes('encargo') ?? false
    if (ehEncargo) continue
    const merchant = extrairMerchant(l.descricao)
    if (merchant === '' || merchant === 'desconhecido' || vistos.has(merchant)) continue
    vistos.add(merchant)
    await aprenderRegra(
      supabase,
      membro.grupoId,
      l.descricao,
      input.divisaoTipo,
      input.divisaoPctDiana,
    )
  }

  revalidatePath('/lancamentos')
  return { ok: true }
}

// ============================================================
// Lançamento manual (boletos, diaristas, PIX — fora de fatura)
// ============================================================

/** Acha (ou cria) a fonte 'manual' do mês, pra agrupar os lançamentos avulsos. */
async function acharOuCriarFonteManual(
  supabase: SupaClient,
  grupoId: string,
  membroId: string,
  competencia: string,
): Promise<string | null> {
  const { data: existente } = await supabase
    .from('fontes')
    .select('id')
    .eq('grupo_id', grupoId)
    .eq('tipo', 'manual')
    .eq('mes_referencia', competencia)
    .maybeSingle()
  if (existente) return existente.id

  const { data: nova } = await supabase
    .from('fontes')
    .insert({
      grupo_id: grupoId,
      tipo: 'manual',
      nome_arquivo: 'Lançamento manual',
      mes_referencia: competencia,
      importado_por: membroId,
    })
    .select('id')
    .single()
  return nova?.id ?? null
}

export interface LancamentoManualInput {
  dataLancamento: string // "YYYY-MM-DD"
  descricao: string
  valorReais: number
  cartaoId: string | null
  categoriaId: string | null
  divisaoTipo: string
  divisaoPctDiana: number | null
  pagoPorId: string
  observacao: string | null
}

export async function adicionarLancamentoManual(
  input: LancamentoManualInput,
): Promise<ClassificarResult> {
  const erroVal = validaDivisao(input.divisaoTipo, input.divisaoPctDiana)
  if (erroVal) return { ok: false, erro: erroVal }
  if (input.descricao.trim() === '') return { ok: false, erro: 'Descrição obrigatória.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dataLancamento)) {
    return { ok: false, erro: 'Data inválida.' }
  }
  if (!Number.isFinite(input.valorReais) || input.valorReais === 0) {
    return { ok: false, erro: 'Valor precisa ser diferente de zero.' }
  }

  const supabase = await createClient()
  const membro = await membroDoUsuario(supabase)
  if (!membro) return { ok: false, erro: 'Não autenticado.' }

  // pago_por precisa ser do grupo.
  const { data: pagoPor } = await supabase
    .from('membros')
    .select('id')
    .eq('id', input.pagoPorId)
    .eq('grupo_id', membro.grupoId)
    .maybeSingle()
  if (!pagoPor) return { ok: false, erro: 'Pagador inválido.' }

  const competencia = `${input.dataLancamento.slice(0, 7)}-01`
  const fonteId = await acharOuCriarFonteManual(
    supabase,
    membro.grupoId,
    membro.id,
    competencia,
  )
  if (!fonteId) return { ok: false, erro: 'Falha ao preparar a fonte manual.' }

  const pctFinal = input.divisaoTipo === 'personalizado' ? input.divisaoPctDiana : 50

  const { error } = await supabase.from('lancamentos').insert({
    grupo_id: membro.grupoId,
    fonte_id: fonteId,
    cartao_id: input.cartaoId,
    pago_por_id: input.pagoPorId,
    data_lancamento: input.dataLancamento,
    data_competencia: competencia,
    descricao: input.descricao.trim(),
    descricao_normalizada: normalizarDescricao(input.descricao),
    merchant: extrairMerchant(input.descricao),
    valor: reaisParaCentavos(input.valorReais),
    categoria_id: input.categoriaId,
    divisao_tipo: input.divisaoTipo,
    divisao_pct_diana: pctFinal,
    classificado: true,
    classificado_por: membro.id,
    classificado_em: new Date().toISOString(),
    observacao: input.observacao?.trim() || null,
  })
  if (error) return { ok: false, erro: `Falha ao salvar: ${error.message}` }

  // Manual já vem classificado -> vira aprendizado por merchant.
  await aprenderRegra(
    supabase,
    membro.grupoId,
    input.descricao,
    input.divisaoTipo,
    input.divisaoPctDiana,
  )

  revalidatePath('/lancamentos')
  return { ok: true }
}

// ============================================================
// Marcar revisado em lote (aprova a divisão atual, sem mudá-la)
// ============================================================

export async function marcarRevisadoLote(ids: string[]): Promise<ClassificarResult> {
  if (ids.length === 0) return { ok: false, erro: 'Nada selecionado.' }

  const supabase = await createClient()
  const membro = await membroDoUsuario(supabase)
  if (!membro) return { ok: false, erro: 'Não autenticado.' }

  // Lê os selecionados (pra aprender regra com a divisão ATUAL de cada um).
  const { data: lancs } = await supabase
    .from('lancamentos')
    .select('id, descricao, tags, divisao_tipo, divisao_pct_diana')
    .in('id', ids)

  const { error } = await supabase
    .from('lancamentos')
    .update({
      classificado: true,
      classificado_por: membro.id,
      classificado_em: new Date().toISOString(),
    })
    .in('id', ids)
  if (error) return { ok: false, erro: `Falha ao salvar: ${error.message}` }

  // Aprende regra por merchant (com a divisão que o lançamento já tem),
  // uma vez por merchant, pulando encargos.
  const vistos = new Set<string>()
  for (const l of lancs ?? []) {
    const ehEncargo = (l.tags as string[] | null)?.includes('encargo') ?? false
    if (ehEncargo) continue
    const merchant = extrairMerchant(l.descricao)
    if (merchant === '' || merchant === 'desconhecido' || vistos.has(merchant)) continue
    vistos.add(merchant)
    await aprenderRegra(
      supabase,
      membro.grupoId,
      l.descricao,
      l.divisao_tipo,
      l.divisao_pct_diana,
    )
  }

  revalidatePath('/lancamentos')
  return { ok: true }
}
