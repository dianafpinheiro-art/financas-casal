"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { salvarCategoria, deletarCategoria } from "./actions"
import { Plus, Trash2, Edit } from "lucide-react"

export function CategoriasClient({ categorias }: { categorias: any[] }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState<any>({})

  function openNew() {
    setEditId(null)
    setFormData({})
    setIsOpen(true)
  }

  function openEdit(cat: any) {
    setEditId(cat.id)
    setFormData(cat)
    setIsOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja apagar esta categoria? Lançamentos vinculados perderão a categoria.")) return
    setIsDeleting(id)
    const res = await deletarCategoria(id)
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
    
    const res = await salvarCategoria({ ...formData, id: editId })
    if (res.success) {
      toast.success(editId ? "Categoria atualizada!" : "Categoria criada!")
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
          <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground mt-1">Gerencie os grupos de despesas.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {categorias.map(c => (
          <div key={c.id} className="p-4 rounded-xl border bg-card flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{c.icone || '🏷️'}</span>
              <span className="font-medium text-sm">{c.nome}</span>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-7 w-7">
                <Edit className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} disabled={isDeleting === c.id} className="h-7 w-7 text-destructive">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
        {categorias.length === 0 && (
          <div className="col-span-full p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground">
            Nenhuma categoria cadastrada.
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Categoria</label>
              <Input 
                required 
                value={formData.nome || ''} 
                onChange={e => setFormData({...formData, nome: e.target.value})} 
                placeholder="Ex: Supermercado"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ícone (Emoji)</label>
              <Input 
                value={formData.icone || ''} 
                onChange={e => setFormData({...formData, icone: e.target.value})} 
                placeholder="Ex: 🛒"
                maxLength={2}
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Salvando..." : "Salvar Categoria"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
