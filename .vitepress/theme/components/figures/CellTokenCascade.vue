<script setup lang="ts">
/**
 * CellTokenCascade — how one `--fc-*` value is resolved for a mounted
 * formulon-cell host.
 *
 * A precedence picture rather than a flow: every band declares the same
 * token, they compete inside the one `.fc-host` scope, and the lowest band
 * wins. DiagramLayers would draw the same rows as a pipeline, which reads as
 * "feeds into" instead of "overrides", so the bands are left-aligned inside a
 * shared container and the cascade direction is shown once, in the gutter.
 *
 * The drawing is shared between language trees: every user-visible string
 * comes from `DEFAULTS` and is replaceable through `labels`, so the Japanese
 * page passes translations rather than a second diagram.
 */
import { computed, useId } from 'vue'
import FigureFrame from '../FigureFrame.vue'
import CascadeCanvas from './CascadeCanvas.vue'
import { buildCascade } from './cascadeGeometry'
import { CANVAS_MAX, NARROW_MAX, RENDER_SCALE } from './diagramGeometry'

type LabelKey =
  | 'themeTag'
  | 'paper'
  | 'paperNote'
  | 'attr'
  | 'attrNote'
  | 'hostTag'
  | 'host'
  | 'hostNote'
  | 'resolvedTag'
  | 'resolved'
  | 'resolvedNote'
  | 'caption'
  | 'aria'

const DEFAULTS: Record<LabelKey, string> = {
  themeTag: '@layer fc.theme',
  paper: 'theme-paper.css',
  paperNote: '.fc-host:not([data-fc-theme]) — the default',
  attr: 'theme-ink.css / theme-contrast.css',
  attrNote: 'selected by data-fc-theme, written by setTheme()',
  hostTag: 'outside every @layer',
  host: 'Host CSS on .fc-host or an ancestor',
  hostNote: '--fc-accent: #d63384',
  resolvedTag: 'resolved',
  resolved: 'The value the grid paints with',
  resolvedNote: 'ribbon --fc-tb-accent falls back to --fc-accent',
  caption:
    'Lower bands override higher ones: unlayered host CSS wins over every bundled theme rule, whatever its selector.',
  aria: 'Token precedence for formulon-cell: bundled theme files in @layer fc.theme, overridden by unlayered host CSS, resolving the value the grid paints with'
}

const props = defineProps<{
  labels?: Partial<Record<LabelKey, string>>
}>()

const t = computed<Record<LabelKey, string>>(() => ({ ...DEFAULTS, ...props.labels }))

/** Comfortable reading width; the frame scales it down with the column. */
const WIDE_W = Math.min(470, CANVAS_MAX)

const bands = computed(() => [
  { tag: t.value.themeTag, label: t.value.paper, note: t.value.paperNote },
  { label: t.value.attr, note: t.value.attrNote },
  { tag: t.value.hostTag, label: t.value.host, note: t.value.hostNote }
])

const resolved = computed(() => ({
  tag: t.value.resolvedTag,
  label: t.value.resolved,
  note: t.value.resolvedNote
}))

const wide = computed(() => buildCascade(bands.value, resolved.value, WIDE_W))
const narrow = computed(() => buildCascade(bands.value, resolved.value, NARROW_MAX))

const uid = useId()
const mainMarker = `${uid}-cascade-a`
const altMarker = `${uid}-cascade-b`
</script>

<template>
  <FigureFrame
    :view-box="`0 0 ${wide.width} ${wide.height}`"
    :width="Math.round(wide.width * RENDER_SCALE)"
    :aria-label="t.aria"
    :caption="t.caption"
    :alt-view-box="`0 0 ${narrow.width} ${narrow.height}`"
    :alt-width="Math.round(narrow.width * RENDER_SCALE)"
  >
    <CascadeCanvas :scene="wide" :marker-id="mainMarker" />
    <template #alt>
      <CascadeCanvas :scene="narrow" :marker-id="altMarker" />
    </template>
  </FigureFrame>
</template>
