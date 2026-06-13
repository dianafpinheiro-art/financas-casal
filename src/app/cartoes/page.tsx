import { createClient } from "@/lib/supabase/server"
import { CartoesClient } from "./form"

export default async function CartoesPage() {
  const supabase = await createClient()

  const { data: cartoesData } = await supabase.from('cartoes').select('*').order('apelido')
  const cartoes = cartoesData || []

  const { data: membrosData } = await supabase.from('membros').select('id, apelido')
  const membros = membrosData || []

  return (
    <div className="max-w-6xl mx-auto py-8">
      <CartoesClient cartoes={cartoes} membros={membros} />
    </div>
  )
}
