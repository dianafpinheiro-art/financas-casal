"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { salvarReceita, deletarReceita } from "./actions"
import { formatarCentavosParaReal } from "@/lib/utils/centavos"
import { Trash2 } from "lucide-react"

export function ReceitasList({ 
  receitas,
  membro,
  mes
}: { 
  receitas: any[], 
  membro: any,
  mes: string
}) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const minhasReceitas = receitas.filter(r => r.membro_id === membro.id)
  const total = minhasReceitas.reduce((acc, curr) => acc + curr.valor, 0)

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja apagar essa receita?")) return
    setIsDeleting(id)
    const res = await deletarReceita(id)
    if (res.success) {
      toast.success("Apagada com sucesso!")
      router.refresh()
    } else {
      toast.error(res.message)
    }
    setIsDeleting(null)
  }

  return (
    <Card className="flex flex-col h-full bg-card/50 border-border/50 backdrop-blur-sm relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 ${membro.apelido === 'Diana' ? 'bg-pink-500' : 'bg-blue-500'}`} />
      <CardHeader>
        <CardTitle className="text-xl">{membro.apelido}</CardTitle>
        <CardDescription>Receitas de {mes}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-6">
        
        <div className="space-y-3 flex-1">
          {minhasReceitas.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-xl">
              Nenhuma receita lançada.
            </div>
          ) : (
            minhasReceitas.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                <span className="font-medium text-sm">{r.fonte}</span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-green-600">{formatarCentavosParaReal(r.valor)}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(r.id)}
                    disabled={isDeleting === r.id}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <span className="font-semibold text-muted-foreground">Total Recebido:</span>
          <span className="font-black text-xl text-green-500">{formatarCentavosParaReal(total)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function NovaReceitaForm({ membro, mes, opcoesFontes }: { membro: any, mes: string, opcoesFontes: string[] }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fonteSelecionada, setFonteSelecionada] = useState(opcoesFontes[0])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    const valorReais = parseFloat(formData.get("valor") as string)
    let fonte = fonteSelecionada
    if (fonte === 'Outros') {
      const outraFonte = formData.get("outra_fonte") as string
      if (outraFonte) fonte = outraFonte
    }

    if (isNaN(valorReais) || !fonte) {
      toast.error("Preencha o valor e a fonte da receita.")
      setIsSubmitting(false)
      return
    }

    const valor_cents = Math.round(valorReais * 100)

    const res = await salvarReceita({
      membro_id: membro.id,
      fonte,
      valor_cents,
      data_competencia: mes
    })

    if (res.success) {
      toast.success(res.message)
      const form = e.target as HTMLFormElement
      form.reset()
      setFonteSelecionada(opcoesFontes[0])
      router.refresh()
    } else {
      toast.error(res.message)
    }

    setIsSubmitting(false)
  }

  return (
    <Card className="mt-4 border-border/50">
      <CardHeader className="py-4">
        <CardTitle className="text-base">Adicionar Receita</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fonte</label>
            <div className="flex flex-wrap gap-2">
              {opcoesFontes.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFonteSelecionada(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    fonteSelecionada === f 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {fonteSelecionada === 'Outros' && (
              <Input 
                name="outra_fonte" 
                placeholder="Qual?" 
                className="mt-2 h-8 text-sm" 
                required 
              />
            )}
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
            <Input 
              name="valor" 
              type="number" 
              step="0.01" 
              min="0"
              placeholder="0,00"
              required
              className="bg-background/50 h-9"
            />
          </div>

          <Button type="submit" disabled={isSubmitting} size="sm" className="w-full">
            {isSubmitting ? "Salvando..." : "Adicionar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
