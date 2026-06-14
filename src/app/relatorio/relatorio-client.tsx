"use client"

import { useState } from "react"
import { formatarCentavosParaReal } from "@/lib/utils/centavos"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer } from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function RelatorioClient({ lancamentos, mes }: { lancamentos: any[], mes: string }) {
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos")
  const [filtroCartao, setFiltroCartao] = useState<string>("todos")
  const [filtroTipo, setFiltroTipo] = useState<string>("todos") // todos, parcelados, extra

  // Lista única de cartões para o filtro
  const cartoesDisponiveis = Array.from(new Set(lancamentos.map(l => l.cartoes?.apelido || "Gasto Extra")))

  // Aplicar Filtros
  const filtrados = lancamentos.filter(l => {
    // Filtro Cartão
    const nomeCartao = l.cartoes?.apelido || "Gasto Extra"
    if (filtroCartao !== "todos" && filtroCartao !== "extra" && nomeCartao !== filtroCartao) return false
    if (filtroCartao === "extra" && nomeCartao !== "Gasto Extra") return false

    // Filtro Responsável
    if (filtroResponsavel !== "todos") {
      if (filtroResponsavel === "diana" && l.divisao_tipo !== "so_diana" && l.divisao_tipo !== "dividir" && l.divisao_tipo !== "personalizado") return false
      if (filtroResponsavel === "nicco" && l.divisao_tipo !== "so_nicco" && l.divisao_tipo !== "dividir" && l.divisao_tipo !== "personalizado") return false
      // Se quiser um filtro "Só Diana estrito", podemos ajustar. Vamos considerar "gastos que a pessoa participa".
    }

    // Filtro Tipo
    if (filtroTipo === "parcelados" && !l.parcela_total) return false
    if (filtroTipo === "extra" && nomeCartao !== "Gasto Extra") return false

    return true
  })

  // Agrupar por cartão após os filtros
  const agrupadoPorCartao: Record<string, any[]> = {}
  let totalGeral = 0
  let totalGeralDiana = 0
  let totalGeralNicco = 0

  filtrados.forEach(l => {
    const nomeCartao = l.cartoes?.apelido || "Gasto Extra"
    if (!agrupadoPorCartao[nomeCartao]) {
      agrupadoPorCartao[nomeCartao] = []
    }
    agrupadoPorCartao[nomeCartao].push(l)
    totalGeral += l.valor

    let pctDiana = 0
    switch (l.divisao_tipo) {
      case 'dividir': pctDiana = 50; break
      case 'so_diana': pctDiana = 100; break
      case 'so_nicco': pctDiana = 0; break
      case 'personalizado': pctDiana = l.divisao_pct_diana || 50; break
      default: pctDiana = 50; break
    }
    const valorDiana = Math.round((l.valor * pctDiana) / 100)
    totalGeralDiana += valorDiana
    totalGeralNicco += (l.valor - valorDiana)
  })

  return (
    <div className="bg-white text-black min-h-screen p-8 max-w-6xl mx-auto rounded-xl shadow-sm print:shadow-none print:p-0 print:m-0 print:max-w-full">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { font-size: 10px !important; }
        }
      `}} />

      <div className="flex items-center justify-between mb-8 print:hidden">
        <Link href={`/?mes=${mes}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Dashboard
          </Button>
        </Link>
        <Button onClick={() => window.print()} variant="default" size="sm" className="gap-2">
          <Printer className="w-4 h-4" /> Imprimir (A4 Horizontal)
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 mb-8 p-4 bg-muted/20 rounded-lg border print:hidden">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Responsável</label>
          <Select value={filtroResponsavel} onValueChange={(val) => setFiltroResponsavel(val || 'todos')}>
            <SelectTrigger className="w-[160px] h-8 text-sm bg-white">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="diana">Diana (Participa)</SelectItem>
              <SelectItem value="nicco">Nicco (Participa)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Cartão / Origem</label>
          <Select value={filtroCartao} onValueChange={(val) => setFiltroCartao(val || 'todos')}>
            <SelectTrigger className="w-[180px] h-8 text-sm bg-white">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos as Origens</SelectItem>
              <SelectItem value="extra">Só Gastos Extras</SelectItem>
              {cartoesDisponiveis.filter(c => c !== "Gasto Extra").map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Tipo de Compra</label>
          <Select value={filtroTipo} onValueChange={(val) => setFiltroTipo(val || 'todos')}>
            <SelectTrigger className="w-[160px] h-8 text-sm bg-white">
              <SelectValue placeholder="Qualquer tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer Tipo</SelectItem>
              <SelectItem value="parcelados">Só Parcelados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-center mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-wider print:text-xl">Prestação de Contas</h1>
        <p className="text-muted-foreground mt-1 text-sm print:text-xs">Competência: {mes}</p>
        <div className="flex justify-center gap-6 mt-3">
          <h2 className="text-lg font-semibold text-primary print:text-base">
            Total: {formatarCentavosParaReal(totalGeral)}
          </h2>
          <h2 className="text-lg font-semibold text-pink-600 print:text-base">
            Diana: {formatarCentavosParaReal(totalGeralDiana)}
          </h2>
          <h2 className="text-lg font-semibold text-blue-600 print:text-base">
            Nicco: {formatarCentavosParaReal(totalGeralNicco)}
          </h2>
        </div>
      </div>

      <div className="space-y-8 print:space-y-4">
        {Object.entries(agrupadoPorCartao).map(([cartao, itens]) => {
          let totalCartao = 0
          let totalDiana = 0
          let totalNicco = 0

          itens.forEach((l) => {
            totalCartao += l.valor
            let pctDiana = 0
            switch (l.divisao_tipo) {
              case 'dividir': pctDiana = 50; break
              case 'so_diana': pctDiana = 100; break
              case 'so_nicco': pctDiana = 0; break
              case 'personalizado': pctDiana = l.divisao_pct_diana || 50; break
              default: pctDiana = 50; break
            }
            const valorDiana = Math.round((l.valor * pctDiana) / 100)
            const valorNicco = l.valor - valorDiana
            totalDiana += valorDiana
            totalNicco += valorNicco
          })

          return (
            <div key={cartao} className="break-inside-avoid">
              <div className="flex items-center justify-between bg-muted/30 p-2 px-3 rounded-t-lg border-b-2 border-primary/20 print:bg-gray-100 print:p-1 print:px-2">
                <h3 className="text-base font-bold print:text-sm">{cartao}</h3>
                <span className="text-base font-semibold print:text-sm">{formatarCentavosParaReal(totalCartao)}</span>
              </div>
              
              <table className="w-full text-sm text-left print:text-xs">
                <thead className="text-[11px] uppercase bg-muted/10 print:bg-gray-50 text-muted-foreground print:text-[9px]">
                  <tr>
                    <th className="px-3 py-2 font-semibold w-[80px]">Data</th>
                    <th className="px-3 py-2 font-semibold w-[200px]">Estabelecimento / Original</th>
                    <th className="px-3 py-2 font-semibold">Anotação</th>
                    <th className="px-3 py-2 font-semibold w-[120px]">Categoria</th>
                    <th className="px-3 py-2 font-semibold w-[90px]">Divisão</th>
                    <th className="px-3 py-2 font-semibold text-right w-[100px]">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itens.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/5 print:border-b">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {item.data_lancamento ? new Date(item.data_lancamento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem data'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-black">
                          {item.merchant || item.descricao}
                        </div>
                        {item.merchant && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 print:text-[8px]">
                            {item.descricao}
                          </div>
                        )}
                        {item.parcela_total && (
                          <span className="inline-block mt-1 text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full print:text-[7px]">
                            Parc. {item.parcela_atual}/{item.parcela_total}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-black font-medium">
                        {item.observacao || <span className="text-muted-foreground italic text-xs">-</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {item.categorias?.nome || <span className="italic">Sem categoria</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground capitalize">
                        {item.divisao_tipo === 'dividir' ? '50/50' : 
                         item.divisao_tipo === 'so_diana' ? '100% Diana' :
                         item.divisao_tipo === 'so_nicco' ? '100% Nicco' : 
                         item.divisao_tipo === 'personalizado' ? `${item.divisao_pct_diana}% Diana` : 'Pendente'}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-black whitespace-nowrap">
                        {formatarCentavosParaReal(item.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/5 font-semibold text-black print:bg-gray-50 border-t-2 border-primary/20">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground text-xs print:text-[10px]">
                      Resumo {cartao}:
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="text-[11px] text-pink-600 font-medium mb-0.5 print:text-[9px]">D: {formatarCentavosParaReal(totalDiana)}</div>
                      <div className="text-[11px] text-blue-600 font-medium mb-0.5 print:text-[9px]">N: {formatarCentavosParaReal(totalNicco)}</div>
                      <div className="text-xs border-t pt-1 mt-1 print:text-[10px]">Total: {formatarCentavosParaReal(totalCartao)}</div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })}
      </div>
      
      <div className="mt-8 text-center text-[10px] text-muted-foreground print:block">
        Gerado pelo Antigravity em {new Date().toLocaleString('pt-BR')}
      </div>
    </div>
  )
}
