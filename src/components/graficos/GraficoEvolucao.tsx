"use client"

import React, { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatarCentavosParaReal } from '@/lib/utils/centavos'

export function GraficoEvolucao({ lancamentos }: { lancamentos: any[] }) {
  const [cartaoSelecionado, setCartaoSelecionado] = useState<string>("todos")

  // Obter lista única de cartões
  const cartoesDisponiveis = useMemo(() => {
    const nomes = new Set<string>()
    lancamentos.forEach(l => nomes.add(l.cartoes?.apelido || "Extra-cartão"))
    return Array.from(nomes).sort()
  }, [lancamentos])

  // Agrupar por data_competencia (Mês) e calcular o total
  const dadosGrafico = useMemo(() => {
    const filtrados = cartaoSelecionado === "todos" 
      ? lancamentos 
      : lancamentos.filter(l => (l.cartoes?.apelido || "Extra-cartão") === cartaoSelecionado)

    const agrupado: Record<string, number> = {}
    filtrados.forEach(l => {
      const mes = l.data_competencia ? l.data_competencia.substring(0, 7) : "Desconhecido"
      agrupado[mes] = (agrupado[mes] || 0) + l.valor
    })

    return Object.entries(agrupado)
      .map(([mes, valor]) => ({ mes, valor }))
      .sort((a, b) => a.mes.localeCompare(b.mes)) // Crescente por data
  }, [lancamentos, cartaoSelecionado])

  return (
    <Card className="col-span-full md:col-span-1">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Evolução Mensal</CardTitle>
            <CardDescription>Histórico de gastos ao longo do tempo</CardDescription>
          </div>
          <Select value={cartaoSelecionado} onValueChange={setCartaoSelecionado}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o cartão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Total Geral</SelectItem>
              {cartoesDisponiveis.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {dadosGrafico.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado para exibir
          </div>
        ) : (
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis 
                  dataKey="mes" 
                  tickFormatter={(val) => {
                    if (val === "Desconhecido") return val
                    const [ano, mes] = val.split('-')
                    return `${mes}/${ano}`
                  }}
                />
                <YAxis 
                  tickFormatter={(val) => `R$ ${(val/100).toLocaleString('pt-BR')}`}
                  width={80}
                />
                <Tooltip 
                  formatter={(value: number) => formatarCentavosParaReal(value)}
                  labelFormatter={(val) => `Mês: ${val}`}
                  cursor={{fill: 'transparent'}}
                />
                <Bar dataKey="valor" fill="#8884d8" radius={[4, 4, 0, 0]} name="Gasto Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
