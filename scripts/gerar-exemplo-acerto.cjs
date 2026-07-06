/**
 * Gera um docx de EXEMPLO do acerto, usando os números do
 * transferencia_nicco_maio2026.docx (modelo da Diana), só pra visualizar o
 * layout sem precisar do banco/sessão. Usa o MESMO builder da rota real.
 *
 *   node scripts/gerar-exemplo-acerto.cjs
 *
 * Saída: docs/exemplo-acerto-maio.docx
 */
const fs = require('fs')
const path = require('path')
const { Packer } = require('docx')
const { montarDocxAcerto } = require('../src/lib/acerto-docx.js')

// Dados do modelo de Maio/2026 (em centavos).
const dados = {
  mes: '2026-05',
  deDiana: false,
  transferenciaCentavos: 982933,
  dianaCartoes: [
    { rotulo: 'ELO Ourocard (cartão Diana)', totalCentavos: 1490378 },
    { rotulo: 'Smiles Visa (cartão Diana)', totalCentavos: 191999 },
    { rotulo: 'Latam Pass Itaú (cartão Diana)', totalCentavos: 1454859 },
    { rotulo: 'Azul Itaucard (cartão Diana)', totalCentavos: 141442 },
    { rotulo: 'Fora do cartão (diaristas, Gustavo, Cida, Claro, Ubers)', totalCentavos: 133697 },
  ],
  subtotalDianaCentavos: 3412375,
  niccoDeveCentavos: 1706188,
  niccoCartoes: [
    { rotulo: 'BTG Pactual (cartão Nicco)', totalCentavos: 920412 },
    { rotulo: 'Bradesco Platinum Amex (cartão Nicco)', totalCentavos: 526097 },
  ],
  subtotalNiccoCentavos: 1446509,
  dianaDeveCentavos: 723255,
  despesasPessoaisDianaCentavos: 1891802,
  despesasPessoaisNiccoCentavos: 1990258,
  metadeCompartDianaCentavos: 2429442,
  metadeCompartNiccoCentavos: 2429442,
  totalCabeDianaCentavos: 4321244,
  totalCabeNiccoCentavos: 4419700,
  totalGeralCentavos: 8740944,
  niccoPagouCentavos: 3436767,
  dianaPagouCentavos: 5304177,
}

const doc = montarDocxAcerto(dados)
const saida = path.join(__dirname, '..', 'docs', 'exemplo-acerto-maio.docx')

Packer.toBuffer(doc)
  .then((buf) => {
    fs.writeFileSync(saida, buf)
    console.log(`✅ Exemplo gerado: ${saida} (${buf.length} bytes)`)
  })
  .catch((err) => {
    console.error('Falha ao gerar exemplo:', err)
    process.exit(1)
  })
