import { describe, expect, it } from "vitest"
import { avancarUmMesDataISO, estaNaMesmaCompetencia } from "./competencia"

describe("competência de gastos extras", () => {
  it("avança a data em um mês preservando o dia", () => {
    expect(avancarUmMesDataISO("2026-06-05")).toBe("2026-07-05")
    expect(avancarUmMesDataISO("2026-12-08")).toBe("2027-01-08")
  })

  it("limita o dia ao último dia do mês seguinte", () => {
    expect(avancarUmMesDataISO("2026-01-31")).toBe("2026-02-28")
  })

  it("identifica despesas que ainda estão na competência original", () => {
    expect(estaNaMesmaCompetencia("2026-06-30", "2026-06-30")).toBe(true)
    expect(estaNaMesmaCompetencia("2026-07-30", "2026-06-30")).toBe(false)
  })
})
