<script setup lang="ts">
/**
 * DemoFrame — shared chrome for the embedded live-engine demos.
 *
 * Owns everything every demo repeats: the title/description header, the
 * capability check that keeps a non-isolated browser from spinning forever,
 * the "load the engine" gate that defers the ~2.3 MB wasm fetch until the
 * reader asks for it, the loading/error panels, and the reset button.
 *
 * The host component only reports its own state and renders the demo body in
 * the default slot; the frame decides whether that body is shown at all.
 */
import { useData } from 'vitepress'
import { computed, onMounted, ref } from 'vue'
import { type EngineBlocker, engineBlocker } from './engine'

const props = withDefaults(
  defineProps<{
    /** Demo title, already localized by the host component. */
    title: string
    /** One or two sentences of localized context shown under the title. */
    description?: string
    /** Host-reported lifecycle. `ready` reveals the default slot. */
    state?: 'idle' | 'loading' | 'ready' | 'error'
    /** Localized failure text shown in the `error` state. */
    error?: string
    /** Localized label for the initial action button. */
    runLabel?: string
    /** Engine version string, shown in the header badge once loaded. */
    version?: string
    /** Set `false` for demos with nothing meaningful to reset. */
    resettable?: boolean
  }>(),
  {
    description: undefined,
    state: 'idle',
    error: undefined,
    runLabel: undefined,
    version: undefined,
    resettable: true
  }
)

const emit = defineEmits<{ run: []; reset: [] }>()

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

// The capability probe reads `crossOriginIsolated`, so it can only run after
// hydration; `null` until then, which keeps SSR output and first paint equal.
const blocker = ref<EngineBlocker | null | undefined>(undefined)
onMounted(() => {
  blocker.value = engineBlocker()
})

const copy = computed(() =>
  isJa.value
    ? {
        run: 'エンジンを読み込んで実行',
        loading: 'WASM エンジンを読み込み中…',
        reset: 'リセット',
        retry: 'もう一度試す',
        failed: 'エンジンの実行に失敗しました。',
        note: '本物の Formulon エンジン (WASM) がこのページ内で動作します。データは送信されません。',
        badge: 'live engine',
        blocked: {
          wasm: 'このブラウザは WebAssembly に対応していないため、デモを実行できません。',
          'shared-memory':
            'SharedArrayBuffer が利用できないため、デモを実行できません。Formulon の WASM ビルドはスレッド共有メモリを前提としています。',
          isolation:
            'このページはクロスオリジン分離 (COOP: same-origin / COEP: require-corp) されていないため、スレッド対応の WASM を起動できません。formulon.libraz.net で直接開くと実行できます。'
        }
      }
    : {
        run: 'Load engine and run',
        loading: 'Loading the WASM engine…',
        reset: 'Reset',
        retry: 'Try again',
        failed: 'The engine failed to run.',
        note: 'Powered by the real Formulon engine (WASM) — it runs entirely in your browser, nothing is uploaded.',
        badge: 'live engine',
        blocked: {
          wasm: 'This browser has no WebAssembly support, so the demo cannot run.',
          'shared-memory':
            'SharedArrayBuffer is unavailable, so the demo cannot run. The Formulon WASM build requires threaded shared memory.',
          isolation:
            'This page is not cross-origin isolated (COOP: same-origin / COEP: require-corp), so the threaded WASM build cannot start. Open it directly on formulon.libraz.net to run the demo.'
        }
      }
)

const blockedText = computed(() => (blocker.value ? copy.value.blocked[blocker.value] : ''))
</script>

<template>
  <section class="demo-frame" :data-state="state">
    <header class="demo-frame__head">
      <h4 class="demo-frame__title">{{ title }}</h4>
      <span v-if="state === 'ready' && version" class="demo-frame__badge">
        {{ copy.badge }} · {{ version }}
      </span>
    </header>
    <p v-if="description" class="demo-frame__desc">{{ description }}</p>

    <ClientOnly>
      <div v-if="blocker" class="demo-frame__panel demo-frame__panel--blocked" role="status">
        {{ blockedText }}
      </div>
      <template v-else>
        <div v-if="state === 'idle'" class="demo-frame__panel">
          <button type="button" class="demo-frame__run" @click="emit('run')">
            {{ runLabel || copy.run }}
          </button>
        </div>

        <div v-else-if="state === 'loading'" class="demo-frame__panel" role="status">
          <span class="demo-frame__spinner" aria-hidden="true"></span>
          {{ copy.loading }}
        </div>

        <div v-else-if="state === 'error'" class="demo-frame__panel demo-frame__panel--error">
          <p>{{ error || copy.failed }}</p>
          <button type="button" class="demo-frame__run" @click="emit('run')">
            {{ copy.retry }}
          </button>
        </div>

        <div v-else class="demo-frame__body">
          <slot />
          <div v-if="resettable" class="demo-frame__actions">
            <button type="button" class="demo-frame__reset" @click="emit('reset')">
              {{ copy.reset }}
            </button>
          </div>
        </div>
      </template>
    </ClientOnly>

    <p class="demo-frame__note">{{ copy.note }}</p>
  </section>
</template>
