"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { salvarRegra, deletarRegra } from "./actions"
import { Plus, Trash2, Edit } from "lucide-react"

export function RegrasClient({ regras, categorias }: { regras: any[], categorias: any[] }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState<any>({ divisao_tipo: "dividir" })

  function openNew() {
    setEditId(null)
    setFormData({ divisao_tipo: "dividir" })
    setIsOpen(true)
  }

  function openEdit(regra: any) {
    setEditId(regra.id)
    setFormData(regra)
    setIsOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja apagar esta regra? A IA vai esquecê-la e tentará classificar novamente da próxima vez.")) return
    setIsDeleting(id)
    const res = await deletarRegra(id)
    if (res.success) {
      toast.success("Apagada com sucesso!")
      router.refresh()
    } else {
      toast.error(res.message)
    }
    setIsDeleting(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    
    const payload = { ...formData, id: editId }
    if (payload.divisao_tipo !== "dividir") {
      payload.divisao_pct_diana = payload.divisao_tipo === "diana" ? 100 : 0
    } else if (payload.divisao_pct_diana == null) {
      payload.divisao_pct_diana = 50
    }

    const res = await salvarRegra(payload)
    if (res.success) {
      toast.success(editId ? "Regra atualizada!" : "Regra criada!")
      setIsOpen(false)
      router.refresh()
    } else {
      toast.error(res.message)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Regras da IA</h1>
          <p className="text-muted-foreground mt-1">Gerencie a memória da Inteligência Artificial sobre as faturas.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Regra
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {regras.map(r => {
          const cat = categorias.find(c => c.id === r.categoria_id)
          return (
            <div key={r.id} className="p-4 rounded-xl border bg-card flex flex-col gap-3 group">
              <div className="flex justify-between items-start">
                <div className="font-mono text-xs bg-muted text-muted-foreground px-2 py-1 rounded truncate flex-1 mr-2">
                  {r.merchant}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)} className="h-6 w-6">
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} disabled={isDeleting === r.id} className="h-6 w-6 text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              <div className="text-sm font-medium">
                {cat ? `${cat.icone || '🏷️'} ${cat.nome}` : 'Sem Categoria'}
              </div>
              
              <div className="flex justify-between items-end mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                <div>
                  Dono: <span className="font-medium text-foreground">
                    {r.divisao_tipo === 'dividir' 
                      ? `Ambos (${r.divisao_pct_diana}% Diana)` 
                      : (r.divisao_tipo === 'diana' ? 'Diana' : 'Nicco')}
                  </span>
                </div>
                <div>Hits: {r.vezes_confirmada || 0}</div>
              </div>
            </div>
          )
        })}
        {regras.length === 0 && (
          <div className="col-span-full p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground">
            A IA ainda não aprendeu nenhuma regra.
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Regra" : "Nova Regra"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Texto da Fatura (Merchant)</label>
              <Input 
                required 
                value={formData.merchant || ''} 
                onChange={e => setFormData({...formData, merchant: e.target.value})} 
                placeholder="Ex: UBER *TRIP"
                className="font-mono uppercase"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria Padrão</label>
              <Select 
                required 
                value={formData.categoria_id || ''} 
                onValueChange={val => setFormData({...formData, categoria_id: val})}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Divisão Padrão</label>
              <Select 
                required 
                value={formData.divisao_tipo || "dividir"} 
                onValueChange={val => setFormData({...formData, divisao_tipo: val})}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dividir">Dividir entre o casal</SelectItem>
                  <SelectItem value="diana">Apenas Diana</SelectItem>
                  <SelectItem value="nicco">Apenas Nicco</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.divisao_tipo === "dividir" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">% da Diana</label>
                <Input 
                  type="number" min="0" max="100" required 
                  value={formData.divisao_pct_diana ?? 50} 
                  onChange={e => setFormData({...formData, divisao_pct_diana: parseInt(e.target.value)})} 
                />
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Salvando..." : "Salvar Regra"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
