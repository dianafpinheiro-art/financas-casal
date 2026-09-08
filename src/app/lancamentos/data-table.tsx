"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateDivisaoLancamentosEmLote } from "./actions"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  categorias?: { id: string, nome: string }[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
  categorias = []
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [isBulkPending, setIsBulkPending] = React.useState(false)

  const table = useReactTable({
    data,
    columns,
    getRowId: (row: any) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    autoResetPageIndex: false,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    initialState: {
      columnVisibility: {
        data_competencia: false,
      },
    },
    meta: {
      categorias,
    }
  })

  const uniqueCartoes = React.useMemo(() => {
    const cartoes = new Set(data.map((d: any) => d.cartao_apelido).filter(Boolean))
    return Array.from(cartoes) as string[]
  }, [data])

  const uniqueMeses = React.useMemo(() => {
    const meses = new Set(
      data.map((d) => String((d as { data_competencia?: string }).data_competencia || "").slice(0, 7)).filter(Boolean)
    )
    return Array.from(meses).sort().reverse() as string[]
  }, [data])

  const linhasFiltradas = table.getFilteredRowModel().rows
  const linhasSelecionadas = table.getFilteredSelectedRowModel().rows

  function selecionarTodosFiltrados() {
    const novaSelecao: Record<string, boolean> = {}
    for (const row of linhasFiltradas) novaSelecao[row.id] = true
    setRowSelection(novaSelecao)
  }

  async function aplicarDivisaoEmLote(
    divisao: "dividir" | "so_diana" | "so_nicco" | "nao_classificado"
  ) {
    const ids = linhasSelecionadas.map((row) => row.id)
    if (ids.length === 0) return

    setIsBulkPending(true)
    const resultado = await updateDivisaoLancamentosEmLote(ids, divisao)
    if (resultado.success) {
      toast.success(`${resultado.updated} lançamento(s) atualizado(s).`)
      setRowSelection({})
      window.location.reload()
    } else {
      toast.error(resultado.message || "Erro ao atualizar lançamentos.")
      setIsBulkPending(false)
    }
  }

  return (
    <div>
      <div className="flex items-center py-4 gap-2 flex-wrap">
        <Input
          placeholder="Filtrar por descrição..."
          value={(table.getColumn("descricao")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("descricao")?.setFilterValue(event.target.value)
          }
          className="max-w-sm bg-background/50"
        />

        <select
          aria-label="Filtrar por mês"
          value={(table.getColumn("data_competencia")?.getFilterValue() as string) ?? "all"}
          onChange={(event) =>
            table.getColumn("data_competencia")?.setFilterValue(event.target.value === "all" ? undefined : event.target.value)
          }
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Todos os meses</option>
          {uniqueMeses.map((mes) => <option key={mes} value={mes}>{mes}</option>)}
        </select>

        <select
          aria-label="Filtrar por divisão"
          value={(table.getColumn("divisao_tipo")?.getFilterValue() as string) ?? "all"}
          onChange={(event) =>
            table.getColumn("divisao_tipo")?.setFilterValue(event.target.value === "all" ? undefined : event.target.value)
          }
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Todas as divisões</option>
          <option value="nao_classificado">Pendentes</option>
          <option value="dividir">50/50</option>
          <option value="so_diana">Só Diana</option>
          <option value="so_nicco">Só Nicco</option>
          <option value="personalizado">Personalizado</option>
        </select>

        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "outline", className: "ml-auto" })}>
            Filtros Avançados
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Filtrar por Cartão</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup 
              value={(table.getColumn("cartao_apelido")?.getFilterValue() as string) ?? "all"} 
              onValueChange={(val) => table.getColumn("cartao_apelido")?.setFilterValue(val === "all" ? undefined : val)}
            >
              <DropdownMenuRadioItem value="all">Todos os Cartões</DropdownMenuRadioItem>
              {uniqueCartoes.map(c => (
                <DropdownMenuRadioItem key={c} value={c}>{c}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {linhasSelecionadas.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <span className="mr-2 text-sm font-medium">{linhasSelecionadas.length} selecionado(s)</span>
          <Button type="button" size="sm" disabled={isBulkPending} onClick={() => aplicarDivisaoEmLote("dividir")}>Aplicar 50/50</Button>
          <Button type="button" size="sm" variant="outline" disabled={isBulkPending} onClick={() => aplicarDivisaoEmLote("so_diana")}>Só Diana</Button>
          <Button type="button" size="sm" variant="outline" disabled={isBulkPending} onClick={() => aplicarDivisaoEmLote("so_nicco")}>Só Nicco</Button>
          <Button type="button" size="sm" variant="ghost" disabled={isBulkPending} onClick={() => setRowSelection({})}>Limpar seleção</Button>
        </div>
      )}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} de{" "}
          {table.getFilteredRowModel().rows.length} linha(s) selecionada(s).
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={selecionarTodosFiltrados}
          disabled={linhasFiltradas.length === 0 || isBulkPending}
        >
          Selecionar todos os {linhasFiltradas.length} filtrados
        </Button>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  )
}
