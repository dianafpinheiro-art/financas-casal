import { describe, expect, it } from "vitest"
import { avancarUmMesDataISO } from "./competencia"

describe("competência de gastos extras", () => {
  it("avança a data em um mês preservando o dia", () => {
    expect(avancarUmMesDataISO("2026-06-05")).toBe("2026-07-05")
    expect(avancarUmMesDataISO("2026-12-08")).toBe("2027-01-08")
  })

  it("limita o dia ao último dia do mês seguinte", () => {
    expect(avancarUmMesDataISO("2026-01-31")).toBe("2026-02-28")
  })
})
