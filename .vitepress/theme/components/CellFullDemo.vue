<script setup lang="ts">
import type { SpreadsheetInstance, WorkbookHandle } from '@libraz/formulon-cell'
import type { RibbonTab } from '@libraz/formulon-cell-vue'
import { useData } from 'vitepress'
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from 'vue'

const Spreadsheet = defineAsyncComponent(async () => {
  const mod = await import('@libraz/formulon-cell-vue')
  return mod.Spreadsheet
})

const SpreadsheetToolbar = defineAsyncComponent(async () => {
  await import('@libraz/formulon-cell-vue/toolbar.css')
  const mod = await import('@libraz/formulon-cell-vue/toolbar.vue')
  return mod.default
})

const { lang, isDark } = useData()
const isJa = computed(() => lang.value === 'ja')
const open = ref(false)
const instance = ref<SpreadsheetInstance | null>(null)
const activeTab = ref<RibbonTab>('home')

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
        title: 'Formulon UI/UX フルデモ',
        body: '同梱している formulon-cell をそのまま埋め込んでいます。これは Formulon エンジン本体の入口ではなく、ブラウザ版 Formulon を spreadsheet workflow から体験・検証するためのデモ UI/UX です。',
        open: 'フルデモを開く',
        close: 'フルデモを閉じる',
        label: 'formulon-cell'
      }
    : {
        title: 'Formulon UI/UX full demo',
        body: 'This embeds @libraz/formulon-cell directly. It is not the primary entry point for the Formulon engine; it is demo UI/UX for inspecting the browser build through spreadsheet workflows.',
        open: 'Open full demo',
        close: 'Close full demo',
        label: 'formulon-cell'
      }
)

const openDemo = () => {
  open.value = true
  document.documentElement.classList.add('cell-demo-overlay-open')
}

const closeDemo = () => {
  open.value = false
  instance.value = null
  document.documentElement.classList.remove('cell-demo-overlay-open')
}

const onReady = (inst: SpreadsheetInstance) => {
  instance.value = inst
}

const onTabChange = (tab: RibbonTab) => {
  activeTab.value = tab
}

onBeforeUnmount(() => {
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
      <div
        v-if="open"
        class="cell-full-demo__overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="copy.title"
        @click.self="closeDemo"
      >
        <div class="cell-full-demo__window">
          <header class="cell-full-demo__bar">
            <strong>{{ copy.label }}</strong>
            <button type="button" class="cell-full-demo__close" :aria-label="copy.close" @click="closeDemo">
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <ClientOnly>
            <SpreadsheetToolbar
              class="cell-full-demo__toolbar"
              :instance="instance"
              :active-tab="activeTab"
              :locale="isJa ? 'ja' : 'en'"
              @tab-change="onTabChange"
            />
            <Spreadsheet
              class="cell-full-demo__sheet"
              :theme="isDark ? 'ink' : 'paper'"
              :locale="isJa ? 'ja' : 'en'"
              :seed="seedSheet"
              @ready="onReady"
            />
          </ClientOnly>
        </div>
      </div>
    </Teleport>
  </section>
</template>
