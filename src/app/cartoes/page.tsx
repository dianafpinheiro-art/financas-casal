import { createClient } from "@/lib/supabase/server"
import { getCurrentGroupId } from "@/lib/auth/group"
import { CartoesClient } from "./form"

export default async function CartoesPage() {
  const supabase = await createClient()
  const grupoId = await getCurrentGroupId()

  const { data: cartoesData } = await supabase.from('cartoes').select('*').eq('grupo_id', grupoId).order('apelido')
  const cartoes = cartoesData || []

  const { data: membrosData } = await supabase.from('membros').select('id, apelido').eq('grupo_id', grupoId)
  const membros = membrosData || []

  return (
    <div className="max-w-6xl mx-auto py-8">
      <CartoesClient cartoes={cartoes} membros={membros} />
    </div>
  )
}
