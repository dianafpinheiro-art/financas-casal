'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { formatCentavos } from '@/lib/utils'
import { extrairTextoPdf } from '@/lib/pdf-client'
import { salvarFatura } from './actions'
import {
  type CartaoOption,
  type ParseResposta,
  type LancamentoPreview,
} from './tipos'

const LABEL_DIVISAO: Record<string, string> = {
  dividir: 'Dividir',
  so_diana: 'Só Diana',
  so_nicco: 'Só Nicco',
  personalizado: 'Personalizado',
}

function divisaoLabel(l: LancamentoPreview): string {
  if (l.divisaoTipo == null) return '— a classificar'
  if (l.divisaoTipo === 'personalizado') return `Diana ${l.divisaoPctDiana ?? '?'}%`
  return LABEL_DIVISAO[l.divisaoTipo] ?? l.divisaoTipo
}

function badgeClasse(l: LancamentoPreview): string {
  if (l.divisaoTipo == null) return 'bg-muted text-muted-foreground'
  if (l.divisaoTipo === 'so_diana') return 'bg-diana-50 text-diana-800'
  if (l.divisaoTipo === 'so_nicco') return 'bg-nicco-50 text-nicco-800'
  return 'bg-compartilhado-50 text-compartilhado-800'
}

// Divisão pré-preenchida mas ainda não confirmada (ex: encargo propagado).
const ehSugerido = (l: LancamentoPreview): boolean =>
  l.divisaoTipo != null && !l.classificado

export default function ImportarClient({ cartoes }: { cartoes: CartaoOption[] }) {
  const [cartaoId, setCartaoId] = useState('')
  // Default: mês atual (não hardcoded). data_competencia sai EXATAMENTE deste
  // valor (importar/actions.ts) — o que a usuária escolher aqui é respeitado.
  const [mesRef, setMesRef] = useState(() => new Date().toISOString().slice(0, 7))
  const [file, setFile] = useState<File | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ParseResposta | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState<{ total: number } | null>(null)

  const onDrop = useCallback((aceitos: File[]) => {
    if (aceitos[0]) {
      setFile(aceitos[0])
      setResultado(null)
      setSalvo(null)
      setErro(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

  const podeAnalisar = cartaoId !== '' && mesRef !== '' && file != null && !analisando

  // PDF sem camada de texto (escaneado) só pode subir inteiro se couber no
  // limite de request body do Vercel (4,5 MB, cortado na borda sem log).
  const MAX_PDF_UPLOAD = 4 * 1024 * 1024

  async function analisar() {
    if (!file) return
    setAnalisando(true)
    setErro(null)
    setResultado(null)
    setSalvo(null)
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
          body: JSON.stringify({ cartao_id: cartaoId, paginas }),
        })
      } else if (file.size <= MAX_PDF_UPLOAD) {
        // Sem texto (PDF escaneado/imagem): manda o arquivo pro Claude ler.
        const fd = new FormData()
        fd.append('file', file)
        fd.append('cartao_id', cartaoId)
        res = await fetch('/api/parse-fatura', { method: 'POST', body: fd })
      } else {
        setErro(
          'Esse PDF parece escaneado (sem texto selecionável) e é grande demais pra subir inteiro. Exporta a fatura em PDF nativo no app/site do banco e tenta de novo.',
        )
        return
      }

      const json = await res.json()
      if (!res.ok) {
        setErro(json.error ?? 'Falha ao analisar a fatura.')
        return
      }
      setResultado(json as ParseResposta)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setAnalisando(false)
    }
  }

  async function salvar() {
    if (!resultado || !file) return
    setSalvando(true)
    setErro(null)
    const r = await salvarFatura({
      cartaoId,
      mesReferencia: mesRef,
      nomeArquivo: file.name,
      totalDeclaradoCentavos: resultado.totalDeclaradoCentavos,
      lancamentos: resultado.lancamentos,
    })
    setSalvando(false)
    if (r.ok) {
      setSalvo({ total: r.total })
      setResultado(null)
      setFile(null)
    } else {
      setErro(r.erro)
    }
  }

  const preClass = resultado?.lancamentos.filter((l) => l.classificado).length ?? 0
  const sugeridos = resultado?.lancamentos.filter(ehSugerido).length ?? 0

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-foreground">Importar fatura</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sobe o PDF da fatura, o Claude lê os lançamentos e o app já aplica as
        regras que aprendeu.
      </p>

      {cartoes.length === 0 ? (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Nenhum cartão cadastrado. Rode a migration{' '}
          <code className="font-mono">007_cartoes.sql</code> antes de importar.
        </div>
      ) : (
        <>
          {/* Form: cartão + mês */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Cartão</span>
              <select
                value={cartaoId}
                onChange={(e) => setCartaoId(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">Selecione…</option>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.apelido} {c.dono ? `(${c.dono})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Mês de referência (competência)</span>
              <input
                type="month"
                value={mesRef}
                onChange={(e) => setMesRef(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`mt-4 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-input'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <p className="text-sm">
                📄 <span className="font-medium">{file.name}</span> — clique ou
                arraste pra trocar
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Arraste o PDF da fatura aqui, ou clique pra escolher
              </p>
            )}
          </div>

          <button
            onClick={analisar}
            disabled={!podeAnalisar}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {analisando ? 'Analisando…' : 'Analisar fatura'}
          </button>
        </>
      )}

      {erro && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {erro}
        </div>
      )}

      {salvo && (
        <div className="mt-4 rounded-lg border border-compartilhado-100 bg-compartilhado-50 p-4 text-sm text-compartilhado-800">
          ✅ {salvo.total} lançamentos salvos no banco! A tela de revisão
          (/lancamentos) é o próximo bloco — por ora dá pra conferir no Supabase.
        </div>
      )}

      {/* Preview */}
      {resultado && (
        <section className="mt-8">
          {/* Alerta do sanity check */}
          {resultado.sanity.semTotal && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              ℹ️ Não achei o “total da fatura” nesse layout — confere a soma (
              {formatCentavos(resultado.sanity.somaCentavos)}) à mão antes de salvar.
            </div>
          )}

          {resultado.status === 'precisa_revisao' && !resultado.sanity.semTotal && (
            <div className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">⚠️ A soma não bateu com o total da fatura</p>
              <p className="mt-1">
                Soma dos lançamentos: {formatCentavos(resultado.sanity.somaCentavos)} ·
                Total declarado: {formatCentavos(resultado.sanity.totalDeclaradoCentavos)} ·
                Diferença: <strong>{formatCentavos(resultado.sanity.difCentavos)}</strong>.
                Confira antes de salvar (pode faltar/sobrar lançamento).
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {resultado.lancamentos.length} lançamentos
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({preClass} pré-classificados · {sugeridos} encargos sugeridos)
              </span>
            </h2>
            <span className="text-sm text-muted-foreground">
              Total da fatura: {formatCentavos(resultado.totalDeclaradoCentavos)}
            </span>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-input">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Parcela</th>
                  <th className="px-3 py-2 font-medium">Divisão</th>
                </tr>
              </thead>
              <tbody>
                {resultado.lancamentos.map((l, i) => (
                  <tr key={i} className="border-t border-input">
                    <td className="whitespace-nowrap px-3 py-2">{l.data}</td>
                    <td className="px-3 py-2">
                      {l.descricao}
                      {l.observacao && (
                        <span className="mt-0.5 block text-xs text-amber-700">
                          ↳ {l.observacao}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {formatCentavos(l.valorCentavos)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {l.parcelaAtual != null && l.parcelaTotal != null
                        ? `${l.parcelaAtual}/${l.parcelaTotal}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs ${badgeClasse(l)} ${
                          ehSugerido(l) ? 'ring-1 ring-amber-300' : ''
                        }`}
                      >
                        {divisaoLabel(l)}
                      </span>
                      {ehSugerido(l) && (
                        <span className="ml-1 text-xs text-amber-700">sugerido</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={salvar}
            disabled={salvando}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : `Salvar todos (${resultado.lancamentos.length})`}
          </button>
        </section>
      )}
    </main>
  )
}
