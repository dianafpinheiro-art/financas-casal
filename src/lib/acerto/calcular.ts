import { createClient } from '@/lib/supabase/server'

export type FechamentoMes = {
  totalGasto: number
  totalDianaPagou: number
  totalNiccoPagou: number
  dianaDeveParaNicco: number
  niccoDeveParaDiana: number
  totalReembolsosNicco: number
  totalReembolsosDiana: number
  saldoFinal: {
    quemPaga: 'Diana' | 'Nicco' | 'Nenhum'
    quemRecebe: 'Diana' | 'Nicco' | 'Nenhum'
    valor: number
  }
}

export async function calcularFechamentoDoMes(mesCompetencia: string): Promise<FechamentoMes> {
  const supabase = await createClient()

  // Buscar os membros para saber quem é quem
  const { data: membros } = await supabase.from('membros').select('id, apelido')
  const diana = membros?.find(m => m.apelido === 'Diana')
  const nicco = membros?.find(m => m.apelido === 'Nicco')

  if (!diana || !nicco) {
    throw new Error("Membros não encontrados no banco de dados.")
  }

  // Buscar todos os lançamentos classificados do mês
  // Vamos filtrar pelo mês passado (ex: 2026-06)
  const inicioMes = `${mesCompetencia}-01`
  
  // Para calcular o fim do mês com segurança sem cair no "dia 31 em mês de 30":
  const [ano, mes] = mesCompetencia.split('-').map(Number)
  const proximoMes = mes === 12 ? 1 : mes + 1
  const proximoAno = mes === 12 ? ano + 1 : ano
  const inicioProximoMes = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`
  
  const { data: lancamentos, error } = await supabase
    .from('lancamentos')
    .select('*, cartoes(membro_id)')
    .gte('data_competencia', inicioMes)
    .lt('data_competencia', inicioProximoMes)
    // .eq('classificado', true) // Podemos forçar que só entre o que está classificado

  if (error || !lancamentos) {
    throw new Error("Erro ao buscar lançamentos: " + error?.message)
  }

  let totalGasto = 0
  let totalDianaPagou = 0
  let totalNiccoPagou = 0

  let dianaDeveParaNicco = 0
  let niccoDeveParaDiana = 0

  for (const l of lancamentos) {
    totalGasto += l.valor

    // Tenta descobrir quem pagou: ou está explícito na transação, ou é o dono do cartão
    const pagadorId = l.pago_por_id || l.cartoes?.membro_id

    if (pagadorId === diana.id) {
      totalDianaPagou += l.valor
    } else if (pagadorId === nicco.id) {
      totalNiccoPagou += l.valor
    }

    // Calcula de quem é a responsabilidade do gasto
    let pctDiana = 0
    let pctNicco = 0

    switch (l.divisao_tipo) {
      case 'dividir':
        pctDiana = 50
        pctNicco = 50
        break
      case 'so_diana':
        pctDiana = 100
        break
      case 'so_nicco':
        pctNicco = 100
        break
      case 'personalizado':
        pctDiana = l.divisao_pct_diana || 50
        pctNicco = 100 - pctDiana
        break
      case 'nao_classificado':
        // Ignoramos nos devidos se não foi classificado
        continue
    }

    const valorResponsabilidadeDiana = Math.round((l.valor * pctDiana) / 100)
    const valorResponsabilidadeNicco = l.valor - valorResponsabilidadeDiana

    // Acerto de contas dessa transação:
    if (pagadorId === diana.id) {
      // Diana pagou. Nicco deve a parte dele para a Diana.
      niccoDeveParaDiana += valorResponsabilidadeNicco
    } else if (pagadorId === nicco.id) {
      // Nicco pagou. Diana deve a parte dela para o Nicco.
      dianaDeveParaNicco += valorResponsabilidadeDiana
    }
  }

  const { data: reembolsos, error: erroReembolsos } = await supabase
    .from('reembolsos')
    .select('*')
    .gte('data_competencia', inicioMes)
    .lt('data_competencia', inicioProximoMes)

  if (erroReembolsos) {
    console.error("Erro ao buscar reembolsos: ", erroReembolsos)
  }

  // Aplicar reembolsos
  let totalReembolsosNicco = 0
  let totalReembolsosDiana = 0

  if (reembolsos) {
    for (const r of reembolsos) {
      if (r.credito_para_id === nicco.id) {
        totalReembolsosNicco += r.valor
        dianaDeveParaNicco += r.valor // Diana passa a dever esse reembolso pro Nicco
      } else if (r.credito_para_id === diana.id) {
        totalReembolsosDiana += r.valor
        niccoDeveParaDiana += r.valor // Nicco passa a dever esse reembolso pra Diana
      }
    }
  }

  // Encontra o saldo final (quem deve quem)
  let quemPaga: 'Diana' | 'Nicco' | 'Nenhum' = 'Nenhum'
  let quemRecebe: 'Diana' | 'Nicco' | 'Nenhum' = 'Nenhum'
  let valorSaldo = 0

  if (dianaDeveParaNicco > niccoDeveParaDiana) {
    quemPaga = 'Diana'
    quemRecebe = 'Nicco'
    valorSaldo = dianaDeveParaNicco - niccoDeveParaDiana
  } else if (niccoDeveParaDiana > dianaDeveParaNicco) {
    quemPaga = 'Nicco'
    quemRecebe = 'Diana'
    valorSaldo = niccoDeveParaDiana - dianaDeveParaNicco
  }

  return {
    totalGasto,
    totalDianaPagou,
    totalNiccoPagou,
    dianaDeveParaNicco,
    niccoDeveParaDiana,
    totalReembolsosNicco,
    totalReembolsosDiana,
    saldoFinal: {
      quemPaga,
      quemRecebe,
      valor: valorSaldo
    }
  }
}
