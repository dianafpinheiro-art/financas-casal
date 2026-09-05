import type { ParsedTransaction } from '@/lib/parser/types'

export function mesValido(mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
}

export function conferirImportacao(transacoes: ParsedTransaction[], total: number, semTotal = false) {
  if (!transacoes.length || !Number.isSafeInteger(total) || transacoes.some(t => !Number.isSafeInteger(t.valor_cents))) {
    throw new Error('Importação vazia ou com valores inválidos.')
  }
  const soma = transacoes.reduce((s, t) => s + t.valor_cents, 0)
  return { soma, diferenca: soma - total, precisaRevisao: semTotal || Math.abs(soma - total) > 100 }
}
