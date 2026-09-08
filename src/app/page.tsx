import { getCurrentGroupId } from "@/lib/auth/group"
import { calcularFechamentosDoPeriodo, FechamentoMes } from "@/lib/acerto/calcular"
import { createClient } from "@/lib/supabase/server"
import { formatarCentavosParaReal } from "@/lib/utils/centavos"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRightLeft, CalendarRange, CreditCard, DollarSign, Wallet } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MonthSelector } from "@/components/month-selector"
import { GraficoCategorias } from "@/components/graficos/GraficoCategorias"
import { GraficoEvolucao } from "@/components/graficos/GraficoEvolucao"
import { ResumoParcelados } from "@/components/resumos/ResumoParcelados"
import { buscarTodasPaginas } from '@/lib/supabase/paginar'

type LancamentoDashboard = {
  data_competencia: string | null
  observacao: string | null
  [campo: string]: unknown
}

type CategoriaDashboard = { id: string; nome: string }

type ReembolsoResumo = {
  valor: number
  data_competencia: string
  credito_para_id: string
  descricao: string | null
}

function listarMeses(inicio: string, fim: string) {
  const meses: string[] = []
  const [anoInicial, mesInicial] = inicio.split('-').map(Number)
  const [anoFinal, mesFinal] = fim.split('-').map(Number)
  const cursor = new Date(Date.UTC(anoInicial, mesInicial - 1, 1))
  const limite = new Date(Date.UTC(anoFinal, mesFinal - 1, 1))

  while (cursor <= limite) {
    meses.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return meses
}

function rotuloMes(mes: string) {
  const data = new Date(`${mes}-01T00:00:00Z`)
  const rotulo = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(data)
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1)
}

function saldoParaMembro1(fechamento: FechamentoMes) {
  if (fechamento.saldoFinal.quemRecebeId === fechamento.membro1.id) return fechamento.saldoFinal.valor
  if (fechamento.saldoFinal.quemPagaId === fechamento.membro1.id) return -fechamento.saldoFinal.valor
  return 0
}

function ehSaldoTransportado(descricao: string | null) {
  const texto = (descricao || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return (
    texto.includes('saldo devedor') &&
    (texto.includes('trazido') || texto.includes('transportado'))
  )
}

export default async function DashboardPage(props: { searchParams: Promise<{ mes?: string }> }) {
  const searchParams = await props.searchParams
  const mes = searchParams.mes || new Date().toISOString().slice(0, 7)
  
  let fechamento = null
  let errorMessage = null
  let todosLancamentos: LancamentoDashboard[] = []
  let categorias: CategoriaDashboard[] = []
  let resumoDesdeJulho: Array<{ mes: string; fechamento: FechamentoMes; saldo: number }> = []
  let adiantamentos: ReembolsoResumo[] = []

  try {
    const grupoId = await getCurrentGroupId()
    const supabase = await createClient()

    // Janela de 12 meses pro gráfico de evolução (antes baixava a base inteira)
    const [anoJanela, mesJanela] = mes.split('-').map(Number)
    const inicioJanela = `${anoJanela - 1}-${String(mesJanela).padStart(2, '0')}-01`
    const mesesDesdeJulho = mes >= '2026-07' ? listarMeses('2026-07', mes) : []
    const mesesParaCalculo = mesesDesdeJulho.length > 0 ? mesesDesdeJulho : [mes]
    const [anoFimResumo, mesFimResumo] = mes.split('-').map(Number)
    const fimResumo = mesFimResumo === 12
      ? `${anoFimResumo + 1}-01-01`
      : `${anoFimResumo}-${String(mesFimResumo + 1).padStart(2, '0')}-01`
    const reembolsosResumoPromise = mesesDesdeJulho.length > 0
      ? supabase
        .from('reembolsos')
        .select('valor, data_competencia, credito_para_id, descricao')
        .eq('grupo_id', grupoId)
        .gte('data_competencia', '2026-07-01')
        .lt('data_competencia', fimResumo)
      : Promise.resolve({ data: [] })

    // Queries em paralelo em vez de sequenciais
    const [fechamentosRes, lancRes, catRes, reembolsosResumoRes] = await Promise.all([
      calcularFechamentosDoPeriodo(mesesParaCalculo),
      buscarTodasPaginas((inicio, fim) => supabase
        .from('lancamentos')
        .select('id, descricao, observacao, valor, data_competencia, data_lancamento, categoria_id, parcela_atual, parcela_total, divisao_tipo, divisao_pct_diana, cartoes(apelido), categorias(nome)')
        .eq('grupo_id', grupoId)
        .gte('data_competencia', inicioJanela)
        .order('id').range(inicio, fim)),
      supabase
        .from('categorias')
        .select('id, nome')
        .eq('grupo_id', grupoId)
        .order('nome', { ascending: true }),
      reembolsosResumoPromise,
    ])

    fechamento = fechamentosRes[mes]
    const reembolsosResumo = (reembolsosResumoRes.data || []) as ReembolsoResumo[]
    const saldosTransportados = reembolsosResumo.filter((item) => ehSaldoTransportado(item.descricao))
    resumoDesdeJulho = mesesDesdeJulho.map((mesResumo) => ({
      mes: mesResumo,
      fechamento: fechamentosRes[mesResumo],
      saldo: saldoParaMembro1(fechamentosRes[mesResumo]) - saldosTransportados
        .filter((item) => item.data_competencia.slice(0, 7) === mesResumo)
        .reduce((total, item) => {
          if (item.credito_para_id === fechamentosRes[mesResumo].membro1.id) return total + item.valor
          if (item.credito_para_id === fechamentosRes[mesResumo].membro2.id) return total - item.valor
          return total
        }, 0),
    }))
    adiantamentos = reembolsosResumo.filter((item) => item.descricao?.toLowerCase().includes('adiantamento'))
    todosLancamentos = lancRes.data || []
    categorias = catRes.data || []
  } catch (e: unknown) {
    errorMessage = e instanceof Error ? e.message : 'Erro desconhecido ao calcular o fechamento.'
  }

  if (errorMessage || !fechamento) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl">
          Erro ao calcular o mês: {errorMessage}
        </div>
      </div>
    )
  }

  const { saldoFinal, membro1, membro2 } = fechamento
  const totalGasto = membro1.totalGasto
  const saldoAcumulado = resumoDesdeJulho.reduce((total, item) => total + item.saldo, 0)
  const impactoAdiantamentos = adiantamentos.reduce((total, item) => {
    if (item.credito_para_id === membro1.id) return total + item.valor
    if (item.credito_para_id === membro2.id) return total - item.valor
    return total
  }, 0)
  const totalAdiantado = adiantamentos.reduce((total, item) => total + item.valor, 0)
  const saldoJulho = resumoDesdeJulho.find((item) => item.mes === '2026-07')?.saldo ?? 0
  const saldoJulhoAntesDoAdiantamento = saldoJulho - impactoAdiantamentos
  const dataAdiantamento = adiantamentos[0]?.data_competencia
    ? new Date(`${adiantamentos[0].data_competencia.slice(0, 10)}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : '05/07/2026'
  const ultimoMesResumo = resumoDesdeJulho.at(-1)?.mes
  return (
    <div className="max-w-5xl mx-auto space-y-8 print:space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="print:hidden">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard de Acerto</h1>
          <p className="text-muted-foreground mt-1">Visão geral e acerto de contas do casal.</p>
        </div>
        <div className="print:hidden">
          <MonthSelector currentMonth={mes} />
        </div>
      </div>

      {todosLancamentos.some(l => l.data_competencia?.startsWith(mes) && (l.observacao?.includes('REVISAO PENDENTE') || l.observacao?.includes('divergência de valores aceita'))) && (
        <div role="alert" className="rounded-lg border border-amber-500 bg-amber-500/10 p-4">
          Há faturas com valores pendentes de revisão neste mês. Os totais abaixo somam os lançamentos extraídos e não são um fechamento conferido. Consulte as observações em Lançamentos e confira com os PDFs.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Total do Casal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarCentavosParaReal(totalGasto)}</div>
            <p className="text-xs text-muted-foreground">
              Soma de todas as faturas do mês
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturas ({membro1.nome})</CardTitle>
            <CreditCard className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarCentavosParaReal(membro1.totalPago)}</div>
            <p className="text-xs text-muted-foreground">
              Total pago pelos cartões desta pessoa
            </p>
            {membro1.totalReembolsos > 0 && (
              <p className="text-[10px] text-green-600 font-medium mt-1">
                + {formatarCentavosParaReal(membro1.totalReembolsos)} em reembolsos
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturas ({membro2.nome})</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarCentavosParaReal(membro2.totalPago)}</div>
            <p className="text-xs text-muted-foreground">
              Total pago pelos cartões desta pessoa
            </p>
            {membro2.totalReembolsos > 0 && (
              <p className="text-[10px] text-green-600 font-medium mt-1">
                + {formatarCentavosParaReal(membro2.totalReembolsos)} em reembolsos
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Transferência Final</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatarCentavosParaReal(saldoFinal.valor)}
            </div>
          </CardContent>
        </Card>
      </div>

      {resumoDesdeJulho.length > 0 && (
        <Card className="overflow-hidden border-violet-500/30 bg-gradient-to-br from-violet-500/[0.08] via-card to-blue-500/[0.06]">
          <CardHeader className="border-b border-violet-500/15">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CalendarRange className="h-5 w-5 text-violet-600" />
                  Acerto acumulado desde julho
                </CardTitle>
                <CardDescription className="mt-1">
                  Com base nas divisões conferidas, sem repetir saldos transportados e já descontando o adiantamento de {dataAdiantamento}.
                </CardDescription>
              </div>
              {totalAdiantado > 0 && (
                <div className="shrink-0 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">Adiantamento</p>
                  <p className="font-bold text-blue-700 dark:text-blue-300">− {formatarCentavosParaReal(totalAdiantado)}</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-3 md:grid-cols-3">
              {resumoDesdeJulho.map((item) => (
                <div key={item.mes} className="rounded-xl border bg-background/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotuloMes(item.mes)}</p>
                  <p className={`mt-2 text-lg font-bold ${item.saldo < 0 ? 'text-blue-600' : item.saldo > 0 ? 'text-violet-700 dark:text-violet-300' : 'text-emerald-600'}`}>
                    {item.saldo === 0 ? 'Tudo zerado' : formatarCentavosParaReal(Math.abs(item.saldo))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.saldo > 0 ? 'Nicco devia à Diana' : item.saldo < 0 ? 'Crédito restante do Nicco' : 'Sem saldo entre os dois'}
                  </p>
                </div>
              ))}
            </div>

            {totalAdiantado > 0 && (
              <div className="rounded-xl border border-dashed bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                Em julho, antes do adiantamento, Nicco devia <strong className="text-foreground">{formatarCentavosParaReal(Math.abs(saldoJulhoAntesDoAdiantamento))}</strong>.
                Depois dos {formatarCentavosParaReal(totalAdiantado)}, restou um crédito de <strong className="text-blue-600">{formatarCentavosParaReal(Math.abs(saldoJulho))}</strong> para ele.
              </div>
            )}

            <div className="flex flex-col justify-between gap-3 rounded-2xl bg-violet-700 p-5 text-white sm:flex-row sm:items-center">
              <div>
                <p className="text-sm text-violet-100">Saldo acumulado até {ultimoMesResumo ? rotuloMes(ultimoMesResumo) : ''}</p>
                <p className="text-lg font-semibold">
                  {saldoAcumulado > 0 ? 'Nicco deve à Diana' : saldoAcumulado < 0 ? 'Diana deve ao Nicco' : 'Tudo acertado'}
                </p>
              </div>
              <p className="text-3xl font-black tracking-tight">{formatarCentavosParaReal(Math.abs(saldoAcumulado))}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2 mt-8 print:hidden">
        <GraficoCategorias 
          lancamentos={todosLancamentos.filter(l => l.data_competencia?.startsWith(mes))} 
          categorias={categorias}
        />
        <GraficoEvolucao 
          lancamentos={todosLancamentos} 
        />
      </div>

      <div className="print:hidden">
        <ResumoParcelados 
          lancamentosMes={todosLancamentos.filter(l => l.data_competencia?.startsWith(mes))} 
          membro1Nome={membro1.nome}
          membro2Nome={membro2.nome}
        />
      </div>

      {/* Destaque do Acerto */}
      <div className="mt-8 relative overflow-hidden rounded-2xl border bg-card p-8 md:p-12 shadow-sm text-center flex flex-col items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 pointer-events-none" />
        <div className="z-10 relative">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-4">
            O Veredito do Mês
          </h2>
          {saldoFinal.quemPagaNome === 'Nenhum' ? (
            <div className="text-4xl md:text-6xl font-black text-green-500 my-8 drop-shadow-sm">
              Tudo zerado! Ninguém deve nada.
            </div>
          ) : (
            <>
            <div className="flex items-center justify-center gap-4 text-3xl md:text-5xl font-bold">
              <span className={saldoFinal.quemPagaId === membro1.id ? 'text-pink-500' : 'text-blue-500'}>
                {saldoFinal.quemPagaNome}
              </span>
              <ArrowRightLeft className="w-8 h-8 text-muted-foreground animate-pulse" />
              <span className={saldoFinal.quemRecebeId === membro1.id ? 'text-pink-500' : 'text-blue-500'}>
                {saldoFinal.quemRecebeNome}
              </span>
            </div>
            
            <div className="mt-6 text-6xl md:text-8xl font-black tracking-tighter text-foreground drop-shadow-sm">
              {formatarCentavosParaReal(saldoFinal.valor)}
            </div>
            
            <div className="mt-6 text-lg text-muted-foreground max-w-[500px] mx-auto mb-8">
              <p>Pix no capricho! {saldoFinal.quemPagaNome} deve transferir {formatarCentavosParaReal(saldoFinal.valor)} para {saldoFinal.quemRecebeNome} para fechar a conta do mês.</p>
              {(membro1.totalReembolsos > 0 || membro2.totalReembolsos > 0) && (
                <p className="text-sm mt-2 font-medium text-primary bg-primary/10 p-2 rounded-md">
                  💡 Este valor já contabiliza os créditos de reembolsos médicos do mês!
                </p>
              )}
            </div>
            </>
          )}
            
            <div className="mt-8 z-10 relative print:hidden flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={`/relatorio?mes=${mes}`}>
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all">
                  🖨️ Imprimir Prestação
                </Button>
              </Link>
              <Link href={`/reembolsos?mes=${mes}`}>
                <Button size="lg" variant="secondary" className="font-semibold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all">
                  ⚕️ Reembolsos Médicos
                </Button>
              </Link>
            </div>
          </div>
      </div>

    </div>
  )
}
