import { createClient } from "@/lib/supabase/server"
import { MonthSelector } from "@/components/month-selector"
import { ReceitasList, NovaReceitaForm } from "./form"

export default async function ReceitasPage(props: { searchParams: Promise<{ mes?: string }> }) {
  const searchParams = await props.searchParams
  const mes = searchParams.mes || "2026-06"

  const supabase = await createClient()

  // Buscar membros
  const { data: membrosData } = await supabase.from('membros').select('id, apelido')
  const membros = membrosData || []
  
  const nicco = membros.find(m => m.apelido === 'Nicco')
  const diana = membros.find(m => m.apelido === 'Diana')

  // Buscar receitas do mês
  const { data: receitasData } = await supabase
    .from('receitas')
    .select('*')
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
        
        {/* Coluna Nicco */}
        {nicco && (
          <div className="space-y-4">
            <ReceitasList 
              receitas={receitas} 
              membro={nicco} 
              mes={mes}
            />
            <NovaReceitaForm 
              membro={nicco} 
              mes={mes} 
              opcoesFontes={['Salário', 'Safira', 'Outros']} 
            />
          </div>
        )}

        {/* Coluna Diana */}
        {diana && (
          <div className="space-y-4">
            <ReceitasList 
              receitas={receitas} 
              membro={diana} 
              mes={mes}
            />
            <NovaReceitaForm 
              membro={diana} 
              mes={mes} 
              opcoesFontes={['Salário', 'Renda Marketing Digital', 'Outros']} 
            />
          </div>
        )}

      </div>
    </div>
  )
}
