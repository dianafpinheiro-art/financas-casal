/** O limite padrão do Supabase é 1.000 linhas. Nunca somar uma página parcial. */
export async function buscarTodasPaginas<T>(
  buscar: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: null }> {
  const data: T[] = []
  const tamanho = 500
  for (let inicio = 0; ; inicio += tamanho) {
    const pagina = await buscar(inicio, inicio + tamanho - 1)
    if (pagina.error) throw new Error(pagina.error.message)
    if (!pagina.data) throw new Error('Resposta vazia ao carregar lançamentos.')
    data.push(...pagina.data)
    if (pagina.data.length < tamanho) return { data, error: null }
  }
}
