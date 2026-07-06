/**
 * Cliente Anthropic — SERVER-ONLY.
 *
 * ⚠️ Só importe isto de API routes (src/app/api/**) ou Server Actions.
 * A ANTHROPIC_API_KEY vive no .env.local SEM prefixo NEXT_PUBLIC_, então
 * nunca chega ao client. O CI ainda faz grep de "sk-ant" no bundle (decisão #9).
 * (Quando quiser uma trava extra, dá pra adicionar o pacote `server-only`.)
 */
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { type z } from 'zod/v4'

// Criação LAZY: o construtor do SDK exige a ANTHROPIC_API_KEY, que não existe
// no CI. Se a gente instanciasse no topo do módulo, o `next build` (que importa
// o módulo da route) quebraria. Só cria quando a função realmente roda.
let _client: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (_client == null) _client = new Anthropic()
  return _client
}

/**
 * Manda o PDF da fatura pro Claude (leitura NATIVA de PDF, sem pdf-parse) e
 * volta com JSON garantido pelo schema (structured outputs).
 *
 * - O PDF vai como bloco `document` base64 (preserva tabela/layout melhor
 *   que extrair texto).
 * - `instrucoes` é o prompt específico do cartão (vai no system, cacheável).
 * - `schema` é o Zod do formato esperado; o output sai validado.
 *
 * Usa STREAMING (não `messages.parse`): com max_tokens=32000 o SDK detecta
 * risco de passar de 10 min de geração e BLOQUEIA chamadas não-streaming
 * (https://github.com/anthropics/anthropic-sdk-typescript#long-requests).
 * Streaming também evita timeout HTTP em fatura grande (Latam ~300 lanc).
 * `finalMessage()` espera o stream fechar e devolve o `parsed_output` já
 * validado contra o schema — interface da função não muda pra quem chama.
 *
 * Sem `thinking`: no Opus 4.7 a ausência do campo já significa "sem thinking",
 * o que deixa o budget de tokens todo pro JSON. Se a extração precisar de mais
 * precisão depois, dá pra ligar `thinking: { type: 'adaptive' }`.
 */
export async function extrairFaturaPDF<S extends z.ZodType>({
  pdfBase64,
  instrucoes,
  schema,
}: {
  pdfBase64: string
  instrucoes: string
  schema: S
}): Promise<z.infer<S>> {
  const stream = getAnthropic().messages.stream({
    model: 'claude-opus-4-7',
    // 32k é o teto do Opus 4.7 — fatura grande (Latam ~300 lançamentos)
    // estourava 16k e voltava JSON truncado ("Unterminated string at ...").
    max_tokens: 32000,
    system: [
      { type: 'text', text: instrucoes, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: 'Extraia os lançamentos desta fatura seguindo as instruções.',
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(schema) },
  })

  const msg = await stream.finalMessage()

  if (msg.parsed_output == null) {
    throw new Error(
      `Claude não retornou JSON válido pra fatura (stop_reason: ${msg.stop_reason}).`,
    )
  }
  return msg.parsed_output
}

/**
 * Irmã da extrairFaturaPDF pra fatura que chega como TEXTO (extraído no
 * browser via pdf.js — ver lib/pdf-client.ts). Usada pelo caminho em chunks:
 * cada chamada recebe um trecho (~2 páginas), então nunca chega perto do
 * teto de max_tokens nem do timeout.
 *
 * Mesmo modelo, streaming e structured output da extrairFaturaPDF.
 */
export async function extrairFaturaTexto<S extends z.ZodType>({
  texto,
  instrucoes,
  schema,
}: {
  texto: string
  instrucoes: string
  schema: S
}): Promise<z.infer<S>> {
  const stream = getAnthropic().messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 32000,
    system: [
      { type: 'text', text: instrucoes, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extraia os lançamentos deste trecho de fatura seguindo as instruções.\n\n<trecho_da_fatura>\n${texto}\n</trecho_da_fatura>`,
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(schema) },
  })

  const msg = await stream.finalMessage()

  if (msg.parsed_output == null) {
    throw new Error(
      `Claude não retornou JSON válido pro trecho da fatura (stop_reason: ${msg.stop_reason}).`,
    )
  }
  return msg.parsed_output
}
