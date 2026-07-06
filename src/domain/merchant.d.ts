export interface MerchantRegra {
  slug: string
  match: RegExp
}

export declare const MERCHANTS_FINAIS: MerchantRegra[]
export declare const MERCHANTS_GATEWAYS: MerchantRegra[]
export declare const PREFIXOS: string[]

/**
 * Extrai o slug do merchant de uma descrição de lançamento. Sempre devolve
 * uma string (lowercase, snake_case); 'desconhecido' se nada significativo.
 */
export declare function extrairMerchant(descricao: string): string
