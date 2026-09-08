const MARCADOR_DETALHE = "[DETALHE DO CASAL]"

export function extrairDetalheUsuario(observacao: string | null | undefined) {
  if (!observacao) return ""

  const linha = observacao
    .split(/\r?\n/)
    .find((item) => item.trimStart().startsWith(MARCADOR_DETALHE))

  return linha?.slice(linha.indexOf(MARCADOR_DETALHE) + MARCADOR_DETALHE.length).trim() || ""
}

export function removerDetalheUsuario(observacao: string | null | undefined) {
  return (observacao || "")
    .split(/\r?\n/)
    .filter((linha) => !linha.trimStart().startsWith(MARCADOR_DETALHE))
    .join("\n")
    .trim()
}

export function atualizarDetalheUsuario(observacao: string | null | undefined, detalhe: string) {
  const observacaoTecnica = removerDetalheUsuario(observacao)
  const detalheLimpo = detalhe.replace(/\s+/g, " ").trim()

  if (!detalheLimpo) return observacaoTecnica
  return [observacaoTecnica, `${MARCADOR_DETALHE} ${detalheLimpo}`].filter(Boolean).join("\n")
}
