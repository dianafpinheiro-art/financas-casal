"use client"

import React, { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { formatarCentavosParaReal } from '@/lib/utils/centavos'
import { updateCategoriaLancamento } from '@/app/lancamentos/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c']

export function GraficoCategorias({ lancamentos, categorias = [] }: { lancamentos: any[], categorias?: {id: string, nome: string}[] }) {
  const router = useRouter()
  const [cartaoSelecionado, setCartaoSelecionado] = useState<string>("todos")
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Obter lista única de cartões
  const cartoesDisponiveis = useMemo(() => {
    const nomes = new Set<string>()
    lancamentos.forEach(l => nomes.add(l.cartoes?.apelido || "Extra-cartão"))
    return Array.from(nomes).sort()
  }, [lancamentos])

  // Filtrar e agrupar
  const filtradosPeloCartao = useMemo(() => {
    return cartaoSelecionado === "todos" 
      ? lancamentos 
      : lancamentos.filter(l => (l.cartoes?.apelido || "Extra-cartão") === cartaoSelecionado)
  }, [lancamentos, cartaoSelecionado])

  const dadosGrafico = useMemo(() => {
    const agrupado: Record<string, number> = {}
    filtradosPeloCartao.forEach(l => {
      const cat = l.categorias?.nome || "Sem categoria"
      agrupado[cat] = (agrupado[cat] || 0) + l.valor
    })

    return Object.entries(agrupado)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor) // Maior pro menor
  }, [filtradosPeloCartao])

  // Lançamentos da categoria clicada
  const lancamentosDaCategoria = useMemo(() => {
    if (!categoriaAberta) return []
    return filtradosPeloCartao.filter(l => {
      const cat = l.categorias?.nome || "Sem categoria"
      return cat === categoriaAberta
    }).sort((a, b) => b.valor - a.valor) // Maior pro menor
  }, [filtradosPeloCartao, categoriaAberta])

  async function handleMudarCategoria(lancamentoId: string, novaCategoriaId: string) {
    setIsUpdating(true)
    const idParaSalvar = novaCategoriaId === "sem_categoria" ? null : novaCategoriaId
    const res = await updateCategoriaLancamento(lancamentoId, idParaSalvar)
    if (res.success) {
      toast.success("Categoria atualizada!")
      router.refresh()
    } else {
      toast.error("Erro: " + res.message)
    }
    setIsUpdating(false)
  }

  return (
    <>
    <Card className="col-span-full md:col-span-1">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Gastos por Categoria</CardTitle>
            <CardDescription>Clique em uma fatia para ver os detalhes</CardDescription>
          </div>
          <Select value={cartaoSelecionado} onValueChange={setCartaoSelecionado}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o cartão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Total Geral</SelectItem>
              {cartoesDisponiveis.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {dadosGrafico.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado para exibir
          </div>
        ) : (
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dadosGrafico}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="valor"
                  nameKey="nome"
                  onClick={(data) => setCategoriaAberta(data.nome)}
                  style={{ cursor: 'pointer' }}
                  label={({ nome, percent }) => {
                    if (percent < 0.04) return null
                    return `${nome.substring(0, 15)}${nome.length > 15 ? '...' : ''} (${(percent * 100).toFixed(0)}%)`
                  }}
                  labelLine={true}
                >
                  {dadosGrafico.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity" />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatarCentavosParaReal(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={!!categoriaAberta} onOpenChange={(open) => !open && setCategoriaAberta(null)}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gastos: {categoriaAberta}</DialogTitle>
          <DialogDescription>
            {lancamentosDaCategoria.length} lançamento(s) encontrado(s) nesta categoria.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-2">
          {lancamentosDaCategoria.map(l => (
            <div key={l.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-muted/20 gap-4">
              <div className="flex-1">
                <p className="font-medium text-sm">{l.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(l.data_lancamento || l.data_competencia).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} • {l.cartoes?.apelido || 'Extra-cartão'}
                  {l.parcela_atual && l.parcela_total > 1 && ` • Parcela ${l.parcela_atual}/${l.parcela_total}`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Select 
                  disabled={isUpdating}
                  value={l.categoria_id || "sem_categoria"} 
                  onValueChange={(val) => handleMudarCategoria(l.id, val)}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
                    <SelectValue>
                      {categorias.find(c => c.id === l.categoria_id)?.nome || "Sem Categoria"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_categoria">Sem Categoria</SelectItem>
                    {categorias.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="font-bold text-sm min-w-[80px] text-right">
                  {formatarCentavosParaReal(l.valor)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
