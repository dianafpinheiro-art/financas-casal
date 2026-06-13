import { createClient } from "@/lib/supabase/server"
import { GastosExtrasForm } from "./form"

export default async function GastosExtrasPage() {
  const supabase = await createClient()
  const { data: categorias } = await supabase.from('categorias').select('id, nome').order('nome')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gastos Extra-Cartão</h1>
        <p className="text-muted-foreground mt-2">
          Adicione manualmente despesas que não vieram da fatura do cartão (ex: Pix, boletos, aluguel).
        </p>
      </div>

      <GastosExtrasForm categorias={categorias || []} />
    </div>
  )
}
