<script setup lang="ts">
/**
 * DemoSheet — a live formulon-cell grid embedded inside a doc demo.
 *
 * Wraps the parts of a mount that every embedded sheet repeats: the dynamic
 * import (`@libraz/formulon-cell` touches `document` at module scope, so it
 * must never be evaluated during the SSR pass), disposal of the previous
 * instance when the source workbook changes, and keeping the grid in step
 * with the site's dark mode and language.
 *
 * The mount uses an embedded grid with a formula bar and no ribbon.
 * The wheel handler consumes the event, so
 * leaving it enabled would trap the reader's scroll over every embedded sheet.
 * The sheets here are sized to their content, so nothing is lost.
 */
import type { SpreadsheetInstance, WorkbookHandle } from '@libraz/formulon-cell'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getCellApi } from './engine'

const props = withDefaults(
  defineProps<{
    /** Workbook to render, as the bytes of a saved .xlsx / .xlsb. */
    bytes?: Uint8Array | null
    /** Seeds a fresh workbook instead; ignored when `bytes` is set. */
    seed?: (wb: WorkbookHandle) => void
    /** Grid height in pixels, capped against the viewport by the stylesheet. */
    height?: number
    /** Uses a viewer policy, so the reader can select but not type. */
    readOnly?: boolean
    /** Replaces the default hint when the demo has something specific to say
     *  about what the reader should do with this sheet. */
    hint?: string
  }>(),
  { bytes: null, seed: undefined, height: 300, readOnly: false, hint: undefined }
)

const emit = defineEmits<{ ready: [SpreadsheetInstance] }>()

const { lang, isDark } = useData()
const isJa = computed(() => lang.value === 'ja')

const host = ref<HTMLDivElement | null>(null)
const failure = ref('')
const busy = ref(true)
const engineVersion = ref('')

let instance: SpreadsheetInstance | null = null
let workbook: WorkbookHandle | null = null
// Mounting is async, so a second source arriving mid-flight must be able to
// abandon the first: only the newest token is allowed to publish its mount.
let token = 0

const copy = computed(() =>
  isJa.value
    ? {
        failed: 'シートを表示できませんでした。',
        engine: 'グリッドのエンジン',
        hint: 'セルを選ぶと数式バーに式が出ます。値を書き換えると、その場で参照先が再計算されます。',
        hintReadOnly: 'セルを選ぶと、数式バーにそのセルが持つ式が表示されます。'
      }
    : {
        failed: 'The sheet could not be displayed.',
        engine: 'Grid engine',
        hint: 'Select a cell to see its formula, or edit a value and watch what depends on it recalculate.',
        hintReadOnly: 'Select a cell to see the formula behind it in the formula bar.'
      }
)

const teardown = () => {
  instance?.dispose()
  instance = null
  workbook?.dispose()
  workbook = null
}

const mount = async () => {
  const mine = ++token
  teardown()
  failure.value = ''
  engineVersion.value = ''
  if (!props.bytes && !props.seed) return

  busy.value = true
  let wb: WorkbookHandle | null = null
  try {
    const cell = await getCellApi()
    wb = props.bytes
      ? await cell.WorkbookHandle.loadBytes(props.bytes)
      : await cell.WorkbookHandle.createDefault()
    if (mine !== token) {
      wb.dispose()
      return
    }
    if (!props.bytes) props.seed?.(wb)

    const el = host.value
    if (!el) {
      wb.dispose()
      return
    }
    const mounted = await cell.Spreadsheet.mount(el, {
      workbook: wb,
      ui: {
        profile: 'embedded',
        features: { formulaBar: true, clipboard: true, shortcuts: true },
        advancedFeatures: { wheel: false }
      },
      policy: props.readOnly ? cell.viewerPolicy() : undefined,
      contextMenu: props.readOnly ? { mode: 'disabled' } : undefined,
      locale: isJa.value ? 'ja' : 'en',
      theme: isDark.value ? 'ink' : 'paper'
    })
    if (mine !== token) {
      mounted.dispose()
      wb.dispose()
      return
    }
    mounted.on('changeBatch', () => mounted.recalc())
    workbook = wb
    instance = mounted
    engineVersion.value = wb.version
    busy.value = false
    emit('ready', mounted)
  } catch (error) {
    wb?.dispose()
    if (mine !== token) return
    failure.value = String(error)
    busy.value = false
  }
}

watch(() => [props.bytes, props.seed], mount, { immediate: true, flush: 'post' })

watch(
  () => props.readOnly,
  async (readOnly) => {
    const cell = await getCellApi()
    if (!instance || readOnly !== props.readOnly) return
    instance.setPolicy(readOnly ? cell.viewerPolicy() : undefined)
    instance.setContextMenu(readOnly ? { mode: 'disabled' } : undefined)
  }
)

watch(isDark, (dark) => {
  instance?.setTheme(dark ? 'ink' : 'paper')
})

watch(isJa, (ja) => {
  instance?.i18n.setLocale(ja ? 'ja' : 'en')
})

onBeforeUnmount(() => {
  token += 1
  teardown()
})
</script>

<template>
  <div class="demo-sheet">
    <p class="demo-hint">
      {{ isJa ? 'このシートの UI は' : 'Spreadsheet UI powered by' }}
      <a :href="isJa ? '/ja/cell/' : '/cell/'">formulon-cell</a>
      {{ isJa ? 'を使用しています。' : '' }}
    </p>
    <p v-if="engineVersion" class="demo-hint">{{ copy.engine }} · {{ engineVersion }}</p>
    <div
      ref="host"
      class="demo-sheet__host"
      :data-busy="busy"
      :style="{ '--demo-sheet-height': `${height}px` }"
    ></div>
    <p v-if="failure" class="demo-hint is-error">{{ copy.failed }} {{ failure }}</p>
    <p v-else class="demo-hint">{{ hint || (readOnly ? copy.hintReadOnly : copy.hint) }}</p>
  </div>
</template>
