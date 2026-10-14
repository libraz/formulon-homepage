<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import {
  type ActiveSignature,
  type FormulaCatalog,
  type FunctionSuggestion,
  fallbackCatalog,
  findActiveSignature,
  loadFormulaCatalog,
  suggestFunctions
} from './formulaCatalog'
import {
  type FormulaLocale,
  localizedDescription,
  parameterHelp,
  parseParameter,
  SYNTAX_TIPS,
  variadicParameterHelp
} from './formulaHelp'

interface Props {
  modelValue: string
  label: string
  actionLabel: string
  placeholder?: string
  contextHint?: string
  functionName?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  contextHint: '',
  functionName: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()

const { lang } = useData()
const locale = computed<FormulaLocale>(() =>
  String(lang.value).toLowerCase().startsWith('ja') ? 'ja' : 'en'
)
const idSeed = useId().replace(/[^a-zA-Z0-9_-]/g, '')
const inputId = `formula-input-${idSeed}`
const hintId = `${inputId}-hint`
const guideId = `${inputId}-guide`
const suggestionsId = `${inputId}-suggestions`

const inputRef = ref<HTMLInputElement | null>(null)
const caret = ref(0)
const activeSuggestion = ref(0)
const dismissed = ref(false)
const focused = ref(false)
const catalog = ref<FormulaCatalog>(fallbackCatalog)
const catalogState = ref<'loading' | 'ready' | 'error'>('loading')
const catalogError = ref('')
const catalogWarning = ref('')
let alive = true
let blurTimer: number | undefined

const copy = computed(() =>
  locale.value === 'ja'
    ? {
        guide: '引数ガイド',
        active: '入力中の引数',
        required: '必須',
        optional: '省略可',
        repeat: '追加可',
        example: '例',
        details: '引数をすべて表示',
        syntax: '構文のヒント',
        catalogWarning: '関数の詳しい説明を読み込めなかったため、引数の数だけ表示しています。',
        catalogError: '関数一覧を読み込めませんでした。入力と評価はそのまま使えます。',
        retry: '再試行',
        suggestions: '関数候補',
        noArguments: 'この関数には引数を指定しません。',
        noArgument: 'カーソルを関数の括弧内に置くと、入力中の引数を案内します。',
        extra: 'シグネチャにない追加の引数です。関数の引数数を確認してください。',
        unknown: 'この関数の公開済みシグネチャはありません。エンジンの引数数を表示しています。'
      }
    : {
        guide: 'Argument guide',
        active: 'Current argument',
        required: 'required',
        optional: 'optional',
        repeat: 'repeatable',
        example: 'Example',
        details: 'Show all arguments',
        syntax: 'Syntax tips',
        catalogWarning: 'Detailed help is unavailable, so the guide is using engine arity only.',
        catalogError:
          'The function list could not be loaded. Input and evaluation remain available.',
        retry: 'Retry',
        suggestions: 'Function suggestions',
        noArguments: 'This function takes no arguments.',
        noArgument: 'Place the caret inside a function call to see the current argument.',
        extra: 'This is an extra argument beyond the published signature.',
        unknown: 'No published signature is available; the guide shows numbered engine arguments.'
      }
)

const clampCaret = (value: number, text = props.modelValue): number =>
  Math.max(0, Math.min(Number.isFinite(value) ? value : text.length, text.length))

const syncCaret = () => {
  const node = inputRef.value
  if (node) caret.value = clampCaret(node.selectionStart ?? node.value.length)
}

const names = computed(() => catalog.value.names)
const signatures = computed(() => catalog.value.signatures)
const suggestion = computed<FunctionSuggestion | null>(() => {
  if (!focused.value || dismissed.value) return null
  return suggestFunctions(props.modelValue, clampCaret(caret.value), 8, { names: names.value })
})
const suggestionMatches = computed(() => suggestion.value?.matches ?? [])
const hasSuggestions = computed(() => suggestionMatches.value.length > 0)
const activeSuggestionName = computed(() => suggestionMatches.value[activeSuggestion.value] ?? '')
const suggestionDescription = (name: string): string =>
  localizedDescription(catalog.value.descriptions[name.toUpperCase()], locale.value)
const suggestionSignature = (name: string): string =>
  `(${signatures.value[name.toUpperCase()]?.join(', ') ?? '…'})`

const resolveName = (raw: string): string => {
  const upper = raw.trim().toLocaleUpperCase()
  return names.value.find((name) => name.toLocaleUpperCase() === upper) ?? upper
}

const activeSignature = computed<ActiveSignature | null>(() =>
  findActiveSignature(props.modelValue, clampCaret(caret.value), {
    names: names.value,
    signatures: signatures.value
  })
)

const selectedName = computed(() => (props.functionName ? resolveName(props.functionName) : ''))
// Keep the last guided function on screen while it is still in the formula, so
// moving the caret out of a call does not collapse the panel under the pointer.
const lastGuideName = ref('')
watch(
  () => activeSignature.value?.name,
  (name) => {
    if (name) lastGuideName.value = name
  }
)
const stickyGuideName = computed(() =>
  lastGuideName.value &&
  props.modelValue.toLocaleUpperCase().includes(`${lastGuideName.value.toLocaleUpperCase()}(`)
    ? lastGuideName.value
    : ''
)
const guideName = computed(
  () => activeSignature.value?.name ?? (selectedName.value || stickyGuideName.value)
)
const guideArgs = computed(() => {
  if (!guideName.value) return []
  return activeSignature.value?.args ?? signatures.value[guideName.value.toUpperCase()] ?? []
})
const guideDescription = computed(() =>
  localizedDescription(catalog.value.descriptions[guideName.value.toUpperCase()], locale.value)
)
const fallbackGuide = computed(() =>
  Boolean(guideName.value && guideArgs.value.some((arg) => /^\[?arg\d+\]?$/u.test(arg.trim())))
)

const argumentRows = computed(() =>
  guideArgs.value.map((raw, index) => {
    const parsed = parseParameter(raw)
    const help = parameterHelp(guideName.value, raw, index, locale.value)
    return {
      raw,
      label: parsed.repeat ? '…' : parsed.key,
      marker: parsed.repeat
        ? copy.value.repeat
        : parsed.required
          ? copy.value.required
          : copy.value.optional,
      required: parsed.required,
      repeat: parsed.repeat,
      help: locale.value === 'ja' ? help.ja : help.en,
      example: help.example ?? ''
    }
  })
)

const activeArgumentIndices = computed(() => {
  const index = activeSignature.value?.activeArgIndex
  if (index === undefined || argumentRows.value.length === 0) return []
  const repeatIndex = argumentRows.value.findIndex((row) => row.repeat)
  if (repeatIndex < 0) return index < argumentRows.value.length ? [index] : []
  if (index < repeatIndex) return [index]
  if (repeatIndex === argumentRows.value.length - 1) return [repeatIndex]
  return Array.from(
    { length: argumentRows.value.length - repeatIndex },
    (_, offset) => repeatIndex + offset
  )
})

const activeArgumentIndex = computed(() => activeArgumentIndices.value[0] ?? -1)

const extraArgument = computed(() => {
  const index = activeSignature.value?.activeArgIndex
  return Boolean(
    index !== undefined &&
      index >= argumentRows.value.length &&
      argumentRows.value.length > 0 &&
      argumentRows.value.every((row) => !row.repeat)
  )
})

const activeArgument = computed(() => {
  if (activeArgumentIndex.value < 0) return undefined
  const row = argumentRows.value[activeArgumentIndex.value]
  if (!row) return undefined
  const repeatIndex = argumentRows.value.findIndex((entry) => entry.repeat)
  const ambiguous =
    repeatIndex >= 0 &&
    repeatIndex < argumentRows.value.length - 1 &&
    (activeSignature.value?.activeArgIndex ?? -1) >= repeatIndex
  if (!ambiguous) return row
  const help = variadicParameterHelp(guideName.value)
  if (!help) return row
  return {
    ...row,
    help: locale.value === 'ja' ? help.ja : help.en,
    example: ''
  }
})

const describedBy = computed(() =>
  [props.contextHint ? hintId : '', guideName.value ? guideId : ''].filter(Boolean).join(' ')
)

const updateFromInput = (event: Event) => {
  const node = event.target as HTMLInputElement
  focused.value = true
  emit('update:modelValue', node.value)
  caret.value = node.selectionStart ?? node.value.length
  dismissed.value = false
  activeSuggestion.value = 0
}

const acceptSuggestion = (name = activeSuggestionName.value) => {
  const current = suggestion.value
  if (!current || !name) return false
  const text = props.modelValue
  const suffix = text.slice(current.tokenEnd)
  const opening = /^(\s*)\(/.exec(suffix)
  let insertion = name
  let nextCaret = current.tokenStart + name.length
  if (opening) {
    nextCaret += opening[1].length + 1
  } else {
    insertion += '('
    nextCaret += 1
  }
  emit('update:modelValue', `${text.slice(0, current.tokenStart)}${insertion}${suffix}`)
  dismissed.value = true
  nextTick(() => {
    const node = inputRef.value
    if (!node) return
    node.focus()
    node.setSelectionRange(nextCaret, nextCaret)
    caret.value = nextCaret
  })
  return true
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'ArrowDown' && hasSuggestions.value) {
    event.preventDefault()
    activeSuggestion.value = (activeSuggestion.value + 1) % suggestionMatches.value.length
    return
  }
  if (event.key === 'ArrowUp' && hasSuggestions.value) {
    event.preventDefault()
    activeSuggestion.value =
      (activeSuggestion.value - 1 + suggestionMatches.value.length) % suggestionMatches.value.length
    return
  }
  if (event.key === 'Escape' && (hasSuggestions.value || dismissed.value === false)) {
    dismissed.value = true
    event.preventDefault()
    return
  }
  if (event.key === 'Enter') {
    if (hasSuggestions.value) {
      event.preventDefault()
      acceptSuggestion()
    } else {
      event.preventDefault()
      emit('submit')
    }
    return
  }
  if (event.key === 'Tab' && hasSuggestions.value) {
    event.preventDefault()
    acceptSuggestion()
  }
}

const onKeyup = (event: KeyboardEvent) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Escape') syncCaret()
}

const submit = () => emit('submit')

// Entering the field (click, Tab) keeps the list closed; typing opens it.
const onFocus = () => {
  focused.value = true
  dismissed.value = true
  syncCaret()
}

const onBlur = () => {
  if (blurTimer !== undefined) window.clearTimeout(blurTimer)
  blurTimer = window.setTimeout(() => {
    blurTimer = undefined
    if (document.activeElement !== inputRef.value) {
      focused.value = false
      dismissed.value = true
    }
  }, 0)
}

let loadGeneration = 0
const loadCatalog = async () => {
  const generation = ++loadGeneration
  catalogState.value = 'loading'
  catalogError.value = ''
  catalogWarning.value = ''
  try {
    const loaded = await loadFormulaCatalog()
    if (!alive || generation !== loadGeneration) return
    catalog.value = loaded
    catalogWarning.value = loaded.warning ? copy.value.catalogWarning : ''
    catalogState.value = 'ready'
  } catch (error) {
    if (!alive || generation !== loadGeneration) return
    catalogError.value = String(error)
    catalogState.value = 'error'
  }
}

watch(suggestion, () => {
  activeSuggestion.value = 0
})

watch(activeSuggestion, (index) => {
  nextTick(() => {
    document.getElementById(`${suggestionsId}-${index}`)?.scrollIntoView({ block: 'nearest' })
  })
})

watch(
  () => props.modelValue,
  () => {
    if (document.activeElement !== inputRef.value) caret.value = clampCaret(props.modelValue.length)
  }
)

onMounted(() => {
  syncCaret()
  void loadCatalog()
})

onBeforeUnmount(() => {
  alive = false
  if (blurTimer !== undefined) window.clearTimeout(blurTimer)
  loadGeneration += 1
})
</script>

<template>
  <div class="formula-input" data-formula-input :data-catalog-state="catalogState">
    <label class="demo-label" :for="inputId">{{ label }}</label>
    <div class="formula-input__field">
      <div class="formula-input__anchor">
        <input
          :id="inputId"
          ref="inputRef"
          :value="modelValue"
          type="text"
          class="demo-input formula-input__control"
          :placeholder="placeholder"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          role="combobox"
          aria-autocomplete="list"
          :aria-describedby="describedBy || undefined"
          :aria-controls="hasSuggestions ? suggestionsId : undefined"
          :aria-expanded="hasSuggestions"
          :aria-activedescendant="hasSuggestions ? `${suggestionsId}-${activeSuggestion}` : undefined"
          @input="updateFromInput"
          @keydown="onKeydown"
          @keyup="onKeyup"
          @click="syncCaret"
          @select="syncCaret"
          @focus="onFocus"
          @blur="onBlur"
        />
        <ul v-if="hasSuggestions" :id="suggestionsId" class="formula-input__suggestions" role="listbox" :aria-label="copy.suggestions">
          <li v-for="(name, index) in suggestionMatches" :id="`${suggestionsId}-${index}`" :key="name" role="option" :aria-selected="index === activeSuggestion" @pointerenter="activeSuggestion = index" @pointerdown.prevent="acceptSuggestion(name)" @click.prevent="acceptSuggestion(name)">
            <span class="formula-input__suggestion">
              <code>{{ name }}</code>
              <span class="formula-input__suggestion-detail">
                <span v-if="suggestionDescription(name)" class="formula-input__suggestion-description">{{ suggestionDescription(name) }}</span>
                <span class="formula-input__suggestion-signature">{{ suggestionSignature(name) }}</span>
              </span>
            </span>
          </li>
        </ul>
      </div>
      <button type="button" class="demo-button formula-input__submit" @click="submit">{{ actionLabel }}</button>
    </div>

    <p v-if="contextHint" :id="hintId" class="demo-hint formula-input__context">{{ contextHint }}</p>


    <div v-if="catalogState === 'error'" class="formula-input__catalog-error" role="alert">
      <span>{{ copy.catalogError }}</span>
      <button type="button" class="demo-button demo-button--ghost" @click="loadCatalog">{{ copy.retry }}</button>
      <small>{{ catalogError }}</small>
    </div>
    <p v-if="catalogWarning" class="demo-hint formula-input__catalog-status" role="status">
      <span>{{ copy.catalogWarning }}</span>
      <button type="button" class="demo-button demo-button--ghost" @click="loadCatalog">{{ copy.retry }}</button>
    </p>

    <section v-if="guideName" :id="guideId" class="formula-input__guide" :data-active-function="guideName">
      <div class="formula-input__guide-head">
        <div>
          <span class="demo-label">{{ copy.guide }}</span>
          <strong class="formula-input__name">{{ guideName }}</strong>
        </div>
        <code class="formula-input__signature">
          <span>{{ guideName }}(</span>
          <template v-if="guideArgs.length">
            <span
              v-for="(arg, index) in guideArgs"
              :key="`${arg}-${index}`"
              class="formula-input__signature-arg"
              :class="{ 'is-active': activeArgumentIndices.includes(index) }"
              :aria-current="index === activeArgumentIndex ? 'true' : undefined"
            >{{ arg }}{{ index < guideArgs.length - 1 ? ', ' : '' }}</span>
          </template>
          <span>)</span>
        </code>
      </div>
      <p v-if="guideDescription" class="formula-input__description">{{ guideDescription }}</p>
      <p v-else-if="fallbackGuide" class="demo-hint">{{ copy.unknown }}</p>

      <div v-if="activeArgument" class="formula-input__active" data-active-argument role="status" aria-live="polite">
        <span class="demo-label">{{ copy.active }} · {{ activeArgument.label }}</span>
        <span class="formula-input__active-help">
          {{ activeArgument.help }}
          <code v-if="activeArgument.example" class="formula-input__example">{{ activeArgument.example }}</code>
        </span>
      </div>
      <p v-else-if="extraArgument" class="demo-hint formula-input__no-active">{{ copy.extra }}</p>
      <p v-else-if="guideArgs.length === 0" class="demo-hint formula-input__no-active">{{ copy.noArguments }}</p>
      <p v-else class="demo-hint formula-input__no-active">{{ copy.noArgument }}</p>

      <details v-if="argumentRows.length" class="formula-input__details">
        <summary>{{ copy.details }} · {{ guideArgs.length }}</summary>
        <ol class="formula-input__arguments">
          <li v-for="(row, index) in argumentRows" :key="`${row.raw}-${index}`" class="formula-input__argument" :class="{ 'is-active': activeArgumentIndices.includes(index) }">
            <span class="formula-input__argument-index">{{ index + 1 }}</span>
            <code class="formula-input__argument-name">{{ row.label }}</code>
            <span class="formula-input__argument-marker">{{ row.marker }}</span>
            <span class="formula-input__argument-help">
              {{ row.help }}
              <code v-if="row.example" class="formula-input__example">{{ row.example }}</code>
            </span>
          </li>
        </ol>
      </details>
    </section>

    <details class="formula-input__syntax">
      <summary>{{ copy.syntax }}</summary>
      <ul>
        <li v-for="tip in SYNTAX_TIPS" :key="tip.key">
          <span>{{ locale === 'ja' ? tip.ja : tip.en }}</span>
          <code>{{ tip.example }}</code>
        </li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.formula-input {
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
  min-width: 0;
  position: relative;
}

.formula-input__field {
  display: flex;
  align-items: stretch;
  gap: 0.45rem;
  min-width: 0;
}

.formula-input__anchor {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
}

.formula-input__control {
  min-width: 0;
}

.formula-input__submit {
  flex: 0 0 auto;
  white-space: nowrap;
}

.formula-input__context,
.formula-input__catalog-status {
  margin: 0.08rem 0 0;
}

.formula-input__suggestions {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  z-index: 20;
  display: grid;
  max-height: min(18rem, 50vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  gap: 0.15rem;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  background: var(--vp-c-bg);
  box-shadow: var(--shadow-elevated);
  box-sizing: border-box;
}

.formula-input__suggestions li {
  min-width: 0;
  max-width: 100%;
}

.formula-input__suggestion {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
  padding: 0.35rem 0.45rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  text-align: left;
  font: inherit;
  line-height: 1.45;
  cursor: pointer;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.formula-input__suggestions li[aria-selected='true'] .formula-input__suggestion {
  background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent);
  color: var(--color-text-primary);
}

.formula-input__suggestion code,
.formula-input__signature,
.formula-input__example,
.formula-input__argument-name {
  font-family: var(--font-mono);
  font-size: var(--demo-fs-mono, 0.78rem);
}

.formula-input__suggestion code {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.formula-input__suggestion-description {
  font-size: var(--demo-fs-body, 0.82rem);
}

.formula-input__suggestion-signature {
  font-family: var(--font-mono);
  font-size: var(--demo-fs-hint, 0.75rem);
}

.formula-input__suggestion span {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.formula-input__suggestion-detail {
  display: grid;
  flex: 1 1 0;
  min-width: 0;
  gap: 0.08rem;
}

.formula-input__suggestion-detail > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.formula-input__catalog-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--cb-danger) 35%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--cb-danger) 8%, transparent);
  color: var(--color-text-primary);
  font-size: var(--demo-fs-hint, 0.75rem);
}

.formula-input__catalog-error small {
  flex: 1 1 100%;
  color: var(--color-text-tertiary);
  overflow-wrap: anywhere;
}

.formula-input__guide {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.7rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 25%, var(--color-border-default));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--vp-c-brand-1) 4%, var(--vp-c-bg));
}

.formula-input__guide-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.formula-input__guide-head > div {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
}

.formula-input__name {
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--demo-fs-body, 0.82rem);
}

.formula-input__signature {
  color: var(--vp-c-brand-1);
  overflow-wrap: anywhere;
}

.formula-input__signature-arg {
  border-radius: 0.2rem;
  padding: 0.05rem 0.12rem;
}

.formula-input__signature-arg.is-active {
  background: color-mix(in srgb, var(--vp-c-brand-1) 16%, transparent);
  color: var(--color-text-primary);
}

.formula-input__description {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--demo-fs-body, 0.82rem);
  line-height: 1.5;
}

.formula-input__active,
.formula-input__no-active {
  display: flex;
  align-items: baseline;
  gap: 0.2rem 0.55rem;
  flex-wrap: wrap;
  min-height: 2.4rem;
  margin: 0;
  padding: 0.5rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 28%, transparent);
  border-radius: var(--radius-sm);
  box-sizing: border-box;
}

.formula-input__active {
  background: color-mix(in srgb, var(--vp-c-brand-1) 8%, transparent);
}

.formula-input__no-active {
  border-style: dashed;
  border-color: var(--color-border-default);
}

.formula-input__active-help {
  flex: 1 1 16rem;
  min-width: 0;
  color: var(--color-text-primary);
  font-size: var(--demo-fs-body, 0.82rem);
}

.formula-input__example {
  margin-left: 0.35rem;
  padding: 0.05rem 0.3rem;
  border-radius: 0.2rem;
  background: color-mix(in srgb, var(--vp-c-brand-1) 8%, transparent);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.formula-input__details summary,
.formula-input__syntax summary {
  width: fit-content;
  color: var(--vp-c-brand-1);
  cursor: pointer;
  font-size: var(--demo-fs-hint, 0.75rem);
}

.formula-input__arguments {
  display: grid;
  gap: 0.3rem;
  margin: 0.45rem 0 0;
  padding: 0;
  list-style: none;
}

.formula-input__argument {
  display: grid;
  grid-template-columns: 1.3rem minmax(6rem, auto) auto 1fr;
  align-items: baseline;
  gap: 0.25rem 0.45rem;
  padding: 0.35rem 0.4rem;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--demo-fs-hint, 0.75rem);
}

.formula-input__argument.is-active {
  background: color-mix(in srgb, var(--vp-c-brand-1) 9%, transparent);
  color: var(--color-text-primary);
}

.formula-input__argument-index {
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.formula-input__argument-name {
  color: var(--color-text-primary);
}

.formula-input__argument-marker {
  color: var(--vp-c-brand-1);
  white-space: nowrap;
}

.formula-input__argument-help {
  min-width: 0;
  line-height: 1.45;
}

.formula-input__syntax {
  margin-top: 0.05rem;
}

.formula-input__syntax ul {
  display: grid;
  gap: 0.3rem;
  margin: 0.45rem 0 0;
  padding-left: 1.1rem;
  color: var(--color-text-secondary);
  font-size: var(--demo-fs-hint, 0.75rem);
}

.formula-input__syntax li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.formula-input__syntax code {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
  font-size: var(--demo-fs-mono, 0.78rem);
}

@media (max-width: 560px) {
  .formula-input__field {
    flex-wrap: wrap;
  }

  .formula-input__anchor {
    flex: 1 1 100%;
  }

  .formula-input__suggestion {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .formula-input__suggestion span {
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .formula-input__suggestion-detail > span {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
  }

  .formula-input__argument {
    grid-template-columns: 1.3rem minmax(5rem, auto) auto 1fr;
  }

  .formula-input__argument-help {
    grid-column: 2 / -1;
  }

  .formula-input__syntax li {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.1rem;
  }
}
</style>
