import { createClient } from "@/lib/supabase/server"
import { RegrasClient } from "./form"

export default async function RegrasPage() {
  const supabase = await createClient()

  const { data: regrasData } = await supabase.from('regras_aprendidas').select('*').order('vezes_confirmada', { ascending: false })
  const regras = regrasData || []

  const { data: catData } = await supabase.from('categorias').select('id, nome, icone').order('nome')
  const categorias = catData || []

  const { data: membrosData } = await supabase.from('membros').select('id, apelido').order('criado_em', { ascending: true })
  const membro1Nome = membrosData && membrosData.length > 0 ? membrosData[0].apelido : "Membro 1"
  const membro2Nome = membrosData && membrosData.length > 1 ? membrosData[1].apelido : "Membro 2"

  return (
    <div className="max-w-6xl mx-auto py-8">
      <RegrasClient regras={regras} categorias={categorias} membro1Nome={membro1Nome} membro2Nome={membro2Nome} />
    </div>
  )
}
