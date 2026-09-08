import { createClient } from "@/lib/supabase/server"
import { getCurrentGroupId } from "@/lib/auth/group"
import { buscarTodasPaginas } from "@/lib/supabase/paginar"
import { ConferenciaClient, ConferenciaItem } from "./review-client"
import { extrairDetalheUsuario, removerDetalheUsuario } from "@/lib/lancamentos/detalhe-usuario"

type LancamentoBanco = {
  id: string
  cartao_id: string | null
  pago_por_id: string | null
  data_lancamento: string | null
  data_competencia: string | null
  descricao: string | null
  merchant: string | null
  observacao: string | null
  valor: number
  divisao_tipo: ConferenciaItem["divisao_tipo"]
  divisao_pct_diana: number | null
  parcela_atual: number | null
  parcela_total: number | null
  categorias: { nome: string }[] | { nome: string } | null
  cartoes: { apelido: string }[] | { apelido: string } | null
}

function proximoMes(mes: string) {
  const [ano, numeroMes] = mes.split("-").map(Number)
  const data = new Date(Date.UTC(ano, numeroMes, 1))
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`
}

export default async function ConferenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const supabase = await createClient()
  const grupoId = await getCurrentGroupId()
  const query = await searchParams

  const { data: competencias } = await buscarTodasPaginas((inicio, fim) =>
    supabase
      .from("lancamentos")
      .select("data_competencia")
      .eq("grupo_id", grupoId)
      .not("data_competencia", "is", null)
      .range(inicio, fim)
  )

  const meses = Array.from(
    new Set(
      (competencias || [])
        .map((item: { data_competencia: string | null }) => item.data_competencia?.slice(0, 7))
        .filter((mes): mes is string => Boolean(mes && /^\d{4}-\d{2}$/.test(mes)))
    )
  ).sort().reverse()

  const mesSolicitado = typeof query.mes === "string" && /^\d{4}-\d{2}$/.test(query.mes)
    ? query.mes
    : undefined
  const mesSelecionado = mesSolicitado && meses.includes(mesSolicitado)
    ? mesSolicitado
    : meses[0] || new Date().toISOString().slice(0, 7)

  const [lancamentosRes, membrosRes] = await Promise.all([
    buscarTodasPaginas((inicio, fim) =>
      supabase
        .from("lancamentos")
        .select(`
          id,
          cartao_id,
          pago_por_id,
          data_lancamento,
          data_competencia,
          descricao,
          merchant,
          observacao,
          valor,
          divisao_tipo,
          divisao_pct_diana,
          parcela_atual,
          parcela_total,
          categorias ( nome ),
          cartoes ( apelido )
        `)
        .eq("grupo_id", grupoId)
        .gte("data_competencia", `${mesSelecionado}-01`)
        .lt("data_competencia", `${proximoMes(mesSelecionado)}-01`)
        // Cada importacao grava `criado_em` na mesma sequencia das linhas do PDF.
        // Ordenar pela data da compra embaralhava parcelamentos e blocos da fatura.
        .order("criado_em", { ascending: true })
        .order("id")
        .range(inicio, fim)
    ),
    supabase.from("membros").select("id, apelido").eq("grupo_id", grupoId),
  ])

  const membros = new Map(
    (membrosRes.data || []).map((membro: { id: string; apelido: string }) => [membro.id, membro.apelido])
  )

  const itens: ConferenciaItem[] = ((lancamentosRes.data || []) as LancamentoBanco[]).map((item) => {
    const cartaoRelacionado = Array.isArray(item.cartoes) ? item.cartoes[0] : item.cartoes
    const categoriaRelacionada = Array.isArray(item.categorias) ? item.categorias[0] : item.categorias

    return {
      id: item.id,
      data_lancamento: item.data_lancamento || "",
      data_competencia: item.data_competencia || "",
      descricao: item.descricao || "Sem descrição",
      merchant: item.merchant || "",
      observacao: removerDetalheUsuario(item.observacao),
      detalhe: extrairDetalheUsuario(item.observacao),
      valor: item.valor,
      cartao_apelido: cartaoRelacionado?.apelido || (item.cartao_id === null ? "Despesas extras" : "Cartão desconhecido"),
      eh_extra: item.cartao_id === null,
      pago_por: item.pago_por_id ? membros.get(item.pago_por_id) || "Não informado" : "Não informado",
      categoria: categoriaRelacionada?.nome || "Sem categoria",
      divisao_tipo: item.divisao_tipo,
      divisao_pct_diana: item.divisao_pct_diana ?? 50,
      parcela_atual: item.parcela_atual,
      parcela_total: item.parcela_total,
    }
  })

  return (
    <ConferenciaClient
      key={mesSelecionado}
      itens={itens}
      meses={meses}
      mesSelecionado={mesSelecionado}
    />
  )
}
