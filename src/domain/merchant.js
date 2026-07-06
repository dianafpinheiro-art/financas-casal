// @ts-nocheck
/**
 * extrairMerchant — paradigma "regra por MERCHANT".
 *
 * Uma regra cobre TODAS as variações de string do mesmo estabelecimento, em
 * qualquer cartão ("CARREFOUR COMCAJAMAR" e "IFD CARREFOUR COMERCIO RECIFE"
 * viram ambos "carrefour").
 *
 * Algoritmo (decisão confirmada com a Diana — whitelist primeiro):
 *   1. WHITELIST por especificidade na descrição ORIGINAL (substring):
 *      1a. merchants FINAIS (rappi, uber, google, carrefour...) — ganham dos gateways
 *      1b. GATEWAYS (paypal, mercadopago, kiwify, ifood...) — só se nenhum final casou
 *   2. fallback: tira prefixos de gateway/banco + dígitos do início e pega a
 *      primeira palavra significativa, em slug.
 *
 *   "PAYPAL *RAPPIBRASIL"   -> rappi    (final ganha do gateway)
 *   "PAYPAL *GOOGLE BUDGET" -> google
 *   "PAYPAL SUBSCRIPTION"   -> paypal   (sem final legível)
 *   "MP *UBERSANDROO"       -> uber
 *   "MERCADOPAGO *M"        -> mercadopago
 *
 * É .js (CommonJS) de propósito: o script de migração (node) e o domínio (TS,
 * via re-export em lancamento.ts) usam o MESMO código — uma fonte de verdade.
 *
 * ⚠️ Ajustes vs spec: os regex de `uber` e `google` foram alargados pra casar
 * "UBERSANDROO"/"GOOGLE BUDGET" (os do spec não pegariam). E a ordem ethos vs
 * bradesco: ethos vem antes (mais específico) pra "BCO BRADESCO S.A" (boleto do
 * colégio) não virar "bradesco".
 */

// Tier 1 — merchants FINAIS (o estabelecimento de verdade).
const MERCHANTS_FINAIS = [
  { slug: 'carrefour', match: /carrefour/i },
  { slug: 'mercadolivre', match: /mercado\s*livre|^ml\b/i },
  { slug: 'amazon', match: /\bamazon|amazonmktplc|amazon\s*br/i },
  { slug: 'claude', match: /claude\.?ai|anthropic/i },
  { slug: 'latam_air', match: /latam\s*air/i },
  { slug: 'latam_pass', match: /latam\s*pass|clube\s*latam/i },
  { slug: 'livelo', match: /livelo|turbo\s*livelo|acelerador.*pontos/i },
  { slug: 'shein', match: /shein/i },
  { slug: 'lojas_riachuelo', match: /lojas\s*riachu/i },
  { slug: 'drogasil', match: /drogasil|drogaria\s*irmaos|droga\s*raia/i },
  { slug: 'iza_marins', match: /izabela\s*marins/i },
  { slug: 'santander', match: /bco\s*santander|santander\s*brasil/i },
  { slug: 'ethos', match: /bco\s*bradesco\s*s\.?a|colegio\s*ethos/i },
  { slug: 'bradesco', match: /bco\s*bradesco/i },
  { slug: 'itau', match: /bco\s*itau|itau\s*unibanco|itau\s*avisa|mensalidade.*plano/i },
  { slug: 'uber', match: /\buber|99\s*app|99\*|99\s*sao\s*paulo|taxi|pop\s+\d+abr/i },
  { slug: 'apple', match: /applecombill|apple\.com\/bill/i },
  { slug: 'google', match: /google/i },
  { slug: 'sams_club', match: /sams\*|sams\s*recife/i },
  { slug: 'hostinger', match: /hostinger/i },
  { slug: 'manus_ai', match: /manus\s*ai/i },
  { slug: 'elevenlabs', match: /elevenlabs/i },
  { slug: 'runpod', match: /runpod/i },
  { slug: 'proton', match: /proton/i },
  { slug: 'wyndham', match: /wyndham/i },
  { slug: 'ibis', match: /\bibis\b/i },
  { slug: 'rappi', match: /rappi/i },
  { slug: 'red_balloon', match: /red\s*balloon|redballoon/i },
  { slug: 'geekie', match: /geekie/i },
  { slug: 'sendas', match: /sendas/i },
  { slug: 'companhia_brasileira', match: /companhia\s*brasilei/i },
  { slug: 'tiktok', match: /tiktok|tik\s*tok/i },
  { slug: 'eudora', match: /eudora/i },
  { slug: 'boticario', match: /botica/i },
  { slug: 'ana_maria', match: /ana\s*maria\s*de\s*albuquer/i },
  { slug: 'maria_jose', match: /maria\s*jose\s*da\s*silva/i },
  { slug: 'alleci', match: /alleci\s*iris/i },
  { slug: 'guilherme_rica', match: /guilherme\s*rica/i },
  { slug: 'vladimir_paulo', match: /vladimir\s*paulo/i },
  { slug: 'debora_franco', match: /debora\s*carla\s*franco/i },
  { slug: 'andre_luis', match: /andre\s*luis\s*da\s*silva/i },
  { slug: 'andreza_moreira', match: /andreza\s*moreira/i },
  { slug: 'convenio_prefeitura', match: /convenio\s*prefeitura/i },
]

// Tier 2 — GATEWAYS (só ganham se nenhum merchant final casou).
const MERCHANTS_GATEWAYS = [
  { slug: 'mercadopago', match: /mercado\s*pago|mercadopago/i },
  { slug: 'kiwify', match: /kiwify/i },
  { slug: 'ifood', match: /ifood|i-food|ifd\s+/i },
  { slug: 'paypal', match: /paypal/i },
  { slug: 'hubla', match: /hubla|hbl\*/i },
  { slug: 'greenn', match: /greenn/i },
  { slug: 'cakto', match: /cakto/i },
  { slug: 'perfectpay', match: /perfectpay/i },
  { slug: 'assiny', match: /assiny/i },
]

// Prefixos de gateway/banco pro FALLBACK (removidos do início).
const PREFIXOS = [
  'ifd', 'ml', 'htm', 'hbl', 'kvn', 'mp', 'ebn', 'dl', 'dm', 'pg', 'br1',
  'brs', 'aut', 'asa', 'ec', 'mercado', 'paypal', 'ig', 'hna', 'hubla',
  'cakto', 'assiny', 'edz', 'll', 'greenn', 'kiwify', 'perfectpay',
  'applecombills', 'google', 'mercadopago', 'pix', 'titulo', 'ifood',
]
const PREFIX_SET = new Set(PREFIXOS)

function fallbackMerchant(descricao) {
  // tokeniza por espaço/asterisco, normaliza cada token (só alfanumérico)
  const tokens = descricao
    .split(/[\s*]+/)
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((t) => t !== '')
  for (const t of tokens) {
    if (PREFIX_SET.has(t)) continue // prefixo de gateway/banco
    const semDigitos = t.replace(/^\d+/, '') // tira dígitos do início ("13produtos" -> "produtos")
    if (semDigitos.length >= 2) return semDigitos
  }
  return 'desconhecido'
}

function extrairMerchant(descricao) {
  const d = String(descricao ?? '').trim()
  if (d === '') return 'desconhecido'
  for (const m of MERCHANTS_FINAIS) if (m.match.test(d)) return m.slug
  for (const m of MERCHANTS_GATEWAYS) if (m.match.test(d)) return m.slug
  return fallbackMerchant(d)
}

module.exports = { extrairMerchant, MERCHANTS_FINAIS, MERCHANTS_GATEWAYS, PREFIXOS }
