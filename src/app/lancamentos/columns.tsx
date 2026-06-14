"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { formatarCentavosParaReal } from "@/lib/utils/centavos"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateDivisaoLancamento, updateCategoriaLancamento, updateEstabelecimentoLancamento, updateObservacaoLancamento } from "./actions"
import { useState, useEffect } from "react"
import { toast } from "sonner"

export type Lancamento = {
  id: string
  data_lancamento: string
  descricao: string
  merchant: string
  observacao: string
  valor: number // em centavos
  categoria_id: string | null
  categoria_nome: string | null
  cartao_apelido: string | null
  divisao_tipo: "dividir" | "so_diana" | "so_nicco" | "personalizado" | "nao_classificado"
  divisao_pct_diana?: number
  classificado: boolean
  parcela_atual?: number | null
  parcela_total?: number | null
}

export const columns: ColumnDef<Lancamento>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={!!table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Selecionar tudo"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Selecionar linha"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "data_lancamento",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Data
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const dateStr = row.getValue("data_lancamento") as string
      if (!dateStr) return <div className="pl-4">-</div>
      const parts = dateStr.split('T')[0].split('-')
      if (parts.length === 3) {
        return <div className="pl-4">{`${parts[2]}/${parts[1]}/${parts[0]}`}</div>
      }
      return <div className="pl-4">{dateStr}</div>
    },
  },
  {
    accessorKey: "descricao",
    header: "Descrição Original",
    cell: ({ row }) => {
      const pAtual = row.original.parcela_atual
      const pTotal = row.original.parcela_total
      const hasParcela = pAtual && pTotal
      return (
        <div className="flex items-center gap-2 max-w-[200px] truncate">
          <span className="font-medium text-muted-foreground text-xs">{row.getValue("descricao")}</span>
          {hasParcela && (
            <Badge variant="secondary" className="text-[10px] px-1 bg-muted">
              {pAtual}/{pTotal}
            </Badge>
          )}
        </div>
      )
    }
  },
  {
    accessorKey: "merchant",
    header: "Estabelecimento",
    cell: function EstabelecimentoCell({ row }) {
      const lancamento = row.original
      const [value, setValue] = useState(lancamento.merchant || "")
      const [isPending, setIsPending] = useState(false)

      useEffect(() => {
        setValue(lancamento.merchant || "")
      }, [lancamento.merchant])

      async function handleBlur() {
        if (value === (lancamento.merchant || "")) return
        setIsPending(true)
        const res = await updateEstabelecimentoLancamento(lancamento.id, value)
        if (res.success) {
          toast.success("Estabelecimento atualizado!")
        } else {
          toast.error("Erro ao atualizar.")
          setValue(lancamento.merchant || "")
        }
        setIsPending(false)
      }

      return (
        <input 
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if(e.key === 'Enter') e.currentTarget.blur() }}
          disabled={isPending}
          placeholder="Ex: iFood"
          className="h-8 w-full min-w-[120px] bg-transparent border border-transparent hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded px-2 text-sm font-medium transition-colors"
        />
      )
    }
  },
  {
    accessorKey: "observacao",
    header: "Anotação",
    cell: function ObservacaoCell({ row }) {
      const lancamento = row.original
      const [value, setValue] = useState(lancamento.observacao || "")
      const [isPending, setIsPending] = useState(false)

      useEffect(() => {
        setValue(lancamento.observacao || "")
      }, [lancamento.observacao])

      async function handleBlur() {
        if (value === (lancamento.observacao || "")) return
        setIsPending(true)
        const res = await updateObservacaoLancamento(lancamento.id, value)
        if (res.success) {
          toast.success("Anotação salva!")
        } else {
          toast.error("Erro ao salvar anotação.")
          setValue(lancamento.observacao || "")
        }
        setIsPending(false)
      }

      return (
        <input 
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if(e.key === 'Enter') e.currentTarget.blur() }}
          disabled={isPending}
          placeholder="Ex: Presente de mãe"
          className="h-8 w-full min-w-[150px] bg-transparent border border-transparent hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded px-2 text-sm font-medium transition-colors"
        />
      )
    }
  },
  {
    accessorKey: "cartao_apelido",
    header: "Cartão",
    cell: ({ row }) => {
      const cartao = row.getValue("cartao_apelido") as string
      return (
        <Badge variant="outline" className="bg-muted/50">
          {cartao || "Desconhecido"}
        </Badge>
      )
    }
  },
  {
    accessorKey: "valor",
    header: () => <div className="text-right">Valor</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("valor"))
      const formatted = formatarCentavosParaReal(amount)
      return <div className="text-right font-medium">{formatted}</div>
    },
  },
  {
    accessorKey: "categoria_id",
    header: "Categoria",
    cell: function CategoriaCell({ row, table }) {
      const lancamento = row.original
      const [isPending, setIsPending] = useState(false)
      const categorias = (table.options.meta as any)?.categorias || []
      const [value, setValue] = useState(lancamento.categoria_id || "none")

      useEffect(() => {
        setValue(lancamento.categoria_id || "none")
      }, [lancamento.categoria_id])

      async function handleValueChange(newValue: string) {
        setIsPending(true)
        setValue(newValue)
        
        const catId = newValue === "none" ? null : newValue
        const res = await updateCategoriaLancamento(lancamento.id, catId)
        
        if (res.success) {
          toast.success("Categoria atualizada!")
        } else {
          toast.error("Erro ao atualizar categoria.")
          setValue(lancamento.categoria_id || "none")
        }
        setIsPending(false)
      }

      const selectedName = value === "none" ? "Sem categoria" : categorias.find((c: any) => c.id === value)?.nome || "Sem categoria"

      return (
        <Select 
          value={value} 
          onValueChange={handleValueChange}
          disabled={isPending}
        >
          <SelectTrigger className="h-8 w-[150px] border-none shadow-none text-sm bg-muted/30 hover:bg-muted/50 rounded-md">
            <SelectValue>{selectedName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-muted-foreground italic">Sem categoria</SelectItem>
            {categorias.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
  },
  {
    accessorKey: "divisao_tipo",
    header: "Divisão",
    cell: function DivisaoCell({ row }) {
      const lancamento = row.original
      const [isPending, setIsPending] = useState(false)
      const [value, setValue] = useState(lancamento.divisao_tipo)
      
      useEffect(() => {
        setValue(lancamento.divisao_tipo)
      }, [lancamento.divisao_tipo])
      
      const mapDivisao: Record<string, { label: string, color: string }> = {
        'dividir': { label: '50/50', color: 'bg-primary/20 text-primary' },
        'so_diana': { label: 'Só Diana', color: 'bg-pink-500/20 text-pink-500' },
        'so_nicco': { label: 'Só Nicco', color: 'bg-blue-500/20 text-blue-500' },
        'personalizado': { label: `Pers. (${lancamento.divisao_pct_diana || 50}%)`, color: 'bg-amber-500/20 text-amber-500' },
        'nao_classificado': { label: 'Pendente', color: 'bg-destructive/20 text-destructive' },
      }

      async function handleValueChange(newValue: string) {
        setIsPending(true)
        
        let customPct: number | undefined = undefined
        if (newValue === 'personalizado') {
          const res = window.prompt("Digite a % que a Diana vai pagar (ex: 60 para 60% Diana e 40% Nicco):")
          if (res === null) {
            setIsPending(false)
            return // Cancelou o prompt
          }
          const parsed = parseInt(res)
          if (isNaN(parsed) || parsed < 0 || parsed > 100) {
            toast.error("Porcentagem inválida. Deve ser entre 0 e 100.")
            setIsPending(false)
            return
          }
          customPct = parsed
        }
        
        setValue(newValue as any)
        
        const res = await updateDivisaoLancamento(lancamento.id, newValue as any, customPct)
        
        if (res.success) {
          toast.success("Divisão atualizada com sucesso!")
        } else {
          toast.error("Erro ao atualizar divisão.")
          setValue(lancamento.divisao_tipo) // revert
        }
        setIsPending(false)
      }

      const conf = mapDivisao[value] || mapDivisao['nao_classificado']

      return (
        <Select 
          value={value} 
          onValueChange={handleValueChange}
          disabled={isPending}
        >
          <SelectTrigger className={`h-8 w-[130px] border-none shadow-none font-medium ${conf.color}`}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dividir">50/50</SelectItem>
            <SelectItem value="so_diana">Só Diana</SelectItem>
            <SelectItem value="so_nicco">Só Nicco</SelectItem>
            <SelectItem value="personalizado">Personalizado</SelectItem>
            <SelectItem value="nao_classificado">Pendente</SelectItem>
          </SelectContent>
        </Select>
      )
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const lancamento = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0">
            <span className="sr-only">Abrir menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(lancamento.id)}
            >
              Copiar ID do lançamento
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Editar classificação</DropdownMenuItem>
            <DropdownMenuItem>Criar Regra de IA</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
