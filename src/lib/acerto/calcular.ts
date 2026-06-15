import { createClient } from '@/lib/supabase/server'
import { getCurrentGroupId } from '@/lib/auth/group'

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

export async function calcularFechamentoDoMes(mesCompetencia: string): Promise<FechamentoMes> {
  const supabase = await createClient()
  const grupoId = await getCurrentGroupId()

  // Buscar os membros ordenados por papel para consistência (admin primeiro)
  const { data: membros } = await supabase
    .from('membros')
    .select('id, apelido')
    .eq('grupo_id', grupoId)
    .order('papel', { ascending: true })
  
  if (!membros || membros.length < 2) {
    throw new Error("São necessários no mínimo 2 membros no grupo para o cálculo.")
  }

  const membro1 = membros[0]
  const membro2 = membros[1]

  const inicioMes = `${mesCompetencia}-01`
  
  const [ano, mes] = mesCompetencia.split('-').map(Number)
  const proximoMes = mes === 12 ? 1 : mes + 1
  const proximoAno = mes === 12 ? ano + 1 : ano
  const inicioProximoMes = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`
  
  const { data: lancamentos, error } = await supabase
    .from('lancamentos')
    .select('*, cartoes(membro_id)')
    .eq('grupo_id', grupoId)
    .gte('data_competencia', inicioMes)
    .lt('data_competencia', inicioProximoMes)

  if (error || !lancamentos) {
    throw new Error("Erro ao buscar lançamentos: " + error?.message)
  }

  let totalGasto = 0
  let totalMembro1Pagou = 0
  let totalMembro2Pagou = 0

  let membro1DeveParaMembro2 = 0
  let membro2DeveParaMembro1 = 0

  for (const l of lancamentos) {
    totalGasto += l.valor

    const pagadorId = l.pago_por_id || l.cartoes?.membro_id

    if (pagadorId === membro1.id) {
      totalMembro1Pagou += l.valor
    } else if (pagadorId === membro2.id) {
      totalMembro2Pagou += l.valor
    }

    let pctMembro1 = 0
    let pctMembro2 = 0

    switch (l.divisao_tipo) {
      case 'dividir':
        pctMembro1 = 50
        pctMembro2 = 50
        break
      case 'so_diana': // Mapeado para membro1
        pctMembro1 = 100
        break
      case 'so_nicco': // Mapeado para membro2
        pctMembro2 = 100
        break
      case 'personalizado':
        pctMembro1 = l.divisao_pct_diana || 50
        pctMembro2 = 100 - pctMembro1
        break
      case 'nao_classificado':
        continue
    }

    const valorResponsabilidadeMembro1 = Math.round((l.valor * pctMembro1) / 100)
    const valorResponsabilidadeMembro2 = l.valor - valorResponsabilidadeMembro1

    if (pagadorId === membro1.id) {
      membro2DeveParaMembro1 += valorResponsabilidadeMembro2
    } else if (pagadorId === membro2.id) {
      membro1DeveParaMembro2 += valorResponsabilidadeMembro1
    }
  }

  const { data: reembolsos, error: erroReembolsos } = await supabase
    .from('reembolsos')
    .select('*')
    .eq('grupo_id', grupoId)
    .gte('data_competencia', inicioMes)
    .lt('data_competencia', inicioProximoMes)

  let totalReembolsosMembro2 = 0
  let totalReembolsosMembro1 = 0

  if (reembolsos) {
    for (const r of reembolsos) {
      if (r.credito_para_id === membro2.id) {
        totalReembolsosMembro2 += r.valor
        membro1DeveParaMembro2 += r.valor 
      } else if (r.credito_para_id === membro1.id) {
        totalReembolsosMembro1 += r.valor
        membro2DeveParaMembro1 += r.valor 
      }
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
      totalGasto: totalGasto, // Gasto total não é por membro aqui, mas enviaremos igual
      totalPago: totalMembro1Pagou,
      deveParaOutro: membro1DeveParaMembro2,
      totalReembolsos: totalReembolsosMembro1
    },
    membro2: {
      id: membro2.id,
      nome: membro2.apelido,
      totalGasto: totalGasto,
      totalPago: totalMembro2Pagou,
      deveParaOutro: membro2DeveParaMembro1,
      totalReembolsos: totalReembolsosMembro2
    },
    saldoFinal: {
      quemPagaId,
      quemPagaNome,
      quemRecebeId,
      quemRecebeNome,
      valor: valorSaldo
    }
  }
}
