import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRole)

async function runUpdate() {
  console.log("Iniciando atualização de parcelas...")

  const lancCsvPath = path.join(process.env.USERPROFILE || '', 'Downloads', 'Supabase Snippet Transações por cartão e competência (limite 2000).csv')
  const lancFile = fs.readFileSync(lancCsvPath, 'utf-8')
  const lancamentosRaw = parse(lancFile, { columns: true, skip_empty_lines: true })

  // Buscar todos os lançamentos para não criar duplicatas e fazer o match perfeito
  const { data: lancamentosDb, error } = await supabase.from('lancamentos').select('id, descricao, valor, cartao_id, data_lancamento')
  
  if (error || !lancamentosDb) {
    console.error("Erro ao buscar lançamentos:", error)
    return
  }

  let updatedCount = 0

  // O match não é 100% garantido sem ID único, mas vamos tentar parear pela descrição + valor exato
  for (const raw of lancamentosRaw as any[]) {
    const pAtual = raw.parcela_atual !== 'null' ? parseInt(raw.parcela_atual) : null
    const pTotal = raw.parcela_total !== 'null' ? parseInt(raw.parcela_total) : null
    
    if (pAtual === null || pTotal === null) continue;

    // Achar o correspondente no banco
    const valorCentavos = Math.round(parseFloat(raw.valor_reais) * 100)
    
    // Tenta encontrar o lançamento correspondente
    const target = lancamentosDb.find(db => 
      db.descricao === raw.descricao &&
      db.valor === valorCentavos
    )

    if (target) {
      // Fazemos o update apenas das parcelas no banco de dados!
      await supabase.from('lancamentos').update({
        parcela_atual: pAtual,
        parcela_total: pTotal
      }).eq('id', target.id)
      updatedCount++
    }
  }

  console.log(`✅ Parcelas atualizadas em ${updatedCount} lançamentos!`)
}

runUpdate().catch(console.error)
