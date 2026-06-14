import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatarCentavosParaReal } from "@/lib/utils/centavos"

export function ResumoParcelados({ lancamentosMes, membro1Nome, membro2Nome }: { lancamentosMes: any[], membro1Nome: string, membro2Nome: string }) {
  // Filtra apenas parcelados
  const parcelados = lancamentosMes.filter(l => l.parcela_total && l.parcela_total > 1)

  let totalGeral = 0
  let totalMembro1Geral = 0
  let totalMembro2Geral = 0

  const porCartao: Record<string, { total: number, membro1: number, membro2: number }> = {}

  parcelados.forEach(l => {
    const cartao = l.cartoes?.apelido || "Extra-cartão"
    if (!porCartao[cartao]) {
      porCartao[cartao] = { total: 0, membro1: 0, membro2: 0 }
    }

    let pctMembro1 = 0
    switch (l.divisao_tipo) {
      case 'dividir': pctMembro1 = 50; break
      case 'so_diana': pctMembro1 = 100; break
      case 'so_nicco': pctMembro1 = 0; break
      case 'personalizado': pctMembro1 = l.divisao_pct_diana || 50; break
      default: pctMembro1 = 50; break
    }

    const valorMembro1 = Math.round((l.valor * pctMembro1) / 100)
    const valorMembro2 = l.valor - valorMembro1

    porCartao[cartao].total += l.valor
    porCartao[cartao].membro1 += valorMembro1
    porCartao[cartao].membro2 += valorMembro2

    totalGeral += l.valor
    totalMembro1Geral += valorMembro1
    totalMembro2Geral += valorMembro2
  })

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Impacto dos Parcelamentos</CardTitle>
        <CardDescription>O peso das parcelas neste mês, separado por pessoa e cartão.</CardDescription>
      </CardHeader>
      <CardContent>
        {Object.keys(porCartao).length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum gasto parcelado neste mês.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(porCartao).map(([cartao, totais]) => (
                <div key={cartao} className="border rounded-lg p-4 bg-muted/20">
                  <h4 className="font-semibold text-sm mb-3 border-b pb-2">{cartao}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-pink-600">
                      <span>{membro1Nome}:</span>
                      <span className="font-medium">{formatarCentavosParaReal(totais.membro1)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>{membro2Nome}:</span>
                      <span className="font-medium">{formatarCentavosParaReal(totais.membro2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 mt-2 border-t font-semibold">
                      <span>Total:</span>
                      <span>{formatarCentavosParaReal(totais.total)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-primary/5 p-4 rounded-lg flex flex-col md:flex-row justify-around items-center border border-primary/20 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Parcelado Total</p>
                <p className="text-xl font-bold">{formatarCentavosParaReal(totalGeral)}</p>
              </div>
              <div className="h-8 w-px bg-border hidden md:block"></div>
              <div className="text-center text-pink-600">
                <p className="text-sm font-medium opacity-80">Parcelado {membro1Nome}</p>
                <p className="text-xl font-bold">{formatarCentavosParaReal(totalMembro1Geral)}</p>
              </div>
              <div className="h-8 w-px bg-border hidden md:block"></div>
              <div className="text-center text-blue-600">
                <p className="text-sm font-medium opacity-80">Parcelado {membro2Nome}</p>
                <p className="text-xl font-bold">{formatarCentavosParaReal(totalMembro2Geral)}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
