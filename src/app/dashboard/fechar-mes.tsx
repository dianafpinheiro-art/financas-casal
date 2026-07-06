'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCentavos } from '@/lib/utils'
import { fecharMes, reabrirMes } from './actions'

export interface FechamentoInfo {
  fechadoEm: string // ISO
  valorCentavos: number
  direcao: 'diana_paga_nicco' | 'nicco_paga_diana'
}

function ddmmaaaa(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function ddmm(iso: string): string {
  return ddmmaaaa(iso).slice(0, 5)
}

export default function FecharMes({
  mes,
  mesLabel,
  totalLancamentos,
  fechamento,
}: {
  mes: string // "YYYY-MM"
  mesLabel: string // ex: "Maio/2026"
  totalLancamentos: number
  fechamento: FechamentoInfo | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarFechar, setConfirmarFechar] = useState(false)
  // Reabrir tem confirmação dupla: 0 = nada, 1 = 1ª confirmação, 2 = final.
  const [etapaReabrir, setEtapaReabrir] = useState(0)

  function onFechar() {
    setErro(null)
    startTransition(async () => {
      const r = await fecharMes(mes)
      if (!r.ok) setErro(r.erro)
      else {
        setConfirmarFechar(false)
        router.refresh()
      }
    })
  }

  function onReabrir() {
    setErro(null)
    startTransition(async () => {
      const r = await reabrirMes(mes)
      if (!r.ok) setErro(r.erro)
      else {
        setEtapaReabrir(0)
        router.refresh()
      }
    })
  }

  // ---------------------------------------------------------------
  // Mês JÁ fechado: badge + banner + (opcional) reabrir
  // ---------------------------------------------------------------
  if (fechamento) {
    const frase =
      fechamento.direcao === 'nicco_paga_diana'
        ? `${formatCentavos(fechamento.valorCentavos)} transferidos (Nicco → Diana)`
        : `${formatCentavos(fechamento.valorCentavos)} transferidos (Diana → Nicco)`

    return (
      <div className="mt-4">
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">
            ✓ {mesLabel} fechado em {ddmm(fechamento.fechadoEm)}
          </p>
          <p className="mt-1 opacity-80">
            {mesLabel} fechado em {ddmmaaaa(fechamento.fechadoEm)}. {frase}.
          </p>
        </div>

        {erro && (
          <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            {erro}
          </div>
        )}

        {etapaReabrir === 0 ? (
          <button
            onClick={() => setEtapaReabrir(1)}
            className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
          >
            Reabrir mês
          </button>
        ) : (
          <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {etapaReabrir === 1 ? (
              <>
                <p>
                  Reabrir {mesLabel} vai destravar os {totalLancamentos}{' '}
                  lançamentos pra edição. Tem certeza?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setEtapaReabrir(2)}
                    className="rounded-md border border-amber-400 px-3 py-1 font-medium"
                  >
                    Sim, continuar
                  </button>
                  <button
                    onClick={() => setEtapaReabrir(0)}
                    className="text-muted-foreground underline"
                  >
                    cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="font-medium">
                  Confirmação final: o acerto deixará de estar congelado.
                  Reabrir mesmo assim?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={onReabrir}
                    disabled={pending}
                    className="rounded-md bg-destructive px-3 py-1 font-medium text-destructive-foreground disabled:opacity-50"
                  >
                    {pending ? 'Reabrindo…' : 'Reabrir definitivamente'}
                  </button>
                  <button
                    onClick={() => setEtapaReabrir(0)}
                    className="text-muted-foreground underline"
                  >
                    cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------
  // Mês ABERTO: botão fechar + modal de confirmação
  // ---------------------------------------------------------------
  return (
    <div className="mt-4">
      <button
        onClick={() => {
          setErro(null)
          setConfirmarFechar(true)
        }}
        className="block w-full rounded-md border border-primary px-4 py-2 text-center text-sm font-medium text-primary hover:bg-primary/5"
      >
        🔒 Fechar mês de {mesLabel}
      </button>

      {confirmarFechar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Fechar {mesLabel}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tem certeza? Após fechar, os {totalLancamentos} lançamentos de{' '}
              {mesLabel.split('/')[0].toLowerCase()} não poderão ser editados.
            </p>

            {erro && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
                {erro}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2 text-sm">
              <button
                onClick={() => setConfirmarFechar(false)}
                disabled={pending}
                className="rounded-md border border-input px-4 py-2 hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={onFechar}
                disabled={pending}
                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
              >
                {pending ? 'Fechando…' : 'Fechar mês'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
