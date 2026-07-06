'use client'

import { useState, useEffect } from 'react'
import { salvarLancamentosNoBanco, getCartoes } from './actions'
import { extrairTextoPdf } from '@/lib/pdf-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UploadCloud, CheckCircle2, AlertCircle, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { formatarCentavosParaReal } from '@/lib/utils/centavos'

export default function ImportarPage() {
  const [file, setFile] = useState<File | null>(null)
  const [tipo, setTipo] = useState<'generico' | 'elo_ourocard'>('generico')
  const [cartaoId, setCartaoId] = useState<string>('')
  const [mesReferencia, setMesReferencia] = useState<string>(() => new Date().toISOString().slice(0, 7))
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

  // PDF sem camada de texto (escaneado) só pode subir inteiro se couber no
  // limite de request body do Vercel (4,5 MB, cortado na borda sem log).
  const MAX_PDF_UPLOAD = 4 * 1024 * 1024

  const handleUpload = async () => {
    if (!file) return
    if (!mesReferencia) {
      toast.error('Selecione o mês da fatura antes de enviar.')
      return
    }

    setIsUploading(true)
    try {
      // Extrai o texto do PDF aqui no navegador — o arquivo (que pode ter
      // vários MB) nunca sobe; vão só ~30-50 KB de texto.
      let paginas: string[] | null = null
      try {
        const extraido = await extrairTextoPdf(file)
        if (extraido.paginas.join('').trim().length >= 200) {
          paginas = extraido.paginas
        }
      } catch {
        // PDF que o pdf.js não leu — tenta o fallback com o arquivo inteiro.
      }

      let res: Response
      if (paginas != null) {
        res = await fetch('/api/parse-fatura', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paginas, tipo, mes_referencia: mesReferencia }),
        })
      } else if (file.size <= MAX_PDF_UPLOAD) {
        // Sem texto (PDF escaneado/imagem): manda o arquivo pro Claude ler.
        const formData = new FormData()
        formData.append('file', file)
        formData.append('tipo', tipo)
        formData.append('mes_referencia', mesReferencia)
        res = await fetch('/api/parse-fatura', { method: 'POST', body: formData })
      } else {
        toast.error(
          'Esse PDF parece escaneado (sem texto selecionável) e é grande demais pra subir inteiro. Exporta a fatura em PDF nativo no app/site do banco e tenta de novo.',
        )
        return
      }

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Falha ao analisar a fatura.')
        return
      }
      toast.success('Fatura lida com sucesso!')
      setResultado(json)
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
    if (!mesReferencia) {
      toast.error("Selecione o mês da fatura antes de salvar.")
      return
    }

    try {
      const res = await salvarLancamentosNoBanco(resultado.transacoes, cartaoId, mesReferencia)
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
          <CardDescription>O texto é extraído no seu navegador e o Claude lê os lançamentos em paralelo — fatura grande não trava mais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-4 gap-6">
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
              <label className="text-sm font-medium">Mês da Fatura</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="month"
                  value={mesReferencia}
                  onChange={(e) => setMesReferencia(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
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
                <UploadCloud className="w-4 h-4" /> Lendo fatura... (fatura grande pode levar 1–2 min)
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
