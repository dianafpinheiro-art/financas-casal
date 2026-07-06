'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/lancamentos', label: 'Lançamentos' },
  { href: '/importar', label: 'Importar' },
  { href: '/ajustes', label: 'Ajustes' },
]

export default function Nav() {
  const pathname = usePathname()
  // Não mostra no login (público).
  if (pathname === '/login' || pathname?.startsWith('/login')) return null

  return (
    <nav className="border-b border-input bg-background">
      <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
        <span className="mr-2 font-semibold text-primary">💜 Casal</span>
        {LINKS.map((l) => {
          const ativo = pathname === l.href || pathname?.startsWith(l.href + '/')
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 transition ${
                ativo
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {l.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
