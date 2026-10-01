import type { WorkbookHandle } from '@libraz/formulon-cell'
import { afterEach, describe, expect, it } from 'vitest'
import { CELL_EMBED_FORM_RANGE, seedCellEmbedWorkbook } from './cellEmbedScenarios'
import { getCellApi } from './engine'

const address = (row: number, col: number) => ({ sheet: 0, row, col })

const valueAt = (workbook: WorkbookHandle, row: number, col: number): number => {
  const value = workbook.getValue(address(row, col))
  if (value.kind !== 'number') throw new Error(`Expected a number at ${row}:${col}`)
  return value.value
}

describe('cell embedding workbook seeds', () => {
  let workbook: WorkbookHandle | null = null

  afterEach(() => {
    workbook?.dispose()
    workbook = null
  })

  it.each([
    ['en', 'Region', 'North', 'Total', 'In browser'],
    ['ja', '区分', '北部', '合計', 'ブラウザ内']
  ] as const)(
    'keeps the report seed and formulas in sync for %s',
    async (locale, header, firstRow, total, updated) => {
      const api = await getCellApi()
      workbook = await api.WorkbookHandle.createDefault()
      seedCellEmbedWorkbook(workbook, 'viewer', locale)

      expect(workbook.getValue(address(0, 0))).toEqual({ kind: 'text', value: header })
      expect(workbook.getValue(address(1, 0))).toEqual({ kind: 'text', value: firstRow })
      expect(workbook.getValue(address(4, 0))).toEqual({ kind: 'text', value: total })
      expect(workbook.getValue(address(5, 1))).toEqual({ kind: 'text', value: updated })
      expect(workbook.cellFormula(address(1, 3))).toBe('=ROUND(C2/B2,2)')
      expect(workbook.cellFormula(address(4, 3))).toBe('=ROUND(C5/B5,2)')
      expect(valueAt(workbook, 1, 3)).toBe(30.48)
      expect(valueAt(workbook, 4, 1)).toBe(99)
      expect(valueAt(workbook, 4, 2)).toBe(3005)
      expect(valueAt(workbook, 4, 3)).toBe(30.35)
    }
  )

  it.each([
    ['en', 'Item', 'Seats'],
    ['ja', '項目', '席数']
  ] as const)(
    'keeps the fixed form seed editable only inside B2:C4 for %s',
    async (locale, header, firstRow) => {
      const api = await getCellApi()
      workbook = await api.WorkbookHandle.createDefault()
      seedCellEmbedWorkbook(workbook, 'form', locale)

      expect(workbook.getValue(address(0, 0))).toEqual({ kind: 'text', value: header })
      expect(workbook.getValue(address(1, 0))).toEqual({ kind: 'text', value: firstRow })
      expect(valueAt(workbook, 1, 3)).toBe(240)
      expect(valueAt(workbook, 4, 1)).toBe(6)
      expect(valueAt(workbook, 4, 3)).toBe(780)
      expect(workbook.cellFormula(address(1, 3))).toBe('=B2*C2')

      const policy = api.fixedFormPolicy([CELL_EMBED_FORM_RANGE])
      expect(policy.editable).toEqual({ ranges: [CELL_EMBED_FORM_RANGE] })
      expect(policy.readOnly).not.toBe(true)
    }
  )
})
