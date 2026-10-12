<script setup lang="ts">
/**
 * LocaleSwitchDemo — a live locale/profile round trip on one workbook.
 *
 * The grid's own selector and the host selector both call the public
 * `SpreadsheetInstance.setLocale()` method when the mounted cell package
 * exposes the complete locale surface. The readout is subscribed to the
 * instance's `localeChange` event, so it shows the profile and formula/value
 * effects of the switch without remounting or copying state into a second
 * workbook.
 */
import type { SpreadsheetInstance, WorkbookHandle } from '@libraz/formulon-cell'
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import DemoFrame from './DemoFrame.vue'
import { getCellApi } from './engine'

const { lang, isDark } = useData()
const isJa = computed(() => lang.value === 'ja')

const LOCALES = ['en', 'ja', 'de', 'fr', 'zh', 'ko', 'th'] as const
type DemoLocale = (typeof LOCALES)[number]

const LOCALE_NAMES: Record<DemoLocale, string> = {
  en: 'English',
  ja: '日本語',
  de: 'Deutsch',
  fr: 'Français',
  zh: '中文',
  ko: '한국어',
  th: 'ไทย'
}

const LOCALE_TAGS: Record<DemoLocale, string> = {
  en: 'en-US',
  ja: 'ja-JP',
  de: 'de-DE',
  fr: 'fr-FR',
  zh: 'zh-CN',
  ko: 'ko-KR',
  th: 'th-TH'
}

const NUMERIC_ADDR = { sheet: 0, row: 1, col: 1 } as const
const DATE_ADDR = { sheet: 0, row: 1, col: 2 } as const
const BOOL_ADDR = { sheet: 0, row: 1, col: 3 } as const
const TOTAL_ADDR = { sheet: 0, row: 1, col: 4 } as const
const EDITABLE_ADDR = { sheet: 0, row: 2, col: 1 } as const
const CURRENCY_ADDR = { sheet: 0, row: 2, col: 4 } as const

/** This is the formula kept in the cell; it never changes when the UI locale does. */
const CANONICAL_FORMULA = '=SUM(B2,B3)+IF(D2,1,0)'

type DemoState = 'idle' | 'loading' | 'ready' | 'error'

interface LocaleReadout {
  locale: string
  profile: string
  decimalSeparator: string
  listSeparator: string
  dateOrder: string
  trueName: string
  falseName: string
  canonicalFormula: string
  localizedFormula: string
  numericValue: string
  dateValue: string
  boolValue: string
  editableValue: string
  currencyValue: string
}

interface LocaleRuntimeInstance {
  setLocale?: (locale: string) => boolean
}

interface LocaleRuntimeWorkbook {
  localeFacts?: () => {
    decimalSeparator?: string
    listSeparator?: string
    dateOrder?: string
    trueName?: string
    falseName?: string
  } | null
  localizeFormulaText?: (formula: string) => string
}

const localeInstance = (value: SpreadsheetInstance): SpreadsheetInstance & LocaleRuntimeInstance =>
  value as SpreadsheetInstance & LocaleRuntimeInstance

const localeWorkbook = (value: WorkbookHandle): WorkbookHandle & LocaleRuntimeWorkbook =>
  value as WorkbookHandle & LocaleRuntimeWorkbook

const initialLocale = (): DemoLocale => (isJa.value ? 'ja' : 'en')

const emptyReadout = (): LocaleReadout => ({
  locale: initialLocale(),
  profile: '—',
  decimalSeparator: '—',
  listSeparator: '—',
  dateOrder: '—',
  trueName: '—',
  falseName: '—',
  canonicalFormula: CANONICAL_FORMULA,
  localizedFormula: CANONICAL_FORMULA,
  numericValue: '—',
  dateValue: '—',
  boolValue: '—',
  editableValue: '—',
  currencyValue: '—'
})

const state = ref<DemoState>('idle')
const failure = ref('')
const version = ref('')
const selectedLocale = ref<DemoLocale>(initialLocale())
const hostLocale = ref<DemoLocale>(initialLocale())
const hostSetResult = ref('—')
const readout = ref<LocaleReadout>(emptyReadout())
const host = ref<HTMLDivElement | null>(null)

let cellApi: Awaited<ReturnType<typeof getCellApi>> | null = null
let instance: SpreadsheetInstance | null = null
let stops: Array<() => void> = []
let token = 0
const unsupported = ref(false)

const copy = computed(() =>
  isJa.value
    ? {
        title: 'ロケールを実行時に切り替える',
        description:
          '同じワークブックを保持したまま、組み込みの 7 言語セレクターとホスト側の setLocale() を試せます。UI、計算プロファイル、式の表示、値の表記が同時に切り替わります。',
        hostSelect: 'ホスト側の言語',
        hostResult: 'setLocale() の結果',
        hostHint: 'ホスト側からも同じインスタンスを切り替えます。',
        currentLocale: 'instance.locale',
        profile: '計算プロファイル',
        facts: 'localeFacts()',
        separators: '区切り',
        decimal: '小数',
        list: 'リスト',
        order: '日付順',
        booleans: '真偽値',
        values: '計算結果',
        numeric: '数値',
        date: 'ホスト側で整形した日付',
        bool: '真偽値',
        editable: '編集したセル B3',
        currency: 'エンジンの DOLLAR 結果',
        formula: '式の変換',
        stored: '保存される式 (canonical)',
        localized: '入力欄の表示式',
        gridHint:
          '数式バーは選択中の式を現在の言語で受け付けます。B3 は編集でき、言語を変えても同じワークブックとセルの値が残ります。',
        failed: 'このロケールへの切り替えに失敗しました。',
        noEngine: 'ワークブックを準備できません。',
        unsupported:
          'この言語切り替えデモには formulon-cell 0.9.0 以降が必要です。読み込まれたパッケージには必要なロケール API がありません。'
      }
    : {
        title: 'Switch locales at runtime',
        description:
          'Keep one workbook while trying the built-in seven-language selector and a host-owned setLocale() control. The UI, calculation profile, formula display and values move together.',
        hostSelect: 'Host language',
        hostResult: 'setLocale() result',
        hostHint: 'The host control calls the same live instance.',
        currentLocale: 'instance.locale',
        profile: 'Calculation profile',
        facts: 'localeFacts()',
        separators: 'Separators',
        decimal: 'decimal',
        list: 'list',
        order: 'date order',
        booleans: 'Boolean names',
        values: 'Calculated values',
        numeric: 'number',
        date: 'host-formatted date',
        bool: 'boolean',
        editable: 'Edited cell B3',
        currency: 'Engine DOLLAR result',
        formula: 'Formula conversion',
        stored: 'Stored formula (canonical)',
        localized: 'Localized input formula',
        gridHint:
          'The formula bar accepts the selected formula in the active language. B3 is editable, and the same workbook keeps its value across a switch.',
        failed: 'The locale switch was rejected.',
        noEngine: 'The workbook could not be prepared.',
        unsupported:
          'Language switching in this demo requires formulon-cell 0.9.0 or later. The loaded package does not expose the required locale APIs.'
      }
)

const localeFromValue = (value: string): DemoLocale | null =>
  (LOCALES as readonly string[]).includes(value) ? (value as DemoLocale) : null

const dateFromExcelSerial = (serial: number): Date =>
  new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000)

const formatDate = (value: unknown, locale: DemoLocale): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC'
  }).format(dateFromExcelSerial(value))
}

const seedWorkbook = (workbook: WorkbookHandle): void => {
  workbook.setText({ sheet: 0, row: 0, col: 0 }, 'Sample')
  workbook.setText({ sheet: 0, row: 0, col: 1 }, 'Number')
  workbook.setText({ sheet: 0, row: 0, col: 2 }, 'Date')
  workbook.setText({ sheet: 0, row: 0, col: 3 }, 'Boolean')
  workbook.setText({ sheet: 0, row: 0, col: 4 }, 'Total')
  workbook.setText({ sheet: 0, row: 1, col: 0 }, 'Locale sample')
  workbook.setNumber(NUMERIC_ADDR, 1234.5)
  workbook.setFormula(DATE_ADDR, '=DATE(2026,1,2)')
  workbook.setFormula(BOOL_ADDR, '=TRUE()')
  workbook.setFormula(TOTAL_ADDR, CANONICAL_FORMULA)
  workbook.setText({ sheet: 0, row: 2, col: 0 }, 'Editable')
  workbook.setNumber(EDITABLE_ADDR, 12)
  workbook.setFormula(CURRENCY_ADDR, '=DOLLAR(B2)')
  workbook.setText({ sheet: 0, row: 3, col: 0 }, 'Profile')
  workbook.setText({ sheet: 0, row: 3, col: 1 }, 'Mac 365')
  // Keep the date and localized currency visible instead of clipping them.
  for (const [column, width] of [110, 95, 120, 85, 120].entries())
    workbook.setColumnWidth(0, column, column, width)

  // Give the date cell a real date format so the mounted grid also reads as a
  // date. If an older fallback engine lacks style mutation, the host readout
  // below still formats the numeric serial using the active locale.
  const currentXf = workbook.getCellXfIndex(DATE_ADDR.sheet, DATE_ADDR.row, DATE_ADDR.col)
  const currentRecord = currentXf === null ? null : workbook.getCellXf(currentXf)
  const dateFormat = workbook.addNumFmtCode('yyyy-mm-dd')
  if (currentRecord && dateFormat >= 0) {
    const dateXf = workbook.addXfRecord({
      ...currentRecord,
      numFmtId: dateFormat,
      applyNumberFormat: true
    })
    if (dateXf >= 0) workbook.setCellXfIndex(DATE_ADDR.sheet, DATE_ADDR.row, DATE_ADDR.col, dateXf)
  }
  workbook.recalc()
}

const clearSubscriptions = (): void => {
  for (const stop of stops) stop()
  stops = []
}

const disposeCurrent = (): void => {
  clearSubscriptions()
  instance?.dispose()
  instance = null
}

const resetReadout = (): void => {
  unsupported.value = false
  selectedLocale.value = initialLocale()
  hostLocale.value = initialLocale()
  hostSetResult.value = '—'
  readout.value = emptyReadout()
}

const readCell = (
  addr: { sheet: number; row: number; col: number },
  locale: DemoLocale
): string => {
  if (!instance || !cellApi) return '—'
  const value = instance.workbook.getValue(addr)
  return cellApi.formatCell(value, LOCALE_TAGS[locale]) || '—'
}

const refreshReadout = (): void => {
  if (!instance || !cellApi) return
  try {
    const workbook = localeWorkbook(instance.workbook)
    const current = localeFromValue(instance.locale) ?? selectedLocale.value
    const facts = workbook.localeFacts?.() ?? null
    const dateCell = instance.workbook.getValue(DATE_ADDR)
    const dateNumber = dateCell.kind === 'number' ? dateCell.value : null
    const storedFormula = instance.workbook.cellFormula(TOTAL_ADDR) ?? ''
    selectedLocale.value = current
    hostLocale.value = current
    readout.value = {
      locale: instance.locale,
      profile: instance.workbook.spreadsheetProfileId() ?? '—',
      decimalSeparator: facts?.decimalSeparator ?? '—',
      listSeparator: facts?.listSeparator ?? '—',
      dateOrder: facts?.dateOrder ?? '—',
      trueName: facts?.trueName ?? '—',
      falseName: facts?.falseName ?? '—',
      canonicalFormula: storedFormula || '—',
      localizedFormula:
        storedFormula && workbook.localizeFormulaText
          ? workbook.localizeFormulaText(storedFormula)
          : '—',
      numericValue: readCell(NUMERIC_ADDR, current),
      dateValue: formatDate(dateNumber, current),
      boolValue: readCell(BOOL_ADDR, current),
      editableValue: readCell(EDITABLE_ADDR, current),
      currencyValue: readCell(CURRENCY_ADDR, current)
    }
  } catch (error) {
    failure.value = String(error)
  }
}

watch(lang, (siteLocale) => {
  if (unsupported.value) {
    return
  }
  if (!instance) return
  const mounted = localeInstance(instance)
  if (typeof mounted.setLocale !== 'function') {
    unsupported.value = true
    failure.value = copy.value.unsupported
    return
  }
  const requested = siteLocale === 'ja' ? 'ja' : 'en'
  if (instance.locale === requested) return
  try {
    if (!mounted.setLocale(requested)) {
      failure.value = copy.value.failed
      return
    }
    failure.value = ''
  } catch (error) {
    failure.value = String(error)
  }
})

watch(isDark, (dark) => {
  if (!instance) return
  try {
    instance.setTheme(dark ? 'ink' : 'paper')
  } catch (error) {
    failure.value = String(error)
  }
})

const attachEvents = (mounted: SpreadsheetInstance): void => {
  clearSubscriptions()
  stops.push(
    mounted.on('localeChange', () => {
      refreshReadout()
    })
  )
  stops.push(
    mounted.on('cellChange', () => {
      refreshReadout()
    })
  )
  stops.push(
    mounted.on('changeBatch', () => {
      mounted.recalc()
      refreshReadout()
    })
  )
  refreshReadout()
}

const supportsLocaleSwitch = (mounted: SpreadsheetInstance): boolean =>
  typeof localeInstance(mounted).setLocale === 'function' &&
  typeof localeWorkbook(mounted.workbook).localeFacts === 'function' &&
  typeof localeWorkbook(mounted.workbook).localizeFormulaText === 'function'

const mountInstance = async (mine: number, target: HTMLDivElement): Promise<boolean> => {
  if (!cellApi || mine !== token) return true
  const mounted = await cellApi.Spreadsheet.mount(target, {
    locale: selectedLocale.value,
    seed: seedWorkbook,
    viewport: {
      range: { sheet: 0, r0: 0, c0: 0, r1: 4, c1: 4 },
      tabBoundary: 'stop'
    },
    ui: {
      profile: 'embedded',
      platform: 'mac',
      theme: isDark.value ? 'ink' : 'paper',
      features: {
        formulaBar: true,
        statusBar: true,
        localeSwitcher: true,
        clipboard: true,
        shortcuts: true
      },
      advancedFeatures: { wheel: false }
    }
  })
  if (mine !== token) {
    mounted.dispose()
    return true
  }
  if (!supportsLocaleSwitch(mounted)) {
    mounted.dispose()
    return false
  }
  instance = mounted
  version.value = mounted.workbook.version
  cellApi.mutators.setActive(mounted.store, { sheet: 0, row: 1, col: 4 })
  attachEvents(mounted)
  return true
}

const start = async (): Promise<void> => {
  const mine = ++token
  disposeCurrent()
  resetReadout()
  state.value = 'loading'
  failure.value = ''
  try {
    cellApi ??= await getCellApi()
    if (mine !== token) return
    state.value = 'ready'
    await nextTick()
    if (mine !== token) return
    if (!host.value) throw new Error(copy.value.noEngine)
    const mounted = await mountInstance(mine, host.value)
    if (mine !== token) return
    if (!mounted) {
      unsupported.value = true
    }
  } catch (error) {
    if (mine === token) {
      disposeCurrent()
      failure.value = String(error)
      state.value = 'error'
    }
  }
}

const reset = (): void => {
  token += 1
  disposeCurrent()
  resetReadout()
  version.value = ''
  failure.value = ''
  state.value = 'idle'
}

const onHostLocaleChange = (event: Event): void => {
  const requested = localeFromValue((event.target as HTMLSelectElement).value)
  if (!requested || !instance) return
  const mounted = localeInstance(instance)
  if (typeof mounted.setLocale !== 'function') {
    unsupported.value = true
    hostSetResult.value = 'false'
    return
  }
  try {
    const accepted = mounted.setLocale(requested)
    hostSetResult.value = String(accepted)
    if (!accepted) {
      hostLocale.value = localeFromValue(instance.locale) ?? hostLocale.value
      failure.value = copy.value.failed
    } else {
      failure.value = ''
    }
  } catch (error) {
    hostSetResult.value = 'false'
    hostLocale.value = localeFromValue(instance.locale) ?? hostLocale.value
    failure.value = String(error)
  }
}

onBeforeUnmount(() => {
  token += 1
  disposeCurrent()
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
    <p v-if="unsupported" class="demo-hint is-error" role="status" data-locale-unsupported>
      {{ copy.unsupported }}
    </p>
    <template v-else>
      <div class="locale-switch-demo__controls">
        <label class="demo-field locale-switch-demo__host-control">
          <span class="demo-label">{{ copy.hostSelect }}</span>
          <select
            class="demo-select"
            :value="hostLocale"
            :aria-label="copy.hostSelect"
            data-host-locale
            @change="onHostLocaleChange"
          >
            <option v-for="locale in LOCALES" :key="locale" :value="locale">
              {{ LOCALE_NAMES[locale] }} ({{ locale }})
            </option>
          </select>
        </label>
        <p class="demo-hint locale-switch-demo__host-hint">
          {{ copy.hostHint }} {{ copy.hostResult }}:
          <span class="is-formula" data-host-set-result>{{ hostSetResult }}</span>
        </p>
      </div>

      <p v-if="failure" class="demo-hint is-error" role="alert">{{ failure }}</p>

      <div
        ref="host"
        class="locale-switch-demo__host demo-sheet__host"
        data-locale-demo-host
      ></div>

      <p class="demo-hint" role="status">{{ copy.gridHint }}</p>

      <dl class="demo-result locale-switch-demo__readout">
        <div>
          <dt>{{ copy.currentLocale }}</dt>
          <dd class="is-formula" data-readout="locale">{{ readout.locale }}</dd>
        </div>
        <div>
          <dt>{{ copy.profile }}</dt>
          <dd class="is-formula" data-readout="profile">{{ readout.profile }}</dd>
        </div>
        <div class="is-wide">
          <dt>{{ copy.facts }}</dt>
          <dd data-readout="facts">
            {{ copy.decimal }} <code>{{ readout.decimalSeparator }}</code> ·
            {{ copy.list }} <code>{{ readout.listSeparator }}</code> ·
            {{ copy.order }} <code>{{ readout.dateOrder }}</code> ·
            {{ copy.booleans }} <code>{{ readout.trueName }}/{{ readout.falseName }}</code>
          </dd>
        </div>
        <div>
          <dt>{{ copy.values }}</dt>
          <dd data-readout="values">
            {{ copy.numeric }} <code>{{ readout.numericValue }}</code> ·
            {{ copy.date }} <code>{{ readout.dateValue }}</code> ·
            {{ copy.bool }} <code>{{ readout.boolValue }}</code> ·
            {{ copy.editable }} <code>{{ readout.editableValue }}</code> ·
            {{ copy.currency }} <code data-readout="currency">{{ readout.currencyValue }}</code>
          </dd>
        </div>
        <div class="is-wide">
          <dt>{{ copy.formula }}</dt>
          <dd data-readout="formula">
            <span>{{ copy.stored }}: </span><code>{{ readout.canonicalFormula }}</code><br />
            <span>{{ copy.localized }}: </span><code>{{ readout.localizedFormula }}</code>
          </dd>
        </div>
      </dl>
    </template>
  </DemoFrame>
</template>
