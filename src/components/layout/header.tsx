"use client"

import { Bell, Moon, Sun, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

export function Header() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(true)
  const [email, setEmail] = useState<string>("")
  const [grupoNome, setGrupoNome] = useState<string>("Carregando...")

  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(async () => {
      // Usar a server action diretamente com transição resolve o erro de redirecionamento
      const { logout } = await import('@/app/login/actions')
      await logout()
    })
  }

  useEffect(() => {
    // Inicializa o tema baseado no HTML class
    setIsDark(document.documentElement.classList.contains("dark"))

    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || "")
        const { data: membros } = await supabase.from('membros').select('grupos(nome)').eq('user_id', user.id).limit(1)
        if (membros && membros.length > 0 && membros[0].grupos) {
          const gruposObj: any = membros[0].grupos
          setGrupoNome(Array.isArray(gruposObj) ? gruposObj[0]?.nome : gruposObj.nome)
        } else {
          setGrupoNome("Sem Grupo")
        }
      }
    }
    fetchUser()
  }, [])

  const toggleTheme = () => {
    const root = document.documentElement
    if (isDark) {
      root.classList.remove("dark")
      setIsDark(false)
    } else {
      root.classList.add("dark")
      setIsDark(true)
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 shadow-sm z-10 sticky top-0">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Visão Geral
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full text-muted-foreground hover:text-foreground"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
        </Button>

        <div className="h-6 w-px bg-border mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-9 w-9 flex items-center justify-center rounded-full bg-muted border border-border hover:bg-muted/80 transition-colors">
            <User className="w-5 h-5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{grupoNome}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem>
              Configurações do Grupo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
