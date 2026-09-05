import { createClient } from "@/lib/supabase/server"
import { RelatorioClient } from "./relatorio-client"
import { buscarTodasPaginas } from '@/lib/supabase/paginar'
import { getCurrentGroupId } from '@/lib/auth/group'
import { mesValido } from '@/domain/importacao'

export default async function RelatorioPage(props: { searchParams: Promise<{ mes?: string }> }) {
  const searchParams = await props.searchParams
  const mes = searchParams.mes || new Date().toISOString().slice(0, 7)
  if (!mesValido(mes)) return <p>Mês inválido.</p>
  const grupoId = await getCurrentGroupId()
  const [ano, numeroMes] = mes.split('-').map(Number)
  const fim = new Date(Date.UTC(ano, numeroMes, 1)).toISOString().slice(0, 10)
  const supabase = await createClient()
  
  const { data } = await buscarTodasPaginas((inicio, final) => supabase
    .from('lancamentos')
    .select(`
      *,
      cartoes ( apelido ),
      categorias ( nome )
    `)
    .eq('grupo_id', grupoId)
    .gte('data_competencia', `${mes}-01`).lt('data_competencia', fim)
    .order('cartao_id', { ascending: true })
    .order('criado_em', { ascending: true })
    .order('id').range(inicio, final))

  // Filtrar pela competência (fatura do mês) em vez da data da compra
  const lancamentos = (data || []).filter(d => d.data_competencia && d.data_competencia.startsWith(mes))

  return <RelatorioClient lancamentos={lancamentos} mes={mes} />
}
