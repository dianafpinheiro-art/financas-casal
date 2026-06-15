import { createClient } from "@/lib/supabase/server"
import { getCurrentGroupId } from "@/lib/auth/group"
import { CategoriasClient } from "./form"

export default async function CategoriasPage() {
  const supabase = await createClient()
  const grupoId = await getCurrentGroupId()

  const { data: catData } = await supabase.from('categorias').select('*').eq('grupo_id', grupoId).order('nome')
  const categorias = catData || []

  return (
    <div className="max-w-5xl mx-auto py-8">
      <CategoriasClient categorias={categorias} />
    </div>
  )
}
