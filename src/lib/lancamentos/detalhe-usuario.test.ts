import { describe, expect, it } from "vitest"
import {
  atualizarDetalheUsuario,
  extrairDetalheUsuario,
  removerDetalheUsuario,
} from "./detalhe-usuario"

describe("detalhe do lançamento", () => {
  it("preserva a observação técnica ao salvar o detalhe do casal", () => {
    const observacao = "Fatura: junho.pdf; mês: 2026-06"
    const atualizada = atualizarDetalheUsuario(observacao, "  itens   da casa  ")

    expect(atualizada).toBe("Fatura: junho.pdf; mês: 2026-06\n[DETALHE DO CASAL] itens da casa")
    expect(extrairDetalheUsuario(atualizada)).toBe("itens da casa")
    expect(removerDetalheUsuario(atualizada)).toBe(observacao)
  })

  it("edita ou remove somente o detalhe do casal", () => {
    const observacao = "Nota técnica\n[DETALHE DO CASAL] compra pessoal"

    expect(atualizarDetalheUsuario(observacao, "presente")).toBe("Nota técnica\n[DETALHE DO CASAL] presente")
    expect(atualizarDetalheUsuario(observacao, "")).toBe("Nota técnica")
  })
})
