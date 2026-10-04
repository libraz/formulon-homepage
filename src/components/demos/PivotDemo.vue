<script setup lang="ts">
/**
 * PivotDemo — a PivotTable projected from a pivot cache.
 *
 * The source table is shown in a read-only formulon-cell grid; the same rows
 * are loaded into a pivot cache on a private engine workbook. Each control
 * change replaces the pivot with a freshly configured one on that cache, and
 * `pivotLayout()` returns the cells, which are rendered here as an HTML table.
 * The layout is a projection for the host: nothing is written to a sheet.
 */
import {
  PivotAggregation,
  PivotAxis,
  type PivotCell,
  PivotCellKind,
  type Status,
  type Workbook
} from '@libraz/formulon'
import type { WorkbookHandle } from '@libraz/formulon-cell'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import DemoFrame from './DemoFrame.vue'
import DemoSheet from './DemoSheet.vue'
import { type Engine, formatValue, getEngine, isErrorValue, statusText } from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

const FIELDS = ['Region', 'Product', 'Quarter'] as const
type Dimension = (typeof FIELDS)[number]
const VALUE_FIELD = 'Sales'
const ALL_FIELDS = [...FIELDS, VALUE_FIELD]

const ROWS: ReadonlyArray<readonly [string, string, string, number]> = [
  ['East', 'Widget', 'Q1', 120],
  ['East', 'Gadget', 'Q1', 80],
  ['East', 'Widget', 'Q2', 150],
  ['West', 'Widget', 'Q1', 90],
  ['West', 'Gadget', 'Q2', 200],
  ['West', 'Gadget', 'Q1', 60],
  ['North', 'Widget', 'Q2', 110],
  ['North', 'Gadget', 'Q1', 70]
]

const AGGREGATIONS = [
  { key: 'sum', value: PivotAggregation.Sum, en: 'Sum', ja: '合計' },
  { key: 'count', value: PivotAggregation.Count, en: 'Count', ja: '個数' },
  { key: 'average', value: PivotAggregation.Average, en: 'Average', ja: '平均' },
  { key: 'max', value: PivotAggregation.Max, en: 'Max', ja: '最大' }
] as const

/** Where the pivot is anchored; the projection never writes there. */
const ANCHOR = { row: 0, col: 6 }

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const rowField = ref<Dimension>('Region')
const colField = ref<Dimension | ''>('')
const aggregation = ref<number>(PivotAggregation.Sum)
const problem = ref('')

interface RenderedCell {
  text: string
  kind: PivotCellKind
  isError: boolean
  isNumber: boolean
}
const table = ref<RenderedCell[][]>([])

let engine: Engine | null = null
let wb: Workbook | null = null
let cacheId = 0
let pivotIndex = -1

const columnChoices = computed(() => FIELDS.filter((field) => field !== rowField.value))

const copy = computed(() =>
  isJa.value
    ? {
        title: 'ピボットテーブル',
        description:
          '元の表と同じ行をピボットキャッシュに入れ、行・列フィールドと集計方法を切り替えるたびにピボットを組み直して pivotLayout() の結果を表示します。',
        sourceTitle: '元データ',
        resultTitle: '投影結果',
        rowLabel: '行フィールド',
        colLabel: '列フィールド',
        aggLabel: '集計',
        none: 'なし',
        caption:
          'pivotLayout() はホストが描画するためのセルを返すだけで、シートには書き込みません。下の表はその戻り値から描いています。',
        fields: { Region: '地域', Product: '製品', Quarter: '四半期' } as Record<string, string>
      }
    : {
        title: 'PivotTable projection',
        description:
          'The same rows as the source table go into a pivot cache. Each change of row field, column field or aggregation rebuilds the pivot and renders the result of pivotLayout().',
        sourceTitle: 'Source data',
        resultTitle: 'Projected layout',
        rowLabel: 'Row field',
        colLabel: 'Column field',
        aggLabel: 'Aggregation',
        none: 'None',
        caption:
          'pivotLayout() only returns cells for the host to render; it does not write them into the sheet. The table below is drawn from that return value. Captions such as 行ラベル and 総計 come from the ja-JP Excel profile of the workbook.',
        fields: { Region: 'Region', Product: 'Product', Quarter: 'Quarter' } as Record<
          string,
          string
        >
      }
)

const seed = (handle: WorkbookHandle) => {
  ALL_FIELDS.forEach((name, col) => {
    handle.setText({ sheet: 0, row: 0, col }, name)
  })
  ROWS.forEach((row, r) => {
    row.forEach((cell, col) => {
      const addr = { sheet: 0, row: r + 1, col }
      if (typeof cell === 'number') handle.setNumber(addr, cell)
      else handle.setText(addr, cell)
    })
  })
  handle.recalc()
}

const check = <T extends Status | { status: Status }>(result: T): T => {
  const status = 'ok' in result ? result : result.status
  if (!status.ok) throw new Error(engine ? statusText(engine, status) : status.message)
  return result
}

/** Declares the cache fields and loads the source rows into it. */
const buildCache = (book: Workbook) => {
  cacheId = check(book.pivotCacheCreate(0)).index
  check(
    book.pivotCacheSetWorksheetSource(cacheId, {
      present: true,
      ref: `A1:D${ROWS.length + 1}`,
      sheet: 'Sheet1'
    })
  )
  ALL_FIELDS.forEach((name, col) => {
    check(book.setText(0, 0, col, name))
    check(book.pivotCacheFieldAdd(cacheId, name))
  })
  ROWS.forEach((row, r) => {
    const record = check(book.pivotCacheRecordAdd(cacheId)).index
    row.forEach((cell, col) => {
      if (typeof cell === 'number') {
        check(book.setNumber(0, r + 1, col, cell))
        check(book.pivotCacheRecordSetNumber(cacheId, record, col, cell))
      } else {
        check(book.setText(0, r + 1, col, cell))
        check(book.pivotCacheRecordSetText(cacheId, record, col, cell))
      }
    })
  })
}

const toRendered = (cell: PivotCell): RenderedCell => {
  const eng = engine as Engine
  return {
    text: formatValue(eng, cell.value),
    kind: cell.kind,
    isError: isErrorValue(eng, cell.value),
    isNumber: cell.value.kind === eng.ValueKind.Number
  }
}

/** Replaces the pivot with one configured from the current controls. */
const rebuild = () => {
  if (!wb || !engine) return
  try {
    if (pivotIndex >= 0) check(wb.pivotRemove(0, pivotIndex))
    pivotIndex = -1
    const created = check(wb.pivotCreate(0, 'SalesPivot', cacheId, ANCHOR.row, ANCHOR.col)).index
    pivotIndex = created
    // Pivot fields match cache fields by position, so every cache field is
    // added in cache order; only the chosen ones are placed on an axis order.
    const index = new Map<string, number>()
    for (const name of ALL_FIELDS) {
      const axis =
        name === VALUE_FIELD
          ? PivotAxis.Value
          : name === colField.value
            ? PivotAxis.Col
            : PivotAxis.Row
      index.set(name, check(wb.pivotFieldAdd(0, created, { sourceName: name, axis })).index)
    }
    check(wb.pivotSetRowFieldOrder(0, created, [index.get(rowField.value) as number]))
    if (colField.value) {
      check(wb.pivotSetColFieldOrder(0, created, [index.get(colField.value) as number]))
    }
    const spec = AGGREGATIONS.find((a) => a.value === aggregation.value) ?? AGGREGATIONS[0]
    check(
      wb.pivotDataFieldAdd(0, created, {
        name: `${spec.en} of ${VALUE_FIELD}`,
        fieldIndex: index.get(VALUE_FIELD) as number,
        aggregation: spec.value
      })
    )
    const layout = check(wb.pivotLayout(0, created))
    const grid: RenderedCell[][] = Array.from({ length: layout.rows }, () =>
      Array.from({ length: layout.cols }, () => ({
        text: '',
        kind: PivotCellKind.Blank,
        isError: false,
        isNumber: false
      }))
    )
    for (const cell of layout.cells) {
      const r = cell.row - layout.top
      const c = cell.col - layout.left
      if (grid[r]?.[c]) grid[r][c] = toRendered(cell)
    }
    table.value = grid
    problem.value = ''
  } catch (error) {
    table.value = []
    problem.value = error instanceof Error ? error.message : String(error)
  }
}

watch(rowField, (field) => {
  if (colField.value === field) colField.value = ''
})
watch([rowField, colField, aggregation], rebuild, { flush: 'sync' })

const kindClass = (kind: PivotCellKind) => ({
  'is-header': kind === PivotCellKind.Header || kind === PivotCellKind.ColLabel,
  'is-label': kind === PivotCellKind.RowLabel,
  'is-total':
    kind === PivotCellKind.GrandTotal ||
    kind === PivotCellKind.RowSubtotal ||
    kind === PivotCellKind.ColSubtotal
})

const disposeWorkbook = () => {
  wb?.delete()
  wb = null
  pivotIndex = -1
}

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    engine = await getEngine()
    version.value = engine.module.versionString()
    wb = engine.module.Workbook.createDefault()
    buildCache(wb)
    state.value = 'ready'
    rebuild()
  } catch (error) {
    disposeWorkbook()
    failure.value = String(error)
    state.value = 'error'
  }
}

const reset = () => {
  disposeWorkbook()
  engine = null
  table.value = []
  problem.value = ''
  rowField.value = 'Region'
  colField.value = ''
  aggregation.value = PivotAggregation.Sum
  state.value = 'idle'
}

onBeforeUnmount(disposeWorkbook)
</script>

<template>
  <DemoFrame
    :title="copy.title"
    :description="copy.description"
    :state="state"
    :error="failure"
    :version="version"
    :reserve="640"
    @run="start"
    @reset="reset"
  >
    <div class="demo-subpanel">
      <span class="demo-label">{{ copy.sourceTitle }}</span>
      <DemoSheet :seed="seed" :height="250" read-only />
    </div>

    <div class="demo-row">
      <label class="demo-field demo-field--inline">
        <span class="demo-label">{{ copy.rowLabel }}</span>
        <select v-model="rowField" class="demo-select" data-test="row">
          <option v-for="field in FIELDS" :key="field" :value="field">
            {{ copy.fields[field] }}
          </option>
        </select>
      </label>
      <label class="demo-field demo-field--inline">
        <span class="demo-label">{{ copy.colLabel }}</span>
        <select v-model="colField" class="demo-select" data-test="col">
          <option value="">{{ copy.none }}</option>
          <option v-for="field in columnChoices" :key="field" :value="field">
            {{ copy.fields[field] }}
          </option>
        </select>
      </label>
      <label class="demo-field demo-field--inline">
        <span class="demo-label">{{ copy.aggLabel }}</span>
        <select v-model.number="aggregation" class="demo-select" data-test="agg">
          <option v-for="agg in AGGREGATIONS" :key="agg.key" :value="agg.value">
            {{ isJa ? agg.ja : agg.en }}
          </option>
        </select>
      </label>
    </div>

    <div class="demo-subpanel">
      <span class="demo-label">{{ copy.resultTitle }}</span>
      <table v-if="table.length" class="demo-grid demo-grid--pivot" data-test="pivot">
        <tbody>
          <tr v-for="(row, r) in table" :key="r">
            <td
              v-for="(cell, c) in row"
              :key="c"
              :class="[kindClass(cell.kind), { 'is-num': cell.isNumber, 'is-error': cell.isError }]"
            >
              {{ cell.text }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="problem" class="demo-hint is-error">{{ problem }}</p>
      <p class="demo-hint">{{ copy.caption }}</p>
    </div>
  </DemoFrame>
</template>

<style scoped>
.demo-grid--pivot td.is-header,
.demo-grid--pivot td.is-label,
.demo-grid--pivot td.is-total {
  font-weight: 600;
}

.demo-grid--pivot td.is-header {
  background: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
}

.demo-grid--pivot td.is-total {
  background: color-mix(in srgb, var(--vp-c-brand-2) 10%, transparent);
}
</style>
