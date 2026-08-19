<script setup lang="ts">
/**
 * DemoFrame — shared chrome for the embedded live-engine demos.
 *
 * Owns everything every demo repeats: the title/description header, the
 * capability check that keeps a non-isolated browser from spinning forever,
 * the boot that pulls the ~2.3 MB wasm in as the demo approaches the
 * viewport, the loading/error panels, and the reset button.
 *
 * The demo starts itself rather than waiting for a click: a reader scrolling
 * to it finds a running sheet, not a button. The fetch is still deferred —
 * `IntersectionObserver` fires it one screen ahead, so a page whose demo is
 * never reached never pays for the engine.
 *
 * The host component only reports its own state and renders the demo body in
 * the default slot; the frame decides whether that body is shown at all.
 */
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
    /** Engine version string, shown in the header badge once loaded. */
    version?: string
    /** Set `false` for demos with nothing meaningful to reset. */
    resettable?: boolean
    /**
     * Height in pixels the frame holds open while the engine boots, roughly
     * what this demo's body will occupy. The demo starts itself as it nears
     * the viewport, so without a reserved box the page reflows under a reader
     * who is still scrolling toward it.
     */
    reserve?: number
  }>(),
  {
    description: undefined,
    state: 'idle',
    error: undefined,
    version: undefined,
    resettable: true,
    reserve: 180
  }
)

const emit = defineEmits<{ run: []; reset: [] }>()

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

// The capability probe reads `crossOriginIsolated`, so it can only run after
// hydration; `null` until then, which keeps SSR output and first paint equal.
const blocker = ref<EngineBlocker | null | undefined>(undefined)
const root = ref<HTMLElement | null>(null)
const nearViewport = ref(false)
let observer: IntersectionObserver | null = null

const stopObserving = () => {
  observer?.disconnect()
  observer = null
}

onMounted(() => {
  blocker.value = engineBlocker()
  if (blocker.value) return
  if (typeof IntersectionObserver === 'undefined' || !root.value) {
    nearViewport.value = true
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      stopObserving()
      nearViewport.value = true
    },
    // One screen of lead time: the engine is usually there by the time the
    // demo is actually read.
    { rootMargin: '256px 0px' }
  )
  observer.observe(root.value)
})

onBeforeUnmount(stopObserving)

// Also covers the reset path: a host that drops back to `idle` while the demo
// is still on screen boots again instead of stranding an empty frame.
watch(
  [nearViewport, () => props.state, blocker],
  () => {
    if (!nearViewport.value || blocker.value || props.state !== 'idle') return
    emit('run')
  },
  { flush: 'post' }
)

const copy = computed(() =>
  isJa.value
    ? {
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
  <section
    ref="root"
    class="demo-frame"
    :data-state="state"
    :style="{ '--demo-reserve': `${reserve}px` }"
  >
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
        <div v-if="state === 'idle' || state === 'loading'" class="demo-frame__panel" role="status">
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
