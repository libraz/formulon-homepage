<script setup lang="ts">
/**
 * CompatCasesDemo — one group of Excel-behaviour probes, run live.
 *
 * Each row shows the value captured from Excel, the answer a straightforward
 * implementation tends to give, and what the engine in this page returns
 * when the same formula runs under the same profile. The match column is
 * computed, not asserted, so a reader can see the comparison happen.
 */
import { useData } from 'vitepress'
import { computed, ref } from 'vue'
import { COMPAT_CASES, type CompatGroup, matchesExcel, runCase } from './compatCases'
import DemoFrame from './DemoFrame.vue'
import { getEngine } from './engine'

const props = defineProps<{ group: CompatGroup }>()

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

const cases = computed(() => COMPAT_CASES[props.group])

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const results = ref<string[]>([])

const copy = computed(() =>
  isJa.value
    ? {
        title: 'Excel の実測値と照合する',
        description:
          'Excel の列は実機で取得した値です。Formulon の列は、このページの WASM エンジンが同じ数式を同じプロファイルで計算した結果です。',
        formula: '数式',
        profile: 'プロファイル',
        plausible: 'ありがちな答え',
        excel: 'Excel',
        formulon: 'Formulon',
        seed: 'セル',
        match: '一致',
        mismatch: '不一致'
      }
    : {
        title: 'Checked against Excel',
        description:
          'The Excel column was captured from a real Excel build. The Formulon column is what the WASM engine in this page returns for the same formula under the same profile.',
        formula: 'Formula',
        profile: 'Profile',
        plausible: 'Plausible answer',
        excel: 'Excel',
        formulon: 'Formulon',
        seed: 'Cells',
        match: 'match',
        mismatch: 'mismatch'
      }
)

const showProfile = computed(() => new Set(cases.value.map((c) => c.profile)).size > 1)

const seedText = (index: number) =>
  (cases.value[index].cells ?? [])
    .map(([address, input]) => `${address}: ${input === '' ? '""(text)' : input}`)
    .join(', ')

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    const engine = await getEngine()
    version.value = engine.module.versionString()
    results.value = cases.value.map((probe) => runCase(engine, probe))
    state.value = 'ready'
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

const reset = () => {
  results.value = []
  state.value = 'idle'
}
</script>

<template>
  <DemoFrame
    :title="copy.title"
    :description="copy.description"
    :state="state"
    :error="failure"
    :version="version"
    :reserve="120 + cases.length * 34"
    @run="start"
    @reset="reset"
  >
    <table class="demo-grid demo-grid--list compat-cases">
      <thead>
        <tr>
          <th>{{ copy.formula }}</th>
          <th v-if="showProfile">{{ copy.profile }}</th>
          <th>{{ copy.plausible }}</th>
          <th>{{ copy.excel }}</th>
          <th>{{ copy.formulon }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(probe, i) in cases" :key="`${probe.profile}:${probe.formula}`">
          <td>
            <code class="compat-cases__formula">{{ probe.formula }}</code>
            <span v-if="probe.cells" class="compat-cases__seed">{{ copy.seed }} — {{ seedText(i) }}</span>
          </td>
          <td v-if="showProfile">{{ probe.profile }}</td>
          <td :class="{ 'compat-cases__plausible': probe.plausible }">{{ probe.plausible ?? '—' }}</td>
          <td>{{ probe.excel }}</td>
          <td
            :class="matchesExcel(results[i] ?? '', probe.excel) ? 'compat-cases__ok' : 'is-error'"
            :aria-label="matchesExcel(results[i] ?? '', probe.excel) ? copy.match : copy.mismatch"
          >
            {{ results[i] }}
            <span aria-hidden="true">{{ matchesExcel(results[i] ?? '', probe.excel) ? '✓' : '✗' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </DemoFrame>
</template>

<style scoped>
/* Values must never break mid-number, so only the formula column wraps. */
.demo-grid.compat-cases :is(th, td) {
  padding: 0.25rem 0.4rem;
  font-size: 0.8rem;
  white-space: nowrap;
}

/* The floor keeps short formulas whole; on a narrow screen the grid scrolls. */
.demo-grid.compat-cases td:first-child {
  min-width: 16ch;
  white-space: normal;
  overflow-wrap: anywhere;
}

/* Inline code is nowrap site-wide; a long formula must wrap inside its cell. */
.compat-cases__formula {
  font-size: inherit;
  white-space: normal;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.compat-cases__seed {
  display: block;
  word-break: normal;
  margin-top: 0.15rem;
  color: var(--color-text-tertiary);
  font-size: 0.85em;
}

.compat-cases__plausible {
  color: var(--color-text-tertiary);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--cb-danger) 55%, transparent);
}

.compat-cases__ok {
  color: var(--cb-info);
}
</style>
