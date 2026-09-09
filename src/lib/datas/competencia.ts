export function avancarUmMesDataISO(data: string) {
  const correspondencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(data)
  if (!correspondencia) throw new Error("Data inválida.")

  const ano = Number(correspondencia[1])
  const mes = Number(correspondencia[2])
  const dia = Number(correspondencia[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) throw new Error("Data inválida.")

  // O número do mês original (1-12) também é o índice UTC (0-11) do mês
  // seguinte. Ex.: junho (6) vira julho (índice 6).
  const inicioMesSeguinte = new Date(Date.UTC(ano, mes, 1))
  const anoSeguinte = inicioMesSeguinte.getUTCFullYear()
  const mesSeguinte = inicioMesSeguinte.getUTCMonth() + 1
  const ultimoDia = new Date(Date.UTC(anoSeguinte, mesSeguinte, 0)).getUTCDate()
  const diaAjustado = Math.min(dia, ultimoDia)

  return `${anoSeguinte}-${String(mesSeguinte).padStart(2, "0")}-${String(diaAjustado).padStart(2, "0")}`
}
