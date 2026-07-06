'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCentavos } from '@/lib/utils'
import {
  classificarLancamento,
  classificarLote,
  adicionarLancamentoManual,
  marcarRevisadoLote,
} from './actions'
import { type LancamentoRow, type ResumoMes } from './tipos'

interface CartaoOpcao { id: string; apelido: string }
interface CategoriaOpcao { id: string; nome: string }
interface MembroOpcao { id: string; apelido: string }

const INP = 'rounded-md border border-input bg-background px-3 py-2'
const INP_SM = 'rounded-md border border-input bg-background px-2.5 py-1.5 text-sm'

const OPCOES: { valor: string; label: string }[] = [
  { valor: 'dividir', label: 'Dividir' },
  { valor: 'so_diana', label: 'Só Diana' },
  { valor: 'so_nicco', label: 'Só Nicco' },
  { valor: 'personalizado', label: 'Personalizado' },
]

interface FiltroInicial {
  cartao: string // id do cartão, 'all', ou 'none'
  status: string // 'todos' | 'a_revisar' | 'revisados'
  div: string    // 'todas' | 'dividir' | 'so_diana' | 'so_nicco' | 'nao_classificado'
  q: string
}

/**
 * Atualiza só o querystring sem disparar fetch no servidor — os filtros são
 * client-side, então `router.replace` seria desperdício (re-executaria
 * a page e re-baixaria os 677 lançamentos do mês).
 */
function setUrlParam(key: string, value: string, vazio: string) {
  if (typeof window === 'undefined') return
  const sp = new URLSearchParams(window.location.search)
  if (value === vazio || value === '') sp.delete(key)
  else sp.set(key, value)
  const qs = sp.toString()
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
}

function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function LancamentosClient({
  mes,
  lancamentos,
  resumo,
  cartoes,
  categorias,
  membros,
  filtroInicial,
}: {
  mes: string
  lancamentos: LancamentoRow[]
  resumo: ResumoMes
  cartoes: CartaoOpcao[]
  categorias: CategoriaOpcao[]
  membros: MembroOpcao[]
  filtroInicial: FiltroInicial
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [pctByRow, setPctByRow] = useState<Record<string, number>>({})

  // --- filtros ---
  const [fCartao, setFCartao] = useState(filtroInicial.cartao)
  const [fStatus, setFStatus] = useState(filtroInicial.status)
  const [fDiv, setFDiv] = useState(filtroInicial.div)
  const [fQ, setFQ] = useState(filtroInicial.q)

  function aplicarFiltroCartao(v: string) {
    setFCartao(v)
    setUrlParam('cartao', v, 'all')
    setSel(new Set()) // seleção poderia incluir linhas que sumiram da view
  }
  function aplicarFiltroStatus(v: string) {
    setFStatus(v)
    setUrlParam('status', v, 'todos')
    setSel(new Set())
  }
  function aplicarFiltroDiv(v: string) {
    setFDiv(v)
    setUrlParam('div', v, 'todas')
    setSel(new Set())
  }
  function aplicarFiltroQ(v: string) {
    setFQ(v)
    setUrlParam('q', v, '')
    // não limpa seleção: digitar texto não muda os já marcados de propósito
  }

  // Filtragem em duas camadas: a base ignora o status (pra contagem dos tabs
  // refletir os outros filtros), e o filtered aplica também o status.
  const baseFiltrada = useMemo(() => {
    const termo = fQ.trim().toLowerCase()
    return lancamentos.filter((l) => {
      if (fCartao === 'none') {
        if (l.cartaoId != null) return false
      } else if (fCartao !== 'all') {
        if (l.cartaoId !== fCartao) return false
      }
      if (fDiv === 'nao_classificado') {
        if (l.classificado) return false
      } else if (fDiv !== 'todas') {
        if (l.divisaoTipo !== fDiv) return false
      }
      if (termo && !l.descricao.toLowerCase().includes(termo)) return false
      return true
    })
  }, [lancamentos, fCartao, fDiv, fQ])

  const filtered = useMemo(() => {
    return baseFiltrada.filter((l) => {
      if (fStatus === 'a_revisar') return !l.classificado
      if (fStatus === 'revisados') return l.classificado
      return true
    })
  }, [baseFiltrada, fStatus])

  const contagem = useMemo(() => {
    let aRevisar = 0
    for (const l of baseFiltrada) if (!l.classificado) aRevisar += 1
    return {
      todos: baseFiltrada.length,
      aRevisar,
      revisados: baseFiltrada.length - aRevisar,
    }
  }, [baseFiltrada])

  const totalFiltradoCentavos = useMemo(
    () => filtered.reduce((s, l) => s + l.valorCentavos, 0),
    [filtered],
  )

  // Linhas de mês fechado são imutáveis: não entram em seleção/ações em lote.
  const selecionaveis = useMemo(
    () => filtered.filter((l) => !l.mesFechado),
    [filtered],
  )

  const algumFiltroAtivo =
    fCartao !== 'all' || fStatus !== 'todos' || fDiv !== 'todas' || fQ !== ''

  function limparFiltros() {
    setFCartao('all')
    setFStatus('todos')
    setFDiv('todas')
    setFQ('')
    setUrlParam('cartao', 'all', 'all')
    setUrlParam('status', 'todos', 'todos')
    setUrlParam('div', 'todas', 'todas')
    setUrlParam('q', '', '')
    setSel(new Set())
  }

  // --- lançamento manual ---
  const hoje = new Date().toISOString().slice(0, 10)
  const formInicial = {
    data: hoje,
    descricao: '',
    valor: '',
    cartaoId: '',
    categoriaId: '',
    divisaoTipo: 'dividir',
    pctDiana: '50',
    pagoPorId: membros[0]?.id ?? '',
    observacao: '',
  }
  const [modalManual, setModalManual] = useState(false)
  const [fm, setFm] = useState(formInicial)
  const [erroManual, setErroManual] = useState<string | null>(null)
  const setF = (k: keyof typeof formInicial, v: string) => setFm((f) => ({ ...f, [k]: v }))

  function salvarManual() {
    setErroManual(null)
    const valorReais = Number(fm.valor.replace(',', '.'))
    startTransition(async () => {
      const r = await adicionarLancamentoManual({
        dataLancamento: fm.data,
        descricao: fm.descricao,
        valorReais,
        cartaoId: fm.cartaoId || null,
        categoriaId: fm.categoriaId || null,
        divisaoTipo: fm.divisaoTipo,
        divisaoPctDiana: fm.divisaoTipo === 'personalizado' ? Number(fm.pctDiana) : null,
        pagoPorId: fm.pagoPorId,
        observacao: fm.observacao || null,
      })
      if (!r.ok) {
        setErroManual(r.erro)
        return
      }
      setModalManual(false)
      setFm({ ...formInicial })
      router.refresh()
    })
  }

  function aplicar(id: string, divisaoTipo: string, pct: number | null) {
    setErro(null)
    startTransition(async () => {
      const r = await classificarLancamento({ id, divisaoTipo, divisaoPctDiana: pct })
      if (!r.ok) setErro(r.erro)
      else router.refresh()
    })
  }

  function aplicarLote(divisaoTipo: string) {
    if (sel.size === 0) return
    setErro(null)
    const ids = [...sel]
    startTransition(async () => {
      const r = await classificarLote({ ids, divisaoTipo, divisaoPctDiana: null })
      if (!r.ok) setErro(r.erro)
      else {
        setSel(new Set())
        router.refresh()
      }
    })
  }

  function revisarLote() {
    if (sel.size === 0) return
    setErro(null)
    const ids = [...sel]
    startTransition(async () => {
      const r = await marcarRevisadoLote(ids)
      if (!r.ok) setErro(r.erro)
      else {
        setSel(new Set())
        router.refresh()
      }
    })
  }

  function onSelectChange(l: LancamentoRow, valor: string) {
    if (valor === 'personalizado') {
      // entra em modo personalizado já com a % atual (default 50); ela ajusta e dá ✓
      const pct = l.divisaoPctDiana ?? 50
      setPctByRow((p) => ({ ...p, [l.id]: pct }))
      aplicar(l.id, 'personalizado', pct)
    } else {
      aplicar(l.id, valor, null)
    }
  }

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleTodos() {
    setSel((s) =>
      s.size === selecionaveis.length
        ? new Set()
        : new Set(selecionaveis.map((l) => l.id)),
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Lançamentos</h1>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Mês</span>
            <input
              type="month"
              value={mes}
              onChange={(e) => router.push(`/lancamentos?mes=${e.target.value}`)}
              className="rounded-md border border-input bg-background px-3 py-1.5"
            />
          </label>
          <button
            onClick={() => {
              setErroManual(null)
              setFm({ ...formInicial })
              setModalManual(true)
            }}
            className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
          >
            + Adicionar
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          {filtered.length} de {resumo.total} lançamentos
        </span>
        <span>Total: {formatCentavos(totalFiltradoCentavos)}</span>
        {contagem.aRevisar > 0 && (
          <span className="font-medium text-amber-700">{contagem.aRevisar} a revisar</span>
        )}
      </div>

      {/* Tabs de status (contagens refletem cartão + divisão + busca) */}
      <div className="mt-4 flex flex-wrap gap-1 border-b border-input">
        {[
          { v: 'todos', label: 'Todos', n: contagem.todos },
          { v: 'a_revisar', label: 'A revisar', n: contagem.aRevisar },
          { v: 'revisados', label: 'Revisados', n: contagem.revisados },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => aplicarFiltroStatus(t.v)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              fStatus === t.v
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label} <span className="tabular-nums">({t.n})</span>
          </button>
        ))}
      </div>

      {/* Barra de filtros */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <select
          aria-label="Filtrar por cartão"
          value={fCartao}
          onChange={(e) => aplicarFiltroCartao(e.target.value)}
          className={INP_SM}
        >
          <option value="all">Todos os cartões</option>
          {cartoes.map((c) => (
            <option key={c.id} value={c.id}>{c.apelido}</option>
          ))}
          <option value="none">Sem cartão (manual)</option>
        </select>

        <select
          aria-label="Filtrar por divisão"
          value={fDiv}
          onChange={(e) => aplicarFiltroDiv(e.target.value)}
          className={INP_SM}
        >
          <option value="todas">Todas as divisões</option>
          <option value="dividir">Dividir</option>
          <option value="so_diana">Só Diana</option>
          <option value="so_nicco">Só Nicco</option>
          <option value="nao_classificado">Não classificado</option>
        </select>

        <input
          type="search"
          placeholder="Buscar descrição…"
          value={fQ}
          onChange={(e) => aplicarFiltroQ(e.target.value)}
          className={`${INP_SM} min-w-[180px] flex-1`}
        />

        {algumFiltroAtivo && (
          <button
            onClick={limparFiltros}
            className="text-muted-foreground underline hover:text-foreground"
          >
            limpar filtros
          </button>
        )}
      </div>

      {erro && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* Barra de ações em lote */}
      {sel.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-input bg-muted/40 p-3 text-sm">
          <span className="font-medium">{sel.size} selecionados:</span>
          <button onClick={revisarLote} disabled={pending} className="rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-50">✓ Marcar revisados</button>
          <span className="text-muted-foreground">ou aplicar divisão:</span>
          <button onClick={() => aplicarLote('dividir')} disabled={pending} className="rounded-md bg-compartilhado-400 px-3 py-1 text-white disabled:opacity-50">Dividir</button>
          <button onClick={() => aplicarLote('so_diana')} disabled={pending} className="rounded-md bg-diana-400 px-3 py-1 text-white disabled:opacity-50">Só Diana</button>
          <button onClick={() => aplicarLote('so_nicco')} disabled={pending} className="rounded-md bg-nicco-400 px-3 py-1 text-white disabled:opacity-50">Só Nicco</button>
          <button onClick={() => setSel(new Set())} className="ml-auto text-muted-foreground underline">cancelar seleção</button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-input">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selecionaveis.length > 0 && sel.size === selecionaveis.length}
                  onChange={toggleTodos}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Descrição</th>
              <th className="px-3 py-2 font-medium">Cartão</th>
              <th className="px-3 py-2 font-medium">Pagou</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Divisão</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr
                key={l.id}
                className={`border-t border-input ${
                  l.mesFechado
                    ? 'bg-muted/40 text-muted-foreground'
                    : !l.classificado
                      ? 'bg-amber-50/50'
                      : ''
                }`}
              >
                <td className="px-3 py-2 align-top">
                  <input
                    type="checkbox"
                    checked={sel.has(l.id)}
                    disabled={l.mesFechado}
                    onChange={() => toggle(l.id)}
                    aria-label={l.mesFechado ? 'Mês fechado — não selecionável' : 'Selecionar'}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 align-top">{ddmm(l.dataLancamento)}</td>
                <td className="px-3 py-2 align-top">
                  <span className={!l.classificado ? 'font-medium' : ''}>{l.descricao}</span>
                  {l.observacao && (
                    <span className="mt-0.5 block text-xs text-amber-700">↳ {l.observacao}</span>
                  )}
                  {l.categoria && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{l.categoria}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 align-top text-muted-foreground">{l.cartao}</td>
                <td className="whitespace-nowrap px-3 py-2 align-top text-muted-foreground">{l.pagoPor}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums">
                  {formatCentavos(l.valorCentavos)}
                </td>
                <td className="px-3 py-2 align-top">
                  {l.mesFechado ? (
                    <div className="flex items-center gap-2">
                      <span>
                        {OPCOES.find((o) => o.valor === l.divisaoTipo)?.label ??
                          l.divisaoTipo}
                        {l.divisaoTipo === 'personalizado' &&
                          l.divisaoPctDiana != null &&
                          ` (${l.divisaoPctDiana}% Diana)`}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        🔒 fechado
                      </span>
                    </div>
                  ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={l.divisaoTipo}
                      disabled={pending}
                      onChange={(e) => onSelectChange(l, e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1"
                    >
                      {OPCOES.map((o) => (
                        <option key={o.valor} value={o.valor}>{o.label}</option>
                      ))}
                    </select>
                    {l.divisaoTipo === 'personalizado' && (
                      <span className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={pctByRow[l.id] ?? l.divisaoPctDiana ?? 50}
                          onChange={(e) =>
                            setPctByRow((p) => ({ ...p, [l.id]: Number(e.target.value) }))
                          }
                          className="w-16 rounded-md border border-input bg-background px-2 py-1"
                        />
                        <span className="text-xs text-muted-foreground">% Diana</span>
                        <button
                          onClick={() =>
                            aplicar(l.id, 'personalizado', pctByRow[l.id] ?? l.divisaoPctDiana ?? 50)
                          }
                          disabled={pending}
                          className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                        >
                          ✓
                        </button>
                      </span>
                    )}
                    {!l.classificado && (
                      <span className="text-xs text-amber-700">revisar</span>
                    )}
                  </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {algumFiltroAtivo
                    ? 'Nenhum lançamento com os filtros aplicados.'
                    : `Nenhum lançamento em ${mes}.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Conferindo o acerto?{' '}
        <a href={`/dashboard?mes=${mes}`} className="font-medium underline">
          Ver dashboard do mês
        </a>
      </p>

      {/* Modal: lançamento manual */}
      {modalManual && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-background p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Novo lançamento</h2>
            <p className="text-xs text-muted-foreground">
              Pra boletos, diaristas, PIX — o que não vem de fatura.
            </p>

            {erroManual && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
                {erroManual}
              </div>
            )}

            <div className="mt-4 grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-medium">Data</span>
                  <input type="date" className={INP} value={fm.data} onChange={(e) => setF('data', e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-medium">Valor (R$)</span>
                  <input className={INP} inputMode="decimal" placeholder="0,00" value={fm.valor} onChange={(e) => setF('valor', e.target.value)} />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="font-medium">Descrição</span>
                <input className={INP} value={fm.descricao} onChange={(e) => setF('descricao', e.target.value)} placeholder="Ex: PIX Maria Jose diarista" />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-medium">Cartão</span>
                <select className={INP} value={fm.cartaoId} onChange={(e) => setF('cartaoId', e.target.value)}>
                  <option value="">Sem cartão (PIX/boleto/dinheiro)</option>
                  {cartoes.map((c) => (
                    <option key={c.id} value={c.id}>{c.apelido}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-medium">Categoria</span>
                <select className={INP} value={fm.categoriaId} onChange={(e) => setF('categoriaId', e.target.value)}>
                  <option value="">— sem categoria</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-medium">Divisão</span>
                  <select className={INP} value={fm.divisaoTipo} onChange={(e) => setF('divisaoTipo', e.target.value)}>
                    <option value="dividir">Dividir</option>
                    <option value="so_diana">Só Diana</option>
                    <option value="so_nicco">Só Nicco</option>
                    <option value="personalizado">Personalizado</option>
                  </select>
                </label>
                {fm.divisaoTipo === 'personalizado' && (
                  <label className="flex flex-col gap-1">
                    <span className="font-medium">% Diana</span>
                    <input type="number" min={0} max={100} className={INP} value={fm.pctDiana} onChange={(e) => setF('pctDiana', e.target.value)} />
                  </label>
                )}
              </div>

              <label className="flex flex-col gap-1">
                <span className="font-medium">Quem pagou</span>
                <select className={INP} value={fm.pagoPorId} onChange={(e) => setF('pagoPorId', e.target.value)}>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>{m.apelido}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-medium">Observação (opcional)</span>
                <textarea className={INP} rows={2} value={fm.observacao} onChange={(e) => setF('observacao', e.target.value)} />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 text-sm">
              <button onClick={() => setModalManual(false)} className="rounded-md border border-input px-4 py-2 hover:bg-muted">
                Cancelar
              </button>
              <button onClick={salvarManual} disabled={pending} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
