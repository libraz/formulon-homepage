<script setup lang="ts">
/**
 * FunctionLookupDemo — the function catalog, read out of the running engine.
 *
 * Nothing here is a copy of the catalog: the index comes from
 * `functionNames()` and every badge, arity and count comes from
 * `functionMetadata(name, locale)` at runtime, so the page cannot drift from
 * the engine it ships with. Signature and description fall back to the
 * display tables in formulon-cell when the engine's locale table has no entry.
 */
import type { FunctionMetadataResult, Workbook } from '@libraz/formulon'
import { useData } from 'vitepress'
import { computed, ref, watch } from 'vue'
import DemoFrame from './DemoFrame.vue'
import {
  type Engine,
  formatValue,
  getCellApi,
  getEngine,
  getFunctionCatalog,
  isErrorValue,
  METADATA_LOCALE,
  statusText
} from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

/** Availability classes reported by `functionMetadata().availability`. */
const AVAILABILITY = {
  implemented: 0,
  implementedUnverified: 1,
  environmentBound: 2,
  unavailableStub: 3
} as const

/** Evaluable examples for the "try it" field. Functions without an entry are
 *  pre-filled with an empty call for the reader to complete. */
const EXAMPLES: Record<string, string> = {
  SUM: '=SUM(1,2,3)',
  AVERAGE: '=AVERAGE(2,4,9)',
  ROUND: '=ROUND(PI(),3)',
  IF: '=IF(3>2,"yes","no")',
  TEXT: '=TEXT(1234.5,"#,##0.00")',
  UPPER: '=UPPER("formulon")',
  LEFT: '=LEFT("formulon",4)',
  DATE: '=TEXT(DATE(2026,8,11),"yyyy-mm-dd")',
  SEQUENCE: '=SUM(SEQUENCE(3,4))',
  TEXTJOIN: '=TEXTJOIN("-",TRUE,"a","b","c")',
  XLOOKUP: '=XLOOKUP(2,{1;2;3},{"a";"b";"c"})',
  SORT: '=INDEX(SORT({3;1;2}),1)'
}

/** Cap on rendered matches; the full match count is still reported. */
const MAX_MATCHES = 60

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const names = ref<string[]>([])
const availability = ref<number[]>([])
const query = ref('')
const selected = ref('')
const meta = ref<FunctionMetadataResult | null>(null)
const fallbackSignature = ref('')
const fallbackDescription = ref('')
const tryFormula = ref('')
const tryResult = ref<{ text: string; isError: boolean; status: string } | null>(null)

let engine: Engine | null = null
// Shared, page-lifetime catalog workbook (see getFunctionCatalog).
let catalog: Workbook | null = null
let signatures: Readonly<Record<string, readonly string[]>> = {}
let descriptions: Readonly<Record<string, { en: string; ja: string }>> = {}

const copy = computed(() =>
  isJa.value
    ? {
        title: '関数カタログを引く',
        description:
          '一覧も件数も、実行中のエンジンの functionNames() / functionMetadata() から取得しています。ページ側に関数表は持っていません。',
        run: 'エンジンを読み込んでカタログを開く',
        search: '関数名で検索',
        total: '登録関数',
        matches: '一致',
        arity: '引数の数',
        variadic: '可変長',
        signature: 'シグネチャ',
        summary: '説明',
        noMeta: 'この関数のロケール別メタデータは登録されていません。',
        tryIt: '試す',
        evaluate: '評価',
        result: '結果',
        labels: {
          0: '実装済み',
          1: '実装済み (未検証)',
          2: '環境依存',
          3: '未実装スタブ'
        } as Record<number, string>
      }
    : {
        title: 'Look up the function catalog',
        description:
          'The index and every count come from the running engine’s functionNames() / functionMetadata(); this page carries no function table of its own.',
        run: 'Load engine and open the catalog',
        search: 'Search by function name',
        total: 'Registered functions',
        matches: 'matches',
        arity: 'Arity',
        variadic: 'variadic',
        signature: 'Signature',
        summary: 'Description',
        noMeta: 'The engine has no locale metadata registered for this function.',
        tryIt: 'Try it',
        evaluate: 'Evaluate',
        result: 'Result',
        labels: {
          0: 'implemented',
          1: 'implemented (unverified)',
          2: 'environment-bound',
          3: 'unavailable stub'
        } as Record<number, string>
      }
)

const localeOrdinal = computed(() => (isJa.value ? METADATA_LOCALE.jaJP : METADATA_LOCALE.enUS))

const matches = computed(() => {
  const needle = query.value.trim().toUpperCase()
  return needle ? names.value.filter((name) => name.includes(needle)) : names.value
})
const shown = computed(() => matches.value.slice(0, MAX_MATCHES))

/** Per-availability totals, counted from the engine's own metadata. */
const counts = computed(() => {
  const totals = new Map<number, number>()
  for (const value of availability.value) totals.set(value, (totals.get(value) ?? 0) + 1)
  return [...totals.entries()].sort((a, b) => a[0] - b[0])
})

const arityText = computed(() => {
  const current = meta.value
  if (!current?.ok) return ''
  const min = current.minArity ?? 0
  const max = current.maxArity
  if (max === null || max === undefined) return `${min}+ (${copy.value.variadic})`
  return min === max ? String(min) : `${min}–${max}`
})

const describe = (name: string) => {
  const entry = descriptions[name]
  fallbackDescription.value = entry ? (isJa.value ? entry.ja : entry.en) : ''
  const args = signatures[name]
  fallbackSignature.value = args ? `${name}(${args.join(', ')})` : ''
}

const select = (name: string) => {
  if (!engine || !catalog) return
  selected.value = name
  meta.value = catalog.functionMetadata(name, localeOrdinal.value)
  describe(name)
  tryFormula.value = EXAMPLES[name] ?? `=${name}(`
  tryResult.value = null
}

const evaluate = () => {
  if (!engine) return
  const text = tryFormula.value.trim()
  if (!text) return
  const result = engine.module.evalFormula(text)
  tryResult.value = {
    text: formatValue(engine, result.value) || '(blank)',
    isError: isErrorValue(engine, result.value),
    status: statusText(engine, result.status)
  }
}

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    engine = await getEngine()
    version.value = engine.module.versionString()
    const cell = await getCellApi()
    signatures = cell.FUNCTION_SIGNATURES
    descriptions = cell.FUNCTION_DESCRIPTIONS

    catalog = await getFunctionCatalog()
    const list = Array.from(catalog.functionNames())
    names.value = list
    availability.value = list.map(
      (name) =>
        catalog?.functionMetadata(name, METADATA_LOCALE.enUS).availability ??
        AVAILABILITY.unavailableStub
    )
    state.value = 'ready'
    // ROUND opens on a fixed two-argument signature, which reads better as a
    // first impression than a variadic entry with an unbounded upper arity.
    select(list.includes('ROUND') ? 'ROUND' : list[0])
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

const reset = () => {
  engine = null
  names.value = []
  availability.value = []
  query.value = ''
  selected.value = ''
  meta.value = null
  tryResult.value = null
  state.value = 'idle'
}

watch(isJa, () => {
  if (state.value === 'ready' && selected.value) select(selected.value)
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
    <div class="demo-row demo-row--counts">
      <span class="demo-status">
        <strong>{{ names.length }}</strong> {{ copy.total }}
      </span>
      <span v-for="[level, count] in counts" :key="level" class="demo-badge" :data-level="level">
        {{ count }} {{ copy.labels[level] }}
      </span>
    </div>

    <label class="demo-field">
      <span class="demo-label">{{ copy.search }}</span>
      <input v-model="query" type="search" class="demo-input" spellcheck="false" />
    </label>

    <div class="demo-namelist">
      <button
        v-for="name in shown"
        :key="name"
        type="button"
        class="demo-chip"
        :class="{ 'is-active': name === selected }"
        @click="select(name)"
      >
        {{ name }}
      </button>
      <span v-if="matches.length > shown.length" class="demo-hint">
        +{{ matches.length - shown.length }} {{ copy.matches }}
      </span>
    </div>

    <div v-if="meta?.ok" class="demo-subpanel">
      <div class="demo-row">
        <strong class="demo-fnname">{{ meta.name }}</strong>
        <span class="demo-badge" :data-level="meta.availability">
          {{ copy.labels[meta.availability ?? 0] }}
        </span>
        <span class="demo-status">{{ copy.arity }}: {{ arityText }}</span>
      </div>
      <dl class="demo-result">
        <div>
          <dt>{{ copy.signature }}</dt>
          <dd class="is-formula">{{ meta.signatureTemplate || fallbackSignature || '—' }}</dd>
        </div>
        <div>
          <dt>{{ copy.summary }}</dt>
          <dd>{{ meta.description || fallbackDescription || copy.noMeta }}</dd>
        </div>
      </dl>

      <label class="demo-field">
        <span class="demo-label">{{ copy.tryIt }}</span>
        <span class="demo-field__row">
          <input
            v-model="tryFormula"
            type="text"
            class="demo-input"
            spellcheck="false"
            @keyup.enter="evaluate"
          />
          <button type="button" class="demo-button" @click="evaluate">{{ copy.evaluate }}</button>
        </span>
      </label>
      <p v-if="tryResult" class="demo-status">
        {{ copy.result }}:
        <strong :class="{ 'is-error': tryResult.isError }">{{ tryResult.text }}</strong>
        <span v-if="tryResult.status" class="is-error"> · {{ tryResult.status }}</span>
      </p>
    </div>
  </DemoFrame>
</template>
