"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, CheckCircle2, ChevronRight, ReceiptText, Save, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { excluirLancamento, updateDetalheLancamento, updateDivisaoLancamento } from "@/app/lancamentos/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatarCentavosParaReal } from "@/lib/utils/centavos"
import { cn } from "@/lib/utils"

type Divisao = "dividir" | "so_diana" | "so_nicco" | "personalizado" | "nao_classificado"

export type ConferenciaItem = {
  id: string
  data_lancamento: string
  data_competencia: string
  descricao: string
  merchant: string
  observacao: string
  detalhe: string
  valor: number
  cartao_apelido: string
  eh_extra: boolean
  pago_por: string
  categoria: string
  divisao_tipo: Divisao
  divisao_pct_diana: number
  parcela_atual?: number | null
  parcela_total?: number | null
}

const opcoes: Array<{ valor: Exclude<Divisao, "nao_classificado">; rotulo: string; estilo: string }> = [
  { valor: "so_nicco", rotulo: "Só Nicco", estilo: "border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-300" },
  { valor: "so_diana", rotulo: "Só Diana", estilo: "border-pink-500/40 bg-pink-500/5 text-pink-700 dark:text-pink-300" },
  { valor: "dividir", rotulo: "50/50", estilo: "border-violet-500/40 bg-violet-500/5 text-violet-700 dark:text-violet-300" },
  { valor: "personalizado", rotulo: "Personalizado", estilo: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300" },
]

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function chaveDuplicidade(item: ConferenciaItem) {
  return [
    item.cartao_apelido,
    item.data_lancamento.slice(0, 10),
    normalizar(item.merchant || item.descricao),
    item.valor,
  ].join("|")
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.slice(0, 10).split("-")
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data || "Sem data"
}

function rotuloMes(mes: string) {
  const [ano, numeroMes] = mes.split("-")
  const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
  return `${nomes[Number(numeroMes) - 1] || numeroMes} de ${ano}`
}

export function ConferenciaClient({
  itens: itensIniciais,
  meses,
  mesSelecionado,
}: {
  itens: ConferenciaItem[]
  meses: string[]
  mesSelecionado: string
}) {
  const router = useRouter()
  const [itens, setItens] = React.useState(itensIniciais)
  const [cartao, setCartao] = React.useState("todos")
  const [busca, setBusca] = React.useState("")
  const [somentePendentes, setSomentePendentes] = React.useState(false)
  const [somenteDuplicados, setSomenteDuplicados] = React.useState(false)
  const [salvando, setSalvando] = React.useState<string | null>(null)
  const [excluindo, setExcluindo] = React.useState<string | null>(null)
  const [salvandoDetalhe, setSalvandoDetalhe] = React.useState<string | null>(null)
  const [detalhes, setDetalhes] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(itensIniciais.map((item) => [item.id, item.detalhe]))
  )
  const [personalizadoAberto, setPersonalizadoAberto] = React.useState<string | null>(null)
  const [percentual, setPercentual] = React.useState("50")
  const [conferidos, setConferidos] = React.useState<Set<string>>(new Set())
  const storageKey = `financas-conferencia-${mesSelecionado}`

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const salvos = JSON.parse(window.localStorage.getItem(storageKey) || "[]")
        if (Array.isArray(salvos)) setConferidos(new Set(salvos.filter((id) => typeof id === "string")))
      } catch {
        setConferidos(new Set())
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [storageKey])

  const contagemDuplicados = React.useMemo(() => {
    const contagem = new Map<string, number>()
    for (const item of itens) {
      const chave = chaveDuplicidade(item)
      contagem.set(chave, (contagem.get(chave) || 0) + 1)
    }
    return contagem
  }, [itens])

  const cartoes = React.useMemo(() => {
    return Array.from(new Set(itens.map((item) => item.cartao_apelido))).sort((a, b) => {
      if (a === "Despesas extras") return 1
      if (b === "Despesas extras") return -1
      return a.localeCompare(b, "pt-BR")
    })
  }, [itens])

  const itensFiltrados = React.useMemo(() => itens.filter((item) => {
    if (cartao !== "todos" && item.cartao_apelido !== cartao) return false
    if (somentePendentes && conferidos.has(item.id)) return false
    if (somenteDuplicados && (contagemDuplicados.get(chaveDuplicidade(item)) || 0) < 2) return false
    if (busca) {
      const alvo = normalizar(`${item.descricao} ${item.merchant} ${item.categoria} ${detalhes[item.id] || item.detalhe}`)
      if (!alvo.includes(normalizar(busca))) return false
    }
    return true
  }), [itens, cartao, somentePendentes, somenteDuplicados, busca, conferidos, contagemDuplicados, detalhes])

  const grupos = React.useMemo(() => {
    const resultado = new Map<string, ConferenciaItem[]>()
    for (const item of itensFiltrados) {
      const lista = resultado.get(item.cartao_apelido) || []
      lista.push(item)
      resultado.set(item.cartao_apelido, lista)
    }
    return Array.from(resultado.entries()).sort(([a], [b]) => {
      if (a === "Despesas extras") return 1
      if (b === "Despesas extras") return -1
      return a.localeCompare(b, "pt-BR")
    })
  }, [itensFiltrados])

  const totalFiltrado = itensFiltrados.reduce((total, item) => total + item.valor, 0)
  const totalConferido = itens.filter((item) => conferidos.has(item.id)).length
  const possiveisDuplicados = itens.filter((item) => (contagemDuplicados.get(chaveDuplicidade(item)) || 0) > 1).length

  function salvarConferidos(proximos: Set<string>) {
    setConferidos(proximos)
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(proximos)))
  }

  function alternarConferido(id: string) {
    const proximos = new Set(conferidos)
    if (proximos.has(id)) proximos.delete(id)
    else proximos.add(id)
    salvarConferidos(proximos)
  }

  async function aplicarDivisao(item: ConferenciaItem, divisao: Exclude<Divisao, "nao_classificado">, pctDiana?: number) {
    if (divisao === "personalizado" && pctDiana === undefined) {
      setPercentual(String(item.divisao_tipo === "personalizado" ? item.divisao_pct_diana : 50))
      setPersonalizadoAberto(item.id)
      return
    }

    setSalvando(item.id)
    const resultado = await updateDivisaoLancamento(item.id, divisao, pctDiana)
    if (!resultado.success) {
      toast.error(resultado.message || "Não foi possível salvar a divisão.")
      setSalvando(null)
      return
    }

    setItens((atuais) => atuais.map((atual) => atual.id === item.id
      ? { ...atual, divisao_tipo: divisao, divisao_pct_diana: pctDiana ?? (divisao === "so_diana" ? 100 : divisao === "so_nicco" ? 0 : 50) }
      : atual
    ))
    const proximos = new Set(conferidos)
    proximos.add(item.id)
    salvarConferidos(proximos)
    setPersonalizadoAberto(null)
    setSalvando(null)
    toast.success("Divisão salva e item marcado como conferido.")
  }

  function salvarPersonalizado(item: ConferenciaItem) {
    const valor = Number(percentual)
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      toast.error("Informe uma porcentagem entre 0 e 100.")
      return
    }
    aplicarDivisao(item, "personalizado", valor)
  }

  async function apagarDuplicado(item: ConferenciaItem) {
    const nome = item.merchant || item.descricao
    const confirmou = window.confirm(
      `Apagar este lançamento?\n\n${nome}\n${formatarData(item.data_lancamento)} · ${formatarCentavosParaReal(item.valor)}\n\nEssa ação não pode ser desfeita.`
    )
    if (!confirmou) return

    setExcluindo(item.id)
    const resultado = await excluirLancamento(item.id)
    if (!resultado.success) {
      toast.error(resultado.message || "Não foi possível apagar o lançamento.")
      setExcluindo(null)
      return
    }

    setItens((atuais) => atuais.filter((atual) => atual.id !== item.id))
    const proximos = new Set(conferidos)
    proximos.delete(item.id)
    salvarConferidos(proximos)
    setExcluindo(null)
    toast.success("Cópia apagada do app.")
  }

  async function salvarDetalhe(item: ConferenciaItem) {
    const detalhe = (detalhes[item.id] || "").replace(/\s+/g, " ").trim()
    if (detalhe === item.detalhe) return

    setSalvandoDetalhe(item.id)
    const resultado = await updateDetalheLancamento(item.id, detalhe)
    if (!resultado.success) {
      toast.error(resultado.message || "Não foi possível salvar o detalhe.")
      setSalvandoDetalhe(null)
      return
    }

    setDetalhes((atuais) => ({ ...atuais, [item.id]: resultado.detalhe || "" }))
    setItens((atuais) => atuais.map((atual) => atual.id === item.id
      ? { ...atual, detalhe: resultado.detalhe || "" }
      : atual
    ))
    setSalvandoDetalhe(null)
    toast.success(detalhe ? "Detalhe salvo." : "Detalhe removido.")
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><CheckCircle2 className="h-6 w-6" /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Conferência tranquila</h1>
            <p className="text-muted-foreground">Confira uma fatura por vez, sem planilha e sem susto.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mês</p>
          <p className="mt-1 text-lg font-semibold">{rotuloMes(mesSelecionado)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progresso neste navegador</p>
          <p className="mt-1 text-lg font-semibold">{totalConferido} de {itens.length} conferidos</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${itens.length ? (totalConferido / itens.length) * 100 : 0}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSomenteDuplicados((atual) => !atual)}
          className={cn("rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50", somenteDuplicados && "border-amber-500 bg-amber-500/10")}
        >
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><AlertTriangle className="h-4 w-4 text-amber-500" /> Possíveis duplicidades</p>
          <p className="mt-1 text-lg font-semibold">{possiveisDuplicados} lançamentos sinalizados</p>
        </button>
      </div>

      <div className="sticky top-0 z-20 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Escolher mês"
            value={mesSelecionado}
            onChange={(event) => router.push(`/conferencia?mes=${event.target.value}`)}
            className="h-10 rounded-lg border bg-background px-3 text-sm font-medium"
          >
            {meses.map((mes) => <option key={mes} value={mes}>{rotuloMes(mes)}</option>)}
          </select>
          <select
            aria-label="Escolher cartão"
            value={cartao}
            onChange={(event) => setCartao(event.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm font-medium"
          >
            <option value="todos">Todos os cartões e extras</option>
            {cartoes.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
          </select>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar estabelecimento ou descrição" className="h-10 pl-9" />
          </div>
          <Button type="button" variant={somentePendentes ? "default" : "outline"} onClick={() => setSomentePendentes((atual) => !atual)}>
            Só não conferidos
          </Button>
          <Button type="button" variant={somenteDuplicados ? "default" : "outline"} onClick={() => setSomenteDuplicados((atual) => !atual)}>
            Possíveis duplicados
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Exibindo {itensFiltrados.length} lançamento(s), total de <strong className="text-foreground">{formatarCentavosParaReal(totalFiltrado)}</strong>.
        </p>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">Nada encontrado com esses filtros.</div>
      ) : grupos.map(([nomeCartao, lista]) => {
        const totalGrupo = lista.reduce((total, item) => total + item.valor, 0)
        return (
          <details key={nomeCartao} open className="group overflow-hidden rounded-2xl border bg-card shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-muted/30 px-5 py-4">
              <div className="flex items-center gap-3">
                <ChevronRight className="h-5 w-5 transition-transform group-open:rotate-90" />
                <ReceiptText className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-semibold">{nomeCartao}</h2>
                  <p className="text-sm text-muted-foreground">{lista.length} lançamento(s)</p>
                </div>
              </div>
              <strong>{formatarCentavosParaReal(totalGrupo)}</strong>
            </summary>
            <div className="divide-y">
              {lista.map((item) => {
                const duplicado = (contagemDuplicados.get(chaveDuplicidade(item)) || 0) > 1
                const conferido = conferidos.has(item.id)
                return (
                  <article key={item.id} className={cn("p-4 transition-colors sm:p-5", conferido && "bg-emerald-500/[0.04]") }>
                    <div className="grid gap-4 xl:grid-cols-[minmax(260px,1.4fr)_150px_minmax(480px,2fr)] xl:items-center">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">{formatarData(item.data_lancamento)}</span>
                          <Badge variant="outline">{item.categoria}</Badge>
                          {item.parcela_atual && item.parcela_total && <Badge variant="secondary">Parcela {item.parcela_atual}/{item.parcela_total}</Badge>}
                          {duplicado && (
                            <>
                              <Badge className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"><AlertTriangle className="mr-1 h-3 w-3" />Possível duplicidade</Badge>
                              <button
                                type="button"
                                aria-label={`Apagar possível duplicidade: ${item.merchant || item.descricao}`}
                                title="Apagar esta cópia"
                                disabled={excluindo === item.id}
                                onClick={() => apagarDuplicado(item)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                        <p className="font-semibold">{item.merchant || item.descricao}</p>
                        {item.merchant && item.merchant !== item.descricao && <p className="text-xs text-muted-foreground">Na fatura: {item.descricao}</p>}
                        {item.observacao && <p className="mt-1 text-xs text-muted-foreground">Nota: {item.observacao}</p>}
                        {item.eh_extra && <p className="mt-1 text-xs text-muted-foreground">Pago por: {item.pago_por}</p>}
                        <form
                          className="mt-3"
                          onSubmit={(event) => {
                            event.preventDefault()
                            salvarDetalhe(item)
                          }}
                        >
                          <label htmlFor={`detalhe-${item.id}`} className="mb-1 block text-xs font-medium text-muted-foreground">Do que se trata?</label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`detalhe-${item.id}`}
                              value={detalhes[item.id] || ""}
                              maxLength={240}
                              onChange={(event) => setDetalhes((atuais) => ({ ...atuais, [item.id]: event.target.value }))}
                              placeholder="Ex.: itens da casa, presente, compra pessoal…"
                              className="h-10 bg-background"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant={(detalhes[item.id] || "").trim() === item.detalhe ? "outline" : "default"}
                              disabled={salvandoDetalhe === item.id || (detalhes[item.id] || "").trim() === item.detalhe}
                              className="h-10 shrink-0"
                            >
                              <Save className="mr-1.5 h-4 w-4" />
                              {salvandoDetalhe === item.id ? "Salvando…" : "Salvar"}
                            </Button>
                          </div>
                        </form>
                      </div>

                      <div className="xl:text-right">
                        <p className="text-xl font-bold">{formatarCentavosParaReal(item.valor)}</p>
                      </div>

                      <div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {opcoes.map((opcao) => {
                            const selecionada = item.divisao_tipo === opcao.valor
                            return (
                              <button
                                key={opcao.valor}
                                type="button"
                                disabled={salvando === item.id}
                                onClick={() => aplicarDivisao(item, opcao.valor)}
                                className={cn(
                                  "relative flex min-h-11 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50",
                                  opcao.estilo,
                                  selecionada && "ring-2 ring-current ring-offset-2 ring-offset-background"
                                )}
                              >
                                {selecionada && <Check className="mr-1.5 h-4 w-4" />}
                                {opcao.valor === "personalizado" && selecionada
                                  ? `${item.divisao_pct_diana}% Diana`
                                  : opcao.rotulo}
                              </button>
                            )
                          })}
                        </div>

                        {personalizadoAberto === item.id && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                            <label htmlFor={`pct-${item.id}`} className="text-sm font-medium">Diana paga</label>
                            <Input id={`pct-${item.id}`} type="number" min="0" max="100" value={percentual} onChange={(event) => setPercentual(event.target.value)} className="h-9 w-20" />
                            <span className="text-sm">% · Nicco paga {100 - (Number(percentual) || 0)}%</span>
                            <Button type="button" size="sm" onClick={() => salvarPersonalizado(item)} disabled={salvando === item.id}>Salvar</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setPersonalizadoAberto(null)}>Cancelar</Button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => alternarConferido(item.id)}
                          className={cn(
                            "mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm font-medium transition-colors",
                            conferido ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <span className={cn("flex h-5 w-5 items-center justify-center rounded border", conferido && "border-emerald-500 bg-emerald-500 text-white")}>
                            {conferido && <Check className="h-3.5 w-3.5" />}
                          </span>
                          {conferido ? "Conferido ✓" : "Marcar como conferido sem alterar"}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </details>
        )
      })}
    </div>
  )
}
