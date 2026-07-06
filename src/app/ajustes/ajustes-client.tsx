'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export interface CartaoRow {
  id: string
  apelido: string
  banco: string
  bandeira: string
  ultimosDigitos: string
  diaFechamento: number | null
  diaVencimento: number | null
  membroId: string
  dono: string
}
export interface MembroOpcao {
  id: string
  apelido: string
}

const BANDEIRAS = ['Visa', 'Mastercard', 'American Express', 'Elo', 'Hipercard', 'Outros']

type Aba = 'cartoes' | 'categorias' | 'membros'

interface FormState {
  apelido: string
  banco: string
  bandeira: string
  ultimosDigitos: string
  diaFechamento: string
  diaVencimento: string
  membroId: string
}

const vazio = (membroId: string): FormState => ({
  apelido: '',
  banco: '',
  bandeira: 'Visa',
  ultimosDigitos: '',
  diaFechamento: '',
  diaVencimento: '',
  membroId,
})

export default function AjustesClient({
  cartoes,
  membros,
}: {
  cartoes: CartaoRow[]
  membros: MembroOpcao[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [aba, setAba] = useState<Aba>('cartoes')
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(vazio(membros[0]?.id ?? ''))
  const [erro, setErro] = useState<string | null>(null)

  function abrirCriar() {
    setEditandoId(null)
    setForm(vazio(membros[0]?.id ?? ''))
    setErro(null)
    setModal(true)
  }
  function abrirEditar(c: CartaoRow) {
    setEditandoId(c.id)
    setForm({
      apelido: c.apelido,
      banco: c.banco,
      bandeira: c.bandeira || 'Visa',
      ultimosDigitos: c.ultimosDigitos,
      diaFechamento: c.diaFechamento?.toString() ?? '',
      diaVencimento: c.diaVencimento?.toString() ?? '',
      membroId: c.membroId,
    })
    setErro(null)
    setModal(true)
  }

  function up<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function salvar() {
    setErro(null)
    const diaToNum = (s: string) => (s.trim() === '' ? null : Number(s))
    const body = {
      apelido: form.apelido.trim(),
      banco: form.banco.trim(),
      bandeira: form.bandeira,
      ultimos_digitos: form.ultimosDigitos.trim() || null,
      dia_fechamento: diaToNum(form.diaFechamento),
      dia_vencimento: diaToNum(form.diaVencimento),
      membro_id: form.membroId,
    }
    const url = editandoId ? `/api/cartoes/${editandoId}` : '/api/cartoes'
    const metodo = editandoId ? 'PATCH' : 'POST'
    startTransition(async () => {
      const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(json.error ?? 'Falha ao salvar')
        return
      }
      setModal(false)
      router.refresh()
    })
  }

  function desativar(c: CartaoRow) {
    if (!confirm(`Desativar "${c.apelido}"? O histórico de lançamentos é preservado.`)) return
    setErro(null)
    startTransition(async () => {
      const res = await fetch(`/api/cartoes/${c.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setErro(json.error ?? 'Falha ao desativar')
        return
      }
      router.refresh()
    })
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Ajustes do grupo Diana &amp; Nicco
      </h1>

      {/* Abas */}
      <div className="mt-4 flex gap-1 border-b border-input text-sm">
        {([
          ['cartoes', 'Cartões'],
          ['categorias', 'Categorias'],
          ['membros', 'Membros'],
        ] as [Aba, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`-mb-px border-b-2 px-3 py-2 ${
              aba === id
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {erro && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {aba === 'cartoes' && (
        <section className="mt-4">
          <div className="flex justify-end">
            <button
              onClick={abrirCriar}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              + Adicionar cartão
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {cartoes.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input p-4"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {c.apelido}{' '}
                    <span className="font-normal text-muted-foreground">
                      ({c.dono})
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {[c.banco, c.bandeira, c.ultimosDigitos && `•••• ${c.ultimosDigitos}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fecha: {c.diaFechamento ?? '—'} · Vence: {c.diaVencimento ?? '—'}
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <button
                    onClick={() => abrirEditar(c)}
                    className="rounded-md border border-input px-3 py-1.5 hover:bg-muted"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => desativar(c)}
                    disabled={pending}
                    className="rounded-md border border-destructive/40 px-3 py-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Desativar
                  </button>
                </div>
              </li>
            ))}
            {cartoes.length === 0 && (
              <li className="rounded-lg border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
                Nenhum cartão ativo. Clique em “+ Adicionar cartão”.
              </li>
            )}
          </ul>
        </section>
      )}

      {aba === 'categorias' && (
        <p className="mt-6 text-sm text-muted-foreground">
          Edição de categorias chega numa próxima — por ora elas vêm do seed.
        </p>
      )}
      {aba === 'membros' && (
        <p className="mt-6 text-sm text-muted-foreground">
          Gestão de membros chega numa próxima (hoje o grupo é Diana &amp; Nicco).
        </p>
      )}

      {/* Modal de cartão */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-lg">
            <h2 className="text-lg font-semibold">
              {editandoId ? 'Editar cartão' : 'Novo cartão'}
            </h2>

            <div className="mt-4 grid gap-3 text-sm">
              <Campo label="Apelido *">
                <input className="inp" value={form.apelido} onChange={(e) => up('apelido', e.target.value)} />
              </Campo>
              <Campo label="Banco *">
                <input className="inp" value={form.banco} onChange={(e) => up('banco', e.target.value)} />
              </Campo>
              <Campo label="Bandeira *">
                <select className="inp" value={form.bandeira} onChange={(e) => up('bandeira', e.target.value)}>
                  {BANDEIRAS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Últimos 4 dígitos (opcional)">
                <input className="inp" inputMode="numeric" maxLength={4} value={form.ultimosDigitos} onChange={(e) => up('ultimosDigitos', e.target.value.replace(/\D/g, ''))} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Dia fechamento">
                  <input className="inp" type="number" min={1} max={31} value={form.diaFechamento} onChange={(e) => up('diaFechamento', e.target.value)} />
                </Campo>
                <Campo label="Dia vencimento">
                  <input className="inp" type="number" min={1} max={31} value={form.diaVencimento} onChange={(e) => up('diaVencimento', e.target.value)} />
                </Campo>
              </div>
              <p className="-mt-1 text-xs text-muted-foreground">
                Pode deixar os dias vazios se não souber — a importação usa o “mês de referência”, não o ciclo.
              </p>
              <Campo label="Dono *">
                <select className="inp" value={form.membroId} onChange={(e) => up('membroId', e.target.value)}>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>{m.apelido}</option>
                  ))}
                </select>
              </Campo>
            </div>

            <div className="mt-5 flex justify-end gap-2 text-sm">
              <button onClick={() => setModal(false)} className="rounded-md border border-input px-4 py-2 hover:bg-muted">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={pending}
                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
              >
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.inp{border:1px solid hsl(var(--input));background:hsl(var(--background));border-radius:0.375rem;padding:0.5rem 0.75rem;width:100%}`}</style>
    </main>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}
