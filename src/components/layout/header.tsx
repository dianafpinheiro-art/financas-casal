"use client"

import { Bell, Moon, Sun, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"

export function Header() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(true)
  const [email, setEmail] = useState<string>("")
  const [grupoNome, setGrupoNome] = useState<string>("Carregando...")
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpen])

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

        {/* Custom dropdown to avoid Base UI Menu crash on item click */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative h-9 w-9 flex items-center justify-center rounded-full bg-muted border border-border hover:bg-muted/80 transition-colors"
          >
            <User className="w-5 h-5 text-muted-foreground" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium leading-none">{grupoNome}</p>
                <p className="text-xs leading-none text-muted-foreground mt-1">
                  {email}
                </p>
              </div>
              <div className="-mx-1 my-1 h-px bg-border" />
              <button
                onClick={() => {
                  setMenuOpen(false)
                  router.push("/ajustes")
                }}
                className="relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Perfil & Ajustes
              </button>
              <div className="-mx-1 my-1 h-px bg-border" />
              <a
                href="/api/auth/logout"
                className="relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent text-destructive hover:text-destructive"
              >
                Sair
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
