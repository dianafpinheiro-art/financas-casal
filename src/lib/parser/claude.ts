import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export type ParsedTransaction = {
  data: string // YYYY-MM-DD
  descricao: string
  valor_cents: number
  moeda: string // BRL, USD
  parcela_atual?: number | null
  parcela_total?: number | null
}

export type ParseResult = {
  transacoes: ParsedTransaction[]
  total_fatura_cents: number
  sanity_ok: boolean
}

export async function parseFaturaComClaude(
  base64Pdf: string,
  tipo: 'generico' | 'elo_ourocard'
): Promise<ParseResult> {
  const promptGenerico = `
Você é um especialista financeiro extraindo dados de faturas de cartão de crédito anexadas.
Extraia TODAS as cobranças que somam no valor da fatura (compras, IOF, taxas, juros, tarifas, parcelas, saques, etc). IGNORE APENAS: pagamentos da própria fatura (ex: "PAGAMENTO RECEBIDO", "PAGTO DE FATURA"), estornos (créditos que subtraem do valor), ou blocos de textos explicativos.
Converta todos os valores monetários para INTEIROS EM CENTAVOS (ex: R$ 12,50 vira 1250).
Converta todas as datas para YYYY-MM-DD (assuma o ano atual caso não tenha).
Se a compra for parcelada, extraia o número da parcela atual e o total de parcelas. Remova a informação de parcelas (ex: "02/12") do nome da descrição.
MUITO IMPORTANTE: Se a fatura exibir o valor total de uma compra parcelada ao lado do valor da parcela mensal, EXTRAIA APENAS O VALOR DA PARCELA MENSAL. Ex: se o PDF mostra "630,00" e "63,00" para uma compra 02/10, o seu valor_cents DEVE SER 6300, e NUNCA 63000.

Responda APENAS com um objeto JSON neste formato exato (sem Markdown):
{
  "total_fatura_cents": 150000,
  "transacoes": [
    { "data": "2026-06-05", "descricao": "UBER *TRIP", "valor_cents": 2500, "moeda": "BRL", "parcela_atual": null, "parcela_total": null },
    { "data": "2026-06-06", "descricao": "AZUL LINHAS AEREAS", "valor_cents": 5000, "moeda": "BRL", "parcela_atual": 2, "parcela_total": 10 }
  ]
}
`

  const promptElo = `
ATENÇÃO: A fatura anexada é um extrato ELO OUROCARD. 
A formatação costuma ser caótica, misturando datas, descrições quebradas em múltiplas linhas e valores no fim.
Extraia TODAS as cobranças (compras, IOF, taxas, juros, tarifas, parcelas). IGNORE APENAS: pagamentos da própria fatura e estornos.
MUITO CUIDADO: O cartão Elo tem parcelamentos exibidos como "01/04", "02/04". Extraia a descrição completa e o valor da parcela.
Converta todos os valores para INTEIROS EM CENTAVOS (ex: R$ 12,50 vira 1250).
Converta todas as datas para YYYY-MM-DD (assuma o ano atual caso não tenha).
Se a compra for parcelada, extraia o número da parcela atual e o total de parcelas. Remova a informação de parcelas (ex: "02/12") do nome da descrição.
MUITO IMPORTANTE: Se a fatura exibir o valor total de uma compra parcelada ao lado do valor da parcela mensal, EXTRAIA APENAS O VALOR DA PARCELA MENSAL. Ex: se o PDF mostra "630,00" e "63,00" para uma compra 02/10, o seu valor_cents DEVE SER 6300, e NUNCA 63000.

Responda APENAS com um objeto JSON neste formato exato (sem Markdown):
{
  "total_fatura_cents": 150000,
  "transacoes": [
    { "data": "2026-06-05", "descricao": "UBER *TRIP", "valor_cents": 2500, "moeda": "BRL", "parcela_atual": null, "parcela_total": null },
    { "data": "2026-06-06", "descricao": "AZUL LINHAS AEREAS", "valor_cents": 5000, "moeda": "BRL", "parcela_atual": 2, "parcela_total": 10 }
  ]
}
`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    temperature: 0,
    system: "Você é um extrator de dados estrito. Responda única e exclusivamente com JSON válido.",
    messages: [
      {
        role: 'user',
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf
            }
          },
          {
            type: "text",
            text: tipo === 'elo_ourocard' ? promptElo : promptGenerico
          }
        ]
      }
    ]
  })

  // @ts-ignore
  const jsonStr = message.content[0].text.trim()
  // Limpeza de blocos Markdown (o Claude adora colocar ```json no começo)
  const cleanStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim()
  
  try {
    const data = JSON.parse(cleanStr) as ParseResult
    
    // Sanity Check: Soma das transações bate com o total declarado? (margem de erro de R$ 5,00)
    const somaTransacoes = data.transacoes.reduce((acc, curr) => acc + curr.valor_cents, 0)
    const diferenca = Math.abs(data.total_fatura_cents - somaTransacoes)
    data.sanity_ok = diferenca <= 500 // 500 centavos = R$ 5,00 de margem pra IOF/Taxas não capturadas
    
    return data
  } catch (error) {
    console.error("Falha ao fazer parse do JSON do Claude", jsonStr)
    throw new Error("A IA não retornou um JSON válido.")
  }
}
