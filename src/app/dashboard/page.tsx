import { formatCentavos } from '@/lib/utils'
import { carregarAcertoDoMes } from '@/lib/acerto'
import { createClient } from '@/lib/supabase/server'
import FecharMes, { type FechamentoInfo } from './fechar-mes'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function rotuloMes(mes: string): string {
  const ano = mes.slice(0, 4)
  const idx = Number(mes.slice(5, 7)) - 1
  const nome = MESES[idx] ?? mes
  return `${nome[0].toUpperCase()}${nome.slice(1)} · ${ano}`
}

/** Ex: "Maio/2026" — usado nos textos do fechar mês. */
function rotuloCurto(mes: string): string {
  const ano = mes.slice(0, 4)
  const idx = Number(mes.slice(5, 7)) - 1
  const nome = MESES[idx] ?? mes
  return `${nome[0].toUpperCase()}${nome.slice(1)}/${ano}`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes: mesParam } = await searchParams
  const { mes, acerto, erroCalc, aRevisar, totalLancamentos } =
    await carregarAcertoDoMes(mesParam)

  // Status de fechamento do mês (RLS já filtra pelo grupo do usuário).
  const supabase = await createClient()
  const { data: fechRow } = await supabase
    .from('fechamento_mes')
    .select('fechado_em, valor_transferencia_cents, direcao_transferencia')
    .eq('mes_referencia', `${mes}-01`)
    .maybeSingle()
  const fechamento: FechamentoInfo | null = fechRow
    ? {
        fechadoEm: String(fechRow.fechado_em),
        valorCentavos: fechRow.valor_transferencia_cents,
        direcao: fechRow.direcao_transferencia as FechamentoInfo['direcao'],
      }
    : null

  const t = acerto?.transferencia ?? null
  const corCard =
    t == null ? 'bg-muted' : t.para === 'diana' ? 'bg-nicco-50' : 'bg-diana-50'
  const tituloTransf =
    t == null
      ? 'Tudo quitado ✨'
      : t.para === 'diana'
        ? 'Nicco te transfere'
        : 'Você transfere pro Nicco'

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Diana &amp; Nicco</p>
          <h1 className="mt-1 text-2xl font-medium">{rotuloMes(mes)}</h1>
        </div>
        <form className="flex items-center gap-1">
          <input
            type="month"
            name="mes"
            defaultValue={mes}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
          <button className="rounded-md border border-input px-2 py-1 text-sm">Ver</button>
        </form>
      </header>

      {erroCalc ? (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Não consegui calcular o acerto: {erroCalc}
        </div>
      ) : acerto ? (
        <>
          <section className={`mt-6 rounded-lg ${corCard} p-5 text-center`}>
            <p className="text-xs uppercase tracking-wider opacity-80">{tituloTransf}</p>
            <p className="mt-1 text-3xl font-medium">
              {formatCentavos(t?.valorCentavos ?? 0)}
            </p>
            <p className="mt-2 text-xs opacity-70">
              Acerto parcial — recalcula sozinho conforme você classifica.
            </p>
          </section>

          {aRevisar > 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              ⚠ {aRevisar} lançamentos a revisar — o valor pode mudar.{' '}
              <a href={`/lancamentos?mes=${mes}`} className="font-medium underline">revisar</a>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-input p-4">
              <p className="font-medium text-diana-800">Diana</p>
              <p className="mt-2 text-muted-foreground">Pagou</p>
              <p className="tabular-nums">{formatCentavos(acerto.diana.pagaCentavos)}</p>
              <p className="mt-1 text-muted-foreground">Cabe a ela</p>
              <p className="tabular-nums">{formatCentavos(acerto.diana.cabeCentavos)}</p>
            </div>
            <div className="rounded-lg border border-input p-4">
              <p className="font-medium text-nicco-800">Nicco</p>
              <p className="mt-2 text-muted-foreground">Pagou</p>
              <p className="tabular-nums">{formatCentavos(acerto.nicco.pagaCentavos)}</p>
              <p className="mt-1 text-muted-foreground">Cabe a ele</p>
              <p className="tabular-nums">{formatCentavos(acerto.nicco.cabeCentavos)}</p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-input p-4 text-sm">
            <p className="font-medium">Composição do mês</p>
            <ul className="mt-2 space-y-1">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Compartilhado</span>
                <span className="tabular-nums">{formatCentavos(acerto.compartilhadoCentavos)}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Só Diana</span>
                <span className="tabular-nums">{formatCentavos(acerto.soDianaCentavos)}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Só Nicco</span>
                <span className="tabular-nums">{formatCentavos(acerto.soNiccoCentavos)}</span>
              </li>
              <li className="flex justify-between border-t border-input pt-1 font-medium">
                <span>Total</span>
                <span className="tabular-nums">{formatCentavos(acerto.totalCentavos)}</span>
              </li>
            </ul>
          </div>

          {/* Baixar docx do acerto */}
          <a
            href={`/api/gerar-acerto?mes=${mes}`}
            className="mt-4 block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
          >
            Baixar acerto (.docx)
          </a>

          {/* Fechar / reabrir o mês */}
          <FecharMes
            mes={mes}
            mesLabel={rotuloCurto(mes)}
            totalLancamentos={totalLancamentos}
            fechamento={fechamento}
          />
        </>
      ) : (
        fechamento && (
          <FecharMes
            mes={mes}
            mesLabel={rotuloCurto(mes)}
            totalLancamentos={totalLancamentos}
            fechamento={fechamento}
          />
        )
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <a href={`/lancamentos?mes=${mes}`} className="font-medium underline">Ver lançamentos do mês</a>
      </p>
    </main>
  )
}
