<script setup lang="ts">
/**
 * RecalcDemo — an xlsx round trip that never leaves the browser.
 *
 * Bytes in (`Workbook.loadBytes`), recalculate, read the cell table back, and
 * bytes out (`saveEx`). The sample workbook is generated in-memory by the same
 * engine (`createDefault()` + `save()`), so the demo works with no file at
 * hand and no binary fixture shipped with the site.
 */
import type { Workbook } from '@libraz/formulon'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'
import { cellAddress, type Engine, formatValue, getEngine, isErrorValue } from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
/** Cap on the cell rows listed under the grid; big workbooks stay readable. */
const MAX_LISTED_CELLS = 30

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const busy = ref(false)
const sourceName = ref('')
const inputSize = ref(0)
const outputSize = ref(0)
const sheetName = ref('')
const cellTotal = ref(0)
const loadError = ref('')
const downloadUrl = ref('')

interface CellRow {
  addr: string
  formula: string
  value: string
  isError: boolean
}
const rows = ref<CellRow[]>([])

let engine: Engine | null = null
let sampleBytes: Uint8Array | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: 'xlsx を読み込んで再計算する',
        description:
          'ファイルはどこにもアップロードされません。読み込み・再計算・書き出しはすべてこのページの WASM エンジンが行い、バイト列がブラウザの外に出ることはありません。',
        run: 'エンジンを読み込む',
        pick: 'xlsx ファイルを選ぶ',
        sample: 'サンプルを生成して読み込む',
        sampleNote: 'サンプルは createDefault() + save() でその場で生成しています。',
        privacy: 'ファイルはブラウザ内でのみ処理されます (送信なし)。',
        source: '読み込み元',
        inSize: '入力バイト数',
        outSize: '出力バイト数',
        sheet: 'シート',
        cells: 'セル数',
        download: '再計算した xlsx をダウンロード',
        table: '再計算後のセル',
        addr: 'セル',
        formula: '数式',
        value: '値',
        working: '処理中…',
        invalid: '読み込みに失敗しました',
        more: (n: number) => `ほか ${n} セル`
      }
    : {
        title: 'Load an xlsx and recalculate it',
        description:
          'Nothing is uploaded. Parsing, recalculation and serialization all happen in this page’s WASM engine, and the bytes never leave your browser.',
        run: 'Load engine',
        pick: 'Choose an xlsx file',
        sample: 'Generate and load a sample',
        sampleNote: 'The sample is built on the spot with createDefault() + save().',
        privacy: 'Files are processed in your browser only — nothing is sent anywhere.',
        source: 'Source',
        inSize: 'Input bytes',
        outSize: 'Output bytes',
        sheet: 'Sheet',
        cells: 'Cells',
        download: 'Download the recalculated xlsx',
        table: 'Cells after recalculation',
        addr: 'Cell',
        formula: 'Formula',
        value: 'Value',
        working: 'Working…',
        invalid: 'The workbook could not be loaded',
        more: (n: number) => `and ${n} more cells`
      }
)

/** Sample sheet content: literals plus the formulas that make recalculation
 *  observable after a round trip. */
const seedSample = (wb: Workbook) => {
  const header = ['Item', 'Q1', 'Q2', 'Total']
  header.forEach((label, col) => {
    wb.setText(0, 0, col, label)
  })
  const data: Array<[string, number, number]> = [
    ['Licenses', 1200, 1450],
    ['Support', 640, 705],
    ['Services', 310, 512]
  ]
  data.forEach(([item, q1, q2], i) => {
    const row = i + 1
    wb.setText(0, row, 0, item)
    wb.setNumber(0, row, 1, q1)
    wb.setNumber(0, row, 2, q2)
    wb.setFormula(0, row, 3, `=SUM(B${row + 1}:C${row + 1})`)
  })
  wb.setText(0, 4, 0, 'Total')
  wb.setFormula(0, 4, 1, '=SUM(B2:B4)')
  wb.setFormula(0, 4, 2, '=SUM(C2:C4)')
  wb.setFormula(0, 4, 3, '=SUM(D2:D4)')
  wb.setText(0, 5, 0, 'Growth')
  wb.setFormula(0, 5, 1, '=TEXT(C5/B5-1,"0.0%")')
  wb.recalc()
}

const revokeDownload = () => {
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
  downloadUrl.value = ''
}

/** Loads bytes, recalculates, snapshots the cell table, and serializes the
 *  result back out. Every native handle opened here is released again. */
const processBytes = (bytes: Uint8Array, label: string) => {
  if (!engine) return
  const { module, WorkbookFormat } = engine
  busy.value = true
  loadError.value = ''
  revokeDownload()
  rows.value = []
  outputSize.value = 0

  let wb: Workbook | null = null
  try {
    sourceName.value = label
    inputSize.value = bytes.byteLength
    wb = module.Workbook.loadBytes(bytes)
    if (!wb.isValid()) {
      loadError.value = module.lastErrorMessage() || copy.value.invalid
      return
    }
    wb.recalc()

    const name = wb.sheetName(0)
    sheetName.value = name.status.ok ? name.value : ''
    const total = wb.cellCount(0)
    cellTotal.value = total
    const listed: CellRow[] = []
    for (let i = 0; i < total && listed.length < MAX_LISTED_CELLS; i += 1) {
      const entry = wb.cellAt(0, i)
      if (!entry.status.ok || entry.row === undefined || entry.col === undefined) continue
      listed.push({
        addr: cellAddress(entry.row, entry.col),
        formula: entry.formula ?? '',
        value: formatValue(engine, entry.value),
        isError: isErrorValue(engine, entry.value)
      })
    }
    rows.value = listed

    const saved = wb.saveEx(WorkbookFormat.Xlsx)
    if (!saved.status.ok || !saved.bytes) {
      loadError.value = module.lastErrorMessage() || copy.value.invalid
      return
    }
    // Copy off the wasm heap: its buffer is shared, and Blob rejects those.
    const out = new Uint8Array(saved.bytes)
    outputSize.value = out.byteLength
    downloadUrl.value = URL.createObjectURL(new Blob([out], { type: XLSX_MIME }))
  } catch (error) {
    loadError.value = String(error)
  } finally {
    wb?.delete()
    busy.value = false
  }
}

const loadSample = () => {
  if (!engine) return
  if (!sampleBytes) {
    const wb = engine.module.Workbook.createDefault()
    try {
      seedSample(wb)
      const saved = wb.save()
      if (!saved.status.ok || !saved.bytes) {
        loadError.value = engine.module.lastErrorMessage() || copy.value.invalid
        return
      }
      sampleBytes = new Uint8Array(saved.bytes)
    } finally {
      wb.delete()
    }
  }
  processBytes(sampleBytes, 'sample.xlsx')
}

const onFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const buffer = await file.arrayBuffer()
  processBytes(new Uint8Array(buffer), file.name)
  input.value = ''
}

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    engine = await getEngine()
    version.value = engine.module.versionString()
    state.value = 'ready'
    loadSample()
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

const reset = () => {
  revokeDownload()
  engine = null
  sampleBytes = null
  rows.value = []
  sourceName.value = ''
  sheetName.value = ''
  loadError.value = ''
  inputSize.value = 0
  outputSize.value = 0
  cellTotal.value = 0
  state.value = 'idle'
}

onBeforeUnmount(revokeDownload)
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
    <div class="demo-row">
      <label class="demo-button demo-button--file">
        {{ copy.pick }}
        <input type="file" accept=".xlsx,.xlsb" @change="onFile" />
      </label>
      <button type="button" class="demo-button demo-button--ghost" @click="loadSample">
        {{ copy.sample }}
      </button>
      <span class="demo-hint">{{ copy.privacy }}</span>
    </div>

    <p v-if="loadError" class="demo-hint is-error">{{ loadError }}</p>
    <p v-else-if="busy" class="demo-hint">{{ copy.working }}</p>

    <dl v-if="sourceName && !loadError" class="demo-result">
      <div>
        <dt>{{ copy.source }}</dt>
        <dd>{{ sourceName }}</dd>
      </div>
      <div>
        <dt>{{ copy.sheet }}</dt>
        <dd>{{ sheetName || '—' }}</dd>
      </div>
      <div>
        <dt>{{ copy.inSize }}</dt>
        <dd>{{ inputSize.toLocaleString() }}</dd>
      </div>
      <div>
        <dt>{{ copy.outSize }}</dt>
        <dd>{{ outputSize.toLocaleString() }}</dd>
      </div>
      <div>
        <dt>{{ copy.cells }}</dt>
        <dd>{{ cellTotal }}</dd>
      </div>
    </dl>

    <div v-if="rows.length" class="demo-subpanel">
      <span class="demo-label">{{ copy.table }}</span>
      <table class="demo-grid demo-grid--list">
        <thead>
          <tr>
            <th>{{ copy.addr }}</th>
            <th>{{ copy.formula }}</th>
            <th>{{ copy.value }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.addr">
            <th>{{ row.addr }}</th>
            <td class="is-formula">{{ row.formula || '—' }}</td>
            <td :class="{ 'is-error': row.isError }">{{ row.value }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="cellTotal > rows.length" class="demo-hint">
        {{ copy.more(cellTotal - rows.length) }}
      </p>
      <p class="demo-hint">{{ copy.sampleNote }}</p>
    </div>

    <p v-if="downloadUrl" class="demo-row">
      <a class="demo-button" :href="downloadUrl" :download="sourceName || 'formulon.xlsx'">
        {{ copy.download }}
      </a>
    </p>
  </DemoFrame>
</template>
