<script setup lang="ts">
/**
 * TraceDemo — dependency tracing over a seeded formula chain.
 *
 * The grid is drawn as SVG so the trace arrows share one coordinate space
 * with the cells. Clicking a cell calls `precedents()` / `dependents()` on the
 * live workbook and draws exactly what the engine returned; the depth control
 * is exposed because the two calls change meaning at `depth <= 1` (one step)
 * versus a bounded BFS.
 */
import type { CellNode, Workbook } from '@libraz/formulon'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import DemoFrame from './DemoFrame.vue'
import {
  cellAddress,
  columnLabel,
  type Engine,
  formatValue,
  getEngine,
  MAX_TRACE_DEPTH
} from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

const uid = useId()

/** Seeded chain: literals in column A, one hop per column to the right. */
const SEED: Array<[number, number, string | number]> = [
  [0, 0, 10],
  [1, 0, 20],
  [2, 0, 30],
  [0, 1, '=A1+A2'],
  [1, 1, '=A2*2'],
  [2, 1, '=A3-A1'],
  [0, 2, '=SUM(B1:B3)'],
  [1, 2, '=B2*1.5'],
  [0, 3, '=C1+C2'],
  [1, 3, '=ROUND(D1/3,2)']
]

const ROWS = 3
const COLS = 4
const CELL_W = 84
const CELL_H = 34
const HEAD_W = 30
const HEAD_H = 20
const PAD = 10
const WIDTH = PAD * 2 + HEAD_W + COLS * CELL_W
const HEIGHT = PAD * 2 + HEAD_H + ROWS * CELL_H

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const depth = ref(1)
const selected = ref({ row: 0, col: 3 })

interface TraceCell {
  row: number
  col: number
  addr: string
  text: string
  formula: string
}
const cells = ref<TraceCell[]>([])
const precedents = ref<CellNode[]>([])
const dependents = ref<CellNode[]>([])

let engine: Engine | null = null
let workbook: Workbook | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: '依存関係のトレース',
        description:
          'セルを選ぶと、エンジンが返した precedents() / dependents() の結果をそのまま矢印で描きます。depth が 1 以下なら 1 ステップ、2 以上なら幅優先探索でその深さまで辿ります。',
        run: 'エンジンを読み込んでトレースする',
        selected: '選択セル',
        depth: '深さ (depth)',
        depthHint: `depth <= 1 は 1 ステップ。エンジン側で ${MAX_TRACE_DEPTH} に丸められます。`,
        precedents: '参照元 (precedents)',
        dependents: '参照先 (dependents)',
        formula: '数式',
        value: '値',
        none: 'なし'
      }
    : {
        title: 'Trace dependencies',
        description:
          'Pick a cell and the arrows are drawn straight from what precedents() / dependents() returned. A depth of 1 or less is a single step; higher values walk the graph breadth-first up to that depth.',
        run: 'Load engine and trace a chain',
        selected: 'Selected cell',
        depth: 'Depth',
        depthHint: `depth <= 1 means one step; the engine caps depth at ${MAX_TRACE_DEPTH}.`,
        precedents: 'Precedents',
        dependents: 'Dependents',
        formula: 'Formula',
        value: 'Value',
        none: 'none'
      }
)

const cellX = (col: number) => PAD + HEAD_W + col * CELL_W
const cellY = (row: number) => PAD + HEAD_H + row * CELL_H
const centerOf = (node: { row: number; col: number }) => ({
  x: cellX(node.col) + CELL_W / 2,
  y: cellY(node.row) + CELL_H / 2
})

/** Stops an arrow at the border of the target cell instead of its centre. */
const edgePoint = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const halfW = CELL_W / 2 - 3
  const halfH = CELL_H / 2 - 3
  const dx = from.x - to.x
  const dy = from.y - to.y
  if (dx === 0 && dy === 0) return to
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy)
  )
  return { x: to.x + dx * scale, y: to.y + dy * scale }
}

/** Slightly bowed connector so parallel arrows stay distinguishable. */
const arrowPath = (from: { row: number; col: number }, to: { row: number; col: number }) => {
  const a = edgePoint(centerOf(to), centerOf(from))
  const b = edgePoint(centerOf(from), centerOf(to))
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const nx = -(b.y - a.y)
  const ny = b.x - a.x
  const len = Math.hypot(nx, ny) || 1
  const bow = Math.min(14, len * 0.12)
  return `M ${a.x} ${a.y} Q ${mx + (nx / len) * bow} ${my + (ny / len) * bow} ${b.x} ${b.y}`
}

const cellAt = (row: number, col: number) =>
  cells.value.find((cell) => cell.row === row && cell.col === col)

const selectedCell = computed(() => cellAt(selected.value.row, selected.value.col))

const isPrecedent = (row: number, col: number) =>
  precedents.value.some((node) => node.row === row && node.col === col)
const isDependent = (row: number, col: number) =>
  dependents.value.some((node) => node.row === row && node.col === col)

const addressList = (nodes: CellNode[]) =>
  nodes.length ? nodes.map((node) => cellAddress(node.row, node.col)).join(', ') : copy.value.none

const readCells = () => {
  if (!engine || !workbook) return
  // Formula text is read back from the workbook rather than echoed from the
  // seed table, so the grid shows what the engine actually stored.
  const formulas = new Map<string, string>()
  const total = workbook.cellCount(0)
  for (let i = 0; i < total; i += 1) {
    const entry = workbook.cellAt(0, i)
    if (entry.status.ok && entry.formula) formulas.set(`${entry.row}:${entry.col}`, entry.formula)
  }

  const list: TraceCell[] = []
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = workbook.getValue(0, row, col)
      list.push({
        row,
        col,
        addr: cellAddress(row, col),
        text: formatValue(engine, cell.value),
        formula: formulas.get(`${row}:${col}`) ?? ''
      })
    }
  }
  cells.value = list
}

const trace = () => {
  if (!workbook) return
  const { row, col } = selected.value
  const step = depth.value
  const self = (node: CellNode) => node.row === row && node.col === col
  precedents.value = Array.from(workbook.precedents(0, row, col, step)).filter((n) => !self(n))
  dependents.value = Array.from(workbook.dependents(0, row, col, step)).filter((n) => !self(n))
}

const select = (row: number, col: number) => {
  selected.value = { row, col }
  trace()
}

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    engine = await getEngine()
    version.value = engine.module.versionString()
    workbook?.delete()
    workbook = engine.module.Workbook.createDefault()
    for (const [row, col, content] of SEED) {
      if (typeof content === 'number') workbook.setNumber(0, row, col, content)
      else workbook.setFormula(0, row, col, content)
    }
    workbook.recalc()
    readCells()
    trace()
    state.value = 'ready'
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

const reset = () => {
  workbook?.delete()
  workbook = null
  engine = null
  cells.value = []
  precedents.value = []
  dependents.value = []
  selected.value = { row: 0, col: 3 }
  depth.value = 1
  state.value = 'idle'
}

onBeforeUnmount(() => {
  workbook?.delete()
  workbook = null
})
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
    <div class="demo-trace">
      <svg
        class="demo-trace__svg"
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        role="img"
        :aria-label="`${copy.selected} ${selectedCell?.addr}`"
      >
        <defs>
          <marker
            :id="`prec-${uid}`"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <path class="demo-trace__head demo-trace__head--prec" d="M0 0 L7 3.5 L0 7 Z" />
          </marker>
          <marker
            :id="`dep-${uid}`"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <path class="demo-trace__head demo-trace__head--dep" d="M0 0 L7 3.5 L0 7 Z" />
          </marker>
        </defs>

        <g>
          <text
            v-for="col in COLS"
            :key="`c${col}`"
            class="fx-axis-label"
            :x="cellX(col - 1) + CELL_W / 2"
            :y="PAD + HEAD_H - 7"
            text-anchor="middle"
          >
            {{ columnLabel(col - 1) }}
          </text>
          <text
            v-for="row in ROWS"
            :key="`r${row}`"
            class="fx-axis-label"
            :x="PAD + HEAD_W - 8"
            :y="cellY(row - 1) + CELL_H / 2 + 3"
            text-anchor="end"
          >
            {{ row }}
          </text>
        </g>

        <g>
          <g v-for="cell in cells" :key="cell.addr">
            <rect
              class="demo-trace__cell"
              :class="{
                'is-selected': cell.row === selected.row && cell.col === selected.col,
                'is-precedent': isPrecedent(cell.row, cell.col),
                'is-dependent': isDependent(cell.row, cell.col),
                'is-empty': !cell.text && !cell.formula
              }"
              :x="cellX(cell.col)"
              :y="cellY(cell.row)"
              :width="CELL_W"
              :height="CELL_H"
              rx="3"
              tabindex="0"
              role="button"
              :aria-label="cell.addr"
              @click="select(cell.row, cell.col)"
              @keyup.enter="select(cell.row, cell.col)"
            />
            <text
              class="fx-tick demo-trace__addr"
              :x="cellX(cell.col) + 5"
              :y="cellY(cell.row) + 11"
            >
              {{ cell.addr }}
            </text>
            <text
              class="fx-value"
              :x="cellX(cell.col) + CELL_W - 6"
              :y="cellY(cell.row) + CELL_H - 8"
              text-anchor="end"
            >
              {{ cell.text }}
            </text>
          </g>
        </g>

        <g>
          <path
            v-for="node in precedents"
            :key="`p${node.row}-${node.col}`"
            class="fx-curve fx-curve--2 demo-trace__arrow"
            :d="arrowPath(node, selected)"
            :marker-end="`url(#prec-${uid})`"
          />
          <path
            v-for="node in dependents"
            :key="`d${node.row}-${node.col}`"
            class="fx-curve demo-trace__arrow"
            :d="arrowPath(selected, node)"
            :marker-end="`url(#dep-${uid})`"
          />
        </g>
      </svg>
    </div>

    <div class="demo-row">
      <label class="demo-field demo-field--inline">
        <span class="demo-label">{{ copy.depth }}: {{ depth }}</span>
        <input
          v-model.number="depth"
          type="range"
          min="1"
          :max="8"
          step="1"
          class="demo-range"
          @input="trace"
        />
      </label>
      <span class="demo-hint">{{ copy.depthHint }}</span>
    </div>

    <dl class="demo-result">
      <div>
        <dt>{{ copy.selected }}</dt>
        <dd>
          {{ selectedCell?.addr }}
          <template v-if="selectedCell?.formula"> · {{ selectedCell.formula }}</template>
          · {{ copy.value }} {{ selectedCell?.text || '—' }}
        </dd>
      </div>
      <div>
        <dt class="is-precedent">{{ copy.precedents }}</dt>
        <dd>{{ addressList(precedents) }}</dd>
      </div>
      <div>
        <dt class="is-dependent">{{ copy.dependents }}</dt>
        <dd>{{ addressList(dependents) }}</dd>
      </div>
    </dl>
  </DemoFrame>
</template>
