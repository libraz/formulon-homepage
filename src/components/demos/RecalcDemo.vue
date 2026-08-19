<script setup lang="ts">
/**
 * RecalcDemo — an xlsx round trip that never leaves the browser.
 *
 * Bytes in (`Workbook.loadBytes`), recalculate, and bytes out (`save`). The
 * sample workbook is generated in-memory by the same engine (`createDefault()`
 * + `save()`), so the demo works with no file at hand and no binary fixture
 * shipped with the site.
 *
 * The result is rendered as a real sheet: the saved bytes are handed to an
 * embedded formulon-cell grid, so what the reader sees is the workbook the
 * download button produces, not a transcription of it. Editing that sheet
 * re-serializes it, which keeps the promise the button makes.
 */
import type { Workbook } from '@libraz/formulon'
import type { SpreadsheetInstance } from '@libraz/formulon-cell'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'
import DemoSheet from './DemoSheet.vue'
import { type Engine, getEngine } from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

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
/** Saved output, handed to the embedded grid so it shows the recalculated
 *  workbook rather than a second, separately-built copy of it. */
const outputBytes = ref<Uint8Array | null>(null)

let engine: Engine | null = null
let sampleBytes: Uint8Array | null = null
let sheet: SpreadsheetInstance | null = null
let unsubscribe: (() => void) | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: 'xlsx を読み込んで再計算する',
        description:
          'ファイルはどこにもアップロードされません。読み込み・再計算・書き出しはすべてこのページの WASM エンジンが行い、バイト列がブラウザの外に出ることはありません。',
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
        table: '再計算後のワークブック',
        working: '処理中…',
        invalid: '読み込みに失敗しました'
      }
    : {
        title: 'Load an xlsx and recalculate it',
        description:
          'Nothing is uploaded. Parsing, recalculation and serialization all happen in this page’s WASM engine, and the bytes never leave your browser.',
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
        table: 'The workbook after recalculation',
        working: 'Working…',
        invalid: 'The workbook could not be loaded'
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

const publishDownload = (bytes: Uint8Array) => {
  revokeDownload()
  outputSize.value = bytes.byteLength
  downloadUrl.value = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }))
}

/** Re-serializes the sheet after the reader edits it, so the download and the
 *  byte count keep describing what is actually on screen. */
const onSheetEdited = () => {
  if (!sheet) return
  const saved = sheet.workbook.save()
  publishDownload(new Uint8Array(saved))
}

const onSheetReady = (mounted: SpreadsheetInstance) => {
  unsubscribe?.()
  sheet = mounted
  unsubscribe = mounted.on('cellChange', onSheetEdited)
}

/** Loads bytes, recalculates, and serializes the result back out. Every native
 *  handle opened here is released again. */
const processBytes = (bytes: Uint8Array, label: string) => {
  if (!engine) return
  const { module } = engine
  busy.value = true
  loadError.value = ''
  revokeDownload()
  outputBytes.value = null
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
    cellTotal.value = wb.cellCount(0)

    const saved = wb.save()
    if (!saved.status.ok || !saved.bytes) {
      loadError.value = module.lastErrorMessage() || copy.value.invalid
      return
    }
    // Copy off the wasm heap: its buffer is shared, and Blob rejects those.
    const out = new Uint8Array(saved.bytes)
    outputBytes.value = out
    publishDownload(out)
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
  unsubscribe?.()
  unsubscribe = null
  sheet = null
  engine = null
  sampleBytes = null
  outputBytes.value = null
  sourceName.value = ''
  sheetName.value = ''
  loadError.value = ''
  inputSize.value = 0
  outputSize.value = 0
  cellTotal.value = 0
  state.value = 'idle'
}

onBeforeUnmount(() => {
  revokeDownload()
  unsubscribe?.()
  unsubscribe = null
  sheet = null
})
</script>

<template>
  <DemoFrame
    :title="copy.title"
    :description="copy.description"
    :state="state"
    :error="failure"
    :version="version"
    :reserve="720"
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

    <div v-if="outputBytes" class="demo-subpanel">
      <span class="demo-label">{{ copy.table }}</span>
      <DemoSheet :bytes="outputBytes" :height="340" @ready="onSheetReady" />
      <p class="demo-hint">{{ copy.sampleNote }}</p>
    </div>

    <p v-if="downloadUrl" class="demo-row">
      <a class="demo-button" :href="downloadUrl" :download="sourceName || 'formulon.xlsx'">
        {{ copy.download }}
      </a>
    </p>
  </DemoFrame>
</template>
