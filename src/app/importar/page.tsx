'use client'

import { useState, useEffect } from 'react'
import { processarUploadPdf, salvarLancamentosNoBanco, getCartoes } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatarCentavosParaReal } from '@/lib/utils/centavos'

export default function ImportarPage() {
  const [file, setFile] = useState<File | null>(null)
  const [tipo, setTipo] = useState<'generico' | 'elo_ourocard'>('generico')
  const [cartaoId, setCartaoId] = useState<string>('')
  const [cartoes, setCartoes] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  useEffect(() => {
    getCartoes().then(data => {
      setCartoes(data)
      if (data.length > 0) setCartaoId(data[0].id)
    })
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResultado(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tipo', tipo)

    try {
      const res = await processarUploadPdf(formData)
      if (res.success) {
        toast.success(res.message)
        setResultado(res.data)
      } else {
        toast.error(res.message)
      }
    } catch (err: any) {
      toast.error('Erro ao enviar arquivo: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSalvar = async () => {
    if (!resultado?.transacoes) return
    if (!cartaoId) {
      toast.error("Selecione um cartão antes de salvar.")
      return
    }

    try {
      const res = await salvarLancamentosNoBanco(resultado.transacoes, cartaoId)
      if (res.success) {
        toast.success(res.message)
        // Redirecionar para dashboard ou limpar a tela?
        setResultado(null)
        setFile(null)
      } else {
        toast.error(res.message)
      }
    } catch (err: any) {
      toast.error('Erro ao salvar no banco: ' + err.message)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar Fatura</h1>
        <p className="text-muted-foreground">
          Faça upload do PDF do cartão para a IA extrair os lançamentos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova Importação</CardTitle>
          <CardDescription>O nosso motor Claude 3.5 Sonnet fará a leitura mágica.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cartão de Crédito</label>
              <Select value={cartaoId} onValueChange={(val: any) => setCartaoId(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o Cartão" />
                </SelectTrigger>
                <SelectContent>
                  {cartoes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.apelido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Selecione o Formato</label>
              <Select value={tipo} onValueChange={(val: any) => setTipo(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Formato do PDF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generico">Genérico (Smiles, Nubank, Itaú)</SelectItem>
                  <SelectItem value="elo_ourocard">Elo Ourocard (Formato Especial)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Arquivo PDF</label>
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={!file || isUploading}
            className="w-full md:w-auto"
          >
            {isUploading ? (
              <span className="flex items-center gap-2 animate-pulse">
                <UploadCloud className="w-4 h-4" /> Lendo PDF... (Pode levar uns 15s)
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4" /> Enviar para a IA
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="w-5 h-5" /> Sucesso!
            </CardTitle>
            <CardDescription>Veja o que o Claude encontrou no PDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 p-4 rounded-lg bg-background border">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Total Encontrado</p>
                <p className="text-2xl font-black">{formatarCentavosParaReal(resultado.total_fatura_cents)}</p>
              </div>
              <div className="border-l pl-4">
                <p className="text-xs text-muted-foreground uppercase font-bold">Lançamentos</p>
                <p className="text-2xl font-black">{resultado.transacoes?.length || 0}</p>
              </div>
              <div className="border-l pl-4">
                <p className="text-xs text-muted-foreground uppercase font-bold">Sanity Check</p>
                {resultado.sanity_ok ? (
                  <p className="text-xl font-bold text-green-500 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-5 h-5" /> OK
                  </p>
                ) : (
                  <p className="text-xl font-bold text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="w-5 h-5" /> FALSO
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-md border bg-background overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">Data</th>
                    <th className="text-left p-2 font-medium">Descrição</th>
                    <th className="text-right p-2 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {resultado.transacoes?.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/50">
                      <td className="p-2">{t.data}</td>
                      <td className="p-2">
                        {t.descricao}
                        {t.parcela_atual && t.parcela_total && (
                          <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            ({t.parcela_atual}/{t.parcela_total})
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right">{formatarCentavosParaReal(t.valor_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button className="w-full mt-4" variant="default" onClick={handleSalvar}>
              Confirmar e Salvar no Banco
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
