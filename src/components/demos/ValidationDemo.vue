<script setup lang="ts">
/**
 * ValidationDemo — checking a proposed value and storing it are separate
 * workbook operations. The live engine's validateValue() is advisory; a
 * direct setNumber() still writes a value outside the rule's range.
 */
import type { Workbook } from '@libraz/formulon'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import DemoFrame from './DemoFrame.vue'
import { type Engine, formatValue, getEngine, statusText } from './engine'

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')
const ruleHintId = useId()

const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const failure = ref('')
const version = ref('')
const candidate = ref<string | number>('150')
const storedValue = ref('')
const validation = ref<{ callOk: boolean; hasRule: boolean; valid: boolean } | null>(null)
const writeOutcome = ref<{ ok: boolean; message: string } | null>(null)

let engine: Engine | null = null
let workbook: Workbook | null = null
let disposed = false

const copy = computed(() =>
  isJa.value
    ? {
        title: '入力規則の判定と値の書き込み',
        description:
          'A1 の入力規則は 0〜100 です。候補値を検査してから、規則に反する値も直接書き込み、判定と保存値の違いを確認できます。',
        candidate: '書き込む候補値',
        candidateHint: 'A1 の規則: 0 以上 100 以下の数値',
        write: '直接書き込む',
        rule: '入力規則あり',
        yes: 'あり',
        valid: '候補値の判定',
        api: '判定 API',
        stored: '現在の A1 の値',
        success: '成功',
        failed: '失敗',
        noValue: '数値を入力してください。',
        validValue: '有効',
        invalidValue: '規則外',
        pending: '未実行',
        note: 'validateValue() は候補値を検査しますが、セルには書き込みません。setNumber() は入力規則を自動適用しないため、規則外の値も保存できます。',
        error: '判定を取得できませんでした。'
      }
    : {
        title: 'Validate a value, then write it',
        description:
          'A1 has a rule allowing numbers from 0 through 100. Check a candidate, then write even an out-of-range value to see validation and stored data separately.',
        candidate: 'Candidate value',
        candidateHint: 'Rule for A1: a number from 0 through 100',
        write: 'Write directly',
        rule: 'Rule found',
        yes: 'yes',
        valid: 'Candidate check',
        api: 'Validation call',
        stored: 'Current A1 value',
        success: 'success',
        failed: 'failed',
        noValue: 'Enter a number.',
        validValue: 'valid',
        invalidValue: 'outside rule',
        pending: 'not run',
        note: 'validateValue() checks a candidate without storing it. setNumber() does not enforce the rule, so a value outside the rule can still be written.',
        error: 'Could not read the validation result.'
      }
)

const parsedCandidate = computed<number | null>(() => {
  const text =
    typeof candidate.value === 'number' ? String(candidate.value) : candidate.value.trim()
  if (!text) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
})

const readStoredValue = () => {
  if (!engine || !workbook) return ''
  const result = workbook.getValue(0, 0, 0)
  if (!result.status.ok) {
    throw new Error(
      statusText(engine, result.status) || `getValue failed: ${JSON.stringify(result.status)}`
    )
  }
  return formatValue(engine, result.value) || '0'
}

const inspectCandidate = () => {
  writeOutcome.value = null
  if (!engine || !workbook) return

  try {
    storedValue.value = readStoredValue()
    const value = parsedCandidate.value
    if (value === null) {
      validation.value = null
      return
    }

    const result = workbook.validateValue(0, 0, 0, {
      kind: engine.ValueKind.Number,
      number: value,
      boolean: 0,
      text: '',
      errorCode: 0
    })
    if (!result.status.ok) {
      throw new Error(
        statusText(engine, result.status) ||
          `validateValue failed: ${JSON.stringify(result.status)}`
      )
    }
    validation.value = {
      callOk: result.status.ok,
      hasRule: result.hasRule,
      valid: result.valid
    }
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

watch(candidate, inspectCandidate)

const writeCandidate = () => {
  if (!engine || !workbook || parsedCandidate.value === null) return
  try {
    const status = workbook.setNumber(0, 0, 0, parsedCandidate.value)
    writeOutcome.value = {
      ok: status.ok,
      message: statusText(engine, status)
    }
    storedValue.value = readStoredValue()
  } catch (error) {
    writeOutcome.value = { ok: false, message: String(error) }
  }
}

const start = async () => {
  state.value = 'loading'
  failure.value = ''
  try {
    engine = await getEngine()
    if (disposed) return
    version.value = engine.module.versionString()
    workbook?.delete()
    workbook = engine.module.Workbook.createDefault()

    const seeded = workbook.setNumber(0, 0, 0, 50)
    if (!seeded.ok) {
      throw new Error(statusText(engine, seeded) || `setNumber failed: ${JSON.stringify(seeded)}`)
    }
    const rule = workbook.addValidation(0, {
      ranges: [{ firstRow: 0, firstCol: 0, lastRow: 0, lastCol: 0 }],
      type: 2,
      op: 0,
      formula1: '0',
      formula2: '100'
    })
    if (!rule.ok) {
      throw new Error(statusText(engine, rule) || `addValidation failed: ${JSON.stringify(rule)}`)
    }

    state.value = 'ready'
    inspectCandidate()
  } catch (error) {
    failure.value = String(error)
    state.value = 'error'
  }
}

const reset = () => {
  workbook?.delete()
  workbook = null
  engine = null
  candidate.value = '150'
  storedValue.value = ''
  validation.value = null
  writeOutcome.value = null
  state.value = 'idle'
}

onBeforeUnmount(() => {
  disposed = true
  workbook?.delete()
  workbook = null
})
</script>

<template>
  <DemoFrame
    :title="copy.title"
    :description="copy.description"
    :state="state"
    :error="failure"
    :version="version"
    :reserve="330"
    @run="start"
    @reset="reset"
  >
    <div class="demo-subpanel">
      <label class="demo-field">
        <span class="demo-label">{{ copy.candidate }}</span>
        <input
          v-model="candidate"
          class="demo-input"
          data-testid="candidate"
          type="number"
          step="any"
          :aria-describedby="ruleHintId"
        />
      </label>
      <p :id="ruleHintId" class="demo-hint">
        {{ copy.candidateHint }}
      </p>
      <div class="demo-row">
        <button
          class="demo-button"
          data-testid="write-value"
          type="button"
          :disabled="parsedCandidate === null"
          @click="writeCandidate"
        >
          {{ copy.write }}
        </button>
        <span v-if="parsedCandidate === null" class="demo-hint">{{ copy.noValue }}</span>
      </div>
    </div>

    <dl class="demo-result">
      <div>
        <dt>{{ copy.api }}</dt>
        <dd data-testid="validation-call">{{ validation?.callOk ? copy.success : copy.pending }}</dd>
      </div>
      <div>
        <dt>{{ copy.rule }}</dt>
        <dd data-testid="rule-found">{{ validation?.hasRule ? copy.yes : copy.pending }}</dd>
      </div>
      <div>
        <dt>{{ copy.valid }}</dt>
        <dd
          data-testid="validation-status"
          :data-valid="validation?.valid ?? ''"
          :class="{ 'is-error': validation && !validation.valid }"
        >
          {{
            validation
              ? validation.valid
                ? copy.validValue
                : copy.invalidValue
              : copy.pending
          }}
        </dd>
      </div>
      <div>
        <dt>{{ copy.stored }}</dt>
        <dd class="is-formula" data-testid="stored-value">{{ storedValue || copy.pending }}</dd>
      </div>
    </dl>

    <p class="demo-hint">{{ copy.note }}</p>
    <p
      v-if="writeOutcome"
      class="demo-status"
      :class="{ 'is-error': !writeOutcome.ok }"
      data-testid="write-status"
    >
      {{ writeOutcome.ok ? copy.success : copy.failed }}
      <span v-if="writeOutcome.message"> — {{ writeOutcome.message }}</span>
    </p>
  </DemoFrame>
</template>
