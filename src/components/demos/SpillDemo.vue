<script setup lang="ts">
/**
 * SpillDemo — dynamic arrays, previewed and then committed.
 *
 * The top panel calls `evaluateFormulaArray()`, which returns the whole
 * `rows x cols` result without touching the workbook, so the spill *shape* is
 * visible before anything is written. The bottom panel writes the same
 * formula into a cell, recalculates, and reads `spillInfo()` back to outline
 * the region the engine actually engaged — including the `#SPILL!` case, where
 * an occupied cell inside the region blocks the whole array.
 */
import type { Value, Workbook } from '@libraz/formulon'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'
import {
  cellAddress,
  columnLabel,
  type Engine,
  formatValue,
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
const ANCHOR = { row: 1, col: 3 }
const GRID_ROWS = 7
const GRID_COLS = 7

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

interface GridCell {
  text: string
  isError: boolean
  inSpill: boolean
  isAnchor: boolean
  isBlocker: boolean
}
const grid = ref<GridCell[][]>([])
const region = ref<{ rows: number; cols: number } | null>(null)
const committed = ref('')
const blockedCell = ref<{ row: number; col: number } | null>(null)

let engine: Engine | null = null
let previewWb: Workbook | null = null
let commitWb: Workbook | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: 'ダイナミック配列とスピル',
        description:
          '配列を返す数式を、まず evaluateFormulaArray() でワークブックを書き換えずに形のまま取得し、次に実際のセルへ書き込んで spillInfo() でスピル範囲を確認します。',
        run: 'エンジンを読み込んでスピルを見る',
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
          'An array formula is first read back with evaluateFormulaArray(), which returns the whole shape without mutating the workbook, then written into a real cell so spillInfo() can report the region the engine engaged.',
        run: 'Load engine and spill an array',
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

const seed = (wb: Workbook) => {
  SEED.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (typeof cell === 'number') wb.setNumber(0, r, c, cell)
      else wb.setText(0, r, c, cell)
    })
  })
  wb.recalc()
}

const toPreviewCell = (value: Value): PreviewCell => ({
  text: formatValue(engine as Engine, value) || '',
  isError: isErrorValue(engine as Engine, value)
})

const runPreview = () => {
  if (!engine || !previewWb) return
  const result = previewWb.evaluateFormulaArray(0, ANCHOR.row, ANCHOR.col, formula.value.trim())
  preview.value = {
    rows: result.rows,
    cols: result.cols,
    cells: result.cells.map((row) => row.map(toPreviewCell)),
    status: statusText(engine, result.status)
  }
}

const snapshotGrid = () => {
  if (!engine || !commitWb) return
  const info = commitWb.spillInfo(0, ANCHOR.row, ANCHOR.col)
  region.value = info.engaged ? { rows: info.rows, cols: info.cols } : null
  const inRegion = (row: number, col: number) =>
    info.engaged &&
    row >= info.anchorRow &&
    row < info.anchorRow + info.rows &&
    col >= info.anchorCol &&
    col < info.anchorCol + info.cols

  const rows: GridCell[][] = []
  for (let row = 0; row < GRID_ROWS; row += 1) {
    const cells: GridCell[] = []
    for (let col = 0; col < GRID_COLS; col += 1) {
      const cell = commitWb.getValue(0, row, col)
      cells.push({
        text: formatValue(engine, cell.value),
        isError: isErrorValue(engine, cell.value),
        inSpill: inRegion(row, col),
        isAnchor: row === ANCHOR.row && col === ANCHOR.col,
        isBlocker: blockedCell.value?.row === row && blockedCell.value?.col === col
      })
    }
    rows.push(cells)
  }
  grid.value = rows
}

/** Rebuilds the committed workbook from scratch so a previous spill can never
 *  leave phantom cells behind, then writes formula + optional blocker. */
const commit = () => {
  if (!engine) return
  commitWb?.delete()
  commitWb = engine.module.Workbook.createDefault()
  seed(commitWb)
  commitWb.setFormula(0, ANCHOR.row, ANCHOR.col, formula.value.trim())
  const blocker = blockedCell.value
  if (blocker) commitWb.setText(0, blocker.row, blocker.col, 'x')
  commitWb.recalc()
  committed.value = formula.value.trim()
  snapshotGrid()
}

/** The far corner of the engaged region: occupying it is enough to trip
 *  `#SPILL!`, and it is never the anchor itself. */
const blockTarget = computed(() => {
  const info = region.value
  if (!info || (info.rows === 1 && info.cols === 1)) return null
  return { row: ANCHOR.row + info.rows - 1, col: ANCHOR.col + info.cols - 1 }
})

const toggleBlock = () => {
  blockedCell.value = blockedCell.value ? null : blockTarget.value
  commit()
}

const apply = () => {
  blockedCell.value = null
  runPreview()
  commit()
}

const usePreset = (preset: string) => {
  formula.value = preset
  apply()
}

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    engine = await getEngine()
    version.value = engine.module.versionString()
    previewWb?.delete()
    previewWb = engine.module.Workbook.createDefault()
    seed(previewWb)
    state.value = 'ready'
    apply()
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

const release = () => {
  previewWb?.delete()
  commitWb?.delete()
  previewWb = null
  commitWb = null
}

const reset = () => {
  release()
  engine = null
  preview.value = null
  grid.value = []
  region.value = null
  blockedCell.value = null
  formula.value = PRESETS[0]
  state.value = 'idle'
}

onBeforeUnmount(release)
</script>

<template>
  <DemoFrame
    :title="copy.title"
    :description="copy.description"
    :state="state"
    :error="failure"
    :run-label="copy.run"
    :version="version"
    @run="start"
    @reset="reset"
  >
    <label class="demo-field">
      <span class="demo-label">{{ copy.formulaLabel }}</span>
      <span class="demo-field__row">
        <input v-model="formula" type="text" class="demo-input" spellcheck="false" @keyup.enter="apply" />
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
      <table class="demo-grid demo-grid--sheet">
        <thead>
          <tr>
            <th></th>
            <th v-for="c in GRID_COLS" :key="c">{{ columnLabel(c - 1) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in grid" :key="r">
            <th>{{ r + 1 }}</th>
            <td
              v-for="(cell, c) in row"
              :key="c"
              :class="{
                'is-spill': cell.inSpill,
                'is-anchor': cell.isAnchor,
                'is-blocker': cell.isBlocker,
                'is-error': cell.isError
              }"
            >
              {{ cell.text }}
            </td>
          </tr>
        </tbody>
      </table>

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
