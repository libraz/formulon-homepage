<script setup lang="ts">
/**
 * SpillDemo — dynamic arrays, previewed and then committed.
 *
 * The top panel calls `evaluateFormulaArray()`, which returns the whole
 * `rows x cols` result without touching the workbook, so the spill *shape* is
 * visible before anything is written. The formula is then written into a real
 * cell of the embedded sheet and recalculated, and `spillInfo()` reports the
 * region the engine engaged — including the `#SPILL!` case, where an occupied
 * cell inside the region blocks the whole array.
 *
 * Both halves run against the one workbook the grid is mounted on, so the
 * preview is provably non-mutating: the sheet next to it does not move.
 */
import type { Value } from '@libraz/formulon'
import type { Addr, SpreadsheetInstance, WorkbookHandle } from '@libraz/formulon-cell'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'
import DemoSheet from './DemoSheet.vue'
import {
  cellAddress,
  type Engine,
  formatValue,
  getCellApi,
  getEngine,
  isErrorValue,
  statusText
} from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

/** Seed list the array formulas read from, laid out from A1. */
const SEED = [
  ['Fruit', 'Qty'],
  ['pear', 4],
  ['apple', 9],
  ['pear', 2],
  ['fig', 7],
  ['apple', 5]
] as const

/** Where the committed formula is written (D2). */
const ANCHOR: Addr = { sheet: 0, row: 1, col: 3 }
/** Rectangle blanked before each commit, so a shrinking result never leaves
 *  cells from the previous one standing. */
const CLEAR_ROWS = 8
const CLEAR_COLS = 8

const PRESETS = [
  '=SEQUENCE(3,4)',
  '=SORT(A2:B6,2,-1)',
  '=UNIQUE(A2:A6)',
  '=FILTER(A2:B6,B2:B6>4)',
  '=TRANSPOSE(A2:A6)'
]

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const formula = ref(PRESETS[0])

interface PreviewCell {
  text: string
  isError: boolean
}
const preview = ref<{ rows: number; cols: number; cells: PreviewCell[][]; status: string } | null>(
  null
)

const region = ref<{ rows: number; cols: number } | null>(null)
const committed = ref('')
const blockedCell = ref<Addr | null>(null)

let engine: Engine | null = null
let instance: SpreadsheetInstance | null = null
let unsubscribe: (() => void) | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: 'ダイナミック配列とスピル',
        description:
          '配列を返す数式を、まず evaluateFormulaArray() でワークブックを書き換えずに形のまま取得し、次に下のシートの実際のセルへ書き込んで spillInfo() でスピル範囲を確認します。',
        formulaLabel: '配列数式',
        presets: 'サンプル',
        previewTitle: 'プレビュー (書き込みなし)',
        shape: '形状',
        commitTitle: `コミット — ${cellAddress(ANCHOR.row, ANCHOR.col)} に書き込んで再計算`,
        commit: 'セルに書き込む',
        block: 'スピル先を塞ぐ',
        unblock: '塞いだセルを空にする',
        blockedNote: 'スピル範囲内に値があるとき、アンカーは #SPILL! を返します。',
        regionLabel: 'スピル範囲',
        none: 'スピルしていません',
        blockHint: '1×1 の結果はスピルしないため、塞ぐセルがありません。'
      }
    : {
        title: 'Dynamic arrays and spilling',
        description:
          'An array formula is first read back with evaluateFormulaArray(), which returns the whole shape without mutating the workbook, then written into a real cell of the sheet below so spillInfo() can report the region the engine engaged.',
        formulaLabel: 'Array formula',
        presets: 'Presets',
        previewTitle: 'Preview (nothing is written)',
        shape: 'Shape',
        commitTitle: `Committed — written to ${cellAddress(ANCHOR.row, ANCHOR.col)} and recalculated`,
        commit: 'Write to the cell',
        block: 'Block the spill range',
        unblock: 'Clear the blocking cell',
        blockedNote: 'With a value sitting inside the spill range, the anchor returns #SPILL!.',
        regionLabel: 'Spill region',
        none: 'No spill region engaged',
        blockHint: 'A 1x1 result does not spill, so there is nothing to block.'
      }
)

const seed = (wb: WorkbookHandle) => {
  SEED.forEach((row, r) => {
    row.forEach((cell, c) => {
      const addr = { sheet: 0, row: r, col: c }
      if (typeof cell === 'number') wb.setNumber(addr, cell)
      else wb.setText(addr, cell)
    })
  })
  wb.recalc()
}

const toPreviewCell = (value: Value): PreviewCell => ({
  text: formatValue(engine as Engine, value) || '',
  isError: isErrorValue(engine as Engine, value)
})

const runPreview = () => {
  if (!engine || !instance) return
  const result = instance.workbook.evaluateFormulaArray(ANCHOR, formula.value.trim())
  preview.value = {
    rows: result.rows,
    cols: result.cols,
    cells: result.cells.map((row) => row.map(toPreviewCell)),
    status: statusText(engine, result.status)
  }
}

/** Selects the engaged region so the grid shows its extent, or just the
 *  anchor when nothing spilled. */
const highlightRegion = async (info: { rows: number; cols: number } | null) => {
  if (!instance) return
  const cell = await getCellApi()
  cell.mutators.setActive(instance.store, ANCHOR)
  if (!info || (info.rows === 1 && info.cols === 1)) return
  cell.mutators.extendRangeTo(instance.store, {
    sheet: ANCHOR.sheet,
    row: ANCHOR.row + info.rows - 1,
    col: ANCHOR.col + info.cols - 1
  })
}

/** Blanks the write area, then writes formula + optional blocker. */
const commit = async () => {
  if (!instance) return
  const wb = instance.workbook
  for (let row = 0; row < CLEAR_ROWS; row += 1) {
    for (let col = 0; col < CLEAR_COLS; col += 1) {
      wb.setBlank({ sheet: ANCHOR.sheet, row: ANCHOR.row + row, col: ANCHOR.col + col })
    }
  }
  wb.setFormula(ANCHOR, formula.value.trim())
  const blocker = blockedCell.value
  if (blocker) wb.setText(blocker, 'x')
  // `instance.recalc()`, not `workbook.recalc()`: the handle only recalculates
  // the engine, while the instance also re-reads the sheet into the store — so
  // spilled neighbours appear instead of the anchor alone.
  instance.recalc()
  committed.value = formula.value.trim()

  const info = wb.spillInfo(ANCHOR.sheet, ANCHOR.row, ANCHOR.col)
  region.value = info ? { rows: info.rows, cols: info.cols } : null
  await highlightRegion(region.value)
}

/** The far corner of the engaged region: occupying it is enough to trip
 *  `#SPILL!`, and it is never the anchor itself. */
const blockTarget = computed<Addr | null>(() => {
  const info = region.value
  if (!info || (info.rows === 1 && info.cols === 1)) return null
  return {
    sheet: ANCHOR.sheet,
    row: ANCHOR.row + info.rows - 1,
    col: ANCHOR.col + info.cols - 1
  }
})

const toggleBlock = async () => {
  blockedCell.value = blockedCell.value ? null : blockTarget.value
  await commit()
}

const apply = async () => {
  blockedCell.value = null
  runPreview()
  await commit()
}

const usePreset = (preset: string) => {
  formula.value = preset
  void apply()
}

/** Re-reads what an edit changed. Editing the source list (A2:B6) changes what
 *  the array returns, so both the preview and the engaged region move with it —
 *  but the formula is not re-committed, or every keystroke would fight the
 *  reader for the selection. */
const refreshAfterEdit = () => {
  if (!instance) return
  runPreview()
  const info = instance.workbook.spillInfo(ANCHOR.sheet, ANCHOR.row, ANCHOR.col)
  region.value = info ? { rows: info.rows, cols: info.cols } : null
}

const onSheetReady = async (mounted: SpreadsheetInstance) => {
  unsubscribe?.()
  instance = mounted
  unsubscribe = mounted.on('cellChange', refreshAfterEdit)
  await apply()
}

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    engine = await getEngine()
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
  engine = null
  preview.value = null
  region.value = null
  blockedCell.value = null
  committed.value = ''
  formula.value = PRESETS[0]
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
    :reserve="810"
    @run="start"
    @reset="reset"
  >
    <label class="demo-field">
      <span class="demo-label">{{ copy.formulaLabel }}</span>
      <span class="demo-field__row">
        <input
          v-model="formula"
          type="text"
          class="demo-input"
          spellcheck="false"
          @keyup.enter="apply"
        />
        <button type="button" class="demo-button" @click="apply">{{ copy.commit }}</button>
      </span>
    </label>

    <div class="demo-row">
      <span class="demo-label">{{ copy.presets }}</span>
      <button
        v-for="preset in PRESETS"
        :key="preset"
        type="button"
        class="demo-chip"
        :class="{ 'is-active': preset === formula }"
        @click="usePreset(preset)"
      >
        {{ preset }}
      </button>
    </div>

    <div v-if="preview" class="demo-subpanel">
      <span class="demo-label">
        {{ copy.previewTitle }} · {{ copy.shape }} {{ preview.rows }} × {{ preview.cols }}
      </span>
      <table class="demo-grid demo-grid--array">
        <tbody>
          <tr v-for="(row, r) in preview.cells" :key="r">
            <td v-for="(cell, c) in row" :key="c" :class="{ 'is-error': cell.isError }">
              {{ cell.text }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="preview.status" class="demo-hint is-error">{{ preview.status }}</p>
    </div>

    <div class="demo-subpanel">
      <span class="demo-label">{{ copy.commitTitle }}</span>
      <DemoSheet :seed="seed" :height="300" @ready="onSheetReady" />

      <div class="demo-row">
        <span class="demo-status">
          {{ copy.regionLabel }}:
          <strong v-if="region">
            {{ cellAddress(ANCHOR.row, ANCHOR.col) }} · {{ region.rows }} × {{ region.cols }}
          </strong>
          <strong v-else>{{ copy.none }}</strong>
        </span>
        <button
          type="button"
          class="demo-button demo-button--ghost"
          :disabled="!blockedCell && !blockTarget"
          @click="toggleBlock"
        >
          {{ blockedCell ? copy.unblock : copy.block }}
        </button>
      </div>
      <p v-if="blockedCell" class="demo-hint">
        {{ copy.blockedNote }} ({{ cellAddress(blockedCell.row, blockedCell.col) }} = "x")
      </p>
      <p v-else-if="!blockTarget && committed" class="demo-hint">{{ copy.blockHint }}</p>
    </div>
  </DemoFrame>
</template>
