<script setup lang="ts">
/**
 * FormulaEvalDemo — type a formula, get the engine's real answer.
 *
 * Two evaluation surfaces are exposed side by side: `evalFormula()`, which
 * evaluates a standalone formula in a throwaway workbook, and
 * `evaluateFormulaText()`, which evaluates against a seeded workbook so cell
 * references resolve. Both report the raw `ValueKind` alongside the formatted
 * result, because the point of the demo is that `#DIV/0!` comes back as an
 * error *value*, not as a thrown exception.
 */
import type { Workbook } from '@libraz/formulon'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'
import {
  cellAddress,
  type Engine,
  formatValue,
  getEngine,
  isErrorValue,
  kindLabel,
  statusText
} from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

type Mode = 'standalone' | 'workbook'

/** Seed rows for the workbook mode, laid out from A1. */
const SEED_HEADER = ['City', 'Revenue', 'Cost'] as const
const SEED_ROWS = [
  ['Tokyo', 12800, 7400],
  ['Osaka', 9420, 5810],
  ['Nagoya', 7860, 4920]
] as const

/** Anchor cell for `evaluateFormulaText`, clear of the seeded range. */
const ANCHOR = { row: 5, col: 4 }

const PRESETS: Record<Mode, string[]> = {
  standalone: [
    '=SUM(1,2,3)*2',
    '=ROUND(PI(),4)',
    '=UPPER(LEFT("formulon",7))',
    '=TEXT(DATE(2026,8,11),"yyyy-mm-dd")',
    '=IF(LEN("spill")>3,"long","short")',
    '=1/0'
  ],
  workbook: [
    '=SUM(B2:B4)',
    '=AVERAGE(B2:B4)-AVERAGE(C2:C4)',
    '=VLOOKUP("Osaka",A2:C4,3,FALSE)',
    '=TEXTJOIN(", ",TRUE,A2:A4)',
    '=B2/(C2-C2)'
  ]
}

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const mode = ref<Mode>('standalone')
const formula = ref(PRESETS.standalone[0])

interface EvalOutput {
  formula: string
  kind: string
  text: string
  isError: boolean
  status: string
}
const output = ref<EvalOutput | null>(null)

let engine: Engine | null = null
let workbook: Workbook | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: '数式を評価する',
        description:
          '入力した数式をブラウザ内の WASM エンジンがそのまま評価します。単体評価は evalFormula()、ワークブック評価は evaluateFormulaText() を呼び出しています。',
        run: 'エンジンを読み込んで数式を試す',
        modeStandalone: '単体 (evalFormula)',
        modeWorkbook: 'ワークブック参照 (evaluateFormulaText)',
        formulaLabel: '数式',
        evaluate: '評価',
        presets: 'サンプル',
        seed: `シードデータ — 数式は ${cellAddress(ANCHOR.row, ANCHOR.col)} に入力したものとして評価されます`,
        kind: '値の種類',
        value: '結果',
        status: 'ステータス',
        errorNote: 'Excel エラーは例外ではなく値として返ります (kind = Error)。'
      }
    : {
        title: 'Evaluate a formula',
        description:
          'The WASM engine in this page evaluates whatever you type. Standalone evaluation calls evalFormula(); workbook evaluation calls evaluateFormulaText() so references resolve.',
        run: 'Load engine and try a formula',
        modeStandalone: 'Standalone (evalFormula)',
        modeWorkbook: 'With references (evaluateFormulaText)',
        formulaLabel: 'Formula',
        evaluate: 'Evaluate',
        presets: 'Presets',
        seed: `Seed data — the formula is evaluated as if entered at ${cellAddress(ANCHOR.row, ANCHOR.col)}`,
        kind: 'Value kind',
        value: 'Result',
        status: 'Status',
        errorNote: 'Excel errors come back as values (kind = Error), never as thrown exceptions.'
      }
)

const seedWorkbook = (wb: Workbook) => {
  SEED_HEADER.forEach((label, col) => {
    wb.setText(0, 0, col, label)
  })
  SEED_ROWS.forEach(([city, revenue, cost], i) => {
    wb.setText(0, i + 1, 0, city as string)
    wb.setNumber(0, i + 1, 1, revenue as number)
    wb.setNumber(0, i + 1, 2, cost as number)
  })
  wb.recalc()
}

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    engine = await getEngine()
    version.value = engine.module.versionString()
    workbook?.delete()
    workbook = engine.module.Workbook.createDefault()
    seedWorkbook(workbook)
    state.value = 'ready'
    evaluate()
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

const evaluate = () => {
  if (!engine || !workbook) return
  const text = formula.value.trim()
  if (!text) return
  const result =
    mode.value === 'standalone'
      ? engine.module.evalFormula(text)
      : workbook.evaluateFormulaText(0, ANCHOR.row, ANCHOR.col, text)
  output.value = {
    formula: text,
    kind: kindLabel(engine, result.value.kind),
    text: formatValue(engine, result.value) || '(blank)',
    isError: isErrorValue(engine, result.value),
    status: statusText(engine, result.status)
  }
}

const usePreset = (preset: string) => {
  formula.value = preset
  evaluate()
}

const switchMode = (next: Mode) => {
  mode.value = next
  formula.value = PRESETS[next][0]
  evaluate()
}

const reset = () => {
  workbook?.delete()
  workbook = null
  engine = null
  output.value = null
  mode.value = 'standalone'
  formula.value = PRESETS.standalone[0]
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
    <div class="demo-row demo-row--tabs">
      <button
        type="button"
        class="demo-tab"
        :class="{ 'is-active': mode === 'standalone' }"
        @click="switchMode('standalone')"
      >
        {{ copy.modeStandalone }}
      </button>
      <button
        type="button"
        class="demo-tab"
        :class="{ 'is-active': mode === 'workbook' }"
        @click="switchMode('workbook')"
      >
        {{ copy.modeWorkbook }}
      </button>
    </div>

    <div v-if="mode === 'workbook'" class="demo-subpanel">
      <span class="demo-label">{{ copy.seed }}</span>
      <table class="demo-grid">
        <thead>
          <tr>
            <th></th>
            <th v-for="(head, col) in SEED_HEADER" :key="head">{{ String.fromCharCode(65 + col) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>1</th>
            <td v-for="head in SEED_HEADER" :key="head">{{ head }}</td>
          </tr>
          <tr v-for="(row, i) in SEED_ROWS" :key="row[0]">
            <th>{{ i + 2 }}</th>
            <td v-for="(cell, c) in row" :key="c" :class="{ 'is-num': typeof cell === 'number' }">
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <label class="demo-field">
      <span class="demo-label">{{ copy.formulaLabel }}</span>
      <span class="demo-field__row">
        <input v-model="formula" type="text" class="demo-input" spellcheck="false" @keyup.enter="evaluate" />
        <button type="button" class="demo-button" @click="evaluate">{{ copy.evaluate }}</button>
      </span>
    </label>

    <div class="demo-row">
      <span class="demo-label">{{ copy.presets }}</span>
      <button
        v-for="preset in PRESETS[mode]"
        :key="preset"
        type="button"
        class="demo-chip"
        @click="usePreset(preset)"
      >
        {{ preset }}
      </button>
    </div>

    <dl v-if="output" class="demo-result">
      <div>
        <dt>{{ copy.value }}</dt>
        <dd :class="{ 'is-error': output.isError }">{{ output.text }}</dd>
      </div>
      <div>
        <dt>{{ copy.kind }}</dt>
        <dd>{{ output.kind }}</dd>
      </div>
      <div v-if="output.status">
        <dt>{{ copy.status }}</dt>
        <dd class="is-error">{{ output.status }}</dd>
      </div>
    </dl>

    <p v-if="output?.isError" class="demo-hint">{{ copy.errorNote }}</p>
  </DemoFrame>
</template>
