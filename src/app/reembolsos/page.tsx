import { createClient } from "@/lib/supabase/server"
import { formatarCentavosParaReal } from "@/lib/utils/centavos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Stethoscope, PlusCircle } from "lucide-react"
import Link from "next/link"
import { revalidatePath } from "next/cache"
import { MonthSelector } from "@/components/month-selector"

async function adicionarReembolso(formData: FormData) {
  "use server"
  const supabase = await createClient()

  const descricao = formData.get("descricao") as string
  const valorReais = formData.get("valor") as string
  const data_competencia = formData.get("data") as string
  const credito_para_id = formData.get("credito_para") as string

  const valorCentavos = Math.round(parseFloat(valorReais.replace(',', '.')) * 100)

  await supabase.from("reembolsos").insert({
    descricao,
    valor: valorCentavos,
    data_competencia,
    credito_para_id
  })

  revalidatePath('/reembolsos')
  revalidatePath('/')
}

async function deletarReembolso(formData: FormData) {
  "use server"
  const supabase = await createClient()
  const id = formData.get("id") as string
  await supabase.from("reembolsos").delete().eq("id", id)
  revalidatePath('/reembolsos')
  revalidatePath('/')
}

export default async function ReembolsosPage(props: { searchParams: Promise<{ mes?: string }> }) {
  const searchParams = await props.searchParams
  const mes = searchParams.mes || "2026-06"
  const supabase = await createClient()

  const { data: membros } = await supabase.from('membros').select('*')
  
  const inicioMes = `${mes}-01`
  const [ano, numMes] = mes.split('-').map(Number)
  const proximoMes = numMes === 12 ? 1 : numMes + 1
  const proximoAno = numMes === 12 ? ano + 1 : ano
  const inicioProximoMes = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`

  const { data: reembolsos } = await supabase
    .from('reembolsos')
    .select('*, membros(apelido)')
    .gte('data_competencia', inicioMes)
    .lt('data_competencia', inicioProximoMes)
    .order('data_competencia', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/?mes=${mes}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Stethoscope className="h-8 w-8 text-primary" />
              Reembolsos Médicos
            </h1>
            <p className="text-muted-foreground mt-1">Gere créditos diretos por despesas da Dinah e outros.</p>
          </div>
        </div>
        <MonthSelector currentMonth={mes} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Formulário */}
        <Card className="md:col-span-1 h-fit border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Adicionar Reembolso</CardTitle>
            <CardDescription>O valor será revertido em crédito.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={adicionarReembolso} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição (Motivo)</Label>
                <Input id="descricao" name="descricao" placeholder="Ex: Consulta Dinah Dr. João" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input id="valor" name="valor" type="number" step="0.01" placeholder="Ex: 250,00" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data de Competência</Label>
                <Input id="data" name="data" type="date" defaultValue={`${mes}-01`} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credito_para">Crédito a favor de:</Label>
                <select 
                  id="credito_para" 
                  name="credito_para" 
                  required
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecione o membro...</option>
                  {membros?.map(m => (
                    <option key={m.id} value={m.id}>{m.apelido}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Reembolso
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Reembolsos Lançados ({mes})</CardTitle>
          </CardHeader>
          <CardContent>
            {(!reembolsos || reembolsos.length === 0) ? (
              <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                Nenhum reembolso registrado neste mês.
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>A favor de</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reembolsos.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{new Date(r.data_competencia).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                        <TableCell className="font-medium">{r.descricao}</TableCell>
                        <TableCell>
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                            {r.membros?.apelido}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-bold">
                          + {formatarCentavosParaReal(r.valor)}
                        </TableCell>
                        <TableCell>
                          <form action={deletarReembolso}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              X
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
