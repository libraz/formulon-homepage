import { describe, expect, it } from 'vitest'
import { engineBlocker, getEngine, numberResult } from './engine'

describe('serial WASM demos', () => {
  it('runs the default engine without cross-origin isolation', async () => {
    expect(globalThis.crossOriginIsolated).toBe(false)
    expect(engineBlocker()).toBeNull()
    expect(engineBlocker(true)).not.toBeNull()
    const engine = await getEngine()
    const workbook = engine.module.Workbook.createDefault()
    try {
      expect(engine.module.version()).toBe('0.12.0')
    } finally {
      workbook.delete()
    }
  })

  it('handles both numeric accessor shapes and rejects failed status', () => {
    expect(numberResult(7)).toBe(7)
    expect(
      numberResult({ status: { ok: true, status: 0, message: '', context: '' }, value: 8 })
    ).toBe(8)
    expect(() =>
      numberResult({
        status: { ok: false, status: 1, message: 'bad input', context: '' },
        value: 0
      })
    ).toThrow('bad input')
  })
})
