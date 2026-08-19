<script setup lang="ts">
/**
 * ErrorsDemo — the two failure channels, side by side.
 *
 * Left: a formula whose result is an error. The call succeeded
 * (`status.ok === true`) and the error arrived as a value, with a `kind` and
 * an `errorCode` ordinal like any other value.
 *
 * Right: a host failure. Sixteen bytes of noise are handed to `loadBytes()`,
 * which cannot produce a workbook at all — no value, no error code, just a
 * failed status and `lastErrorMessage()`.
 *
 * The code table above them is generated from the engine's own `ErrorCode`
 * ordinals and `errorDisplayName()`, so it lists exactly the codes this build
 * carries rather than the classic ten a host-side lookup table usually stops
 * at.
 */
import type { Workbook } from '@libraz/formulon'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'
import DemoFrame from './DemoFrame.vue'
import { type Engine, formatValue, getEngine, isErrorValue, kindLabel, statusText } from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

/** Seed the error probes evaluate against: enough of a grid for range and
 *  lookup arguments to mean something. */
const SEED: Array<[number, number, number]> = [
  [0, 0, 4],
  [0, 1, 9],
  [1, 0, 16],
  [1, 1, 25]
]

/** Anchor for `evaluateFormulaText`, clear of the seeded block. */
const ANCHOR = { row: 6, col: 6 }

/** One formula per failure shape worth showing. What each returns is read
 *  back from the engine — the list is a set of probes, not a set of promises
 *  about which code comes out. */
const PROBES = [
  '=1/0',
  '="a"+1',
  '=NOSUCHFN()',
  '=SQRT(-1)',
  '=NA()',
  '=INDEX(A1:B2,9,9)',
  '=SUM(A1:A2 D1:D2)'
]

/** Bytes that are not a workbook in any container: no ZIP signature, no
 *  BIFF12 record stream. */
const NOISE = new Uint8Array([
  0x66, 0x6f, 0x72, 0x6d, 0x75, 0x6c, 0x6f, 0x6e, 0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd, 0xfc
])

interface CodeEntry {
  ordinal: number
  name: string
  display: string
}

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const codes = ref<CodeEntry[]>([])
const formula = ref(PROBES[0])
const cell = ref<{
  statusOk: boolean
  status: string
  kind: string
  text: string
  code: number | null
  isError: boolean
} | null>(null)
const host = ref<{ ok: boolean; message: string; context: string } | null>(null)

let engine: Engine | null = null
let workbook: Workbook | null = null

const copy = computed(() =>
  isJa.value
    ? {
        title: 'セルのエラーとホストの失敗',
        description:
          '数式が返すエラーは値です。呼び出し自体は成功し、kind = Error として値の側に届きます。ホストの失敗はまったく別の経路で、値も返らずステータスが失敗になります。両方をその場で実行して見比べられます。',
        codesTitle: 'このビルドが持つ ErrorCode',
        codesHint: 'errorDisplayName() が返した表示名です。ページ側に対応表は持っていません。',
        cellTitle: 'セルのエラー (値として返る)',
        hostTitle: 'ホストの失敗 (別経路)',
        formulaLabel: '数式',
        evaluate: '評価',
        probes: 'サンプル',
        statusLabel: 'status.ok',
        kindLabel: 'value.kind',
        valueLabel: '表示値',
        codeLabel: 'errorCode',
        notError: 'この数式はエラーを返していません。値としてそのまま扱えます。',
        hostAction: '16 バイトのノイズを読み込む',
        hostHint: 'ワークブックではないバイト列を loadBytes() に渡します。',
        hostFailed: 'loadBytes() は失敗しました。',
        hostOk: 'このバイト列は読み込めてしまいました。',
        messageLabel: 'lastErrorMessage()',
        contextLabel: 'lastErrorContext()',
        contrast: 'エラー値は表示して処理を続けるもの、ホストの失敗は連携そのものを直すものです。'
      }
    : {
        title: 'Cell errors and host failures',
        description:
          'An error returned by a formula is a value: the call itself succeeded and the error arrived with kind = Error. A host failure travels a different channel entirely — no value comes back and the status reports the failure. Both run here, next to each other.',
        codesTitle: 'ErrorCode ordinals in this build',
        codesHint: 'Display names come from errorDisplayName(); this page carries no lookup table.',
        cellTitle: 'Cell error (arrives as a value)',
        hostTitle: 'Host failure (separate channel)',
        formulaLabel: 'Formula',
        evaluate: 'Evaluate',
        probes: 'Probes',
        statusLabel: 'status.ok',
        kindLabel: 'value.kind',
        valueLabel: 'Display value',
        codeLabel: 'errorCode',
        notError: 'This formula did not produce an error — the value is usable as it stands.',
        hostAction: 'Load 16 bytes of noise',
        hostHint: 'Hands loadBytes() a byte string that is not a workbook.',
        hostFailed: 'loadBytes() failed.',
        hostOk: 'These bytes loaded after all.',
        messageLabel: 'lastErrorMessage()',
        contextLabel: 'lastErrorContext()',
        contrast:
          'An error value is something to show and carry on with; a host failure is something to fix in the integration.'
      }
)

const seedWorkbook = (wb: Workbook) => {
  for (const [row, col, value] of SEED) wb.setNumber(0, row, col, value)
  wb.recalc()
}

const evaluate = () => {
  if (!engine || !workbook) return
  const text = formula.value.trim()
  if (!text) return
  const result = workbook.evaluateFormulaText(0, ANCHOR.row, ANCHOR.col, text)
  const isError = isErrorValue(engine, result.value)
  cell.value = {
    statusOk: result.status.ok,
    status: statusText(engine, result.status),
    kind: kindLabel(engine, result.value.kind),
    text: formatValue(engine, result.value) || '(blank)',
    code: isError ? (result.value.errorCode ?? null) : null,
    isError
  }
}

const useProbe = (probe: string) => {
  formula.value = probe
  evaluate()
}

/** Runs the host-failure path for real: a handle that never became valid, and
 *  the engine's own message for why. */
const loadNoise = () => {
  if (!engine) return
  const { module } = engine
  const wb = module.Workbook.loadBytes(NOISE)
  try {
    host.value = {
      ok: wb.isValid(),
      message: module.lastErrorMessage(),
      context: module.lastErrorContext()
    }
  } finally {
    wb.delete()
  }
}

/** Highlights the code the current probe produced, so the table above stops
 *  being a wall of constants. */
const activeCode = computed(() => cell.value?.code ?? null)

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    engine = await getEngine()
    version.value = engine.module.versionString()
    codes.value = Object.entries(engine.ErrorCode)
      .filter(([, ordinal]) => typeof ordinal === 'number')
      .map(([name, ordinal]) => ({
        ordinal: ordinal as number,
        name,
        display: engine?.module.errorDisplayName(ordinal as number) ?? ''
      }))
      .sort((a, b) => a.ordinal - b.ordinal)
    workbook?.delete()
    workbook = engine.module.Workbook.createDefault()
    seedWorkbook(workbook)
    state.value = 'ready'
    evaluate()
    loadNoise()
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

const reset = () => {
  workbook?.delete()
  workbook = null
  engine = null
  codes.value = []
  cell.value = null
  host.value = null
  formula.value = PROBES[0]
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
    :version="version"
    :reserve="860"
    @run="start"
    @reset="reset"
  >
    <div class="demo-subpanel">
      <span class="demo-label">{{ copy.codesTitle }} · {{ codes.length }}</span>
      <div class="demo-codes">
        <span
          v-for="entry in codes"
          :key="entry.ordinal"
          class="demo-code"
          :class="{ 'is-active': entry.ordinal === activeCode }"
        >
          <span class="demo-code__ordinal">{{ entry.ordinal }}</span>
          {{ entry.display }}
          <span class="demo-code__name">{{ entry.name }}</span>
        </span>
      </div>
      <p class="demo-hint">{{ copy.codesHint }}</p>
    </div>

    <label class="demo-field">
      <span class="demo-label">{{ copy.formulaLabel }}</span>
      <span class="demo-field__row">
        <input
          v-model="formula"
          type="text"
          class="demo-input"
          spellcheck="false"
          @keyup.enter="evaluate"
        />
        <button type="button" class="demo-button" @click="evaluate">{{ copy.evaluate }}</button>
      </span>
    </label>

    <div class="demo-row">
      <span class="demo-label">{{ copy.probes }}</span>
      <button
        v-for="probe in PROBES"
        :key="probe"
        type="button"
        class="demo-chip"
        :class="{ 'is-active': probe === formula }"
        @click="useProbe(probe)"
      >
        {{ probe }}
      </button>
    </div>

    <div class="demo-split">
      <div class="demo-subpanel">
        <span class="demo-label">{{ copy.cellTitle }}</span>
        <dl v-if="cell" class="demo-result">
          <div>
            <dt>{{ copy.statusLabel }}</dt>
            <dd>{{ cell.statusOk ? 'true' : 'false' }}</dd>
          </div>
          <div>
            <dt>{{ copy.kindLabel }}</dt>
            <dd>{{ cell.kind }}</dd>
          </div>
          <div>
            <dt>{{ copy.valueLabel }}</dt>
            <dd :class="{ 'is-error': cell.isError }">{{ cell.text }}</dd>
          </div>
          <div v-if="cell.code !== null">
            <dt>{{ copy.codeLabel }}</dt>
            <dd>{{ cell.code }}</dd>
          </div>
        </dl>
        <p v-if="cell && !cell.isError" class="demo-hint">{{ copy.notError }}</p>
        <p v-if="cell?.status" class="demo-hint is-error">{{ cell.status }}</p>
      </div>

      <div class="demo-subpanel">
        <span class="demo-label">{{ copy.hostTitle }}</span>
        <p class="demo-hint">{{ copy.hostHint }}</p>
        <div class="demo-row">
          <button type="button" class="demo-button demo-button--ghost" @click="loadNoise">
            {{ copy.hostAction }}
          </button>
        </div>
        <template v-if="host">
          <p class="demo-status" :class="{ 'is-error': !host.ok }">
            {{ host.ok ? copy.hostOk : copy.hostFailed }}
          </p>
          <dl class="demo-result">
            <div class="is-wide">
              <dt>{{ copy.messageLabel }}</dt>
              <dd class="is-formula">{{ host.message || '—' }}</dd>
            </div>
            <div v-if="host.context" class="is-wide">
              <dt>{{ copy.contextLabel }}</dt>
              <dd class="is-formula">{{ host.context }}</dd>
            </div>
          </dl>
        </template>
      </div>
    </div>

    <p class="demo-hint">{{ copy.contrast }}</p>
  </DemoFrame>
</template>
