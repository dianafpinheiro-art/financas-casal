"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { salvarGastoExtra } from "./actions"

export function GastosExtrasForm({ categorias }: { categorias: { id: string, nome: string }[] }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quemPagou, setQuemPagou] = useState<string>("Diana")
  const [divisaoTipo, setDivisaoTipo] = useState<string>("dividir")
  const [pctDiana, setPctDiana] = useState<string>("50")
  const [categoriaId, setCategoriaId] = useState<string>("sem_categoria")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data_lancamento = formData.get("data_lancamento") as string
    const descricao = formData.get("descricao") as string
    const valorReais = parseFloat(formData.get("valor") as string)
    
    if (!data_lancamento || !descricao || isNaN(valorReais)) {
      toast.error("Preencha todos os campos corretamente.")
      setIsSubmitting(false)
      return
    }

    const valor_cents = Math.round(valorReais * 100)
    let finalPctDiana = 50

    if (divisaoTipo === "personalizado") {
      finalPctDiana = parseInt(pctDiana)
      if (isNaN(finalPctDiana) || finalPctDiana < 0 || finalPctDiana > 100) {
        toast.error("Porcentagem inválida. Deve ser entre 0 e 100.")
        setIsSubmitting(false)
        return
      }
    }

    const res = await salvarGastoExtra({
      data_lancamento,
      descricao,
      valor_cents,
      quem_pagou: quemPagou,
      divisao_tipo: divisaoTipo,
      divisao_pct_diana: finalPctDiana,
      categoria_id: categoriaId === "sem_categoria" ? undefined : categoriaId
    })

    if (res.success) {
      toast.success(res.message)
      // Reset form
      const form = e.target as HTMLFormElement
      form.reset()
      setDivisaoTipo("dividir")
      setPctDiana("50")
      setCategoriaId("sem_categoria")
      router.refresh()
    } else {
      toast.error(res.message)
    }

    setIsSubmitting(false)
  }

  return (
    <Card className="max-w-2xl border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Novo Gasto</CardTitle>
        <CardDescription>
          Preencha os dados do gasto e como ele será dividido.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_lancamento">Data do Gasto</Label>
              <Input 
                id="data_lancamento" 
                name="data_lancamento" 
                type="date" 
                required 
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input 
                id="valor" 
                name="valor" 
                type="number" 
                step="0.01" 
                min="0"
                placeholder="0,00"
                required 
                className="bg-background/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input 
                id="descricao" 
                name="descricao" 
                type="text" 
                placeholder="Ex: Aluguel do mês, Conta de Luz"
                required 
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={(val) => setCategoriaId(val)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_categoria">Sem Categoria</SelectItem>
                  {categorias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quem Pagou?</Label>
              <Select value={quemPagou} onValueChange={(val) => setQuemPagou(val || "Diana")}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Quem pagou?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diana">Diana</SelectItem>
                  <SelectItem value="Nicco">Nicco</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Divisão (quem deve pagar)</Label>
              <Select value={divisaoTipo} onValueChange={(val) => setDivisaoTipo(val || "dividir")}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Selecione a divisão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dividir">Dividir 50/50</SelectItem>
                  <SelectItem value="so_diana">Só Diana</SelectItem>
                  <SelectItem value="so_nicco">Só Nicco</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {divisaoTipo === "personalizado" && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label htmlFor="pct_diana">% Pago pela Diana</Label>
              <div className="flex items-center gap-2">
                <Input 
                  id="pct_diana" 
                  type="number" 
                  value={pctDiana}
                  onChange={(e) => setPctDiana(e.target.value)}
                  min="0"
                  max="100"
                  className="w-24 bg-background/50"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                (O restante de {100 - (parseInt(pctDiana) || 0)}% será pago pelo Nicco)
              </p>
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full mt-4">
            {isSubmitting ? "Salvando..." : "Salvar Gasto Extra"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
