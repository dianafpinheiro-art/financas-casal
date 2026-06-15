import { columns, Lancamento } from "./columns"
import { DataTable } from "./data-table"
import { createClient } from "@/lib/supabase/server"
import { getCurrentGroupId } from "@/lib/auth/group"

export default async function LancamentosPage() {
  const supabase = await createClient()
  const grupoId = await getCurrentGroupId()
  
  // Buscar os dados reais do banco
  const { data: lancamentos, error } = await supabase
    .from('lancamentos')
    .select(`
      id,
      cartao_id,
      data_lancamento,
      descricao,
      merchant,
      observacao,
      valor,
      divisao_tipo,
      divisao_pct_diana,
      classificado,
      parcela_atual,
      parcela_total,
      categoria_id,
      categorias ( nome ),
      cartoes ( apelido ),
      criado_em
    `)
    .eq('grupo_id', grupoId)
    .order('criado_em', { ascending: true })

  // Formatar os dados para o formato esperado pela tabela
  const formattedData: Lancamento[] = (lancamentos || []).map((l: any) => ({
    id: l.id,
    data_lancamento: l.data_lancamento || '',
    descricao: l.descricao,
    merchant: l.merchant || '',
    observacao: l.observacao || '',
    valor: l.valor,
    categoria_id: l.categoria_id,
    categoria_nome: l.categorias?.nome || null,
    cartao_apelido: l.cartoes?.apelido || (l.cartao_id === null ? 'Gasto Extra' : 'Desconhecido'),
    divisao_tipo: l.divisao_tipo,
    divisao_pct_diana: l.divisao_pct_diana,
    classificado: l.classificado,
    parcela_atual: l.parcela_atual,
    parcela_total: l.parcela_total,
  }))

  const { data: categoriasLista } = await supabase.from('categorias').select('id, nome').eq('grupo_id', grupoId).order('nome')

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lançamentos</h1>
        <p className="text-muted-foreground">
          Gerencie e classifique todas as transações importadas.
        </p>
      </div>
      
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        {error ? (
          <div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
            Erro ao carregar dados: {error.message}
          </div>
        ) : (
          <DataTable columns={columns} data={formattedData} categorias={categoriasLista || []} />
        )}
      </div>
    </div>
  )
}
