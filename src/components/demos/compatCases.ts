/**
 * Excel-behaviour probes for the "How far compatibility goes" page.
 *
 * Every `excel` value is copied from a golden the core repo captured from a
 * real Excel build (`tests/oracle/targets/<profile>/golden/`), and `profile`
 * names that capture. `plausible` is what a straightforward implementation
 * tends to return; it is omitted where that answer happens to match Excel.
 * The demo and its test both run each case through the real engine, so a
 * dependency bump that drifts from Excel fails the test.
 */
import type { ExcelProfileId, Value } from '@libraz/formulon'
import type { Engine } from './engine'

/** A seed cell: A1 address and its input. A string starting with `=` is a
 *  formula; any other string is text. */
export type SeedCell = [address: string, input: string | number]

export interface CompatCase {
  formula: string
  /** Display form: numbers bare, text in double quotes, TRUE/FALSE, `#ERR!`. */
  excel: string
  plausible?: string
  profile: ExcelProfileId
  cells?: SeedCell[]
}

export type CompatGroup = 'float' | 'dates' | 'coercion' | 'text' | 'spill'

/** The formula under test always sits in Z1, where the goldens put it. */
const ANCHOR = { row: 0, col: 25 } as const

const MAC_JA: ExcelProfileId = 'mac-365-ja_JP'
const WIN_JA: ExcelProfileId = 'win-365-ja_JP'

const KANA_COLUMN: SeedCell[] = [
  ['A1', 'ア'],
  ['A2', 'い'],
  ['A3', 'う']
]

/** A formula returning "", a zero-length text constant, a true blank, text. */
const MIXED_EMPTIES: SeedCell[] = [
  ['A1', '=""'],
  ['A2', ''],
  ['A4', 'apple']
]

export const COMPAT_CASES: Record<CompatGroup, CompatCase[]> = {
  float: [
    { formula: '=0.5-0.4-0.1', excel: '0', plausible: '-2.78E-17', profile: MAC_JA },
    {
      formula: '=(0.5-0.4-0.1)',
      excel: '-2.7755575615628914E-17',
      plausible: '0',
      profile: MAC_JA
    },
    { formula: '=0.5-0.4-0.1=0', excel: 'FALSE', plausible: 'TRUE', profile: MAC_JA },
    { formula: '=1E15+0.3-1E15', excel: '0', plausible: '0.25', profile: MAC_JA },
    {
      formula: '=SUM(0.5,-0.4,-0.1)',
      excel: '0',
      plausible: '-2.78E-17',
      profile: MAC_JA
    },
    {
      formula: '=SUMIF(A1:A3,"<>x")',
      excel: '-2.7755575615628914E-17',
      plausible: '0',
      profile: MAC_JA,
      cells: [
        ['A1', 0.5],
        ['A2', -0.4],
        ['A3', -0.1]
      ]
    },
    {
      formula: '=VALUETOTEXT(1234567890123456)',
      excel: '"1234567890123450"',
      plausible: '"1234567890123456"',
      profile: MAC_JA
    },
    { formula: '=MROUND(6.05,0.1)', excel: '6', plausible: '6.1', profile: MAC_JA },
    {
      formula: '=MROUND(7.05,0.1)',
      excel: '7.1000000000000005',
      plausible: '7.1',
      profile: MAC_JA
    },
    { formula: '=(-8)^(1/3)', excel: '-1.9999999999999998', plausible: '#NUM!', profile: MAC_JA },
    { formula: '=(-8)^(2/3)', excel: '#NUM!', plausible: '4', profile: MAC_JA }
  ],
  dates: [
    { formula: '=N(DATE(1900,2,29))', excel: '60', plausible: '61', profile: MAC_JA },
    { formula: '=WORKDAY(59,1)', excel: '60', plausible: '61', profile: MAC_JA },
    {
      formula: '=TEXT(0,"yyyy/m/d")',
      excel: '"1900/1/0"',
      plausible: '"1899/12/31"',
      profile: MAC_JA
    },
    {
      formula: '=DATEVALUE("令和元年5月1日")',
      excel: '#VALUE!',
      plausible: '43586',
      profile: MAC_JA
    },
    {
      formula: '=DATEVALUE("平成32年4月30日")',
      excel: '43951',
      plausible: '#VALUE!',
      profile: MAC_JA
    },
    {
      formula: '=TEXT(43586,"ggge年m月d日")',
      excel: '"令和1年5月1日"',
      plausible: '"令和元年5月1日"',
      profile: MAC_JA
    },
    {
      formula: '=TIMEVALUE("12:60")',
      excel: '0.5416666666666666',
      plausible: '#VALUE!',
      profile: MAC_JA
    }
  ],
  coercion: [
    {
      formula: '=COUNTIF(A1:A4,"")',
      excel: '3',
      plausible: '1',
      profile: MAC_JA,
      cells: MIXED_EMPTIES
    },
    {
      formula: '=COUNTIF(A1:A4,"=")',
      excel: '1',
      plausible: '3',
      profile: MAC_JA,
      cells: MIXED_EMPTIES
    },
    { formula: '=IF("TRUE",1,0)', excel: '1', plausible: '#VALUE!', profile: MAC_JA },
    { formula: '=IF("  TRUE  ",1,2)', excel: '#VALUE!', plausible: '1', profile: MAC_JA },
    { formula: '=AND("  TRUE  ",TRUE)', excel: 'TRUE', plausible: '#VALUE!', profile: MAC_JA },
    { formula: '=SUM("TRUE",1)', excel: '#VALUE!', plausible: '2', profile: MAC_JA },
    { formula: '=TRUE=1', excel: 'FALSE', plausible: 'TRUE', profile: MAC_JA },
    {
      formula: '=COUNTA(SORT(A1:A3))',
      excel: '3',
      plausible: '2',
      profile: MAC_JA,
      cells: [
        ['A1', 2],
        ['A3', 1]
      ]
    },
    { formula: '=VALUE("¥1,234")', excel: '1234', plausible: '#VALUE!', profile: MAC_JA },
    { formula: '=VALUE("23円")', excel: '#VALUE!', plausible: '23', profile: MAC_JA }
  ],
  text: [
    {
      formula: '=MATCH("あ",A1:A3,0)',
      excel: '1',
      plausible: '#N/A',
      profile: MAC_JA,
      cells: KANA_COLUMN
    },
    {
      formula: '=MATCH("あ",A1:A3,0)',
      excel: '#N/A',
      profile: WIN_JA,
      cells: KANA_COLUMN
    },
    { formula: '=CODE("髙")', excel: '95', plausible: '39641', profile: MAC_JA },
    { formula: '=CODE("髙")', excel: '38526', plausible: '39641', profile: WIN_JA },
    { formula: '=LENB("â")', excel: '2', profile: MAC_JA },
    { formula: '=LENB("â")', excel: '1', plausible: '2', profile: WIN_JA },
    {
      formula: '=COUNTIF(A1:A2,"12*")',
      excel: '1',
      plausible: '2',
      profile: MAC_JA,
      cells: [
        ['A1', '12 Oak Street'],
        ['A2', 1213]
      ]
    },
    { formula: '=ASC("ヴ")', excel: '"ヴ"', plausible: '"ｳﾞ"', profile: MAC_JA }
  ],
  spill: [
    { formula: '=@A1:A5', excel: '42', plausible: '#VALUE!', profile: MAC_JA, cells: [['A1', 42]] },
    { formula: '=@A3:A8', excel: '#VALUE!', plausible: '0', profile: MAC_JA, cells: [['A1', 42]] },
    {
      formula: '=SEQUENCE(3)',
      excel: '#SPILL!',
      plausible: '1',
      profile: MAC_JA,
      cells: [['Z2', '=""']]
    }
  ]
}

/** `B12` → zero-based `{ row: 11, col: 1 }`. */
export function parseAddress(address: string): { row: number; col: number } {
  const match = address.match(/^([A-Z]+)(\d+)$/)
  if (!match) throw new Error(`bad address ${address}`)
  let col = 0
  for (const ch of match[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { row: Number(match[2]) - 1, col: col - 1 }
}

/** Renders a value in the same display form `excel` uses. Numbers use the
 *  shortest round-trip text, so the last binary digits stay visible. */
export function displayValue(engine: Engine, value: Value): string {
  const { ValueKind } = engine
  switch (value.kind) {
    case ValueKind.Number:
      return String(value.number).replace('e', 'E')
    case ValueKind.Bool:
      return value.boolean ? 'TRUE' : 'FALSE'
    case ValueKind.Text:
      return `"${value.text}"`
    case ValueKind.Error:
      return engine.module.errorDisplayName(value.errorCode)
    case ValueKind.Blank:
      return '(blank)'
    default:
      return String(value.kind)
  }
}

const NUMERIC = /^-?[\d.]+(E[-+]?\d+)?$/

/** `true` when a displayed result equals the captured Excel value; numbers
 *  compare as doubles so exponent spelling cannot cause a false mismatch. */
export function matchesExcel(shown: string, excel: string): boolean {
  if (NUMERIC.test(excel) && NUMERIC.test(shown)) return Number(shown) === Number(excel)
  return shown === excel
}

/** Runs one case in a fresh workbook pinned to the case's profile. */
export function runCase(engine: Engine, probe: CompatCase): string {
  const workbook = engine.module.Workbook.createDefault()
  try {
    workbook.setExcelProfileId(probe.profile)
    for (const [address, input] of probe.cells ?? []) {
      const { row, col } = parseAddress(address)
      if (typeof input === 'number') workbook.setNumber(0, row, col, input)
      else if (input.startsWith('=')) workbook.setFormula(0, row, col, input)
      else workbook.setText(0, row, col, input)
    }
    workbook.setFormula(0, ANCHOR.row, ANCHOR.col, probe.formula)
    workbook.recalc()
    const result = workbook.getValue(0, ANCHOR.row, ANCHOR.col)
    if (!result.status.ok) return engine.module.statusString(result.status.status)
    return displayValue(engine, result.value)
  } finally {
    workbook.delete()
  }
}
