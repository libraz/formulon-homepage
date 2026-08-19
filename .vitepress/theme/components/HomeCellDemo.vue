<script setup lang="ts">
import type {
  SpreadsheetInstance,
  WorkbookHandle as WorkbookHandleType
} from '@libraz/formulon-cell'
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const { lang, isDark } = useData()
const isJa = computed(() => lang.value === 'ja')

type DemoFunction = {
  name: string
  category: string
  formula: string
  target: string
}

const functions: DemoFunction[] = [
  { name: 'SUM', category: 'Math', formula: '=SUM(B2:B7)', target: 'F2' },
  { name: 'AVERAGE', category: 'Stat', formula: '=AVERAGE(D2:D7)', target: 'F2' },
  { name: 'MAX', category: 'Stat', formula: '=MAX(B2:B7)', target: 'F2' },
  { name: 'MIN', category: 'Stat', formula: '=MIN(C2:C7)', target: 'F2' },
  { name: 'COUNT', category: 'Stat', formula: '=COUNT(B2:B7)', target: 'F2' },
  { name: 'ROUND', category: 'Math', formula: '=ROUND(SUM(D2:D7),2)', target: 'F2' },
  {
    name: 'IF',
    category: 'Logic',
    formula: '=IF(SUM(D2:D7)>8000,"above plan","below plan")',
    target: 'F2'
  }
]

const activeFunction = ref(functions[0])
const result = ref('')
const engine = ref('loading')
const status = ref<'booting' | 'ready' | 'fallback' | 'error'>('booting')
const host = ref<HTMLElement | null>(null)

let workbook: WorkbookHandleType | null = null
let spreadsheet: SpreadsheetInstance | null = null

const copy = computed(() =>
  isJa.value
    ? {
        section: 'Live Workbook',
        heading: 'npm 版 formulon で関数を試す',
        body: '下のシートは @libraz/formulon を読み込んだ formulon-cell の実デモです。関数を選ぶと F2 の式を書き換え、WASM エンジンで再計算します。',
        badge: 'WASM',
        readonly: '表示専用',
        readonlyNote: 'シートは読み取り専用です。編集は関数ピッカーから反映されます。',
        result: 'F2 の結果',
        formula: '現在の式',
        open: 'UI デモの位置づけ',
        full: 'フルデモを見る'
      }
    : {
        section: 'Live Workbook',
        heading: 'Try functions through npm formulon',
        body: 'This sheet is the real formulon-cell surface backed by @libraz/formulon. Pick a function to rewrite F2 and recalculate it in the WASM engine.',
        badge: 'WASM',
        readonly: 'Read-only',
        readonlyNote: 'The sheet is read-only. Changes are applied through the function picker.',
        result: 'F2 result',
        formula: 'Current formula',
        open: 'Why this UI exists',
        full: 'Open full demo'
      }
)

const targetAddr = { sheet: 0, row: 1, col: 5 }

const applyFunction = (fn: DemoFunction) => {
  activeFunction.value = fn
  if (!workbook || !spreadsheet) return
  const { mutators, formatCell } = spreadsheetApi
  workbook.setFormula(targetAddr, fn.formula)
  // The instance recalculates and re-reads the sheet into the store; the
  // workbook's own recalc() only does the former, leaving the grid stale.
  spreadsheet.recalc()
  mutators.setActive(spreadsheet.store, targetAddr)
  result.value = formatCell(workbook.getValue(targetAddr), lang.value === 'ja' ? 'ja-JP' : 'en-US')
}

let spreadsheetApi: Awaited<typeof import('@libraz/formulon-cell')>

const seedWorkbook = (wb: WorkbookHandleType) => {
  const rows = [
    ['Jan', 1280, 740],
    ['Feb', 1420, 810],
    ['Mar', 1560, 900],
    ['Apr', 1610, 920],
    ['May', 1750, 980],
    ['Jun', 1890, 1040]
  ] as const

  wb.setText({ sheet: 0, row: 0, col: 0 }, 'Month')
  wb.setText({ sheet: 0, row: 0, col: 1 }, 'Revenue')
  wb.setText({ sheet: 0, row: 0, col: 2 }, 'Cost')
  wb.setText({ sheet: 0, row: 0, col: 3 }, 'Margin')

  rows.forEach(([month, revenue, cost], i) => {
    const row = i + 1
    wb.setText({ sheet: 0, row, col: 0 }, month)
    wb.setNumber({ sheet: 0, row, col: 1 }, revenue)
    wb.setNumber({ sheet: 0, row, col: 2 }, cost)
    wb.setFormula({ sheet: 0, row, col: 3 }, `=B${row + 1}-C${row + 1}`)
  })

  wb.setText({ sheet: 0, row: 0, col: 4 }, 'Picked')
  wb.setText({ sheet: 0, row: 0, col: 5 }, 'Result')
  wb.setText({ sheet: 0, row: 1, col: 4 }, activeFunction.value.name)
  wb.setFormula(targetAddr, activeFunction.value.formula)
  wb.recalc()
}

onMounted(async () => {
  if (!host.value) return

  try {
    spreadsheetApi = await import('@libraz/formulon-cell')
    const { Spreadsheet, WorkbookHandle, mutators, formatCell, isUsingStub } = spreadsheetApi
    workbook = await WorkbookHandle.createDefault()
    seedWorkbook(workbook)

    spreadsheet = await Spreadsheet.mount(host.value, {
      workbook,
      features: spreadsheetApi.presets.minimal(),
      locale: isJa.value ? 'ja' : 'en',
      theme: isDark.value ? 'ink' : 'paper'
    })

    // The panel says the sheet is read-only, so make it so: protection is
    // enforced in the interaction layer, leaving the function picker's own
    // writes through the workbook API unaffected.
    spreadsheet.setSheetProtected(true)

    mutators.setActive(spreadsheet.store, targetAddr)
    result.value = formatCell(workbook.getValue(targetAddr), isJa.value ? 'ja-JP' : 'en-US')
    engine.value = workbook.isStub || isUsingStub() ? 'stub' : `formulon ${workbook.version}`
    status.value = workbook.isStub || isUsingStub() ? 'fallback' : 'ready'
  } catch (error) {
    console.error('[formulon-cell demo]', error)
    engine.value = 'unavailable'
    status.value = 'error'
  }
})

onBeforeUnmount(() => {
  spreadsheet?.dispose()
  spreadsheet = null
  workbook = null
})

watch(isDark, (dark) => {
  spreadsheet?.setTheme(dark ? 'ink' : 'paper')
})

watch(isJa, async (ja) => {
  spreadsheet?.i18n.setLocale(ja ? 'ja' : 'en')
  await nextTick()
  if (workbook && spreadsheetApi) {
    result.value = spreadsheetApi.formatCell(workbook.getValue(targetAddr), ja ? 'ja-JP' : 'en-US')
  }
})
</script>

<template>
  <section class="fln-demo" aria-labelledby="fln-demo-title">
    <div class="fln-demo-inner">
      <div class="fln-demo-copy">
        <span class="fln-section-mark" data-volume="04">{{ copy.section }}</span>
        <h2 id="fln-demo-title">{{ copy.heading }}</h2>
        <p>{{ copy.body }}</p>
        <div class="fln-demo-links">
          <a :href="isJa ? '/ja/cell/' : '/cell/'">{{ copy.open }}</a>
          <a :href="isJa ? '/ja/cell/demo' : '/cell/demo'">{{ copy.full }}</a>
        </div>
      </div>

      <div class="fln-demo-board">
        <header class="fln-demo-toolbar">
          <div class="fln-demo-toolbar-meta">
            <strong>function-lab.xlsx</strong>
            <small class="fln-demo-readonly-note" aria-live="polite">{{ copy.readonlyNote }}</small>
          </div>
          <div class="fln-demo-toolbar-pills">
            <span class="fln-demo-readonly">{{ copy.readonly }}</span>
            <span :data-state="status">{{ copy.badge }} · {{ engine }}</span>
          </div>
        </header>

        <div class="fln-function-strip" aria-label="Function picker">
          <button
            v-for="fn in functions"
            :key="fn.name"
            type="button"
            :class="{ active: fn.name === activeFunction.name }"
            @click="applyFunction(fn)"
          >
            <b>{{ fn.name }}</b>
            <small>{{ fn.category }}</small>
          </button>
        </div>

        <div class="fln-demo-sheet-wrap">
          <div class="fln-demo-sheet" ref="host" aria-hidden="true"></div>
        </div>

        <footer class="fln-demo-result">
          <div class="fln-demo-result-cell">
            <span>{{ copy.formula }}</span>
            <code>{{ activeFunction.formula }}</code>
          </div>
          <div class="fln-demo-result-cell">
            <span>{{ copy.result }}</span>
            <strong>{{ result || '...' }}</strong>
          </div>
        </footer>
      </div>
    </div>
  </section>
</template>
