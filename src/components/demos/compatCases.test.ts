import { describe, expect, it } from 'vitest'
import { COMPAT_CASES, matchesExcel, parseAddress, runCase } from './compatCases'
import { getEngine } from './engine'

describe('compatibility probes', () => {
  it('parses A1 addresses to zero-based coordinates', () => {
    expect(parseAddress('A1')).toEqual({ row: 0, col: 0 })
    expect(parseAddress('Z2')).toEqual({ row: 1, col: 25 })
    expect(parseAddress('AB10')).toEqual({ row: 9, col: 27 })
  })

  it('compares numbers as doubles and everything else as text', () => {
    expect(matchesExcel('-2.7755575615628914E-17', '-2.7755575615628914E-17')).toBe(true)
    expect(matchesExcel('0', '-2.7755575615628914E-17')).toBe(false)
    expect(matchesExcel('"60"', '60')).toBe(false)
  })

  for (const [group, cases] of Object.entries(COMPAT_CASES)) {
    it(`returns the captured Excel value for every ${group} probe`, async () => {
      const engine = await getEngine()
      for (const probe of cases) {
        expect(runCase(engine, probe), `${probe.profile} ${probe.formula}`).toSatisfy(
          (shown: string) => matchesExcel(shown, probe.excel)
        )
      }
    })
  }
})
