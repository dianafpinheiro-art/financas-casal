"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { salvarCartao, deletarCartao } from "./actions"
import { Plus, Trash2, Edit } from "lucide-react"

export function CartoesClient({ cartoes, membros }: { cartoes: any[], membros: any[] }) {
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

  function openEdit(cartao: any) {
    setEditId(cartao.id)
    setFormData(cartao)
    setIsOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja apagar este cartão?")) return
    setIsDeleting(id)
    const res = await deletarCartao(id)
    if (res.success) {
      toast.success("Apagado com sucesso!")
      router.refresh()
    } else {
      toast.error(res.message)
    }
    setIsDeleting(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    
    const res = await salvarCartao({ ...formData, id: editId })
    if (res.success) {
      toast.success(editId ? "Cartão atualizado!" : "Cartão criado!")
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
          <h1 className="text-3xl font-bold tracking-tight">Cartões de Crédito</h1>
          <p className="text-muted-foreground mt-1">Gerencie os cartões usados para as importações.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Cartão
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cartoes.map(c => {
          const dono = membros.find(m => m.id === c.membro_id)
          return (
            <div key={c.id} className="relative p-6 rounded-2xl border bg-card shadow-sm flex flex-col gap-4 group">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{c.apelido}</h3>
                  <p className="text-sm text-muted-foreground">{c.banco} • {c.bandeira}</p>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-8 w-8">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} disabled={isDeleting === c.id} className="h-8 w-8 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-between items-end mt-4 pt-4 border-t border-border/50">
                <div className="text-xs space-y-1 text-muted-foreground">
                  <p>Vencimento: dia {c.dia_vencimento}</p>
                  <p>Fechamento: dia {c.dia_fechamento}</p>
                </div>
                <div className="text-xs font-medium px-2 py-1 rounded-md bg-secondary/50 text-secondary-foreground">
                  {dono?.apelido || 'Desconhecido'}
                </div>
              </div>
            </div>
          )
        })}
        {cartoes.length === 0 && (
          <div className="col-span-full p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground">
            Nenhum cartão cadastrado.
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Cartão" : "Novo Cartão"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Apelido (ex: Nubank Nicco)</label>
                <Input 
                  required 
                  value={formData.apelido || ''} 
                  onChange={e => setFormData({...formData, apelido: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Membro Titular</label>
                <Select 
                  required 
                  value={formData.membro_id || ''} 
                  onValueChange={val => setFormData({...formData, membro_id: val})}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {membros.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.apelido}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Banco</label>
                <Input 
                  required 
                  value={formData.banco || ''} 
                  onChange={e => setFormData({...formData, banco: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Bandeira</label>
                <Input 
                  required 
                  value={formData.bandeira || ''} 
                  onChange={e => setFormData({...formData, bandeira: e.target.value})} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Dia do Fechamento</label>
                <Input 
                  type="number" min="1" max="31" required 
                  value={formData.dia_fechamento || ''} 
                  onChange={e => setFormData({...formData, dia_fechamento: parseInt(e.target.value)})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dia do Vencimento</label>
                <Input 
                  type="number" min="1" max="31" required 
                  value={formData.dia_vencimento || ''} 
                  onChange={e => setFormData({...formData, dia_vencimento: parseInt(e.target.value)})} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Parser Tipo (Ex: nubank, inter)</label>
              <Input 
                required 
                value={formData.parser_tipo || ''} 
                onChange={e => setFormData({...formData, parser_tipo: e.target.value})} 
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Salvando..." : "Salvar Cartão"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
