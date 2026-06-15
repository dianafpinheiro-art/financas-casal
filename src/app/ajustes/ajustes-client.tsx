"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Users, Shield, Mail } from "lucide-react"

type Membro = {
  id: string
  apelido: string
  papel: string
  user_id: string | null
  grupos: { id: string; nome: string } | { id: string; nome: string }[] | null
}

type Props = {
  user: { id: string; email: string } | null
  membros: Membro[]
  grupo: { id: string; nome: string } | null
}

export function AjustesClient({ user, membros, grupo }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie seu perfil e as configurações do grupo.
        </p>
      </div>

      {/* Conta do Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Sua Conta
          </CardTitle>
          <CardDescription>
            Informações da conta autenticada neste dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">E-mail</span>
              <span className="text-sm font-medium">{user?.email || "—"}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">ID do Usuário</span>
              <span className="text-xs font-mono text-muted-foreground">{user?.id?.slice(0, 8)}...</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grupo / Casal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Grupo: {grupo?.nome || "Sem grupo"}
          </CardTitle>
          <CardDescription>
            Membros que compartilham as finanças neste grupo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {membros.map((membro) => (
              <div
                key={membro.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{membro.apelido}</p>
                    <p className="text-xs text-muted-foreground">
                      {membro.user_id === user?.id ? "Você" : "Membro do casal"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {membro.papel === "admin" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                  {membro.papel === "membro" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                      Membro
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Segurança
          </CardTitle>
          <CardDescription>
            Informações sobre a proteção dos seus dados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Autenticação</span>
              <span className="text-sm font-medium text-green-500">Supabase Auth ✓</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Sessão</span>
              <span className="text-sm font-medium text-green-500">Ativa</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Dados criptografados</span>
              <span className="text-sm font-medium text-green-500">HTTPS + RLS</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
