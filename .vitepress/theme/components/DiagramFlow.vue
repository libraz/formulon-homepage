<script setup lang="ts">
/**
 * DiagramFlow — a linear, numbered box-and-arrow process diagram for markdown
 * content.
 *
 * Renders an ordered sequence of steps as connected boxes: left to right,
 * wrapping onto further rows when the sequence outgrows the column, and
 * stacking into a single column on phone-width viewports (or always, via
 * `vertical`). Authored without any raw SVG or diagram syntax.
 *
 * Usage (arrow-delimited string — closest to how the flow reads in prose):
 *   <DiagramFlow steps="Open workbook bytes → Parse workbook model → Apply edits → Recalculate → Read values or save bytes" />
 *
 * Usage (structured — a box carries its name plus what it holds):
 *   <DiagramFlow :steps="[
 *     { label: 'Excel build', note: 'e.g. Win 365 ja-JP' },
 *     { label: 'Oracle dataset', note: 'captured cell values' },
 *     { label: 'Compatibility profile', tone: 'alt' }
 *   ]" caption="Every profile is pinned to the Excel build its values came from." />
 *
 * Layout lives in figures/flowLayout.ts; presentation in the `.fx-*` diagram
 * classes of styles/figures.css, which track the site's light/dark toggle.
 */
import { computed, useId } from 'vue'
import FigureFrame from './FigureFrame.vue'
import DiagramCanvas from './figures/DiagramCanvas.vue'
import { type DiagramItem, NARROW_MAX, RENDER_SCALE } from './figures/diagramGeometry'
import { layoutFlowStacked, layoutFlowWide } from './figures/flowLayout'

const props = withDefaults(
  defineProps<{
    /** Steps in order, either an arrow-delimited string ("A → B → C", "A
     * -> B -> C") or an array of labels / `{ label, note, tone }` objects. */
    steps: string | Array<string | DiagramItem>
    /** Accessible label for the whole diagram. Defaults to the step
     * labels joined with " → ". */
    label?: string
    /** One line under the drawing: the invariant the geometry cannot state. */
    caption?: string
    /** Force a top-to-bottom layout at any viewport width (the default
     * already stacks to vertical automatically on narrow viewports). */
    vertical?: boolean
  }>(),
  { label: undefined, caption: undefined, vertical: false }
)

const items = computed<DiagramItem[]>(() => {
  const raw = props.steps
  const list = typeof raw === 'string' ? raw.split(/\s*(?:→|->)\s*/).filter(Boolean) : raw
  return list.map((step) => (typeof step === 'string' ? { label: step } : step))
})

const ariaLabel = computed(() => props.label ?? items.value.map((s) => s.label).join(' → '))

const wide = computed(() => layoutFlowWide(items.value))
const stacked = computed(() => layoutFlowStacked(items.value))
const main = computed(() => (props.vertical ? stacked.value : wide.value))
/** The wide layout only needs a stacked fallback if it is too wide to shrink. */
const alt = computed(() =>
  !props.vertical && wide.value.width > NARROW_MAX ? stacked.value : null
)

const uid = useId()
const mainMarker = `${uid}-flow-a`
const altMarker = `${uid}-flow-b`
</script>

<template>
  <FigureFrame
    :view-box="`0 0 ${main.width} ${main.height}`"
    :width="Math.round(main.width * RENDER_SCALE)"
    :aria-label="ariaLabel"
    :caption="props.caption"
    :alt-view-box="alt ? `0 0 ${alt.width} ${alt.height}` : undefined"
    :alt-width="alt ? Math.round(alt.width * RENDER_SCALE) : undefined"
  >
    <DiagramCanvas :scene="main" :marker-id="mainMarker" />
    <template v-if="alt" #alt>
      <DiagramCanvas :scene="alt" :marker-id="altMarker" />
    </template>
  </FigureFrame>
</template>
