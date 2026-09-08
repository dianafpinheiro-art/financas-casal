import { createClient } from '@/lib/supabase/server'
import { getCurrentGroupId } from '@/lib/auth/group'
import { buscarTodasPaginas } from '@/lib/supabase/paginar'

export type FechamentoMes = {
  membro1: {
    id: string
    nome: string
    totalGasto: number
    totalPago: number
    deveParaOutro: number
    totalReembolsos: number
  }
  membro2: {
    id: string
    nome: string
    totalGasto: number
    totalPago: number
    deveParaOutro: number
    totalReembolsos: number
  }
  saldoFinal: {
    quemPagaId: string
    quemPagaNome: string
    quemRecebeId: string
    quemRecebeNome: string
    valor: number
  }
}

type MembroAcerto = { id: string; apelido: string }

type LancamentoAcerto = {
  valor: number
  pago_por_id: string | null
  divisao_tipo: string
  divisao_pct_diana: number | null
  data_competencia?: string | null
  cartoes: { membro_id: string | null } | { membro_id: string | null }[] | null
}

type ReembolsoAcerto = {
  valor: number
  credito_para_id: string
  data_competencia?: string | null
}

function inicioDoProximoMes(mesCompetencia: string) {
  const [ano, mes] = mesCompetencia.split('-').map(Number)
  const proximoMes = mes === 12 ? 1 : mes + 1
  const proximoAno = mes === 12 ? ano + 1 : ano
  return `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`
}

function calcularComDados(
  membros: MembroAcerto[],
  lancamentos: LancamentoAcerto[],
  reembolsos: ReembolsoAcerto[],
): FechamentoMes {
  if (membros.length < 2) {
    throw new Error('São necessários no mínimo 2 membros no grupo para o cálculo.')
  }

  const membro1 = membros[0]
  const membro2 = membros[1]
  let totalGasto = 0
  let totalMembro1Pagou = 0
  let totalMembro2Pagou = 0
  let membro1DeveParaMembro2 = 0
  let membro2DeveParaMembro1 = 0

  for (const lancamento of lancamentos) {
    totalGasto += lancamento.valor

    const cartao = Array.isArray(lancamento.cartoes) ? lancamento.cartoes[0] : lancamento.cartoes
    const pagadorId = lancamento.pago_por_id || cartao?.membro_id

    if (pagadorId === membro1.id) totalMembro1Pagou += lancamento.valor
    else if (pagadorId === membro2.id) totalMembro2Pagou += lancamento.valor

    let pctMembro1 = 0

    switch (lancamento.divisao_tipo) {
      case 'dividir':
        pctMembro1 = 50
        break
      case 'so_diana':
        pctMembro1 = 100
        break
      case 'so_nicco':
        break
      case 'personalizado':
        pctMembro1 = lancamento.divisao_pct_diana ?? 50
        break
      case 'nao_classificado':
        continue
    }

    const responsabilidadeMembro1 = Math.round((lancamento.valor * pctMembro1) / 100)
    const responsabilidadeMembro2 = lancamento.valor - responsabilidadeMembro1

    if (pagadorId === membro1.id) membro2DeveParaMembro1 += responsabilidadeMembro2
    else if (pagadorId === membro2.id) membro1DeveParaMembro2 += responsabilidadeMembro1
  }

  let totalReembolsosMembro1 = 0
  let totalReembolsosMembro2 = 0

  for (const reembolso of reembolsos) {
    if (reembolso.credito_para_id === membro2.id) {
      totalReembolsosMembro2 += reembolso.valor
      membro1DeveParaMembro2 += reembolso.valor
    } else if (reembolso.credito_para_id === membro1.id) {
      totalReembolsosMembro1 += reembolso.valor
      membro2DeveParaMembro1 += reembolso.valor
    }
  }

  let quemPagaId = ''
  let quemPagaNome = 'Nenhum'
  let quemRecebeId = ''
  let quemRecebeNome = 'Nenhum'
  let valorSaldo = 0

  if (membro1DeveParaMembro2 > membro2DeveParaMembro1) {
    quemPagaId = membro1.id
    quemPagaNome = membro1.apelido
    quemRecebeId = membro2.id
    quemRecebeNome = membro2.apelido
    valorSaldo = membro1DeveParaMembro2 - membro2DeveParaMembro1
  } else if (membro2DeveParaMembro1 > membro1DeveParaMembro2) {
    quemPagaId = membro2.id
    quemPagaNome = membro2.apelido
    quemRecebeId = membro1.id
    quemRecebeNome = membro1.apelido
    valorSaldo = membro2DeveParaMembro1 - membro1DeveParaMembro2
  }

  return {
    membro1: {
      id: membro1.id,
      nome: membro1.apelido,
      totalGasto,
      totalPago: totalMembro1Pagou,
      deveParaOutro: membro1DeveParaMembro2,
      totalReembolsos: totalReembolsosMembro1,
    },
    membro2: {
      id: membro2.id,
      nome: membro2.apelido,
      totalGasto,
      totalPago: totalMembro2Pagou,
      deveParaOutro: membro2DeveParaMembro1,
      totalReembolsos: totalReembolsosMembro2,
    },
    saldoFinal: {
      quemPagaId,
      quemPagaNome,
      quemRecebeId,
      quemRecebeNome,
      valor: valorSaldo,
    },
  }
}

export async function calcularFechamentosDoPeriodo(meses: string[]): Promise<Record<string, FechamentoMes>> {
  const mesesUnicos = Array.from(new Set(meses.filter((mes) => /^\d{4}-\d{2}$/.test(mes)))).sort()
  if (mesesUnicos.length === 0) return {}

  const supabase = await createClient()
  const grupoId = await getCurrentGroupId()
  const inicioPeriodo = `${mesesUnicos[0]}-01`
  const fimPeriodo = inicioDoProximoMes(mesesUnicos[mesesUnicos.length - 1])

  const [membrosRes, lancamentosRes, reembolsosRes] = await Promise.all([
    supabase
      .from('membros')
      .select('id, apelido')
      .eq('grupo_id', grupoId)
      .order('papel', { ascending: true }),
    buscarTodasPaginas((inicio, fim) => supabase
      .from('lancamentos')
      .select('valor, pago_por_id, divisao_tipo, divisao_pct_diana, data_competencia, cartoes(membro_id)')
      .eq('grupo_id', grupoId)
      .gte('data_competencia', inicioPeriodo)
      .lt('data_competencia', fimPeriodo)
      .order('id')
      .range(inicio, fim)),
    buscarTodasPaginas((inicio, fim) => supabase
      .from('reembolsos')
      .select('valor, credito_para_id, data_competencia')
      .eq('grupo_id', grupoId)
      .gte('data_competencia', inicioPeriodo)
      .lt('data_competencia', fimPeriodo)
      .order('id')
      .range(inicio, fim)),
  ])

  if (membrosRes.error) throw new Error(`Erro ao buscar membros: ${membrosRes.error.message}`)

  const membros = (membrosRes.data || []) as MembroAcerto[]
  const lancamentos = lancamentosRes.data as LancamentoAcerto[]
  const reembolsos = reembolsosRes.data as ReembolsoAcerto[]
  const resultados: Record<string, FechamentoMes> = {}

  for (const mes of mesesUnicos) {
    resultados[mes] = calcularComDados(
      membros,
      lancamentos.filter((item) => item.data_competencia?.slice(0, 7) === mes),
      reembolsos.filter((item) => item.data_competencia?.slice(0, 7) === mes),
    )
  }

  return resultados
}

export async function calcularFechamentoDoMes(mesCompetencia: string): Promise<FechamentoMes> {
  const fechamentos = await calcularFechamentosDoPeriodo([mesCompetencia])
  const fechamento = fechamentos[mesCompetencia]
  if (!fechamento) throw new Error('Mês de competência inválido.')
  return fechamento
}
