import { createClient } from '@/lib/supabase/server'
import LancamentosClient from './lancamentos-client'
import { type LancamentoRow, type ResumoMes } from './tipos'

function proximoMesISO(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  // m é 1..12; Date.UTC(a, m, 1) já cai no mês seguinte (índice m).
  return new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10)
}

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string
    cartao?: string
    status?: string
    div?: string
    q?: string
  }>
}) {
  const supabase = await createClient()
  const {
    mes: mesParam,
    cartao: cartaoParam,
    status: statusParam,
    div: divParam,
    q: qParam,
  } = await searchParams

  // Mês default: o mais recente que tem lançamento; senão o mês atual.
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

  // Mapa membro_id -> apelido (pago_por tem 2 FKs pra membros; resolve em memória).
  const { data: membros } = await supabase.from('membros').select('id, apelido')
  const apelidoPorMembro = new Map<string, string>(
    (membros ?? []).map((m) => [m.id as string, m.apelido as string]),
  )

  const { data: rows } = await supabase
    .from('lancamentos')
    .select(
      'id, data_lancamento, descricao, valor, divisao_tipo, divisao_pct_diana, classificado, mes_fechado, tags, observacao, pago_por_id, cartao_id, categoria:categorias(nome), cartao:cartoes(apelido)',
    )
    .gte('data_competencia', inicio)
    .lt('data_competencia', fim)
    .order('data_lancamento', { ascending: true })

  const lancamentos: LancamentoRow[] = (rows ?? []).map((r) => {
    const cat = Array.isArray(r.categoria) ? r.categoria[0] : r.categoria
    const cart = Array.isArray(r.cartao) ? r.cartao[0] : r.cartao
    return {
      id: r.id,
      dataLancamento: String(r.data_lancamento),
      descricao: r.descricao,
      valorCentavos: r.valor,
      divisaoTipo: r.divisao_tipo,
      divisaoPctDiana: r.divisao_pct_diana,
      classificado: r.classificado,
      tags: r.tags,
      observacao: r.observacao,
      cartaoId: (r.cartao_id as string | null) ?? null,
      cartao: cart?.apelido ?? '',
      pagoPor: apelidoPorMembro.get(r.pago_por_id) ?? '?',
      categoria: cat?.nome ?? null,
      mesFechado: r.mes_fechado ?? false,
    }
  })

  const resumo: ResumoMes = {
    total: lancamentos.length,
    totalCentavos: lancamentos.reduce((s, l) => s + l.valorCentavos, 0),
    aRevisar: lancamentos.filter((l) => !l.classificado).length,
  }

  // Opções pro form de lançamento manual.
  const { data: cartoesRows } = await supabase
    .from('cartoes')
    .select('id, apelido')
    .eq('ativo', true)
    .order('apelido')
  const cartoes = (cartoesRows ?? []).map((c) => ({ id: c.id, apelido: c.apelido }))

  const { data: catRows } = await supabase
    .from('categorias')
    .select('id, nome')
    .eq('ativo', true)
    .order('ordem')
  const categorias = (catRows ?? []).map((c) => ({ id: c.id, nome: c.nome }))

  const membrosOpcoes = (membros ?? []).map((m) => ({ id: m.id, apelido: m.apelido }))

  return (
    <LancamentosClient
      mes={mes}
      lancamentos={lancamentos}
      resumo={resumo}
      cartoes={cartoes}
      categorias={categorias}
      membros={membrosOpcoes}
      filtroInicial={{
        cartao: cartaoParam ?? 'all',
        status: statusParam ?? 'todos',
        div: divParam ?? 'todas',
        q: qParam ?? '',
      }}
    />
  )
}
