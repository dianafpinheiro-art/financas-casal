/**
 * lint-staged: o que rodar antes de cada commit, baseado nos arquivos staged.
 *
 * Pra TS/TSX rodamos `tsc --noEmit` no PROJETO INTEIRO (não nos arquivos
 * soltos). Motivo: `tsc arquivo.ts` ignora o tsconfig.json (paths, strict,
 * libs) e dá falso verde. A função abaixo descarta a lista de arquivos e
 * devolve o comando do projeto — é o jeito idiomático de type-checar no
 * pre-commit sem furo.
 */
export default {
  '*.{ts,tsx}': () => 'tsc --noEmit',
}
