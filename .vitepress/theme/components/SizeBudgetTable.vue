<script setup lang="ts">
// The budget table on /development/size-budgets, rendered from `@/data/facts`
// so the English and Japanese pages cannot drift apart from each other or from
// the ceilings the core repo actually enforces.
//
// The numbers come from the data; the wording stays on the page. `pattern`
// takes `{soft}` and `{hard}` placeholders so each locale keeps its own word
// order — English puts the label after the value, Japanese before it.
import { formatKiB, formatMiB, WASM_SIZE_BUDGET } from '@/data/facts'

const props = defineProps<{
  /** Column headers. */
  target: string
  budget: string
  /** Row labels. */
  uncompressed: string
  brotli: string
  /** e.g. `{soft} soft target, {hard} hard ceiling` */
  pattern: string
}>()

const fill = (soft: string, hard: string) =>
  props.pattern.replace('{soft}', soft).replace('{hard}', hard)

const rows = [
  {
    label: () => props.uncompressed,
    text: () =>
      fill(
        formatMiB(WASM_SIZE_BUDGET.uncompressed.softBytes),
        formatMiB(WASM_SIZE_BUDGET.uncompressed.hardBytes)
      )
  },
  {
    label: () => props.brotli,
    text: () =>
      fill(
        formatKiB(WASM_SIZE_BUDGET.brotli.softBytes),
        formatKiB(WASM_SIZE_BUDGET.brotli.hardBytes)
      )
  }
]
</script>

<template>
  <table>
    <thead>
      <tr>
        <th>{{ target }}</th>
        <th>{{ budget }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, i) in rows" :key="i">
        <td>{{ row.label() }}</td>
        <td>{{ row.text() }}</td>
      </tr>
    </tbody>
  </table>
</template>
