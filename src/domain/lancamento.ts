/**
 * Domínio: Lançamento.
 *
 * Código PURO — sem Next, sem Supabase, sem React. Tudo testável isolado.
 * Dinheiro SEMPRE em centavos (integer). Conversão pra reais só na exibição.
 */

// Regra por merchant (impl em merchant.js — reusada pelo script de migração).
export { extrairMerchant } from './merchant'

export type DivisaoTipo = 'dividir' | 'so_diana' | 'so_nicco' | 'personalizado'

/** No MVP o grupo é um casal (2 pessoas). Domínio fixa Diana/Nicco. */
export type Pagador = 'diana' | 'nicco'

export interface Lancamento {
  /** Valor em CENTAVOS (integer). R$ 12,34 => 1234. */
  valorCentavos: number
  pagoPor: Pagador
  divisaoTipo: DivisaoTipo
  /** 0..100. Obrigatório quando divisaoTipo === 'personalizado'. */
  divisaoPctDiana?: number
}

// ============================================================
// Conversão reais <-> centavos
// ============================================================
// Ficam no domínio (não em lib/utils) pra os parsers usarem sem importar
// nada de UI. Math.round protege do lixo de float (1.1 * 100 = 110.000...1).

export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100)
}

export function centavosParaReais(centavos: number): number {
  return centavos / 100
}

// ============================================================
// normalizarDescricao
// ============================================================

/**
 * Normaliza a descrição de um lançamento para casar com regras aprendidas.
 *
 * ⚠️ MESMA função usada no seed das regras E no parser de PDF. Qualquer
 * divergência entre os dois lados quebra o aprendizado (REGRA DE OURO do
 * projeto). Se mudar aqui, re-gera o seed.
 *
 * Ordem das operações:
 *  1. minúsculas
 *  2. remove acentos (josé -> jose) via NFD + \p{Diacritic}, pra
 *     "maria josé" casar com "maria jose"
 *  3. tira marcadores de parcela ANTES da pontuação genérica, pra remover
 *     também os dígitos: "parc 03/12", "(03/12)", "03/12" solto
 *  4. tira sufixos "*123" (asterisco + dígitos)
 *  5. troca o resto da pontuação por espaço
 *  6. colapsa espaços e dá trim
 *
 * NÃO tenta remover cidade/UF: é frágil (a versão antiga com regex de
 * cidade comia tudo depois de um hífen). A variação de sufixo é resolvida
 * pelo tipo_match (prefix/contains) da regra, não pela normalização.
 *
 * Idempotente: normalizarDescricao(normalizarDescricao(x)) === normalizarDescricao(x).
 */
export function normalizarDescricao(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // remove acentos
    .replace(/\bparc\.?\s*\d{1,2}\s*\/\s*\d{1,2}\b/g, ' ') // "parc 03/12"
    .replace(/\(\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)/g, ' ') // "(03/12)"
    .replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g, ' ') // "03/12" solto
    .replace(/\*\s*\d+/g, ' ') // sufixo "*125"
    .replace(/[^a-z0-9\s]/g, ' ') // pontuação restante -> espaço
    .replace(/\s+/g, ' ')
    .trim()
}

// ============================================================
// competenciaDaCompra
// ============================================================

/**
 * Em que mês (competência) uma compra cai, dado o ciclo do cartão.
 *
 * A competência é o PRIMEIRO DIA DO MÊS DE VENCIMENTO da fatura que contém
 * a compra. Devolve um Date em UTC (meia-noite), determinístico em qualquer
 * fuso — por isso lê a data de entrada também em UTC.
 *
 * Regra do ciclo:
 *  - Compra ATÉ o dia do fechamento (inclusive) entra na fatura que fecha
 *    naquele mês; DEPOIS do fechamento, na fatura do mês seguinte.
 *    👉 O "inclusive" no dia do fechamento é uma convenção (knob). Se algum
 *       cartão jogar a compra do dia do fechamento pra fatura seguinte,
 *       troca `dia > diaFechamento` por `dia >= diaFechamento`.
 *  - O vencimento dessa fatura é no MESMO mês do fechamento quando
 *    diaVencimento > diaFechamento (ex: fecha 15, vence 22); senão "vira o
 *    mês" (ex: fecha 28, vence 5 -> vence no mês seguinte ao fechamento).
 *
 * Ex (review): ELO fecha 15. Compra 16/abr cai depois do fechamento de abr,
 * então entra na fatura que fecha 15/mai.
 */
export function competenciaDaCompra(
  dataCompra: Date,
  diaFechamento: number,
  diaVencimento: number,
): Date {
  const ano = dataCompra.getUTCFullYear()
  const mes = dataCompra.getUTCMonth() // 0..11
  const dia = dataCompra.getUTCDate()

  // Mês em que FECHA a fatura que contém a compra (offset sobre 'mes').
  let mesFechamento = mes
  if (dia > diaFechamento) mesFechamento += 1

  // Do fechamento pro vencimento: +1 mês se o vencimento vira o mês.
  let mesVencimento = mesFechamento
  if (diaVencimento <= diaFechamento) mesVencimento += 1

  // Date.UTC normaliza overflow de mês (mês 12 -> janeiro do ano seguinte).
  return new Date(Date.UTC(ano, mesVencimento, 1))
}

// ============================================================
// dataCompraDaFatura
// ============================================================

/**
 * Resolve a data completa de uma compra a partir do texto da fatura
 * ("DD/MM" ou "DD/MM/AAAA") e do mês de competência da fatura.
 *
 * Numa fatura ÚNICA todos os lançamentos pertencem à mesma competência (o
 * mês de vencimento) — então o mês de referência vem de fora (a tela
 * /importar). Quando a data não traz ano, a gente infere: se o mês da compra
 * é DEPOIS do mês de referência, é do ano anterior (compra de dez numa
 * fatura de jan). Retorna Date UTC (meia-noite).
 *
 * (competenciaDaCompra continua pra quando a entrada for extrato cru, com
 *  compras espalhadas por vários ciclos — aí sim precisa do ciclo do cartão.)
 */
export function dataCompraDaFatura(
  dataStr: string,
  refAno: number,
  refMes1a12: number,
): Date {
  const m = dataStr.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!m) {
    throw new Error(`Data de fatura inválida: "${dataStr}"`)
  }
  const dia = Number(m[1])
  const mes = Number(m[2])
  let ano: number
  if (m[3] != null) {
    ano = Number(m[3])
    if (ano < 100) ano += 2000 // "26" -> 2026
  } else {
    ano = mes > refMes1a12 ? refAno - 1 : refAno
  }
  return new Date(Date.UTC(ano, mes - 1, dia))
}

// ============================================================
// Quanto cabe a cada um (em centavos)
// ============================================================

/**
 * Quanto cabe à Diana de um lançamento, em CENTAVOS (integer).
 *
 * 'personalizado' SEM divisaoPctDiana => LANÇA ERRO (fail-fast). Nada de
 * virar 50/50 silencioso: é código que mexe com dinheiro, falha barulhenta
 * é melhor que centavo errado escondido.
 *
 * No 'dividir' com valor ímpar, a Diana fica com o centavo a mais
 * (Math.round arredonda 0,5 pra cima). Como quantoCabeNicco é SEMPRE o
 * complemento (valor - cabeDiana), vale cabeDiana + cabeNicco === valor
 * sempre — nenhum centavo some na soma do mês.
 */
export function quantoCabeDiana(lanc: Lancamento): number {
  switch (lanc.divisaoTipo) {
    case 'so_diana':
      return lanc.valorCentavos
    case 'so_nicco':
      return 0
    case 'dividir':
      return Math.round(lanc.valorCentavos / 2)
    case 'personalizado':
      if (lanc.divisaoPctDiana == null) {
        throw new Error(
          'Lançamento personalizado sem divisaoPctDiana. ' +
            'Defina a porcentagem da Diana (0..100) antes de calcular o acerto.',
        )
      }
      return Math.round(lanc.valorCentavos * (lanc.divisaoPctDiana / 100))
    default:
      // Defesa contra divisaoTipo fora do union (ex: lixo vindo do banco).
      throw new Error(`divisaoTipo inválido: ${String(lanc.divisaoTipo)}`)
  }
}

export function quantoCabeNicco(lanc: Lancamento): number {
  return lanc.valorCentavos - quantoCabeDiana(lanc)
}
