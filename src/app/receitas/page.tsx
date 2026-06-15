import { createClient } from "@/lib/supabase/server"
import { getCurrentGroupId } from "@/lib/auth/group"
import { MonthSelector } from "@/components/month-selector"
import { ReceitasList, NovaReceitaForm } from "./form"

export default async function ReceitasPage(props: { searchParams: Promise<{ mes?: string }> }) {
  const searchParams = await props.searchParams
  const mes = searchParams.mes || "2026-06"

  const supabase = await createClient()
  const grupoId = await getCurrentGroupId()

  // Buscar membros
  const { data: membrosData } = await supabase.from('membros').select('id, apelido, papel').eq('grupo_id', grupoId).order('papel', { ascending: true })
  const membros = membrosData || []
  
  const membro1 = membros[0]
  const membro2 = membros[1]

  // Buscar receitas do mês
  const { data: receitasData } = await supabase
    .from('receitas')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('data_competencia', mes)
  const receitas = receitasData || []

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receitas do Mês</h1>
          <p className="text-muted-foreground mt-1">
            Lance os salários e entradas extras de cada um.
          </p>
        </div>
        <MonthSelector currentMonth={mes} />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Coluna Membro 1 */}
        {membro1 && (
          <div className="space-y-4">
            <ReceitasList 
              receitas={receitas} 
              membro={membro1} 
              mes={mes}
            />
            <NovaReceitaForm 
              membro={membro1} 
              mes={mes} 
              opcoesFontes={['Salário', 'Outros']} 
            />
          </div>
        )}

        {/* Coluna Membro 2 */}
        {membro2 && (
          <div className="space-y-4">
            <ReceitasList 
              receitas={receitas} 
              membro={membro2} 
              mes={mes}
            />
            <NovaReceitaForm 
              membro={membro2} 
              mes={mes} 
              opcoesFontes={['Salário', 'Outros']} 
            />
          </div>
        )}

      </div>
    </div>
  )
}
