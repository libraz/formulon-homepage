<script setup lang="ts">
/**
 * DiagramLayers — a stacked-row diagram for architecture layers, or a flow
 * that fans out into parallel branches and (optionally) converges again.
 *
 * Each layer is a row; a row with more than one node renders those nodes side
 * by side on a shared group panel, which reads as either "these are the parts
 * of this layer" (architecture diagrams) or "the flow splits here" (branching
 * diagrams). Rows are connected top to bottom: a single node drops straight
 * into the next row, several nodes are fanned into through an elbow.
 *
 * Usage:
 *   <DiagramLayers :layers="[
 *     { title: 'L4', nodes: [{ label: 'AI agents', note: 'Claude Code, Codex', tone: 'alt' }] },
 *     { title: 'L3', nodes: [{ label: '@libraz/formulon-mcp', note: 'stdio MCP server' }] },
 *     { title: 'L1', nodes: [{ label: 'formulon', note: 'C++17 calculation core' }] }
 *   ]" caption="Every surface calls the same core; none reimplements a function." />
 *
 * For a simple linear sequence with no branching, prefer DiagramFlow. Layout
 * lives in figures/layersLayout.ts; presentation in the `.fx-*` diagram classes
 * of styles/figures.css, which track the site's light/dark toggle.
 */
import { computed, useId } from 'vue'
import FigureFrame from './FigureFrame.vue'
import DiagramCanvas from './figures/DiagramCanvas.vue'
import { type DiagramItem, NARROW_MAX, RENDER_SCALE } from './figures/diagramGeometry'
import { type LayerRow, layoutLayersNarrow, layoutLayersWide } from './figures/layersLayout'

interface Layer {
  /** Optional short caption shown above the row (e.g. "L1", "Surfaces"). */
  title?: string
  nodes: Array<string | DiagramItem>
}

const props = defineProps<{
  layers: Layer[]
  /** Accessible label for the whole diagram. Defaults to the layer
   * titles/node labels joined in order. */
  label?: string
  /** One line under the drawing: the invariant the geometry cannot state. */
  caption?: string
}>()

const rows = computed<LayerRow[]>(() =>
  props.layers.map((layer) => ({
    title: layer.title,
    nodes: layer.nodes.map((node) => (typeof node === 'string' ? { label: node } : node))
  }))
)

const ariaLabel = computed(
  () =>
    props.label ??
    rows.value
      .map((row) => (row.title ? `${row.title}: ` : '') + row.nodes.map((n) => n.label).join(', '))
      .join(' → ')
)

const wide = computed(() => layoutLayersWide(rows.value))
const narrow = computed(() => layoutLayersNarrow(rows.value))
const alt = computed(() => (wide.value.width > NARROW_MAX ? narrow.value : null))

const uid = useId()
const mainMarker = `${uid}-layers-a`
const altMarker = `${uid}-layers-b`
</script>

<template>
  <FigureFrame
    :view-box="`0 0 ${wide.width} ${wide.height}`"
    :width="Math.round(wide.width * RENDER_SCALE)"
    :aria-label="ariaLabel"
    :caption="props.caption"
    :alt-view-box="alt ? `0 0 ${alt.width} ${alt.height}` : undefined"
    :alt-width="alt ? Math.round(alt.width * RENDER_SCALE) : undefined"
  >
    <DiagramCanvas :scene="wide" :marker-id="mainMarker" />
    <template v-if="alt" #alt>
      <DiagramCanvas :scene="alt" :marker-id="altMarker" />
    </template>
  </FigureFrame>
</template>
