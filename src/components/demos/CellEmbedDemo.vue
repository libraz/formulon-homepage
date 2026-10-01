<script setup lang="ts">
import type {
  MountOptions,
  SpreadsheetFeatureSwitches,
  SpreadsheetInstance,
  SpreadsheetUiOptions,
  SpreadsheetUiProfile
} from '@libraz/formulon-cell'
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  CELL_EMBED_FORM_RANGE,
  CELL_EMBED_VIEWPORT,
  type CellEmbedLocale,
  type CellEmbedScenario,
  seedCellEmbedWorkbook
} from './cellEmbedScenarios'
import DemoFrame from './DemoFrame.vue'
import { cellAddress, getCellApi } from './engine'

const props = defineProps<{ scenario: CellEmbedScenario }>()

const { lang, isDark } = useData()
const isJa = computed(() => lang.value === 'ja')

type DemoState = 'idle' | 'loading' | 'ready' | 'error'
type DemoTheme = 'paper' | 'ink' | 'contrast'
type ChromeToggle = 'formulaBar' | 'sheetTabs' | 'statusBar'

const FORM_INPUT_ADDR = { sheet: 0, row: 1, col: 1 } as const
const FORM_TOTAL_ADDR = { sheet: 0, row: 1, col: 3 } as const

const PROFILE_NAMES: SpreadsheetUiProfile[] = ['embedded', 'minimal', 'standard', 'excel365']
const THEMES: DemoTheme[] = ['paper', 'ink', 'contrast']
const LOCALES: CellEmbedLocale[] = ['en', 'ja']

const state = ref<DemoState>('idle')
const failure = ref('')
const version = ref('')
const mounting = ref(false)
const host = ref<HTMLDivElement | null>(null)
const overlayHost = ref<HTMLDivElement | null>(null)
const overlayRoot = ref<HTMLDialogElement | null>(null)
const overlayOpen = ref(false)
const mountedReady = ref(false)

const activeProfile = ref<SpreadsheetUiProfile>('embedded')
const selectedTheme = ref<DemoTheme>(isDark.value ? 'ink' : 'paper')
const selectedLocale = ref<CellEmbedLocale>(isJa.value ? 'ja' : 'en')
const chrome = reactive<Record<ChromeToggle, boolean>>({
  formulaBar: true,
  sheetTabs: false,
  statusBar: false
})

const selection = ref('A1')
const formFeedback = ref('')
const formReadout = ref({ input: '2', total: '240', rejected: '' })
const syncResult = ref<SyncResult | null>(null)
const eventLog = ref<string[]>([])
const overlayFeedback = ref('')
const uiLabels = ref({ copy: '', paste: '', find: '' })

interface SyncResult {
  status: string
  applied: string
  rejected: string
}

let cellApi: Awaited<ReturnType<typeof getCellApi>> | null = null
let instance: SpreadsheetInstance | null = null
let stops: Array<() => void> = []
let token = 0

const copy = computed(() => {
  const ja = isJa.value
  const shared = ja
    ? {
        mounting: '埋め込みシートを準備中…',
        selection: '選択',
        selected: '現在の選択',
        sheetHint: 'セルを選ぶと選択範囲をホスト側の表示へ反映します。',
        resetHint: '変更はこのページ内で処理されます。',
        profile: 'UI プロファイル',
        chrome: '表示するコントロール',
        formulaBar: '数式バー',
        sheetTabs: 'シートタブ',
        statusBar: 'ステータスバー',
        profileHint: 'プロファイルを切り替えても同じワークブックを使い続けます。',
        hostUpdate: 'ホストから反映',
        hostOneCell: '1 セルを更新',
        hostStatus: 'applyChanges() の結果',
        events: 'イベントインスペクター',
        noEvents: 'まだイベントはありません。',
        eventSelection: 'selectionChange',
        eventCell: 'cellChange',
        eventBatch: 'changeBatch',
        formHint:
          'B2:C4 を編集できます。D 列は数式のまま計算されます。Tab は入力セルだけを移動します。',
        formEditable: '編集可能: B2:C4',
        formCalculated: '計算列: D2:D4',
        formApplied: (address: string) => `${address} を更新しました。D 列を再計算しました。`,
        formTryCalculated: 'D2 を編集して拒否を確認',
        formResult: 'D2 の計算結果',
        formRejected: (code: string) => `D2 は拒否されました (${code})`,
        policy: 'ポリシー',
        viewport: 'viewport',
        theme: 'テーマ',
        locale: 'ロケール',
        themeHint: 'setTheme() と i18n.setLocale() がマウント済みの UI に反映されます。',
        labels: '現在の UI 辞書',
        openSheet: 'シートを開く',
        closeSheet: '閉じる',
        format: '書式設定を開く',
        find: '検索を開く',
        overlayHint:
          'ホスト側のボタンから開く組み込みダイアログを、同じ native dialog の中に配置します。',
        actionOpened: (label: string) => `${label} を開きました。`,
        actionFailed: 'ダイアログを開けませんでした。'
      }
    : {
        mounting: 'Preparing the embedded sheet…',
        selection: 'Selection',
        selected: 'Current selection',
        sheetHint: 'Select a cell and the host readout follows the live selection.',
        resetHint: 'Changes stay in this page and are processed in the browser.',
        profile: 'UI profile',
        chrome: 'Visible chrome',
        formulaBar: 'Formula bar',
        sheetTabs: 'Sheet tabs',
        statusBar: 'Status bar',
        profileHint: 'The profile changes around the same live workbook.',
        hostUpdate: 'Apply host snapshot',
        hostOneCell: 'Update one cell',
        hostStatus: 'applyChanges() result',
        events: 'Event inspector',
        noEvents: 'No events yet.',
        eventSelection: 'selectionChange',
        eventCell: 'cellChange',
        eventBatch: 'changeBatch',
        formHint:
          'Edit B2:C4. Column D stays formula-driven. Tab moves only through the input cells.',
        formEditable: 'Editable: B2:C4',
        formCalculated: 'Calculated: D2:D4',
        formApplied: (address: string) => `${address} changed. Column D recalculated.`,
        formTryCalculated: 'Try editing D2 (should reject)',
        formResult: 'D2 calculated result',
        formRejected: (code: string) => `D2 rejected (${code})`,
        policy: 'Policy',
        viewport: 'Viewport',
        theme: 'Theme',
        locale: 'Locale',
        themeHint: 'setTheme() and i18n.setLocale() update the mounted UI.',
        labels: 'Resolved UI labels',
        openSheet: 'Open sheet',
        closeSheet: 'Close',
        format: 'Open format dialog',
        find: 'Open find',
        overlayHint: 'Host buttons open built-in dialogs inside the same native dialog boundary.',
        actionOpened: (label: string) => `${label} opened.`,
        actionFailed: 'The dialog could not be opened.'
      }

  const scenarioCopy: Record<CellEmbedScenario, { title: string; description: string }> = ja
    ? {
        viewer: {
          title: '読み取り専用のレポートビューア',
          description: '表示範囲を固定し、選択とコピーだけを許可した埋め込みです。'
        },
        form: {
          title: '入力セルを限定したフォーム',
          description:
            'B2:C4 だけを編集できるフォームです。D 列の合計は実際の数式で再計算されます。'
        },
        profiles: {
          title: 'UI プロファイルと表示の切り替え',
          description: '同じワークブックを再マウントせず、setUi() で表示密度と周辺 UI を変えます。'
        },
        'host-sync': {
          title: 'ホスト更新とイベント',
          description:
            'ホストの信頼済み更新を applyChanges() で反映し、選択と変更イベントを読み取ります。'
        },
        'theme-locale': {
          title: 'テーマとロケールの実行時切り替え',
          description: 'マウント済みのシートへテーマと UI 辞書を切り替えます。'
        },
        overlay: {
          title: 'native dialog 内のオーバーレイ',
          description: 'native dialog を表示境界にして、シートと浮動 UI を同じ領域に収めます。'
        }
      }
    : {
        viewer: {
          title: 'Read-only report viewer',
          description:
            'A bounded report embed that allows selection and copying while blocking edits.'
        },
        form: {
          title: 'Fixed-input form',
          description:
            'Only B2:C4 accepts edits. The totals in column D are real formulas and recalculate live.'
        },
        profiles: {
          title: 'UI profiles and chrome switches',
          description:
            'Change the surface around the same workbook at runtime with setUi(), without a remount.'
        },
        'host-sync': {
          title: 'Host updates and events',
          description:
            'Apply a trusted host snapshot and inspect selection and change events from the live instance.'
        },
        'theme-locale': {
          title: 'Switch theme and locale at runtime',
          description: 'Change the mounted sheet’s theme and UI dictionary while it stays in place.'
        },
        overlay: {
          title: 'Overlays inside a native dialog',
          description:
            'A native dialog owns the presentation boundary for the sheet and its floating UI.'
        }
      }

  return { ...shared, ...scenarioCopy[props.scenario] }
})

const activeScenario = computed(() => props.scenario)
const controlReady = computed(() => mountedReady.value && instance !== null)

const selectionLabel = (event: {
  active: { row: number; col: number }
  range: { r0: number; c0: number; r1: number; c1: number }
}): string => {
  const first = cellAddress(event.range.r0, event.range.c0)
  const last = cellAddress(event.range.r1, event.range.c1)
  return first === last ? first : `${first}:${last}`
}

const addressLabel = (addr: { row: number; col: number }): string => cellAddress(addr.row, addr.col)

const cellValueLabel = (addr: {
  readonly sheet: number
  readonly row: number
  readonly col: number
}): string => {
  const value = instance?.workbook.getValue(addr)
  if (!value || value.kind === 'blank') return '—'
  if (value.kind === 'error') return value.text
  return String(value.value)
}

const readFormValues = (): void => {
  if (!instance) return
  formReadout.value = {
    ...formReadout.value,
    input: cellValueLabel(FORM_INPUT_ADDR),
    total: cellValueLabel(FORM_TOTAL_ADDR)
  }
}

const pushEvent = (message: string): void => {
  eventLog.value = [message, ...eventLog.value].slice(0, 6)
}

const readUiLabels = (): void => {
  if (!instance) return
  const strings = instance.i18n.strings
  uiLabels.value = {
    copy: strings.contextMenu.copy,
    paste: strings.contextMenu.paste,
    find: strings.findReplace.findLabel
  }
}

const clearSubscriptions = (): void => {
  for (const stop of stops) stop()
  stops = []
}

const disposeCurrent = (): void => {
  clearSubscriptions()
  instance?.dispose()
  instance = null
  mountedReady.value = false
}

const resetReadouts = (): void => {
  selection.value = 'A1'
  formFeedback.value = ''
  formReadout.value = { input: '2', total: '240', rejected: '' }
  syncResult.value = null
  eventLog.value = []
  overlayFeedback.value = ''
  uiLabels.value = { copy: '', paste: '', find: '' }
  activeProfile.value = 'embedded'
  selectedTheme.value = isDark.value ? 'ink' : 'paper'
  selectedLocale.value = isJa.value ? 'ja' : 'en'
  chrome.formulaBar = true
  chrome.sheetTabs = false
  chrome.statusBar = false
}

const profileFeatures = (): SpreadsheetFeatureSwitches => ({
  formulaBar: chrome.formulaBar,
  sheetTabs: chrome.sheetTabs,
  statusBar: chrome.statusBar,
  clipboard: true,
  shortcuts: true
})

const uiForScenario = (): SpreadsheetUiOptions => {
  if (activeScenario.value === 'profiles') {
    return {
      profile: activeProfile.value,
      theme: selectedTheme.value,
      features: profileFeatures(),
      advancedFeatures: { wheel: false }
    }
  }

  const features: SpreadsheetFeatureSwitches = {
    formulaBar: true,
    clipboard: true,
    shortcuts: true
  }
  if (activeScenario.value === 'overlay' || activeScenario.value === 'theme-locale') {
    features.formatDialog = true
    features.findReplace = true
  }
  if (activeScenario.value === 'theme-locale') {
    features.contextMenu = true
  }
  return {
    profile: 'embedded',
    theme: selectedTheme.value,
    features,
    advancedFeatures: { wheel: false }
  }
}

const mountOptions = (api: Awaited<ReturnType<typeof getCellApi>>): MountOptions => {
  const options: MountOptions = {
    ui: uiForScenario(),
    locale: selectedLocale.value,
    seed: (wb) => seedCellEmbedWorkbook(wb, activeScenario.value, selectedLocale.value),
    viewport: {
      range: CELL_EMBED_VIEWPORT,
      tabBoundary: 'stop',
      tabNavigation: activeScenario.value === 'form' ? 'editable' : 'normal'
    },
    contextMenu:
      activeScenario.value === 'theme-locale' ? { mode: 'builtIn' } : { mode: 'disabled' }
  }

  if (activeScenario.value === 'viewer') options.policy = api.viewerPolicy()
  if (activeScenario.value === 'form') options.policy = api.fixedFormPolicy([CELL_EMBED_FORM_RANGE])
  if (activeScenario.value === 'overlay') {
    const root = overlayRoot.value
    if (!root) throw new Error('The native dialog is not available.')
    options.overlays = { root }
  }
  return options
}

const attachEvents = (mounted: SpreadsheetInstance): void => {
  clearSubscriptions()
  stops.push(
    mounted.on('selectionChange', (event) => {
      selection.value = selectionLabel(event)
      if (activeScenario.value === 'host-sync') {
        pushEvent(`${copy.value.eventSelection}: ${selection.value}`)
      }
    })
  )
  stops.push(
    mounted.on('cellChange', (event) => {
      const address = addressLabel(event.addr)
      if (activeScenario.value === 'form') {
        formFeedback.value = copy.value.formApplied(address)
        readFormValues()
      }
      if (activeScenario.value === 'host-sync') {
        pushEvent(`${copy.value.eventCell}: ${address}`)
      }
    })
  )
  stops.push(
    mounted.on('changeBatch', (event) => {
      mounted.recalc()
      if (activeScenario.value === 'form') readFormValues()
      if (activeScenario.value === 'host-sync') {
        pushEvent(`${copy.value.eventBatch}: ${event.status}`)
      }
    })
  )
  stops.push(
    mounted.on('localeChange', () => {
      readUiLabels()
    })
  )
  readUiLabels()
}

const verifyFormPolicy = (): void => {
  if (!instance) return
  const result = instance.commands.execute({
    type: 'cellBatch',
    operation: 'valueEdit',
    origin: 'instanceApi',
    changes: [{ addr: FORM_TOTAL_ADDR, input: '999' }]
  })
  const code = result.rejected[0]?.code ?? result.status
  formReadout.value = { ...formReadout.value, rejected: copy.value.formRejected(code) }
}

const showOverlay = async (): Promise<void> => {
  const dialog = overlayRoot.value
  if (!dialog) return
  try {
    if (!dialog.open) dialog.showModal()
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
    return
  }
  overlayOpen.value = true

  if (instance || mounting.value || !cellApi) return
  const mine = token
  const target = overlayHost.value
  if (!target) return
  try {
    await mountInstance(mine, target)
  } catch (error) {
    if (mine !== token) return
    failure.value = String(error)
    state.value = 'error'
    closeOverlay()
  }
}

const onOverlayEscape = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape' || !instance) return
  const find = overlayRoot.value?.querySelector<HTMLElement>('.fc-find')
  if (find?.getClientRects().length) {
    event.preventDefault()
    instance.closeFindReplace()
  }
}

const closeOverlay = (): void => {
  const dialog = overlayRoot.value
  if (dialog?.open) dialog.close()
  overlayOpen.value = false
}

const mountInstance = async (mine: number, target: HTMLDivElement): Promise<void> => {
  if (!cellApi || mine !== token) return
  mounting.value = true
  try {
    const mounted = await cellApi.Spreadsheet.mount(target, mountOptions(cellApi))
    if (mine !== token) {
      mounted.dispose()
      return
    }
    instance = mounted
    mountedReady.value = true
    version.value = mounted.workbook.version
    attachEvents(mounted)
    if (activeScenario.value === 'form') {
      cellApi.mutators.setActive(mounted.store, FORM_INPUT_ADDR)
      selection.value = 'B2'
      readFormValues()
    }
    if (activeScenario.value === 'host-sync') pushEvent('mount ready')
  } finally {
    if (mine === token) mounting.value = false
  }
}

const start = async (): Promise<void> => {
  const mine = ++token
  disposeCurrent()
  resetReadouts()
  state.value = 'loading'
  failure.value = ''
  mounting.value = activeScenario.value !== 'overlay'

  try {
    cellApi ??= await getCellApi()
    if (mine !== token) return

    state.value = 'ready'
    await nextTick()
    if (mine !== token) return
    if (activeScenario.value === 'overlay') {
      mounting.value = false
      return
    }
    const target = host.value
    if (!target) throw new Error('The spreadsheet host is not available.')
    await mountInstance(mine, target)
  } catch (error) {
    if (mine === token) {
      failure.value = String(error)
      state.value = 'error'
    }
  } finally {
    if (mine === token) mounting.value = false
  }
}

const reset = (): void => {
  token += 1
  disposeCurrent()
  closeOverlay()
  resetReadouts()
  version.value = ''
  state.value = 'idle'
  mounting.value = false
}

const setProfile = (profile: SpreadsheetUiProfile): void => {
  activeProfile.value = profile
  if (!instance) return
  instance.setUi({
    profile,
    theme: selectedTheme.value,
    features: profileFeatures(),
    advancedFeatures: { wheel: false }
  })
}

const toggleChrome = (key: ChromeToggle): void => {
  chrome[key] = !chrome[key]
  if (!instance) return
  instance.setUi({
    profile: activeProfile.value,
    theme: selectedTheme.value,
    features: profileFeatures(),
    advancedFeatures: { wheel: false }
  })
}

const applyHostSnapshot = (): void => {
  if (!instance) return
  const result = instance.applyChanges(
    [
      { addr: { sheet: 0, row: 1, col: 1 }, input: '58' },
      { addr: { sheet: 0, row: 1, col: 2 }, input: '1500' }
    ],
    { history: 'record', origin: 'host-refresh' }
  )
  syncResult.value = {
    status: result.status,
    applied: result.applied.map(addressLabel).join(', ') || '—',
    rejected:
      result.rejected
        .map((entry) => (entry.addr ? addressLabel(entry.addr) : entry.code))
        .join(', ') || '—'
  }
}

const applyOneHostCell = (): void => {
  if (!instance) return
  const result = instance.applyChanges([{ addr: { sheet: 0, row: 2, col: 1 }, input: '37' }], {
    history: 'record',
    origin: 'host-edit'
  })
  syncResult.value = {
    status: result.status,
    applied: result.applied.map(addressLabel).join(', ') || '—',
    rejected:
      result.rejected
        .map((entry) => (entry.addr ? addressLabel(entry.addr) : entry.code))
        .join(', ') || '—'
  }
}

const changeTheme = (theme: DemoTheme): void => {
  selectedTheme.value = theme
  instance?.setTheme(theme)
}

const changeLocale = (locale: CellEmbedLocale): void => {
  selectedLocale.value = locale
  instance?.i18n.setLocale(locale)
}

const openOverlayAction = (kind: 'format' | 'find'): void => {
  if (!instance) return
  try {
    if (kind === 'format') {
      instance.openFormatDialog('number')
      overlayFeedback.value = copy.value.actionOpened(copy.value.format)
    } else {
      instance.openFindReplace('find')
      overlayFeedback.value = copy.value.actionOpened(copy.value.find)
    }
  } catch {
    overlayFeedback.value = copy.value.actionFailed
  }
}

watch(isDark, (dark) => {
  if (activeScenario.value === 'theme-locale') return
  const theme: DemoTheme = dark ? 'ink' : 'paper'
  selectedTheme.value = theme
  instance?.setTheme(theme)
})

watch(isJa, (ja) => {
  if (activeScenario.value === 'theme-locale') return
  const locale: CellEmbedLocale = ja ? 'ja' : 'en'
  selectedLocale.value = locale
  instance?.i18n.setLocale(locale)
})

onBeforeUnmount(() => {
  token += 1
  disposeCurrent()
  closeOverlay()
})
</script>

<template>
  <DemoFrame
    :title="copy.title"
    :description="copy.description"
    :state="state"
    :error="failure"
    :version="version"
    :reserve="activeScenario === 'overlay' ? 0 : activeScenario === 'profiles' ? 500 : 300"
    :style="{ '--cell-embed-height': activeScenario === 'profiles' ? '400px' : '190px' }"
    :resettable="activeScenario !== 'overlay'"
    @run="start"
    @reset="reset"
  >
    <p v-if="mounting" class="demo-hint" role="status">{{ copy.mounting }}</p>

    <div
      v-if="activeScenario !== 'overlay'"
      ref="host"
      class="cell-embed-demo__host"
      :data-busy="mounting"
    ></div>

    <template v-else>
      <p v-if="!overlayOpen" class="demo-row">
        <button type="button" class="demo-button" @click="showOverlay">{{ copy.openSheet }}</button>
      </p>
      <dialog
        ref="overlayRoot"
        class="cell-embed-demo__dialog"
        :aria-label="copy.title"
        @keydown.capture="onOverlayEscape"
        @cancel.prevent="closeOverlay"
        @close="overlayOpen = false"
        @click.self="closeOverlay"
      >
        <div class="cell-embed-demo__dialog-inner">
          <header class="cell-embed-demo__dialog-head">
            <strong>{{ copy.title }}</strong>
            <button type="button" class="demo-button demo-button--ghost" @click="closeOverlay">
              {{ copy.closeSheet }}
            </button>
          </header>
          <div ref="overlayHost" class="cell-embed-demo__host" :data-busy="mounting"></div>
          <div class="demo-row cell-embed-demo__dialog-actions">
            <button type="button" class="demo-button" :disabled="!controlReady" @click="openOverlayAction('format')">
              {{ copy.format }}
            </button>
            <button type="button" class="demo-button demo-button--ghost" :disabled="!controlReady" @click="openOverlayAction('find')">
              {{ copy.find }}
            </button>
          </div>
          <p v-if="overlayFeedback" class="demo-hint" role="status">{{ overlayFeedback }}</p>
        </div>
      </dialog>

    </template>

    <template v-if="activeScenario === 'viewer'">
      <p class="demo-hint">{{ copy.sheetHint }}</p>
      <dl class="demo-result">
        <div>
          <dt>{{ copy.policy }}</dt>
          <dd class="is-formula">viewerPolicy()</dd>
        </div>
        <div>
          <dt>{{ copy.viewport }}</dt>
          <dd class="is-formula">A1:D6</dd>
        </div>
        <div>
          <dt>{{ copy.selected }}</dt>
          <dd>{{ selection }}</dd>
        </div>
      </dl>
    </template>

    <template v-else-if="activeScenario === 'form'">
      <p class="demo-hint">{{ copy.formHint }}</p>
      <div class="demo-row">
        <span class="demo-chip is-active">{{ copy.formEditable }}</span>
        <span class="demo-chip">{{ copy.formCalculated }}</span>
        <button type="button" class="demo-button demo-button--ghost" :disabled="!controlReady" @click="verifyFormPolicy">
          {{ copy.formTryCalculated }}
        </button>
      </div>
      <p v-if="formFeedback" class="demo-hint" role="status">{{ formFeedback }}</p>
      <dl class="demo-result">
        <div>
          <dt>{{ copy.policy }}</dt>
          <dd class="is-formula">fixedFormPolicy(B2:C4)</dd>
        </div>
        <div>
          <dt>{{ copy.selected }}</dt>
          <dd>{{ selection }}</dd>
        </div>
        <div>
          <dt>{{ copy.formResult }}</dt>
          <dd class="is-formula">B2={{ formReadout.input }} · D2={{ formReadout.total }}</dd>
        </div>
        <div v-if="formReadout.rejected">
          <dt>{{ copy.formCalculated }}</dt>
          <dd class="is-formula">{{ formReadout.rejected }}</dd>
        </div>
      </dl>
    </template>

    <template v-else-if="activeScenario === 'profiles'">
      <div class="cell-embed-demo__control-block">
        <span class="demo-label">{{ copy.profile }}</span>
        <div class="demo-segment" role="tablist">
          <button
            v-for="profile in PROFILE_NAMES"
            :key="profile"
            type="button"
            role="tab"
            class="demo-segment__item"
            :class="{ 'is-active': profile === activeProfile }"
            :aria-selected="profile === activeProfile"
            @click="setProfile(profile)"
          >
            {{ profile }}
          </button>
        </div>
      </div>
      <div class="cell-embed-demo__control-block">
        <span class="demo-label">{{ copy.chrome }}</span>
        <div class="demo-row">
          <button
            type="button"
            class="demo-chip"
            :class="{ 'is-active': chrome.formulaBar }"
            :aria-pressed="chrome.formulaBar"
            @click="toggleChrome('formulaBar')"
          >
            {{ copy.formulaBar }}
          </button>
          <button
            type="button"
            class="demo-chip"
            :class="{ 'is-active': chrome.sheetTabs }"
            :aria-pressed="chrome.sheetTabs"
            @click="toggleChrome('sheetTabs')"
          >
            {{ copy.sheetTabs }}
          </button>
          <button
            type="button"
            class="demo-chip"
            :class="{ 'is-active': chrome.statusBar }"
            :aria-pressed="chrome.statusBar"
            @click="toggleChrome('statusBar')"
          >
            {{ copy.statusBar }}
          </button>
        </div>
      </div>
      <p class="demo-hint">{{ copy.profileHint }}</p>
    </template>

    <template v-else-if="activeScenario === 'host-sync'">
      <div class="demo-row">
        <button type="button" class="demo-button" :disabled="!controlReady" @click="applyHostSnapshot">
          {{ copy.hostUpdate }}
        </button>
        <button type="button" class="demo-button demo-button--ghost" :disabled="!controlReady" @click="applyOneHostCell">
          {{ copy.hostOneCell }}
        </button>
      </div>
      <div class="demo-split">
        <div class="demo-subpanel">
          <span class="demo-label">{{ copy.hostStatus }}</span>
          <dl v-if="syncResult" class="demo-result">
            <div>
              <dt>Status</dt>
              <dd class="is-formula">{{ syncResult.status }}</dd>
            </div>
            <div>
              <dt>Applied</dt>
              <dd class="is-formula">{{ syncResult.applied }}</dd>
            </div>
            <div>
              <dt>Rejected</dt>
              <dd class="is-formula">{{ syncResult.rejected }}</dd>
            </div>
          </dl>
          <p v-else class="demo-hint">{{ copy.resetHint }}</p>
        </div>
        <div class="demo-subpanel">
          <span class="demo-label">{{ copy.events }}</span>
          <p class="demo-hint">{{ copy.selected }}: <span class="is-formula">{{ selection }}</span></p>
          <ul v-if="eventLog.length" class="cell-embed-demo__events">
            <li v-for="(event, index) in eventLog" :key="`${event}-${index}`" class="is-formula">{{ event }}</li>
          </ul>
          <p v-else class="demo-hint">{{ copy.noEvents }}</p>
        </div>
      </div>
    </template>

    <template v-else-if="activeScenario === 'theme-locale'">
      <div class="cell-embed-demo__control-block">
        <span class="demo-label">{{ copy.theme }}</span>
        <div class="demo-segment" role="tablist">
          <button
            v-for="theme in THEMES"
            :key="theme"
            type="button"
            role="tab"
            class="demo-segment__item"
            :class="{ 'is-active': theme === selectedTheme }"
            :aria-selected="theme === selectedTheme"
            @click="changeTheme(theme)"
          >
            {{ theme }}
          </button>
        </div>
      </div>
      <div class="cell-embed-demo__control-block">
        <span class="demo-label">{{ copy.locale }}</span>
        <div class="demo-segment demo-segment--inline" role="tablist">
          <button
            v-for="locale in LOCALES"
            :key="locale"
            type="button"
            role="tab"
            class="demo-segment__item"
            :class="{ 'is-active': locale === selectedLocale }"
            :aria-selected="locale === selectedLocale"
            @click="changeLocale(locale)"
          >
            {{ locale }}
          </button>
        </div>
      </div>
      <div class="demo-row">
        <button
          type="button"
          class="demo-button demo-button--ghost"
          :disabled="!controlReady"
          @click="openOverlayAction('format')"
        >
          {{ copy.format }}
        </button>
        <button
          type="button"
          class="demo-button demo-button--ghost"
          :disabled="!controlReady"
          @click="openOverlayAction('find')"
        >
          {{ copy.find }}
        </button>
      </div>
      <p v-if="overlayFeedback" class="demo-hint" role="status">{{ overlayFeedback }}</p>
      <dl class="demo-result">
        <div>
          <dt>{{ copy.labels }}</dt>
          <dd class="is-formula">{{ uiLabels.copy }} · {{ uiLabels.paste }} · {{ uiLabels.find }}</dd>
        </div>
      </dl>
      <p class="demo-hint">{{ copy.themeHint }}</p>
    </template>
  </DemoFrame>
</template>
