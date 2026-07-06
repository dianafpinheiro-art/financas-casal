import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata um valor em CENTAVOS (integer) como moeda BRL pra exibição.
 * É AQUI que centavos viram reais — em nenhum outro lugar (decisão #1).
 * Ex: formatCentavos(123456) => "R$ 1.234,56"
 */
export function formatCentavos(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100)
}

/**
 * Formata um valor já em REAIS (number) como moeda BRL.
 * Use só quando o valor JÁ está em reais; pro padrão do app (centavos),
 * use formatCentavos.
 */
export function formatBRL(reais: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(reais)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatMesAno(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(d)
}
