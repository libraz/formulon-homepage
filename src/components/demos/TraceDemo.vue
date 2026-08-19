<script setup lang="ts">
/**
 * TraceDemo — dependency tracing over a seeded formula chain.
 *
 * The sheet is a real `formulon-cell` grid, so selecting a cell is selecting a
 * cell: the arrows are the grid's own trace overlay and the addresses listed
 * underneath come from `precedents()` / `dependents()` on the same workbook.
 * The depth control drives both, because the two calls change meaning at
 * `depth <= 1` (one step) versus a bounded breadth-first walk.
 */
import type { Addr, SpreadsheetInstance, TraceArrow, WorkbookHandle } from '@libraz/formulon-cell'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'
import DemoSheet from './DemoSheet.vue'
import { cellAddress, getCellApi, getEngine, MAX_TRACE_DEPTH } from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

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

/** Cell the demo opens on: the deepest formula in the chain. */
const ENTRY: Addr = { sheet: 0, row: 0, col: 3 }

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const depth = ref(1)
const selected = ref<Addr>(ENTRY)
const selectedFormula = ref('')
const selectedValue = ref('')
const precedents = ref<Addr[]>([])
const dependents = ref<Addr[]>([])

let instance: SpreadsheetInstance | null = null
let unsubscribe: (() => void) | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: '依存関係のトレース',
        description:
          'グリッド上でセルを選ぶと、そのセルを基点に矢印が引かれます。矢印も下の一覧も、エンジンが返した precedents() / dependents() の結果そのものです。depth が 1 以下なら 1 ステップ、2 以上なら幅優先探索でその深さまで辿ります。',
        selected: '選択セル',
        depth: '深さ (depth)',
        depthHint: `depth <= 1 は 1 ステップ。エンジン側で ${MAX_TRACE_DEPTH} に丸められます。`,
        precedents: '参照元 (precedents)',
        dependents: '参照先 (dependents)',
        value: '値',
        none: 'なし'
      }
    : {
        title: 'Trace dependencies',
        description:
          'Select a cell in the grid and the arrows are drawn from it. Both the arrows and the list below are what precedents() / dependents() returned. A depth of 1 or less is a single step; higher values walk the graph breadth-first up to that depth.',
        selected: 'Selected cell',
        depth: 'Depth',
        depthHint: `depth <= 1 means one step; the engine caps depth at ${MAX_TRACE_DEPTH}.`,
        precedents: 'Precedents',
        dependents: 'Dependents',
        value: 'Value',
        none: 'none'
      }
)

const seed = (wb: WorkbookHandle) => {
  for (const [row, col, content] of SEED) {
    const addr = { sheet: 0, row, col }
    if (typeof content === 'number') wb.setNumber(addr, content)
    else wb.setFormula(addr, content)
  }
  wb.recalc()
}

const sameCell = (a: Addr, b: Addr) => a.sheet === b.sheet && a.row === b.row && a.col === b.col

const addressList = (nodes: Addr[]) =>
  nodes.length ? nodes.map((node) => cellAddress(node.row, node.col)).join(', ') : copy.value.none

const selectedAddr = computed(() => cellAddress(selected.value.row, selected.value.col))

const edgeKey = (kind: string, from: Addr, to: Addr) =>
  `${kind}:${from.sheet}/${from.row}/${from.col}->${to.sheet}/${to.row}/${to.col}`

/** Ceiling on drawn arrows; a deep selection would otherwise bury the grid. */
const MAX_ARROWS = 64

/**
 * Draws the graph hop by hop rather than as a star around the selection.
 *
 * `instance.tracePrecedents()` is the ribbon command: one level from the
 * active cell, and calling it again re-draws that same level. To show what a
 * depth of N actually covers, each level is asked for its own one-step
 * neighbours and every edge is drawn where it belongs — B1 → C1 → D1, not
 * B1 → D1.
 */
const drawArrows = (
  addTraceArrow: (store: SpreadsheetInstance['store'], arrow: TraceArrow) => void,
  wb: WorkbookHandle,
  addr: Addr,
  step: number
) => {
  if (!instance) return
  const store = instance.store
  const seen = new Set<string>()
  let drawn = 0

  const walk = (kind: 'precedent' | 'dependent') => {
    let frontier: Addr[] = [addr]
    for (let level = 0; level < step && frontier.length && drawn < MAX_ARROWS; level += 1) {
      const next: Addr[] = []
      for (const node of frontier) {
        const neighbours =
          (kind === 'precedent' ? wb.precedents(node, 1) : wb.dependents(node, 1)) ?? []
        for (const neighbour of neighbours) {
          if (sameCell(neighbour, node) || drawn >= MAX_ARROWS) continue
          const [from, to] = kind === 'precedent' ? [neighbour, node] : [node, neighbour]
          const key = edgeKey(kind, from, to)
          if (seen.has(key)) continue
          seen.add(key)
          addTraceArrow(store, { kind, from, to })
          drawn += 1
          next.push(neighbour)
        }
      }
      frontier = next
    }
  }

  walk('precedent')
  walk('dependent')
}

/** Refreshes both readings of the same graph: the address lists from the
 *  engine, and the arrows drawn over the grid. */
const trace = async () => {
  if (!instance) return
  const wb = instance.workbook
  const addr = selected.value
  const step = depth.value
  const notSelf = (node: Addr) => !sameCell(node, addr)

  precedents.value = (wb.precedents(addr, step) ?? []).filter(notSelf)
  dependents.value = (wb.dependents(addr, step) ?? []).filter(notSelf)

  const cell = await getCellApi()
  selectedFormula.value = wb.cellFormula(addr) ?? ''
  selectedValue.value = cell.formatCell(wb.getValue(addr), isJa.value ? 'ja-JP' : 'en-US')

  instance.clearTraces()
  drawArrows(cell.addTraceArrow, wb, addr, step)
}

const onSheetReady = async (mounted: SpreadsheetInstance) => {
  unsubscribe?.()
  instance = mounted
  const cell = await getCellApi()
  cell.mutators.setActive(mounted.store, ENTRY)
  selected.value = ENTRY
  const stopSelection = mounted.on('selectionChange', (event) => {
    selected.value = event.active
    void trace()
  })
  // An edit reshapes the graph — a literal turned into a formula gains
  // precedents — so the readout is rebuilt from the workbook, not patched.
  const stopEdits = mounted.on('cellChange', () => {
    void trace()
  })
  unsubscribe = () => {
    stopSelection()
    stopEdits()
  }
  await trace()
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
  precedents.value = []
  dependents.value = []
  selectedFormula.value = ''
  selectedValue.value = ''
  selected.value = ENTRY
  depth.value = 1
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
    :reserve="515"
    @run="start"
    @reset="reset"
  >
    <DemoSheet :seed="seed" :height="260" @ready="onSheetReady" />

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
      <div class="is-wide">
        <dt>{{ copy.selected }}</dt>
        <dd>
          {{ selectedAddr }}
          <template v-if="selectedFormula"> · {{ selectedFormula }}</template>
          · {{ copy.value }} {{ selectedValue || '—' }}
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
