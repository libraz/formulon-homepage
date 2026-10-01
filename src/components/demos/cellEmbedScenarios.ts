import type { WorkbookHandle } from '@libraz/formulon-cell'

/** The public scenario names used by the cell documentation pages. */
export type CellEmbedScenario =
  | 'viewer'
  | 'form'
  | 'profiles'
  | 'host-sync'
  | 'theme-locale'
  | 'overlay'

export type CellEmbedLocale = 'en' | 'ja'

export interface CellEmbedViewport {
  sheet: number
  r0: number
  c0: number
  r1: number
  c1: number
}

/** Every embedded sheet is deliberately small enough to stay a reading aid. */
export const CELL_EMBED_VIEWPORT: CellEmbedViewport = {
  sheet: 0,
  r0: 0,
  c0: 0,
  r1: 5,
  c1: 3
}

/** B2:C4 in the zero-based range shape accepted by fixedFormPolicy(). */
export const CELL_EMBED_FORM_RANGE: CellEmbedViewport = {
  sheet: 0,
  r0: 1,
  c0: 1,
  r1: 3,
  c1: 2
}

const reportRows = {
  en: [
    ['North', 42, 1280],
    ['Central', 31, 945],
    ['South', 26, 780]
  ],
  ja: [
    ['北部', 42, 1280],
    ['中央', 31, 945],
    ['南部', 26, 780]
  ]
} as const

const formRows = {
  en: [
    ['Seats', 2, 120],
    ['Support', 1, 300],
    ['Training', 3, 80]
  ],
  ja: [
    ['席数', 2, 120],
    ['サポート', 1, 300],
    ['研修', 3, 80]
  ]
} as const

const setText = (wb: WorkbookHandle, row: number, col: number, text: string): void => {
  wb.setText({ sheet: 0, row, col }, text)
}

const setNumber = (wb: WorkbookHandle, row: number, col: number, value: number): void => {
  wb.setNumber({ sheet: 0, row, col }, value)
}

const setFormula = (wb: WorkbookHandle, row: number, col: number, formula: string): void => {
  wb.setFormula({ sheet: 0, row, col }, formula)
}

/** Seed one compact workbook that can be used by every embedding example. */
export function seedCellEmbedWorkbook(
  wb: WorkbookHandle,
  scenario: CellEmbedScenario,
  locale: CellEmbedLocale
): void {
  if (scenario === 'form') {
    seedForm(wb, locale)
    return
  }
  seedReport(wb, locale)
}

function seedReport(wb: WorkbookHandle, locale: CellEmbedLocale): void {
  const labels =
    locale === 'ja' ? ['区分', '件数', '売上', '平均'] : ['Region', 'Orders', 'Revenue', 'Average']
  labels.forEach((label, col) => {
    setText(wb, 0, col, label)
  })

  reportRows[locale].forEach(([name, orders, revenue], index) => {
    const row = index + 1
    setText(wb, row, 0, name)
    setNumber(wb, row, 1, orders)
    setNumber(wb, row, 2, revenue)
    setFormula(wb, row, 3, `=ROUND(C${row + 1}/B${row + 1},2)`)
  })

  setText(wb, 4, 0, locale === 'ja' ? '合計' : 'Total')
  setFormula(wb, 4, 1, '=SUM(B2:B4)')
  setFormula(wb, 4, 2, '=SUM(C2:C4)')
  setFormula(wb, 4, 3, '=ROUND(C5/B5,2)')

  setText(wb, 5, 0, locale === 'ja' ? '更新' : 'Updated')
  setText(wb, 5, 1, locale === 'ja' ? 'ブラウザ内' : 'In browser')
  wb.recalc()
}

function seedForm(wb: WorkbookHandle, locale: CellEmbedLocale): void {
  const labels =
    locale === 'ja' ? ['項目', '数量', '単価', '小計'] : ['Item', 'Qty', 'Price', 'Total']
  labels.forEach((label, col) => {
    setText(wb, 0, col, label)
  })

  formRows[locale].forEach(([name, quantity, price], index) => {
    const row = index + 1
    setText(wb, row, 0, name)
    setNumber(wb, row, 1, quantity)
    setNumber(wb, row, 2, price)
    setFormula(wb, row, 3, `=B${row + 1}*C${row + 1}`)
  })

  setText(wb, 4, 0, locale === 'ja' ? '合計' : 'Total')
  setFormula(wb, 4, 1, '=SUM(B2:B4)')
  setFormula(wb, 4, 3, '=SUM(D2:D4)')
  setText(wb, 5, 0, locale === 'ja' ? '入力範囲' : 'Editable range')
  setText(wb, 5, 1, 'B2:C4')
  wb.recalc()
}
