"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  CreditCard, 
  LayoutDashboard, 
  ListOrdered, 
  Settings, 
  UploadCloud, 
  Tags,
  Wand2,
  Wallet
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Receitas", href: "/receitas", icon: Wallet },
  { name: "Importar", href: "/importar", icon: UploadCloud },
  { name: "Lançamentos", href: "/lancamentos", icon: ListOrdered },
  { name: "Gastos Extras", href: "/gastos-extras", icon: ListOrdered },
  { name: "Cartões", href: "/cartoes", icon: CreditCard },
  { name: "Categorias", href: "/categorias", icon: Tags },
  { name: "Regras IA", href: "/regras", icon: Wand2 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card text-card-foreground shadow-sm">
      <div className="flex h-16 items-center px-6 border-b border-border/50">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <span className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <CreditCard className="w-5 h-5" />
          </span>
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Finanças
          </span>
          <span className="text-muted-foreground font-medium text-lg">Casal</span>
          <span>💜</span>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-sm font-medium",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-200",
                isActive ? "scale-110" : "group-hover:scale-110 group-hover:text-primary"
              )} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <Link
          href="/ajustes"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
          Ajustes
        </Link>
      </div>
    </div>
  )
}
