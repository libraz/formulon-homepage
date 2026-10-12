<script setup lang="ts">
// API reference rows generated from the engine declarations by
// scripts/gen-api-reference.mjs. Only the column headers are localized; the
// summaries are the API's own English doc text.
import { useData } from 'vitepress'
import { computed } from 'vue'
import reference from '@/data/api-reference.json'

interface Entry {
  name: string
  signature: string
  summary: string
  family: string
}

const props = defineProps<{
  surface: 'wasm' | 'python' | 'c'
  /** Render only this family; omit for the whole surface. */
  family?: string
}>()

const { lang } = useData()

const headers = computed(() =>
  lang.value === 'ja'
    ? { name: '名前', signature: 'シグネチャ', summary: '説明' }
    : { name: 'Name', signature: 'Signature', summary: 'Description' }
)

const rows = computed(() => {
  const all: Entry[] = reference.surfaces[props.surface] ?? []
  return props.family ? all.filter((e) => e.family === props.family) : all
})

/** Split a summary on backticks so code spans render as <code> without v-html. */
const segments = (text: string) => text.split('`').map((part, i) => ({ code: i % 2 === 1, part }))
</script>

<template>
  <div class="api-ref">
    <table>
      <colgroup>
        <col class="col-name" />
        <col class="col-signature" />
        <col class="col-summary" />
      </colgroup>
      <thead>
        <tr>
          <th>{{ headers.name }}</th>
          <th>{{ headers.signature }}</th>
          <th>{{ headers.summary }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.signature">
          <td>
            <code>{{ row.name }}</code>
          </td>
          <td>
            <code>{{ row.signature }}</code>
          </td>
          <td>
            <template v-for="(seg, i) in segments(row.summary)" :key="i">
              <code v-if="seg.code">{{ seg.part }}</code>
              <template v-else>{{ seg.part }}</template>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.api-ref {
  margin: 16px 0;
  overflow-x: auto;
}

.api-ref table {
  display: table;
  width: 100%;
  min-width: 640px;
  margin: 0;
  table-layout: fixed;
}

.col-name {
  width: 26%;
}

.col-signature {
  width: 40%;
}

.col-summary {
  width: 34%;
}

.api-ref td {
  vertical-align: top;
  font-size: 13px;
  line-height: 1.5;
}

.api-ref td code {
  overflow-wrap: anywhere;
  white-space: normal;
}
</style>
