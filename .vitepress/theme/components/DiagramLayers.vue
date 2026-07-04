<script setup lang="ts">
/**
 * DiagramLayers — a stacked-row diagram for architecture layers, or a flow
 * that fans out into 2-3 parallel branches and (optionally) converges again.
 *
 * Each layer is a row; a row with more than one node renders those nodes
 * side by side, which reads naturally as either "these are the parts of
 * this layer" (architecture diagrams) or "the flow splits here" (branching
 * diagrams). Rows are connected top-to-bottom by a single arrow, so no
 * per-node edge routing is needed — keep branch fan-out/fan-in to 2-3
 * nodes per row for the visual to stay legible.
 *
 * Usage:
 *   <DiagramLayers :layers="[
 *     { title: 'L4', nodes: ['AI agents', 'Browser apps'] },
 *     { title: 'L3', nodes: [{ label: '@libraz/formulon-mcp', note: 'stdio · 31 tools' }] },
 *     { title: 'L1', nodes: ['C++17 calculation core'] }
 *   ]" />
 *
 * For a simple linear sequence with no branching, prefer DiagramFlow —
 * it reads better for that case. Colors come entirely from VitePress's
 * `--vp-c-*` tokens, so light/dark mode need no extra handling.
 */
import { computed } from 'vue'

interface LayerNode {
  label: string
  note?: string
}

interface Layer {
  /** Optional short caption shown beside the row (e.g. "L1", "Layer 2"). */
  title?: string
  nodes: Array<string | LayerNode>
}

const props = defineProps<{
  layers: Layer[]
  /** Accessible label for the whole diagram. Defaults to the layer
   * titles/node labels joined in order. */
  label?: string
}>()

const rows = computed(() =>
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
</script>

<template>
  <div class="diagram-layers" role="img" :aria-label="ariaLabel">
    <div v-for="(row, i) in rows" :key="i" class="diagram-layers-row">
      <span v-if="row.title" class="diagram-layers-title">{{ row.title }}</span>
      <div class="diagram-layers-nodes">
        <div v-for="(node, j) in row.nodes" :key="j" class="diagram-layers-node">
          <span class="diagram-layers-label">{{ node.label }}</span>
          <span v-if="node.note" class="diagram-layers-note">{{ node.note }}</span>
        </div>
      </div>
      <span v-if="i < rows.length - 1" class="diagram-layers-arrow" aria-hidden="true">↓</span>
    </div>
  </div>
</template>

<style scoped>
.diagram-layers {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin: 1.75rem 0;
}

.diagram-layers-row {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.diagram-layers-title {
  align-self: flex-start;
  margin-bottom: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.diagram-layers-nodes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  width: 100%;
}

.diagram-layers-node {
  display: flex;
  flex: 1 1 180px;
  max-width: 320px;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  text-align: center;
}

.diagram-layers-label {
  font-family: var(--vp-font-family-base);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  line-height: 1.35;
}

.diagram-layers-note {
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
  line-height: 1.3;
}

.diagram-layers-arrow {
  margin: 8px 0;
  color: var(--vp-c-brand-1);
  font-size: 1.15rem;
  line-height: 1;
}
</style>
