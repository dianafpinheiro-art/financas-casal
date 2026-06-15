import { createClient } from "@/lib/supabase/server"
import { AjustesClient } from "./ajustes-client"

export default async function AjustesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: membrosData } = await supabase
    .from('membros')
    .select('id, apelido, papel, user_id, grupos(id, nome)')
    .order('papel')

  const membros = membrosData || []

  const { data: grupoData } = await supabase
    .from('grupos')
    .select('id, nome')
    .limit(1)
    .single()

  return (
    <div className="max-w-4xl mx-auto py-8">
      <AjustesClient
        user={user ? { id: user.id, email: user.email || "" } : null}
        membros={membros}
        grupo={grupoData}
      />
    </div>
  )
}
