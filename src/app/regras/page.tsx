import { createClient } from "@/lib/supabase/server"
import { RegrasClient } from "./form"

export default async function RegrasPage() {
  const supabase = await createClient()

  const { data: regrasData } = await supabase.from('regras_aprendidas').select('*').order('vezes_confirmada', { ascending: false })
  const regras = regrasData || []

  const { data: catData } = await supabase.from('categorias').select('id, nome, icone').order('nome')
  const categorias = catData || []

  return (
    <div className="max-w-6xl mx-auto py-8">
      <RegrasClient regras={regras} categorias={categorias} />
    </div>
  )
}
