/**
 * Helper server-side: carrega os lançamentos de um mês de competência e
 * calcula o acerto (via domínio). Usado pelo /dashboard e pela rota do docx,
 * pra não duplicar o fetch + mapeamento + calcAcerto.
 */
import { createClient } from '@/lib/supabase/server'
import { calcAcerto, type Acerto } from '@/domain/acerto'
import {
  quantoCabeDiana,
  quantoCabeNicco,
  type Lancamento,
  type DivisaoTipo,
  type Pagador,
} from '@/domain/lancamento'

const FORA_DO_CARTAO = 'Fora do cartão (diaristas, Gustavo, Cida, Claro, Ubers)'

export interface AcertoDoMes {
  mes: string // "YYYY-MM"
  acerto: Acerto | null
  erroCalc: string | null
  aRevisar: number
  totalLancamentos: number
}

function proximoMesISO(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10)
}

export async function carregarAcertoDoMes(mesParam?: string): Promise<AcertoDoMes> {
  const supabase = await createClient()

  let mes = mesParam ?? ''
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    const { data: ultimo } = await supabase
      .from('lancamentos')
      .select('data_competencia')
      .order('data_competencia', { ascending: false })
      .limit(1)
      .maybeSingle()
    mes = ultimo?.data_competencia
      ? String(ultimo.data_competencia).slice(0, 7)
      : new Date().toISOString().slice(0, 7)
  }

  const inicio = `${mes}-01`
  const fim = proximoMesISO(mes)

  const { data: membros } = await supabase.from('membros').select('id, apelido')
  const apelidoPorMembro = new Map<string, string>(
    (membros ?? []).map((m) => [m.id as string, m.apelido as string]),
  )

  const { data: rows } = await supabase
    .from('lancamentos')
    .select('valor, divisao_tipo, divisao_pct_diana, pago_por_id, classificado')
    .gte('data_competencia', inicio)
    .lt('data_competencia', fim)

  const lancs: Lancamento[] = (rows ?? []).map((r) => {
    const apelido = (apelidoPorMembro.get(r.pago_por_id) ?? '').toLowerCase()
    const pagoPor: Pagador = apelido === 'nicco' ? 'nicco' : 'diana'
    return {
      valorCentavos: r.valor,
      pagoPor,
      divisaoTipo: r.divisao_tipo as DivisaoTipo,
      divisaoPctDiana: r.divisao_pct_diana ?? undefined,
    }
  })

  let acerto: Acerto | null = null
  let erroCalc: string | null = null
  try {
    acerto = calcAcerto(lancs)
  } catch (e) {
    erroCalc = (e as Error).message
  }

  return {
    mes,
    acerto,
    erroCalc,
    aRevisar: (rows ?? []).filter((r) => !r.classificado).length,
    totalLancamentos: lancs.length,
  }
}

// ============================================================
// Dados pro docx do acerto (agrupado por cartão) — ver lib/acerto-docx.js
// ============================================================

export interface GrupoCartao {
  rotulo: string
  totalCentavos: number
}

export interface DadosDocxAcerto {
  mes: string
  deDiana: boolean
  transferenciaCentavos: number
  dianaCartoes: GrupoCartao[]
  subtotalDianaCentavos: number
  niccoDeveCentavos: number
  niccoCartoes: GrupoCartao[]
  subtotalNiccoCentavos: number
  dianaDeveCentavos: number
  despesasPessoaisDianaCentavos: number
  despesasPessoaisNiccoCentavos: number
  metadeCompartDianaCentavos: number
  metadeCompartNiccoCentavos: number
  totalCabeDianaCentavos: number
  totalCabeNiccoCentavos: number
  totalGeralCentavos: number
  niccoPagouCentavos: number
  dianaPagouCentavos: number
}

interface RowDetalhe {
  lanc: Lancamento
  pagoPor: Pagador
  cartaoRotulo: string // apelido do cartão OU FORA_DO_CARTAO
}

function agruparPorCartao(rows: RowDetalhe[]): {
  grupos: GrupoCartao[]
  subtotal: number
} {
  const mapa = new Map<string, number>()
  let subtotal = 0
  for (const { lanc, cartaoRotulo } of rows) {
    mapa.set(cartaoRotulo, (mapa.get(cartaoRotulo) ?? 0) + lanc.valorCentavos)
    subtotal += lanc.valorCentavos
  }
  // cartões nomeados em ordem alfabética; "fora do cartão" sempre por último
  const nomeados = [...mapa.entries()]
    .filter(([rot]) => rot !== FORA_DO_CARTAO)
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([rotulo, totalCentavos]) => ({ rotulo, totalCentavos }))
  const fora = mapa.get(FORA_DO_CARTAO)
  if (fora != null) nomeados.push({ rotulo: FORA_DO_CARTAO, totalCentavos: fora })
  return { grupos: nomeados, subtotal }
}

export async function carregarDadosDocx(
  mesParam?: string,
): Promise<{ mes: string; dados: DadosDocxAcerto | null }> {
  const supabase = await createClient()

  let mes = mesParam ?? ''
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    const { data: ultimo } = await supabase
      .from('lancamentos')
      .select('data_competencia')
      .order('data_competencia', { ascending: false })
      .limit(1)
      .maybeSingle()
    mes = ultimo?.data_competencia
      ? String(ultimo.data_competencia).slice(0, 7)
      : new Date().toISOString().slice(0, 7)
  }

  const inicio = `${mes}-01`
  const fim = proximoMesISO(mes)

  const { data: membros } = await supabase.from('membros').select('id, apelido')
  const apelidoPorMembro = new Map<string, string>(
    (membros ?? []).map((m) => [m.id as string, m.apelido as string]),
  )

  const { data: rows } = await supabase
    .from('lancamentos')
    .select(
      'valor, divisao_tipo, divisao_pct_diana, pago_por_id, cartao:cartoes(apelido)',
    )
    .gte('data_competencia', inicio)
    .lt('data_competencia', fim)

  if (!rows || rows.length === 0) return { mes, dados: null }

  const detalhes: RowDetalhe[] = rows.map((r) => {
    const cart = Array.isArray(r.cartao) ? r.cartao[0] : r.cartao
    const apelido = (apelidoPorMembro.get(r.pago_por_id) ?? '').toLowerCase()
    return {
      lanc: {
        valorCentavos: r.valor,
        pagoPor: apelido === 'nicco' ? 'nicco' : 'diana',
        divisaoTipo: r.divisao_tipo as DivisaoTipo,
        divisaoPctDiana: r.divisao_pct_diana ?? undefined,
      },
      pagoPor: apelido === 'nicco' ? 'nicco' : 'diana',
      cartaoRotulo: cart?.apelido ?? FORA_DO_CARTAO,
    }
  })

  const acerto = calcAcerto(detalhes.map((d) => d.lanc))

  const ehCompart = (t: DivisaoTipo) => t === 'dividir' || t === 'personalizado'
  const compartDiana = detalhes.filter((d) => d.pagoPor === 'diana' && ehCompart(d.lanc.divisaoTipo))
  const compartNicco = detalhes.filter((d) => d.pagoPor === 'nicco' && ehCompart(d.lanc.divisaoTipo))

  const g1 = agruparPorCartao(compartDiana)
  const g2 = agruparPorCartao(compartNicco)

  // Sufixo "(cartão Diana/Nicco)" como no modelo — exceto a linha "Fora do cartão".
  const comSufixo = (grupos: GrupoCartao[], dono: string): GrupoCartao[] =>
    grupos.map((g) =>
      g.rotulo === FORA_DO_CARTAO ? g : { ...g, rotulo: `${g.rotulo} (cartão ${dono})` },
    )

  const niccoDeve = compartDiana.reduce((s, d) => s + quantoCabeNicco(d.lanc), 0)
  const dianaDeve = compartNicco.reduce((s, d) => s + quantoCabeDiana(d.lanc), 0)
  const saldo = niccoDeve - dianaDeve

  const dados: DadosDocxAcerto = {
    mes,
    deDiana: saldo < 0,
    transferenciaCentavos: Math.abs(saldo),
    dianaCartoes: comSufixo(g1.grupos, 'Diana'),
    subtotalDianaCentavos: g1.subtotal,
    niccoDeveCentavos: niccoDeve,
    niccoCartoes: comSufixo(g2.grupos, 'Nicco'),
    subtotalNiccoCentavos: g2.subtotal,
    dianaDeveCentavos: dianaDeve,
    despesasPessoaisDianaCentavos: acerto.soDianaCentavos,
    despesasPessoaisNiccoCentavos: acerto.soNiccoCentavos,
    metadeCompartDianaCentavos: acerto.diana.cabeCentavos - acerto.soDianaCentavos,
    metadeCompartNiccoCentavos: acerto.nicco.cabeCentavos - acerto.soNiccoCentavos,
    totalCabeDianaCentavos: acerto.diana.cabeCentavos,
    totalCabeNiccoCentavos: acerto.nicco.cabeCentavos,
    totalGeralCentavos: acerto.totalCentavos,
    niccoPagouCentavos: acerto.nicco.pagaCentavos,
    dianaPagouCentavos: acerto.diana.pagaCentavos,
  }

  return { mes, dados }
}
