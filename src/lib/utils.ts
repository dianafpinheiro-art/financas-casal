import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
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

/**
 * Normaliza descrição de lançamento para matching de regras de aprendizado.
 * Remove: parcelas, datas, cidades, números no final.
 *
 * Exemplos:
 * "AMAZON PARC 03/12 - SAO PAULO" → "AMAZON"
 * "GRANADO PHARMACIAS RECIFE" → "GRANADO PHARMACIAS"
 * "Mix Mateus" → "MIX MATEUS"
 */
export function normalizarDescricao(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/\s*PARC\s+\d{1,2}\/\d{1,2}\s*/g, ' ')
    .replace(/\s*\(\d{1,2}\/\d{1,2}\)\s*/g, ' ')
    .replace(/\s*-\s*(SAO PAULO|RECIFE|RIO DE JANEIRO|BELEM|BARUERI|OSASCO|.*)$/i, '')
    .replace(/\s+\d+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
