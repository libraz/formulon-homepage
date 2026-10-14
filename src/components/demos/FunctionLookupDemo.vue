<script setup lang="ts">
/**
 * FunctionLookupDemo — the function catalog, read out of the running engine.
 *
 * Nothing here is a copy of the catalog: the index comes from
 * `functionNames()` and every badge, arity and count comes from
 * `functionMetadata(name)` at runtime, so the page cannot drift from
 * the engine it ships with. Signature and description fall back to the
 * display tables in formulon-cell because the engine metadata is structural.
 */
import type { FunctionMetadataResult } from '@libraz/formulon'
import { useData } from 'vitepress'
import { computed, ref, useId, watch } from 'vue'
import DemoFrame from './DemoFrame.vue'
import { type Engine, formatValue, getEngine, isErrorValue, statusText } from './engine'
import FormulaInput from './FormulaInput.vue'
import { loadFormulaCatalog } from './formulaCatalog'

const { lang } = useData()
const searchHelpId = useId()
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
  SORT: '=INDEX(SORT({3;1;2}),1)',
  COUNT: '=COUNT(1,2,"text")',
  COUNTA: '=COUNTA(1,"text",TRUE)',
  MIN: '=MIN(7,2,9)',
  MAX: '=MAX(7,2,9)',
  MEDIAN: '=MEDIAN(1,3,8)',
  IFERROR: '=IFERROR(1/0,"fallback")',
  IFNA: '=IFNA(NA(),"not found")',
  AND: '=AND(3>2,5<10)',
  OR: '=OR(3<2,5<10)',
  NOT: '=NOT(FALSE)',
  ROUNDUP: '=ROUNDUP(12.345,2)',
  ROUNDDOWN: '=ROUNDDOWN(12.345,2)',
  MOD: '=MOD(17,5)',
  ABS: '=ABS(-42)',
  POWER: '=POWER(2,8)',
  SQRT: '=SQRT(81)',
  LOG: '=LOG(100,10)',
  PI: '=PI()',
  RIGHT: '=RIGHT("formulon",3)',
  MID: '=MID("formulon",2,4)',
  LEN: '=LEN("formulon")',
  LOWER: '=LOWER("FORMULON")',
  TRIM: '=TRIM("  hello   world  ")',
  SUBSTITUTE: '=SUBSTITUTE("a-b-c","-","/")',
  REPLACE: '=REPLACE("formulon",1,4,"calc")',
  FIND: '=FIND("mul","formulon")',
  VALUE: '=VALUE("123.5")',
  YEAR: '=YEAR(DATE(2026,8,11))',
  MONTH: '=MONTH(DATE(2026,8,11))',
  DAY: '=DAY(DATE(2026,8,11))',
  INDEX: '=INDEX({10,20;30,40},2,1)',
  MATCH: '=MATCH(20,{10;20;30},0)',
  CHOOSE: '=CHOOSE(2,"red","green","blue")',
  FILTER: '=SUM(FILTER({1;2;3},{FALSE;TRUE;TRUE}))',
  UNIQUE: '=ROWS(UNIQUE({1;1;2;3}))',
  TRANSPOSE: '=INDEX(TRANSPOSE({1;2;3}),1,2)',
  LET: '=LET(price,120,tax,0.1,price*(1+tax))',
  TRUE: '=TRUE()',
  FALSE: '=FALSE()',
  NA: '=NA()'
}

/** Cap on rendered matches; the full match count is still reported. */
const MAX_MATCHES = 60

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const names = ref<string[]>([])
const searchIndex = ref<Record<string, string>>({})
const availability = ref<number[]>([])
const query = ref('')
const selected = ref('')
const meta = ref<FunctionMetadataResult | null>(null)
const fallbackSignature = ref('')
const fallbackDescription = ref('')
const tryFormula = ref('')
const tryResult = ref<{ text: string; isError: boolean; status: string } | null>(null)

let engine: Engine | null = null
let metadata: Readonly<Record<string, FunctionMetadataResult>> = {}
let signatures: Readonly<Record<string, readonly string[]>> = {}
let descriptions: Readonly<Record<string, { en: string; ja: string }>> = {}

const copy = computed(() =>
  isJa.value
    ? {
        title: '関数カタログを引く',
        description:
          '一覧も件数も、実行中のエンジンの functionNames() / functionMetadata() から取得しています。ページ側に関数表は持っていません。',
        search: '関数名・説明で検索',
        searchPlaceholder: '例: ROUND、四捨五入、検索、文字列',
        searchHint:
          '関数名の一部や、やりたい操作で絞り込めます。候補を選ぶと引数と入力例を表示します。',
        noMatches: '一致する関数がありません。検索語を短くしてみてください。',
        total: '登録関数',
        matches: '一致',
        arity: '引数の数',
        variadic: '可変長',
        signature: 'シグネチャ',
        summary: '説明',
        noMeta: 'この関数のロケール別メタデータは登録されていません。',
        tryIt: '試す',
        inputHint:
          'この欄は単体評価です。セル参照の代わりに数値・文字列・配列定数を使ってください。',
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
        search: 'Search names and descriptions',
        searchPlaceholder: 'Try ROUND, precision, lookup or text',
        searchHint:
          'Search by part of a name or what you want to do. Select a function to see its arguments and try a formula.',
        noMatches: 'No matching functions. Try a shorter search.',
        total: 'Registered functions',
        matches: 'matches',
        arity: 'Arity',
        variadic: 'variadic',
        signature: 'Signature',
        summary: 'Description',
        noMeta: 'The engine has no locale metadata registered for this function.',
        tryIt: 'Try it',
        inputHint:
          'This field evaluates standalone formulas. Use numbers, text or array constants in place of cell references.',
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

const matches = computed(() => {
  const needle = query.value.trim().toUpperCase()
  return needle
    ? names.value.filter((name) => searchIndex.value[name]?.includes(needle))
    : names.value
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
  if (!engine) return
  selected.value = name
  meta.value = metadata[name] ?? null
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
    const catalog = await loadFormulaCatalog()
    signatures = catalog.signatures
    descriptions = catalog.descriptions
    metadata = catalog.metadata
    const list = [...catalog.names]
    searchIndex.value = Object.fromEntries(
      list.map((name) => {
        const description = descriptions[name]
        return [
          name,
          `${name} ${description?.en ?? ''} ${description?.ja ?? ''} ${metadata[name]?.description ?? ''}`.toUpperCase()
        ]
      })
    )
    names.value = list
    availability.value = list.map(
      (name) => metadata[name]?.availability ?? AVAILABILITY.unavailableStub
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
  searchIndex.value = {}
  availability.value = []
  query.value = ''
  selected.value = ''
  meta.value = null
  tryResult.value = null
  state.value = 'idle'
}

watch(isJa, () => {
  if (state.value === 'ready' && selected.value) describe(selected.value)
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
      <input v-model="query" type="search" class="demo-input" spellcheck="false" :placeholder="copy.searchPlaceholder" :aria-describedby="searchHelpId" />
    </label>
    <p :id="searchHelpId" class="demo-hint">{{ copy.searchHint }}</p>

    <div class="demo-namelist">
      <span v-if="matches.length === 0" class="demo-hint" role="status">{{ copy.noMatches }}</span>
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

      <FormulaInput
        v-model="tryFormula"
        :label="copy.tryIt"
        :action-label="copy.evaluate"
        :function-name="selected"
        :placeholder="EXAMPLES[selected] ?? `=${selected}(`"
        :context-hint="copy.inputHint"
        @submit="evaluate"
      />
      <p v-if="tryResult" class="demo-status">
        {{ copy.result }}:
        <strong :class="{ 'is-error': tryResult.isError }">{{ tryResult.text }}</strong>
        <span v-if="tryResult.status" class="is-error"> · {{ tryResult.status }}</span>
      </p>
    </div>
  </DemoFrame>
</template>
