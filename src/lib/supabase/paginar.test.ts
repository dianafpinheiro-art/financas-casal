import { it, expect } from 'vitest'
import { buscarTodasPaginas } from './paginar'

it('carrega mais de mil linhas sem truncar o total', async () => {
  const rows = Array.from({ length: 2242 }, (_, id) => ({ id }))
  const result = await buscarTodasPaginas(async (a, b) => ({ data: rows.slice(a, b + 1), error: null }))
  expect(result.data).toEqual(rows)
})
it('não retorna um total parcial quando uma página falha', async () => {
  await expect(buscarTodasPaginas(async () => ({ data: null, error: { message: 'Falha' } }))).rejects.toThrow('Falha')
})
