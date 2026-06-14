import { calcularFechamentoDoMes } from "@/lib/acerto/calcular"
import { createClient } from "@/lib/supabase/server"
import { formatarCentavosParaReal } from "@/lib/utils/centavos"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRightLeft, CreditCard, DollarSign, Wallet } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MonthSelector } from "@/components/month-selector"
import { GraficoCategorias } from "@/components/graficos/GraficoCategorias"
import { GraficoEvolucao } from "@/components/graficos/GraficoEvolucao"
import { ResumoParcelados } from "@/components/resumos/ResumoParcelados"

export default async function DashboardPage(props: { searchParams: Promise<{ mes?: string }> }) {
  const searchParams = await props.searchParams
  const mes = searchParams.mes || "2026-06"
  
  let fechamento = null
  let errorMessage = null
  let todosLancamentos: any[] = []
  let categorias: any[] = []

  try {
    fechamento = await calcularFechamentoDoMes(mes)
    const supabase = await createClient()
    const { data } = await supabase.from('lancamentos').select('*, cartoes(apelido), categorias(nome)')
    todosLancamentos = data || []
    const { data: catData } = await supabase.from('categorias').select('id, nome').order('nome', { ascending: true })
    categorias = catData || []
  } catch (e: any) {
    errorMessage = e.message
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
