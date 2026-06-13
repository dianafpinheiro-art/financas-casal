import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import dotenv from 'dotenv'

// Carrega as variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRole)

// Função auxiliar para converter valores Reais (float string) para centavos (bigint)
function toCentavos(valorReaisStr: string): number {
  if (!valorReaisStr || valorReaisStr === 'null') return 0
  const val = parseFloat(valorReaisStr)
  if (isNaN(val)) return 0
  return Math.round(val * 100)
}

async function runMigration() {
  console.log("🚀 Iniciando migração de dados antigos...")

  // 1. Criar um Grupo Padrão e Membros
  console.log("Criando Grupo e Membros base...")
  
  const { data: grupo, error: grupoErr } = await supabase
    .from('grupos')
    .insert({ nome: 'Diana & Nicco' })
    .select('id')
    .single()
    
  if (grupoErr || !grupo) {
    console.error("Erro ao criar grupo:", grupoErr)
    return
  }
  const grupoId = grupo.id

  const { data: membros, error: membrosErr } = await supabase
    .from('membros')
    .insert([
      { grupo_id: grupoId, apelido: 'Diana', papel: 'admin' },
      { grupo_id: grupoId, apelido: 'Nicco', papel: 'membro' }
    ])
    .select('id, apelido')

  if (membrosErr || !membros) {
    console.error("Erro ao criar membros:", membrosErr)
    return
  }

  const dianaId = membros.find(m => m.apelido === 'Diana')?.id
  const niccoId = membros.find(m => m.apelido === 'Nicco')?.id

  // 2. Importar Regras (Merchant)
  console.log("Lendo CSV de Regras de IA...")
  const regrasCsvPath = path.join(process.env.USERPROFILE || '', 'Downloads', 'Supabase Snippet Fetch Active Learned Rules by Merchant.csv')
  const regrasFile = fs.readFileSync(regrasCsvPath, 'utf-8')
  
  const regras = parse(regrasFile, { columns: true, skip_empty_lines: true })
  console.log(`Encontradas ${regras.length} regras antigas. Inserindo...`)

  // Inserir categorias para não quebrar chave estrangeira, ou apenas ignorar a categoria por enquanto
  // Como `categoria_id` é opcional/null, vamos deixar sem criar todas as categorias antes, 
  // mas o ideal seria criar. Para simplificar, vou criar categorias sob demanda.
  const mapCategorias = new Map<string, string>() // nome -> uuid
  
  const categoriasUnicas = [...new Set(regras.map((r: any) => r.categoria).filter((c: string) => c && c !== 'null'))] as string[]
  
  const { data: catsCriadas } = await supabase
    .from('categorias')
    .insert(categoriasUnicas.map(c => ({ grupo_id: grupoId, nome: c })))
    .select('id, nome')

  if (catsCriadas) {
    catsCriadas.forEach(c => mapCategorias.set(c.nome, c.id))
  }

  const payloadRegras = regras.map((r: any) => {
    return {
      grupo_id: grupoId,
      merchant: r.merchant,
      categoria_id: mapCategorias.get(r.categoria) || null,
      divisao_tipo: r.divisao_tipo && r.divisao_tipo !== 'null' ? r.divisao_tipo : 'nao_classificado',
      divisao_pct_diana: r.divisao_pct_diana !== 'null' ? parseInt(r.divisao_pct_diana) : 50,
      vezes_confirmada: parseInt(r.vezes_confirmada) || 1,
      ativa: r.ativa === 'true',
    }
  })

  // Agrupar e garantir uniqs por merchant para evitar erros do UNIQUE(grupo_id, merchant)
  const uniqRegrasMap = new Map()
  for (const pr of payloadRegras) {
    if (!uniqRegrasMap.has(pr.merchant)) {
      uniqRegrasMap.set(pr.merchant, pr)
    }
  }

  const { error: regrasErr } = await supabase
    .from('regras_aprendidas')
    .insert(Array.from(uniqRegrasMap.values()))

  if (regrasErr) {
    console.error("Erro inserindo regras:", regrasErr)
  } else {
    console.log("✅ Regras importadas com sucesso!")
  }

  // 3. Importar Lançamentos
  console.log("Lendo CSV de Lançamentos...")
  const lancCsvPath = path.join(process.env.USERPROFILE || '', 'Downloads', 'Supabase Snippet Transações por cartão e competência (limite 2000).csv')
  const lancFile = fs.readFileSync(lancCsvPath, 'utf-8')

  const lancamentosRaw = parse(lancFile, { columns: true, skip_empty_lines: true })
  console.log(`Encontrados ${lancamentosRaw.length} lançamentos. Inserindo...`)

  // Precisamos criar os cartões primeiro baseados nos dados brutos
  const cartoesUnicos = [...new Set(lancamentosRaw.map((l: any) => l.cartao).filter((c: string) => c && c !== 'null'))] as string[]
  
  const mapCartoes = new Map<string, string>() // apelido -> uuid
  const payloadCartoes = cartoesUnicos.map(c => ({
    grupo_id: grupoId,
    apelido: c,
    banco: c.includes('Itau') ? 'Itaú' : (c.includes('BB') ? 'Banco do Brasil' : 'Desconhecido'),
    parser_tipo: 'generico'
  }))

  const { data: cartoesCriados } = await supabase.from('cartoes').insert(payloadCartoes).select('id, apelido')
  if (cartoesCriados) {
    cartoesCriados.forEach(c => mapCartoes.set(c.apelido, c.id))
  }

  // Montar payload de lançamentos
  // data_lancamento,data_competencia,descricao,merchant,cartao,banco,bandeira,categoria,valor_reais,parcela_atual,parcela_total,divisao_tipo,divisao_pct_diana,pagou,revisado,observacao,tags
  const payloadLanc = lancamentosRaw.map((l: any) => {
    return {
      grupo_id: grupoId,
      cartao_id: mapCartoes.get(l.cartao) || null,
      pago_por_id: l.pagou === 'Nicco' ? niccoId : dianaId, // Baseado na lógica de quem era dono do cartão
      data_lancamento: l.data_lancamento && l.data_lancamento !== 'null' ? l.data_lancamento : null,
      data_competencia: l.data_competencia && l.data_competencia !== 'null' ? l.data_competencia : new Date().toISOString().split('T')[0],
      descricao: l.descricao || 'Sem descrição',
      merchant: l.merchant !== 'null' ? l.merchant : null,
      valor: toCentavos(l.valor_reais),
      categoria_id: mapCategorias.get(l.categoria) || null,
      divisao_tipo: l.divisao_tipo && l.divisao_tipo !== 'null' ? l.divisao_tipo : 'nao_classificado',
      divisao_pct_diana: l.divisao_pct_diana !== 'null' ? parseInt(l.divisao_pct_diana) : 50,
      classificado: l.revisado === 'true'
    }
  })

  // Inserir em lotes de 100 para evitar timeout
  const loteSize = 100
  for (let i = 0; i < payloadLanc.length; i += loteSize) {
    const lote = payloadLanc.slice(i, i + loteSize)
    const { error: insErr } = await supabase.from('lancamentos').insert(lote)
    if (insErr) {
      console.error(`Erro inserindo lote ${i}:`, insErr)
    }
  }

  console.log("✅ Lançamentos importados com sucesso!")
  console.log("🚀 Migração concluída com sucesso! Todos os dados antigos estão agora no novo formato BIGINT.")
}

runMigration().catch(console.error)
