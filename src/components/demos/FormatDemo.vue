<script setup lang="ts">
/**
 * FormatDemo — one workbook written into both containers, then read back.
 *
 * `saveAs(format)` picks the container explicitly, so the same model can be
 * emitted as OOXML and as MS-XLSB from one handle. Each write goes through
 * `saveWithDiagnostics()`, whose counters are reported as the engine returns
 * them: an all-zero column means nothing was lost on that write, not that
 * nothing was checked.
 *
 * Both outputs are then handed straight back to `loadBytes()`. Nothing tells
 * it which container it is holding — detection is content-sniffed from the
 * bytes — and the probe read afterwards is what proves the round trip, not a
 * claim in the prose.
 */
import type { Workbook } from '@libraz/formulon'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'
import DemoSheet from './DemoSheet.vue'
import { cellAddress, type Engine, formatValue, getEngine, statusText } from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

type Container = 'xlsx' | 'xlsb'

const MIME: Record<Container, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12'
}

/** Cell read back out of every reloaded workbook. It is a formula cell, so the
 *  probe covers the formula surviving the write as well as its value. */
const PROBE = { row: 1, col: 3 }

/** Counters `saveWithDiagnostics()` reports, in the order the page discusses
 *  them. Summing them would double-count — a dropped part raises two — so they
 *  are listed, never totalled. */
const SAVE_COUNTERS = [
  'downgradedFormulaCount',
  'deferredFeatureCount',
  'droppedPartCount',
  'droppedRelationshipCount',
  'renumberedPartCount'
] as const

interface Written {
  bytes: Uint8Array
  size: number
  counters: Array<{ key: string; value: number }>
  lossless: boolean
  status: string
  /** Read back from the bytes above, with no file name to go on. */
  probe: string
  sheet: string
  cells: number
  url: string
}

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const sourceName = ref('')
const sourceSize = ref(0)
const loadError = ref('')
const busy = ref(false)
const shown = ref<Container>('xlsx')
const written = ref<Record<Container, Written | null>>({ xlsx: null, xlsb: null })

let engine: Engine | null = null
let sampleBytes: Uint8Array | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: '同じワークブックを XLSX と XLSB で書き出す',
        description:
          '1 つのワークブックを saveWithDiagnostics() で両方のコンテナに書き出し、生成したバイト列をそのまま loadBytes() に戻します。読み込みはファイル名ではなくバイト列の内容から形式を判定するため、拡張子のないバイト列でも正しく開きます。',
        pick: 'xlsx / xlsb を選ぶ',
        sample: 'サンプルを生成',
        privacy: 'ファイルはブラウザ内でのみ処理されます (送信なし)。',
        source: '読み込み元',
        sourceSize: '入力バイト数',
        size: 'バイト',
        lossless: '欠落の報告なし',
        probeLabel: `再読込した ${cellAddress(PROBE.row, PROBE.col)}`,
        cellsLabel: 'セル数',
        agree: '両形式の再読込結果は一致しています。',
        differ: '両形式の再読込結果が一致しません。',
        sheetTitle: '再読込したワークブック',
        download: 'ダウンロード',
        working: '処理中…',
        invalid: '読み込みに失敗しました',
        counters: {
          downgradedFormulaCount: 'キャッシュ値に降格した数式',
          deferredFeatureCount: 'レコード化を見送った機能',
          droppedPartCount: '破棄したパート',
          droppedRelationshipCount: '破棄したリレーション',
          renumberedPartCount: '採番し直したテーブル'
        } as Record<string, string>
      }
    : {
        title: 'Write one workbook as XLSX and as XLSB',
        description:
          'The same workbook is written into both containers with saveWithDiagnostics(), then each output is handed back to loadBytes(). Loading is content-sniffed, so the bytes open correctly with no file name and no extension to go on.',
        pick: 'Choose an xlsx / xlsb file',
        sample: 'Generate a sample',
        privacy: 'Files are processed in your browser only — nothing is sent anywhere.',
        source: 'Source',
        sourceSize: 'Input bytes',
        size: 'Bytes',
        lossless: 'no loss reported',
        probeLabel: `${cellAddress(PROBE.row, PROBE.col)} after reload`,
        cellsLabel: 'Cells',
        agree: 'Both containers read back the same workbook.',
        differ: 'The two containers did not read back the same workbook.',
        sheetTitle: 'The reloaded workbook',
        download: 'Download',
        working: 'Working…',
        invalid: 'The workbook could not be loaded',
        counters: {
          downgradedFormulaCount: 'Formulas emitted as cached literals',
          deferredFeatureCount: 'Features not lowered to records',
          droppedPartCount: 'Parts dropped',
          droppedRelationshipCount: 'Relationships dropped',
          renumberedPartCount: 'Tables renumbered'
        } as Record<string, string>
      }
)

const CONTAINERS: Container[] = ['xlsx', 'xlsb']

/** Sample content: formulas, text and numbers, so a write has something to
 *  downgrade and a reload has something to prove. */
const seedSample = (wb: Workbook) => {
  const header = ['Region', 'Plan', 'Seats', 'MRR']
  header.forEach((label, col) => {
    wb.setText(0, 0, col, label)
  })
  const rows: Array<[string, string, number]> = [
    ['APAC', 'Team', 180],
    ['EMEA', 'Business', 96],
    ['AMER', 'Enterprise', 42]
  ]
  rows.forEach(([region, plan, seats], i) => {
    const row = i + 1
    wb.setText(0, row, 0, region)
    wb.setText(0, row, 1, plan)
    wb.setNumber(0, row, 2, seats)
    wb.setFormula(0, row, 3, `=C${row + 1}*${(i + 2) * 12}`)
  })
  wb.setText(0, 4, 0, 'Total')
  wb.setFormula(0, 4, 2, '=SUM(C2:C4)')
  wb.setFormula(0, 4, 3, '=SUM(D2:D4)')
  wb.setFormula(0, 5, 0, '=TEXTJOIN(" / ",TRUE,A2:A4)')
  wb.recalc()
}

const revoke = () => {
  for (const container of CONTAINERS) {
    const entry = written.value[container]
    if (entry?.url) URL.revokeObjectURL(entry.url)
  }
  written.value = { xlsx: null, xlsb: null }
}

/** Writes one container and reads the result straight back. */
const writeAndReload = (wb: Workbook, container: Container): Written | null => {
  if (!engine) return null
  const { module, WorkbookFormat } = engine
  const format = container === 'xlsx' ? WorkbookFormat.Xlsx : WorkbookFormat.Xlsb
  const result = wb.saveWithDiagnostics(format)
  if (!result.status.ok || !result.bytes) {
    loadError.value = statusText(engine, result.status) || copy.value.invalid
    return null
  }
  // Copy off the wasm heap: its buffer is shared, and Blob rejects those.
  const bytes = new Uint8Array(result.bytes)
  const counters = SAVE_COUNTERS.map((key) => ({ key, value: result[key] }))

  let probe = ''
  let sheet = ''
  let cells = 0
  const reloaded = module.Workbook.loadBytes(bytes)
  try {
    if (reloaded.isValid()) {
      const name = reloaded.sheetName(0)
      sheet = name.status.ok ? name.value : ''
      cells = reloaded.cellCount(0)
      probe = formatValue(engine, reloaded.getValue(0, PROBE.row, PROBE.col).value)
    } else {
      loadError.value = module.lastErrorMessage() || copy.value.invalid
    }
  } finally {
    reloaded.delete()
  }

  return {
    bytes,
    size: bytes.byteLength,
    counters,
    lossless: counters.every((entry) => entry.value === 0),
    status: statusText(engine, result.status),
    probe,
    sheet,
    cells,
    url: URL.createObjectURL(new Blob([bytes], { type: MIME[container] }))
  }
}

const processBytes = (bytes: Uint8Array, label: string) => {
  if (!engine) return
  busy.value = true
  loadError.value = ''
  revoke()

  let wb: Workbook | null = null
  try {
    sourceName.value = label
    sourceSize.value = bytes.byteLength
    wb = engine.module.Workbook.loadBytes(bytes)
    if (!wb.isValid()) {
      loadError.value = engine.module.lastErrorMessage() || copy.value.invalid
      return
    }
    wb.recalc()
    written.value = {
      xlsx: writeAndReload(wb, 'xlsx'),
      xlsb: writeAndReload(wb, 'xlsb')
    }
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

/** The two reloads have to agree on everything the probe can see; if they do
 *  not, the container mapping lost something the counters did not name. */
const roundTripAgrees = computed(() => {
  const a = written.value.xlsx
  const b = written.value.xlsb
  if (!a || !b) return null
  return a.probe === b.probe && a.sheet === b.sheet && a.cells === b.cells
})

const shownBytes = computed(() => written.value[shown.value]?.bytes ?? null)

/** Pairs each container with its write, so the template can name the entry
 *  once instead of indexing (and re-asserting) it on every line. */
const panels = computed(() =>
  CONTAINERS.map((container) => ({ container, entry: written.value[container] }))
)

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
  revoke()
  engine = null
  sampleBytes = null
  sourceName.value = ''
  sourceSize.value = 0
  loadError.value = ''
  shown.value = 'xlsx'
  state.value = 'idle'
}

onBeforeUnmount(revoke)
</script>

<template>
  <DemoFrame
    :title="copy.title"
    :description="copy.description"
    :state="state"
    :error="failure"
    :version="version"
    :reserve="780"
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

    <dl v-if="sourceName" class="demo-result">
      <div>
        <dt>{{ copy.source }}</dt>
        <dd>{{ sourceName }}</dd>
      </div>
      <div>
        <dt>{{ copy.sourceSize }}</dt>
        <dd>{{ sourceSize.toLocaleString() }}</dd>
      </div>
    </dl>

    <div class="demo-split">
      <div v-for="{ container, entry } in panels" :key="container" class="demo-subpanel">
        <div class="demo-panelhead">
          <span class="demo-label">.{{ container }}</span>
          <span class="demo-status">
            {{ entry ? `${entry.size.toLocaleString()} ${copy.size}` : '—' }}
          </span>
        </div>

        <template v-if="entry">
          <div class="demo-shift">
            <template v-for="counter in entry.counters" :key="counter.key">
              <template v-if="counter.value > 0">
                <span class="demo-shift__addr">{{ counter.value }}</span>
                <span class="demo-shift__formula">{{ copy.counters[counter.key] }}</span>
              </template>
            </template>
          </div>
          <p v-if="entry.lossless" class="demo-hint">{{ copy.lossless }}</p>

          <dl class="demo-result">
            <div>
              <dt>{{ copy.probeLabel }}</dt>
              <dd>{{ entry.probe || '—' }}</dd>
            </div>
            <div>
              <dt>{{ copy.cellsLabel }}</dt>
              <dd>{{ entry.cells }}</dd>
            </div>
          </dl>

          <p class="demo-row">
            <a
              class="demo-button demo-button--ghost"
              :href="entry.url"
              :download="`formulon.${container}`"
            >
              {{ copy.download }} .{{ container }}
            </a>
          </p>
        </template>
      </div>
    </div>

    <p v-if="roundTripAgrees !== null" class="demo-hint" :class="{ 'is-error': !roundTripAgrees }">
      {{ roundTripAgrees ? copy.agree : copy.differ }}
    </p>

    <div v-if="shownBytes" class="demo-subpanel">
      <span class="demo-label">{{ copy.sheetTitle }}</span>
      <div class="demo-segment demo-segment--inline" role="tablist">
        <button
          v-for="container in CONTAINERS"
          :key="container"
          type="button"
          role="tab"
          class="demo-segment__item"
          :class="{ 'is-active': container === shown }"
          :aria-selected="container === shown"
          @click="shown = container"
        >
          .{{ container }}
        </button>
      </div>
      <DemoSheet :bytes="shownBytes" :height="260" read-only />
    </div>
  </DemoFrame>
</template>
