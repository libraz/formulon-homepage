<script setup lang="ts">
/**
 * StructureDemo — inserting and deleting rows / columns, with the formula
 * rewrites the engine performs shown either side of the edit.
 *
 * The claim on the page is that references follow a structural edit, and that
 * a reference into deleted space collapses to `#REF!` instead of silently
 * pointing at whatever moved into its place. Both are read back out of the
 * workbook: the inventory is `cells()` filtered to formula cells, so it is
 * whatever the engine holds after the call, not a transcription of what the
 * demo asked for.
 *
 * The two inventories are compared as sets rather than paired row by row. A
 * delete removes cells, so positions no longer line up, and pairing by index
 * would invent moves that never happened.
 */
import type { SpreadsheetInstance, WorkbookHandle } from '@libraz/formulon-cell'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'
import DemoSheet from './DemoSheet.vue'
import { cellAddress, columnLabel, getEngine } from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

type Operation = 'insertRows' | 'deleteRows' | 'insertCols' | 'deleteCols'

const OPERATIONS: Operation[] = ['insertRows', 'deleteRows', 'insertCols', 'deleteCols']

/** Seeded model: per-row totals across, column totals down, and a grand total
 *  that sums the totals — so one edit can move a reference, widen a range and
 *  break a range all at once. */
const SEED: Array<[number, number, string | number]> = [
  [0, 0, 'Item'],
  [0, 1, 'Q1'],
  [0, 2, 'Q2'],
  [0, 3, 'Total'],
  [1, 0, 'Licenses'],
  [1, 1, 1200],
  [1, 2, 1450],
  [1, 3, '=SUM(B2:C2)'],
  [2, 0, 'Support'],
  [2, 1, 640],
  [2, 2, 705],
  [2, 3, '=SUM(B3:C3)'],
  [3, 0, 'Services'],
  [3, 1, 310],
  [3, 2, 512],
  [3, 3, '=SUM(B4:C4)'],
  [5, 0, 'Total'],
  [5, 1, '=SUM(B2:B4)'],
  [5, 2, '=SUM(C2:C4)'],
  [5, 3, '=SUM(D2:D4)'],
  // A reference to one specific cell rather than a range: deleting the row it
  // names leaves nothing to shift to, which is the `#REF!` case. A range
  // reference over the same row would merely shrink.
  [7, 0, 'Support share'],
  [7, 1, '=B3/B6']
]

/** Rows and columns offered as targets: the seeded block plus a little room
 *  past it, so an edit outside the data is reachable too. */
const ROW_CHOICES = [0, 1, 2, 3, 4, 5, 6]
const COL_CHOICES = [0, 1, 2, 3, 4]
const COUNTS = [1, 2, 3]

interface FormulaEntry {
  addr: string
  formula: string
  error: string
}

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const operation = ref<Operation>('insertRows')
const target = ref(2)
const count = ref(1)
const before = ref<FormulaEntry[]>([])
const after = ref<FormulaEntry[]>([])
const lastCall = ref('')
const callFailed = ref(false)
const unsupported = ref(false)
/** Bumped to remount the sheet, which is how the demo gets a clean workbook
 *  back: a structural edit has no inverse on the workbook API. */
const generation = ref(0)

let instance: SpreadsheetInstance | null = null
let unsubscribe: (() => void) | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: '行と列の挿入 / 削除',
        description:
          '行や列を挿入・削除すると、影響を受ける数式はエンジン側で書き換えられます。下の一覧は操作前後にワークブックから読み直した数式そのもので、削除範囲に入った参照は #REF! に変わります。',
        opLabels: {
          insertRows: '行を挿入',
          deleteRows: '行を削除',
          insertCols: '列を挿入',
          deleteCols: '列を削除'
        } as Record<Operation, string>,
        targetRow: '対象の行',
        targetCol: '対象の列',
        count: '本数',
        apply: '実行',
        restore: 'シートを戻す',
        row: (index: number) => `${index + 1} 行目`,
        col: (index: number) => `${columnLabel(index)} 列`,
        beforeTitle: '操作前の数式',
        afterTitle: '操作後の数式',
        callLabel: '呼び出し',
        rewritten: '変化した項目',
        broken: '#REF! になった数式',
        untouched: '変化なし',
        failed: 'エンジンが操作を拒否しました。',
        unsupported: 'このエンジンは行 / 列の挿入・削除に対応していません。',
        sheetHint:
          'セルを選ぶと対象の行 / 列がそれに合わせて変わります。値を書き換えれば、その状態から挿入・削除を試せます。'
      }
    : {
        title: 'Insert and delete rows and columns',
        description:
          'Inserting or deleting rows and columns rewrites the formulas that move with them. The lists below are read back out of the workbook either side of the call, so a reference that ended up inside deleted space shows the #REF! the engine actually stored.',
        opLabels: {
          insertRows: 'Insert rows',
          deleteRows: 'Delete rows',
          insertCols: 'Insert columns',
          deleteCols: 'Delete columns'
        } as Record<Operation, string>,
        targetRow: 'At row',
        targetCol: 'At column',
        count: 'Count',
        apply: 'Apply',
        restore: 'Restore the sheet',
        row: (index: number) => `Row ${index + 1}`,
        col: (index: number) => `Column ${columnLabel(index)}`,
        beforeTitle: 'Formulas before',
        afterTitle: 'Formulas after',
        callLabel: 'Call',
        rewritten: 'Entries changed',
        broken: 'Formulas now #REF!',
        untouched: 'nothing changed',
        failed: 'The engine refused the operation.',
        unsupported: 'This engine does not support row / column insert and delete.',
        sheetHint:
          'Selecting a cell moves the target row / column with it, and editing a value lets you run the same edits over your own numbers.'
      }
)

const isRowOp = computed(() => operation.value === 'insertRows' || operation.value === 'deleteRows')

const seed = (wb: WorkbookHandle) => {
  for (const [row, col, content] of SEED) {
    const addr = { sheet: 0, row, col }
    if (typeof content === 'number') wb.setNumber(addr, content)
    else if (content.startsWith('=')) wb.setFormula(addr, content)
    else wb.setText(addr, content)
  }
  wb.recalc()
}

/** Every formula cell on the sheet, in the order the engine reports them. */
const inventory = (wb: WorkbookHandle): FormulaEntry[] => {
  const entries: FormulaEntry[] = []
  for (const cell of wb.cells(0)) {
    if (!cell.formula) continue
    entries.push({
      addr: cellAddress(cell.addr.row, cell.addr.col),
      formula: cell.formula,
      error: cell.value.kind === 'error' ? cell.value.text : ''
    })
  }
  return entries
}

/** An entry is marked when its address / formula pair is not in the pre-edit
 *  list — the same comparison a reader makes between the two panels. Keying on
 *  the pair rather than the position matters because a delete removes entries,
 *  and index-wise pairing would then report every later row as changed. */
const entryKey = (entry: FormulaEntry) => `${entry.addr}\t${entry.formula}`
const beforeKeys = computed(() => new Set(before.value.map(entryKey)))
const isRewritten = (entry: FormulaEntry) => !beforeKeys.value.has(entryKey(entry))
const rewrittenCount = computed(() => after.value.filter(isRewritten).length)
const brokenCount = computed(() => after.value.filter((entry) => entry.error === '#REF!').length)

const targetChoices = computed(() => (isRowOp.value ? ROW_CHOICES : COL_CHOICES))
const targetLabel = (index: number) =>
  isRowOp.value ? copy.value.row(index) : copy.value.col(index)

/** Keeps the target inside the offered range when the axis changes. */
const switchOperation = (next: Operation) => {
  const wasRowOp = isRowOp.value
  operation.value = next
  if (wasRowOp === isRowOp.value) return
  const choices = targetChoices.value
  target.value = Math.min(target.value, choices[choices.length - 1])
}

const apply = () => {
  if (!instance) return
  const wb = instance.workbook
  if (!wb.capabilities.insertDeleteRowsCols) {
    unsupported.value = true
    return
  }
  before.value = inventory(wb)
  const at = target.value
  const n = count.value
  const ok =
    operation.value === 'insertRows'
      ? wb.engineInsertRows(0, at, n)
      : operation.value === 'deleteRows'
        ? wb.engineDeleteRows(0, at, n)
        : operation.value === 'insertCols'
          ? wb.engineInsertCols(0, at, n)
          : wb.engineDeleteCols(0, at, n)
  callFailed.value = !ok
  lastCall.value = `${operation.value}(0, ${at}, ${n})`
  // `instance.recalc()`, not the handle's: the structural edit moved cells the
  // renderer still holds at their old addresses, and only the instance re-reads
  // the sheet into the store.
  instance.recalc()
  after.value = inventory(wb)
}

/** Reverts by rebuilding the sheet: `insertRows` has no undo on the workbook
 *  API, and re-seeding is the honest way to say so. */
const restore = () => {
  generation.value += 1
  before.value = []
  after.value = []
  lastCall.value = ''
  callFailed.value = false
}

const onSheetReady = (mounted: SpreadsheetInstance) => {
  unsubscribe?.()
  instance = mounted
  unsupported.value = !mounted.workbook.capabilities.insertDeleteRowsCols
  after.value = inventory(mounted.workbook)
  const stopSelection = mounted.on('selectionChange', (event) => {
    target.value = isRowOp.value ? event.active.row : event.active.col
  })
  const stopEdits = mounted.on('cellChange', () => {
    if (instance) after.value = inventory(instance.workbook)
  })
  unsubscribe = () => {
    stopSelection()
    stopEdits()
  }
}

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    const engine = await getEngine()
    version.value = engine.module.versionString()
    state.value = 'ready'
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

const reset = () => {
  unsubscribe?.()
  unsubscribe = null
  instance = null
  before.value = []
  after.value = []
  lastCall.value = ''
  callFailed.value = false
  unsupported.value = false
  operation.value = 'insertRows'
  target.value = 2
  count.value = 1
  state.value = 'idle'
}

onBeforeUnmount(() => {
  unsubscribe?.()
  unsubscribe = null
  instance = null
})
</script>

<template>
  <DemoFrame
    :title="copy.title"
    :description="copy.description"
    :state="state"
    :error="failure"
    :version="version"
    :reserve="740"
    @run="start"
    @reset="reset"
  >
    <DemoSheet
      :key="generation"
      :seed="seed"
      :height="280"
      :hint="copy.sheetHint"
      @ready="onSheetReady"
    />

    <div class="demo-segment" role="tablist">
      <button
        v-for="op in OPERATIONS"
        :key="op"
        type="button"
        role="tab"
        class="demo-segment__item"
        :class="{ 'is-active': op === operation }"
        :aria-selected="op === operation"
        @click="switchOperation(op)"
      >
        {{ copy.opLabels[op] }}
      </button>
    </div>

    <div class="demo-row">
      <label class="demo-field demo-field--inline">
        <span class="demo-label">{{ isRowOp ? copy.targetRow : copy.targetCol }}</span>
        <select v-model.number="target" class="demo-select">
          <option v-for="index in targetChoices" :key="index" :value="index">
            {{ targetLabel(index) }}
          </option>
        </select>
      </label>
      <label class="demo-field demo-field--inline">
        <span class="demo-label">{{ copy.count }}</span>
        <select v-model.number="count" class="demo-select">
          <option v-for="value in COUNTS" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>
      <button type="button" class="demo-button" @click="apply">{{ copy.apply }}</button>
      <button type="button" class="demo-button demo-button--ghost" @click="restore">
        {{ copy.restore }}
      </button>
    </div>

    <p v-if="unsupported" class="demo-hint is-error">{{ copy.unsupported }}</p>
    <p v-else-if="callFailed" class="demo-hint is-error">{{ copy.failed }}</p>

    <div class="demo-split">
      <div v-if="before.length" class="demo-subpanel">
        <span class="demo-label">{{ copy.beforeTitle }}</span>
        <div class="demo-shift">
          <template v-for="entry in before" :key="`b-${entry.addr}`">
            <span class="demo-shift__addr">{{ entry.addr }}</span>
            <span class="demo-shift__formula">{{ entry.formula }}</span>
          </template>
        </div>
      </div>
      <div class="demo-subpanel">
        <span class="demo-label">{{ copy.afterTitle }}</span>
        <div class="demo-shift">
          <template v-for="entry in after" :key="`a-${entry.addr}`">
            <span class="demo-shift__addr">{{ entry.addr }}</span>
            <span
              class="demo-shift__formula"
              :class="{ 'is-changed': isRewritten(entry), 'is-error': entry.error }"
            >
              {{ entry.formula }}<template v-if="entry.error"> · {{ entry.error }}</template>
            </span>
          </template>
        </div>
      </div>
    </div>

    <dl v-if="lastCall" class="demo-result">
      <div>
        <dt>{{ copy.callLabel }}</dt>
        <dd class="is-formula">{{ lastCall }}</dd>
      </div>
      <div>
        <dt>{{ copy.rewritten }}</dt>
        <dd>{{ rewrittenCount || copy.untouched }}</dd>
      </div>
      <div>
        <dt>{{ copy.broken }}</dt>
        <dd :class="{ 'is-error': brokenCount > 0 }">{{ brokenCount }}</dd>
      </div>
    </dl>
  </DemoFrame>
</template>
