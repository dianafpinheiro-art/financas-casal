import { createClient } from "@/lib/supabase/server"
import { RelatorioClient } from "./relatorio-client"

export default async function RelatorioPage(props: { searchParams: Promise<{ mes?: string }> }) {
  const searchParams = await props.searchParams
  const mes = searchParams.mes || "2026-06"
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('lancamentos')
    .select(`
      *,
      cartoes ( apelido ),
      categorias ( nome )
    `)
    .order('cartao_id', { ascending: true })
    .order('criado_em', { ascending: true })

  if (error) {
    return <div className="p-8 text-center text-red-500">Erro ao carregar dados: {error.message}</div>
  }

  // Filtrar pela competência (fatura do mês) em vez da data da compra
  const lancamentos = (data || []).filter(d => d.data_competencia && d.data_competencia.startsWith(mes))

  return <RelatorioClient lancamentos={lancamentos} mes={mes} />
}
