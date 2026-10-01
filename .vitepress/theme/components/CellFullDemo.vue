<script setup lang="ts">
import type { SpreadsheetInstance, WorkbookHandle } from '@libraz/formulon-cell'
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const { lang, isDark } = useData()
const isJa = computed(() => lang.value === 'ja')
const open = ref(false)
const instance = ref<SpreadsheetInstance | null>(null)
const dialogHost = ref<HTMLDialogElement | null>(null)
const windowHost = ref<HTMLDivElement | null>(null)
const failure = ref('')
const busy = ref(false)
const fullscreen = ref(false)
let token = 0
let returnFocus: HTMLElement | null = null
const sheetHost = ref<HTMLDivElement | null>(null)

let spreadsheet: SpreadsheetInstance | null = null
let cellApi: Awaited<typeof import('@libraz/formulon-cell')> | null = null

const regions = [
  ['Tokyo', 12800, 7400],
  ['Osaka', 9420, 5810],
  ['Nagoya', 7860, 4920],
  ['Yokohama', 8730, 5260],
  ['Fukuoka', 5640, 3380],
  ['Sapporo', 4220, 2710],
  ['Sendai', 3580, 2440],
  ['Hiroshima', 4910, 3070]
] as const

const lastDataRow = regions.length + 1
const totalRow = regions.length + 1
const avgRow = totalRow + 1
const marginRow = avgRow + 1
const statusRow = marginRow + 1
const totalA1 = totalRow + 1

const seedSheet = (wb: WorkbookHandle) => {
  wb.setText({ sheet: 0, row: 0, col: 0 }, 'Region')
  wb.setText({ sheet: 0, row: 0, col: 1 }, 'Revenue')
  wb.setText({ sheet: 0, row: 0, col: 2 }, 'Cost')
  wb.setText({ sheet: 0, row: 0, col: 3 }, 'Margin')

  regions.forEach(([name, revenue, cost], i) => {
    const row = i + 1
    const a1 = row + 1
    wb.setText({ sheet: 0, row, col: 0 }, name as string)
    wb.setNumber({ sheet: 0, row, col: 1 }, revenue as number)
    wb.setNumber({ sheet: 0, row, col: 2 }, cost as number)
    wb.setFormula({ sheet: 0, row, col: 3 }, `=B${a1}-C${a1}`)
  })

  wb.setText({ sheet: 0, row: totalRow, col: 0 }, 'Total')
  wb.setFormula({ sheet: 0, row: totalRow, col: 1 }, `=SUM(B2:B${lastDataRow})`)
  wb.setFormula({ sheet: 0, row: totalRow, col: 2 }, `=SUM(C2:C${lastDataRow})`)
  wb.setFormula({ sheet: 0, row: totalRow, col: 3 }, `=SUM(D2:D${lastDataRow})`)

  wb.setText({ sheet: 0, row: avgRow, col: 0 }, 'Average')
  wb.setFormula({ sheet: 0, row: avgRow, col: 1 }, `=AVERAGE(B2:B${lastDataRow})`)
  wb.setFormula({ sheet: 0, row: avgRow, col: 2 }, `=AVERAGE(C2:C${lastDataRow})`)
  wb.setFormula({ sheet: 0, row: avgRow, col: 3 }, `=AVERAGE(D2:D${lastDataRow})`)

  wb.setText({ sheet: 0, row: marginRow, col: 0 }, 'Margin %')
  wb.setFormula({ sheet: 0, row: marginRow, col: 1 }, `=TEXT(D${totalA1}/B${totalA1},"0.0%")`)

  wb.setText({ sheet: 0, row: statusRow, col: 0 }, 'Status')
  wb.setFormula({ sheet: 0, row: statusRow, col: 1 }, `=IF(D${totalA1}>30000,"On plan","Off plan")`)

  wb.recalc()
}

const copy = computed(() =>
  isJa.value
    ? {
        title: 'formulon-cell フルデモ',
        body: 'formulon-cell を埋め込んだ表計算デモです。リボン、セル編集、数式入力を試せます。',
        open: 'フルデモを開く',
        close: 'フルデモを閉じる',
        label: 'formulon-cell',
        expand: '全画面表示',
        shrink: '全画面を終了'
      }
    : {
        title: 'formulon-cell full demo',
        body: 'A spreadsheet demo embedded with formulon-cell. Try the ribbon, cell editing, and formula entry.',
        open: 'Open full demo',
        close: 'Close full demo',
        label: 'formulon-cell',
        expand: 'Enter fullscreen',
        shrink: 'Exit fullscreen'
      }
)

const openDemo = async () => {
  if (open.value) return
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  open.value = true
  await nextTick()
  if (!open.value) return
  dialogHost.value?.showModal()
  document.documentElement.classList.add('cell-demo-overlay-open')
  document.addEventListener('fullscreenchange', syncFullscreen)
  void mountDemo()
}

const toggleFullscreen = async () => {
  const surface = windowHost.value
  if (!surface) return
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await surface.requestFullscreen()
    fullscreen.value = document.fullscreenElement === surface
  } catch (error) {
    failure.value = String(error)
  }
}

const syncFullscreen = () => {
  fullscreen.value = Boolean(windowHost.value && document.fullscreenElement === windowHost.value)
}

const onDialogEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  const find = dialogHost.value?.querySelector<HTMLElement>('.fc-find')
  if (find?.getClientRects().length) {
    event.preventDefault()
    spreadsheet?.closeFindReplace()
  }
}

const closeDemo = () => {
  if (!open.value) return
  token += 1
  if (document.fullscreenElement && document.fullscreenElement === windowHost.value) {
    void document.exitFullscreen().catch(() => {})
  }
  document.removeEventListener('fullscreenchange', syncFullscreen)
  fullscreen.value = false
  dialogHost.value?.close()
  open.value = false
  spreadsheet?.dispose()
  spreadsheet = null
  instance.value = null
  document.documentElement.classList.remove('cell-demo-overlay-open')
  returnFocus?.focus()
}

const mountDemo = async () => {
  const mine = ++token
  busy.value = true
  failure.value = ''
  try {
    await nextTick()
    const sheetEl = sheetHost.value
    const root = dialogHost.value
    if (!open.value || !sheetEl || !root || mine !== token) return
    cellApi ??= await import('@libraz/formulon-cell')
    if (!open.value || mine !== token) return
    spreadsheet?.dispose()
    spreadsheet = null
    instance.value = null
    const mounted = await cellApi.Spreadsheet.mount(sheetEl, {
      ui: { profile: 'excel365', theme: isDark.value ? 'ink' : 'paper' },
      locale: isJa.value ? 'ja' : 'en',
      overlays: {
        root: () => {
          const surface = windowHost.value
          return surface && document.fullscreenElement === surface ? surface : root
        }
      },
      seed: seedSheet
    })
    if (!open.value || mine !== token) {
      mounted.dispose()
      return
    }
    mounted.on('changeBatch', () => mounted.recalc())
    spreadsheet = mounted
    instance.value = mounted
  } catch (error) {
    if (mine === token) failure.value = String(error)
  } finally {
    if (mine === token) busy.value = false
  }
}

watch(isDark, (dark) => {
  spreadsheet?.setTheme(dark ? 'ink' : 'paper')
})

watch(isJa, (ja) => {
  spreadsheet?.i18n.setLocale(ja ? 'ja' : 'en')
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  if (document.fullscreenElement && document.fullscreenElement === windowHost.value) {
    void document.exitFullscreen().catch(() => {})
  }
  token += 1
  spreadsheet?.dispose()
  document.documentElement.classList.remove('cell-demo-overlay-open')
})
</script>

<template>
  <section class="cell-full-demo" aria-labelledby="cell-full-demo-title">
    <div class="cell-full-demo__intro">
      <div>
        <span class="cell-full-demo__tag">{{ copy.label }}</span>
        <h2 id="cell-full-demo-title">{{ copy.title }}</h2>
        <p>{{ copy.body }}</p>
      </div>
      <button type="button" @click="openDemo">{{ copy.open }}</button>
    </div>

    <Teleport to="body">
      <dialog
        v-if="open"
        ref="dialogHost"
        class="cell-full-demo__overlay"
        :aria-label="copy.title"
        @click.self="closeDemo"
        @keydown.capture="onDialogEscape"
        @cancel.prevent="closeDemo"
        @close="closeDemo"
      >
        <div ref="windowHost" class="cell-full-demo__window">
          <header class="cell-full-demo__bar">
            <strong><a :href="isJa ? '/ja/cell/' : '/cell/'">{{ copy.label }}</a></strong>
            <div class="cell-full-demo__window-actions">
              <button type="button" @click="toggleFullscreen">{{ fullscreen ? copy.shrink : copy.expand }}</button>
            <button type="button" class="cell-full-demo__close" autofocus :aria-label="copy.close" @click="closeDemo">
              <span aria-hidden="true">×</span>
            </button>
            </div>
          </header>
          <ClientOnly>
            <div class="cell-full-demo__content">
              <p v-if="busy" role="status" class="cell-full-demo__notice">{{ isJa ? 'シートを読み込み中…' : 'Loading workbook…' }}</p>
              <p v-if="failure" role="alert" class="cell-full-demo__notice">{{ failure }}</p>
              <div ref="sheetHost" class="cell-full-demo__sheet"></div>
            </div>
          </ClientOnly>
        </div>
      </dialog>
    </Teleport>
  </section>
</template>
