<script setup lang="ts">
/**
 * IterativeDemo — circular references solved iteratively, with the residual
 * stream plotted as it was reported.
 *
 * The two cells reference each other, so a normal recalculation would be a
 * cycle error. With `setIterative()` the engine runs Gauss-Seidel sweeps until
 * the largest change falls under `maxChange` or the iteration cap is hit, and
 * `setIterativeProgress()` reports the residual after every sweep — that is
 * the series drawn below. Changing the tolerance visibly changes the curve.
 */
import type { Workbook } from '@libraz/formulon'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'
import {
  acquireIterativeLock,
  type Engine,
  formatValue,
  getEngine,
  releaseIterativeLock,
  statusText
} from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

/** Mutually referencing cells with a stable fixed point (A1 = 15.625,
 *  B1 = 11.25), so convergence is visible rather than divergent. */
const SEED: Array<[number, number, string]> = [
  [0, 0, '=B1*0.5+10'],
  [0, 1, '=A1*0.4+5']
]

const TOLERANCES = [0.1, 0.01, 0.001, 0.000001]
const ITERATION_CAPS = [5, 12, 25, 100]

/** Decades shown above / below the tolerance when the run is too short to
 *  define its own log domain (a single usable sweep, or none). */
const FALLBACK_DECADES_ABOVE = 3
const FALLBACK_DECADES_BELOW = 1

const CHART = { width: 360, height: 140, left: 42, right: 10, top: 12, bottom: 30 }

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const maxChange = ref(TOLERANCES[1])
const maxIterations = ref(ITERATION_CAPS[2])
const samples = ref<Array<{ iteration: number; residual: number }>>([])
const results = ref<Array<{ addr: string; value: string }>>([])
const solveStatus = ref('')
const contention = ref(false)

const lockKey = Symbol('iterative-demo')
let engine: Engine | null = null
let workbook: Workbook | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: '循環参照と反復計算',
        description:
          '互いを参照する 2 つのセルを反復計算で解きます。各スイープの残差は setIterativeProgress() が返した値をそのまま描いています。',
        run: 'エンジンを読み込んで反復計算する',
        solve: '解く',
        tolerance: '収束判定 (maxChange)',
        cap: '最大反復回数',
        iterations: '反復回数',
        residual: '最終残差',
        converged: '収束しました',
        capped: '上限に達しました (未収束)',
        chart: '残差の推移 (対数軸)',
        values: '解',
        busy: 'このページの別のデモが反復計算中です。少し待ってから再実行してください。',
        axis: 'iteration'
      }
    : {
        title: 'Circular references and iterative calculation',
        description:
          'Two mutually referencing cells are solved iteratively. The curve is the residual reported by setIterativeProgress() after each sweep, plotted exactly as the engine streamed it.',
        run: 'Load engine and iterate',
        solve: 'Solve',
        tolerance: 'Convergence tolerance (maxChange)',
        cap: 'Iteration cap',
        iterations: 'Iterations',
        residual: 'Final residual',
        converged: 'converged',
        capped: 'hit the cap (not converged)',
        chart: 'Residual per sweep (log scale)',
        values: 'Solution',
        busy: 'Another demo on this page is iterating. Try again in a moment.',
        axis: 'iteration'
      }
)

const converged = computed(() => {
  const last = samples.value.at(-1)
  return last ? last.residual <= maxChange.value : false
})

/** Compact residual text: raw doubles carry float noise that says nothing
 *  about convergence. */
const formatResidual = (value: number | undefined): string => {
  if (value === undefined) return '—'
  if (!Number.isFinite(value)) return '∞'
  if (value === 0) return '0'
  return value.toExponential(3)
}

const chart = computed(() => {
  // The first sweep of a cold cycle can report a non-finite residual, and a
  // fully converged sweep reports exactly 0; neither has a log, so both are
  // left out of the plot rather than dragged onto an infinite axis.
  const points = samples.value
    .filter((point) => Number.isFinite(point.residual) && point.residual > 0)
    .map((point) => ({ iteration: point.iteration, log: Math.log10(point.residual) }))
  if (points.length === 0) return null

  const guide = Math.log10(maxChange.value)
  const usableDomain = points.length >= 2
  const top = usableDomain
    ? Math.max(...points.map((p) => p.log), guide) + 0.4
    : guide + FALLBACK_DECADES_ABOVE
  const bottom = usableDomain
    ? Math.min(...points.map((p) => p.log), guide) - 0.4
    : guide - FALLBACK_DECADES_BELOW
  const span = top - bottom || 1

  const plotW = CHART.width - CHART.left - CHART.right
  const plotH = CHART.height - CHART.top - CHART.bottom
  const first = points[0].iteration
  const last = points.at(-1)?.iteration ?? first
  const x = (iteration: number) =>
    CHART.left + (last === first ? plotW / 2 : ((iteration - first) / (last - first)) * plotW)
  // Clamped so an out-of-domain sample sits on the frame instead of flying
  // off the canvas.
  const y = (value: number) => {
    const ratio = Math.min(1, Math.max(0, (top - value) / span))
    return CHART.top + ratio * plotH
  }

  return {
    path: points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.iteration)} ${y(p.log)}`).join(' '),
    dots: points.map((p) => ({ x: x(p.iteration), y: y(p.log), iteration: p.iteration })),
    guideY: y(guide),
    baseline: CHART.height - CHART.bottom,
    tickY: CHART.height - CHART.bottom + 12,
    unitY: CHART.height - 4,
    midX: CHART.left + plotW / 2,
    axisX: CHART.left,
    plotRight: CHART.width - CHART.right,
    topLabel: `1e${Math.round(top)}`,
    bottomLabel: `1e${Math.round(bottom)}`,
    firstIteration: first,
    lastIteration: last
  }
})

const buildWorkbook = () => {
  if (!engine) return
  workbook?.delete()
  workbook = engine.module.Workbook.createDefault()
  for (const [row, col, formula] of SEED) workbook.setFormula(0, row, col, formula)
}

const solve = () => {
  if (!engine) return
  if (!acquireIterativeLock(lockKey)) {
    contention.value = true
    return
  }
  contention.value = false
  const collected: Array<{ iteration: number; residual: number }> = []
  try {
    // Start from a fresh workbook so every run converges from the same state.
    buildWorkbook()
    const wb = workbook
    if (!wb) return
    const enabled = wb.setIterative(true, maxIterations.value, maxChange.value)
    wb.setIterativeProgress((iteration, residual) => {
      collected.push({ iteration, residual })
      return true
    })
    const status = wb.recalc()
    wb.setIterativeProgress(null)
    solveStatus.value = statusText(engine, enabled) || statusText(engine, status)
    samples.value = collected
    results.value = SEED.map(([row, col]) => ({
      addr: `${String.fromCharCode(65 + col)}${row + 1}`,
      value: formatValue(engine as Engine, wb.getValue(0, row, col).value)
    }))
  } finally {
    releaseIterativeLock(lockKey)
  }
}

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    engine = await getEngine()
    version.value = engine.module.versionString()
    state.value = 'ready'
    solve()
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

const reset = () => {
  workbook?.delete()
  workbook = null
  engine = null
  samples.value = []
  results.value = []
  solveStatus.value = ''
  contention.value = false
  maxChange.value = TOLERANCES[1]
  maxIterations.value = ITERATION_CAPS[2]
  state.value = 'idle'
}

onBeforeUnmount(() => {
  workbook?.setIterativeProgress(null)
  releaseIterativeLock(lockKey)
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
    <div class="demo-subpanel">
      <table class="demo-grid demo-grid--list">
        <tbody>
          <tr v-for="([row, col, formula], i) in SEED" :key="formula">
            <th>{{ String.fromCharCode(65 + col) }}{{ row + 1 }}</th>
            <td class="is-formula">{{ formula }}</td>
            <td>{{ results[i]?.value ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="demo-row">
      <label class="demo-field demo-field--inline">
        <span class="demo-label">{{ copy.tolerance }}</span>
        <select v-model.number="maxChange" class="demo-select" @change="solve">
          <option v-for="value in TOLERANCES" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>
      <label class="demo-field demo-field--inline">
        <span class="demo-label">{{ copy.cap }}</span>
        <select v-model.number="maxIterations" class="demo-select" @change="solve">
          <option v-for="value in ITERATION_CAPS" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>
      <button type="button" class="demo-button" @click="solve">{{ copy.solve }}</button>
    </div>

    <p v-if="contention" class="demo-hint is-error">{{ copy.busy }}</p>
    <p v-if="solveStatus" class="demo-hint is-error">{{ solveStatus }}</p>

    <div v-if="chart" class="demo-subpanel">
      <span class="demo-label">{{ copy.chart }}</span>
      <svg
        class="demo-chart"
        :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
        role="img"
        :aria-label="copy.chart"
      >
        <line
          class="fx-axis"
          :x1="chart.axisX"
          :y1="CHART.top"
          :x2="chart.axisX"
          :y2="chart.baseline"
        />
        <line
          class="fx-axis"
          :x1="chart.axisX"
          :y1="chart.baseline"
          :x2="chart.plotRight"
          :y2="chart.baseline"
        />
        <line
          class="fx-guide"
          :x1="chart.axisX"
          :y1="chart.guideY"
          :x2="chart.plotRight"
          :y2="chart.guideY"
        />
        <text class="fx-tick" :x="chart.axisX - 5" :y="CHART.top + 8" text-anchor="end">
          {{ chart.topLabel }}
        </text>
        <text class="fx-tick" :x="chart.axisX - 5" :y="chart.baseline" text-anchor="end">
          {{ chart.bottomLabel }}
        </text>
        <text class="fx-tick" :x="chart.axisX - 5" :y="chart.guideY + 3" text-anchor="end">
          {{ maxChange }}
        </text>
        <path class="fx-curve" :d="chart.path" />
        <circle v-for="dot in chart.dots" :key="dot.iteration" class="fx-dot" :cx="dot.x" :cy="dot.y" r="2.4" />
        <text class="fx-tick" :x="chart.axisX" :y="chart.tickY" text-anchor="middle">
          {{ chart.firstIteration }}
        </text>
        <text class="fx-tick" :x="chart.plotRight" :y="chart.tickY" text-anchor="middle">
          {{ chart.lastIteration }}
        </text>
        <text class="fx-axis-label" :x="chart.midX" :y="chart.unitY" text-anchor="middle">
          {{ copy.axis }}
        </text>
      </svg>
    </div>

    <dl v-if="samples.length" class="demo-result">
      <div>
        <dt>{{ copy.iterations }}</dt>
        <dd>{{ samples.length }} / {{ maxIterations }} · {{ converged ? copy.converged : copy.capped }}</dd>
      </div>
      <div>
        <dt>{{ copy.residual }}</dt>
        <dd>{{ formatResidual(samples.at(-1)?.residual) }}</dd>
      </div>
      <div>
        <dt>{{ copy.values }}</dt>
        <dd>{{ results.map((r) => `${r.addr} = ${r.value}`).join(' · ') }}</dd>
      </div>
    </dl>
  </DemoFrame>
</template>
