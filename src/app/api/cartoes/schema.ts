import { z } from 'zod'

export const BANDEIRAS = [
  'Visa',
  'Mastercard',
  'American Express',
  'Elo',
  'Hipercard',
  'Outros',
] as const

export const cartaoSchema = z.object({
  apelido: z.string().trim().min(1, 'Apelido obrigatório'),
  banco: z.string().trim().min(1, 'Banco obrigatório'),
  bandeira: z.enum(BANDEIRAS),
  ultimos_digitos: z
    .union([z.string().regex(/^\d{4}$/, '4 dígitos'), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  dia_fechamento: z.number().int().min(1).max(31).nullable().optional(),
  dia_vencimento: z.number().int().min(1).max(31).nullable().optional(),
  membro_id: z.string().uuid('Dono inválido'),
})
