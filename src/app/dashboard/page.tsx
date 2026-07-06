import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <header className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Diana &amp; Nicco
        </p>
        <h1 className="text-2xl font-medium mt-1">Maio · 2026</h1>
      </header>

      <section className="bg-nicco-50 dark:bg-nicco-900 rounded-lg p-5 text-center mb-3">
        <p className="text-xs text-nicco-800 dark:text-nicco-100 uppercase tracking-wider">
          Nicco te transfere
        </p>
        <p className="text-3xl font-medium text-nicco-900 dark:text-nicco-50 mt-1">
          R$ 0,00
        </p>
        <p className="text-xs text-nicco-800 dark:text-nicco-100 mt-2 opacity-70">
          Importa as faturas do mês pra calcular
        </p>
      </section>

      <div className="rounded-lg border p-4 mt-6 text-center text-sm text-muted-foreground">
        Logado como <span className="font-medium text-foreground">{user?.email}</span>
        <br />
        <span className="text-xs">Vamos construir o resto a partir daqui!</span>
      </div>
    </div>
  )
}
