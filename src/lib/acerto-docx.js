// @ts-nocheck
/**
 * Builder PURO do docx do acerto, no formato do transferencia_nicco_maio2026.docx
 * (tom íntimo entre Diana e Nicco). Recebe um objeto `dados` já calculado e
 * devolve um `Document` do pacote `docx`.
 *
 * É .js (CommonJS) de propósito: assim a rota (TS) importa via allowJs E um
 * script node consegue `require` o mesmo builder — uma fonte de verdade só,
 * tanto pra geração real quanto pro exemplo de preview.
 *
 * Formato do `dados` (tudo em CENTAVOS, exceto flags/strings):
 *   {
 *     mes: "YYYY-MM",
 *     deDiana: boolean,            // true = Diana transfere pro Nicco (invertido)
 *     transferenciaCentavos: number,
 *     dianaCartoes: [{ rotulo, totalCentavos }],  // inclui "Fora do cartão" se houver
 *     subtotalDianaCentavos, niccoDeveCentavos,
 *     niccoCartoes: [{ rotulo, totalCentavos }],
 *     subtotalNiccoCentavos, dianaDeveCentavos,
 *     despesasPessoaisDianaCentavos, despesasPessoaisNiccoCentavos,
 *     metadeCompartDianaCentavos, metadeCompartNiccoCentavos,
 *     totalCabeDianaCentavos, totalCabeNiccoCentavos,
 *     totalGeralCentavos, niccoPagouCentavos, dianaPagouCentavos,
 *   }
 */
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} = require('docx')

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function rotuloMes(mes) {
  const ano = mes.slice(0, 4)
  const nome = MESES[Number(mes.slice(5, 7)) - 1] ?? mes
  return `${nome}/${ano}`
}

function fmt(centavos) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (centavos ?? 0) / 100,
  )
}

// --- valor por extenso (literário, aproximado na casa dos milhares) ---
const UNID = [
  'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete',
  'dezoito', 'dezenove',
]
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
function porExtenso(n) {
  if (n < 20) return UNID[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  return u === 0 ? DEZ[d] : `${DEZ[d]} e ${UNID[u]}`
}
function valorExtenso(centavos) {
  const reais = (centavos ?? 0) / 100
  const mil = reais / 1000
  if (mil < 1) return 'menos de mil reais'
  const n = Math.round(mil)
  const palavra = n <= 99 ? porExtenso(n) : String(n)
  if (Math.abs(mil - n) < 0.05) return `${palavra} mil reais`
  return mil < n ? `quase ${palavra} mil reais` : `pouco mais de ${palavra} mil reais`
}

// --- helpers de parágrafo/tabela ---
function p(children, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: opts.spacing,
    children: Array.isArray(children) ? children : [children],
  })
}
function r(text, opts = {}) {
  return new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italic,
    size: opts.size,
    color: opts.color,
  })
}

const BORDA = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' }
const BORDAS = {
  top: BORDA, bottom: BORDA, left: BORDA, right: BORDA,
  insideHorizontal: BORDA, insideVertical: BORDA,
}

function cel(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: opts.alignRight ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [r(text, opts)],
      }),
    ],
  })
}

function tabela2col(linhas) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDAS,
    rows: linhas.map((l) =>
      new TableRow({
        children: [
          cel(l.esq, { width: 70, bold: l.bold, italic: l.italic }),
          cel(l.dir, { width: 30, alignRight: true, bold: l.bold }),
        ],
      }),
    ),
  })
}

function montarDocxAcerto(dados) {
  const rm = rotuloMes(dados.mes)
  const quitado = (dados.transferenciaCentavos ?? 0) === 0
  const inv = !!dados.deDiana

  const topoLabel = quitado
    ? 'Contas quitadas este mês 💜'
    : inv
      ? 'Eu te transfiro'
      : 'Você me transfere'

  const explicacao = inv
    ? 'Eu pago todas as contas compartilhadas que estão nos meus cartões, no boleto, no PIX e nas diaristas. Você paga as compartilhadas que estão nos seus cartões. No fim do mês, equilibramos: eu te transfiro a metade das compartilhadas que você pagou, e você me "reembolsa" descontando a metade do que está nos meus cartões.'
    : 'Eu pago todas as contas compartilhadas que estão nos meus cartões, no boleto, no PIX e nas diaristas. Você paga as compartilhadas que estão nos seus cartões. No fim do mês, equilibramos: você me transfere a metade das compartilhadas que eu paguei, e eu te "reembolso" descontando a metade do que está nos seus cartões.'

  const explicacaoSaldo = inv
    ? 'Este mês eu paguei mais nas minhas faturas, então o saldo fica a teu favor:'
    : 'Como você paga mais nas suas faturas (boletos, IPTU, condomínio, escola, diarista, etc), o saldo fica a meu favor:'

  // Seção 1 (Diana pagou compartilhadas)
  const sec1 = dados.dianaCartoes.map((c) => ({ esq: c.rotulo, dir: fmt(c.totalCentavos) }))
  sec1.push({ esq: 'Subtotal (eu paguei)', dir: fmt(dados.subtotalDianaCentavos), bold: true })
  sec1.push({ esq: '→ Sua metade (você me deve)', dir: fmt(dados.niccoDeveCentavos), bold: true, italic: true })

  // Seção 2 (Nicco pagou compartilhadas)
  const sec2 = dados.niccoCartoes.map((c) => ({ esq: c.rotulo, dir: fmt(c.totalCentavos) }))
  sec2.push({ esq: 'Subtotal (você pagou)', dir: fmt(dados.subtotalNiccoCentavos), bold: true })
  sec2.push({ esq: '→ Minha metade (eu te devo)', dir: fmt(dados.dianaDeveCentavos), bold: true, italic: true })

  // Seção 3 (saldo) — direção condicional
  const sec3 = inv
    ? [
        { esq: 'Eu te devo (metade do que você pagou)', dir: `+ ${fmt(dados.dianaDeveCentavos)}` },
        { esq: 'Você me deve (metade do que eu paguei)', dir: `− ${fmt(dados.niccoDeveCentavos)}` },
        { esq: 'Saldo a transferir', dir: fmt(dados.transferenciaCentavos), bold: true },
      ]
    : [
        { esq: 'Você me deve (metade do que paguei)', dir: `+ ${fmt(dados.niccoDeveCentavos)}` },
        { esq: 'Eu te devo (metade do que você pagou)', dir: `− ${fmt(dados.dianaDeveCentavos)}` },
        { esq: 'Saldo a transferir', dir: fmt(dados.transferenciaCentavos), bold: true },
      ]

  // Resumo (3 colunas)
  const tabResumo = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDAS,
    rows: [
      new TableRow({
        children: [cel('', { width: 40 }), cel('Diana', { width: 30, bold: true, alignRight: true }), cel('Nicco', { width: 30, bold: true, alignRight: true })],
      }),
      new TableRow({
        children: [cel('Despesas pessoais', { width: 40 }), cel(fmt(dados.despesasPessoaisDianaCentavos), { width: 30, alignRight: true }), cel(fmt(dados.despesasPessoaisNiccoCentavos), { width: 30, alignRight: true })],
      }),
      new TableRow({
        children: [cel('+ Metade das compartilhadas', { width: 40 }), cel(fmt(dados.metadeCompartDianaCentavos), { width: 30, alignRight: true }), cel(fmt(dados.metadeCompartNiccoCentavos), { width: 30, alignRight: true })],
      }),
      new TableRow({
        children: [cel('Total que cabe a cada um', { width: 40, bold: true }), cel(fmt(dados.totalCabeDianaCentavos), { width: 30, bold: true, alignRight: true }), cel(fmt(dados.totalCabeNiccoCentavos), { width: 30, bold: true, alignRight: true })],
      }),
    ],
  })

  const children = [
    p(r(`Transferência — ${rm}`, { bold: true, size: 32 })),
    p(r('Acerto das contas compartilhadas do casal', { italic: true, color: '888780' }), { spacing: { after: 200 } }),

    p(r(topoLabel, { color: '534AB7' }), { align: AlignmentType.CENTER }),
    p(r(quitado ? '' : fmt(dados.transferenciaCentavos), { bold: true, size: 56, color: '534AB7' }), { align: AlignmentType.CENTER }),
  ]
  if (!quitado) {
    children.push(
      p(r(`(${valorExtenso(dados.transferenciaCentavos)}, neném 💜)`, { italic: true, color: '534AB7' }), {
        align: AlignmentType.CENTER, spacing: { after: 200 },
      }),
    )
  }

  children.push(
    p(r('Como cheguei nesse valor', { bold: true, size: 26 }), { spacing: { before: 200, after: 100 } }),
    p(r(explicacao), { spacing: { after: 200 } }),

    p([r('1. Compartilhadas que eu paguei', { bold: true }), r(' (metade é sua)', { italic: true })], { spacing: { after: 80 } }),
    tabela2col(sec1),

    p([r('2. Compartilhadas que você pagou', { bold: true }), r(' (metade é minha)', { italic: true })], { spacing: { before: 200, after: 80 } }),
    tabela2col(sec2),

    p(r('3. Saldo final', { bold: true }), { spacing: { before: 200, after: 80 } }),
    p(r(explicacaoSaldo), { spacing: { after: 80 } }),
    tabela2col(sec3),

    p(r(`Resumo de ${rm} — total casal`, { bold: true, size: 26 }), { spacing: { before: 300, after: 100 } }),
    tabResumo,
    p(r(`Total geral do casal este mês: ${fmt(dados.totalGeralCentavos)}`, { italic: true }), { spacing: { before: 120 } }),
    p(r(`Você pagou nas suas faturas: ${fmt(dados.niccoPagouCentavos)}  ·  Eu paguei (faturas + boletos + diaristas): ${fmt(dados.dianaPagouCentavos)}`, { italic: true })),

    p(r('Te amo, neném 💜', { italic: true, color: '534AB7' }), { align: AlignmentType.CENTER, spacing: { before: 400 } }),
  )

  return new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{ children }],
  })
}

/** Gera o buffer do .docx direto (a rota usa esta — evita o tipo Document
 *  cruzar a fronteira TS/JS e dar conflito de "duas declarações"). */
async function gerarBufferAcerto(dados) {
  return Packer.toBuffer(montarDocxAcerto(dados))
}

module.exports = { montarDocxAcerto, gerarBufferAcerto, valorExtenso, rotuloMes }
