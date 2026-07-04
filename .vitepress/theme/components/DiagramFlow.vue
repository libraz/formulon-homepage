<script setup lang="ts">
/**
 * DiagramFlow — a linear, box-and-arrow process diagram for markdown content.
 *
 * Renders an ordered sequence of steps as connected boxes: horizontal and
 * wrapping on wide viewports, stacking to a vertical column on narrow ones
 * (or always, via `vertical`). Intended as a drop-in replacement for simple
 * sequential Mermaid `flowchart LR` diagrams (open → parse → edit →
 * recalc → read/save), authored without any raw SVG or diagram syntax.
 *
 * Usage (arrow-delimited string — closest to how the flow reads in prose):
 *   <DiagramFlow steps="Open workbook bytes → Parse workbook model → Apply edits → Recalculate → Read values or save bytes" />
 *
 * Usage (structured, for optional secondary captions per step):
 *   <DiagramFlow :steps="[
 *     { label: 'Excel build', note: 'e.g. Win 365 ja-JP' },
 *     { label: 'Oracle dataset' },
 *     { label: 'Compatibility profile' }
 *   ]" />
 *
 * Colors are drawn entirely from VitePress's `--vp-c-*` design tokens, so
 * the diagram tracks light/dark mode automatically with no extra work.
 */
import { computed } from 'vue'

interface FlowStep {
  label: string
  note?: string
}

const props = withDefaults(
  defineProps<{
    /** Steps in order, either an arrow-delimited string ("A → B → C", "A
     * -> B -> C") or an array of labels / `{ label, note }` objects. */
    steps: string | Array<string | FlowStep>
    /** Accessible label for the whole diagram. Defaults to the step
     * labels joined with " → ". */
    label?: string
    /** Force a top-to-bottom layout at any viewport width (the default
     * already wraps to vertical automatically on narrow viewports). */
    vertical?: boolean
  }>(),
  { label: undefined, vertical: false }
)

const items = computed<FlowStep[]>(() => {
  const raw = props.steps
  const list = typeof raw === 'string' ? raw.split(/\s*(?:→|->)\s*/).filter(Boolean) : raw
  return list.map((step) => (typeof step === 'string' ? { label: step } : step))
})

const ariaLabel = computed(() => props.label ?? items.value.map((s) => s.label).join(' → '))
</script>

<template>
  <ol
    class="diagram-flow"
    :class="{ 'diagram-flow--vertical': vertical }"
    :aria-label="ariaLabel"
  >
    <li v-for="(step, i) in items" :key="i" class="diagram-flow-step">
      <span class="diagram-flow-label">{{ step.label }}</span>
      <span v-if="step.note" class="diagram-flow-note">{{ step.note }}</span>
    </li>
  </ol>
</template>

<style scoped>
.diagram-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0;
  margin: 1.75rem 0;
  padding: 0;
  list-style: none;
}

.diagram-flow-step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 9em;
  margin: 0 1.85em 0.85em 0;
  padding: 11px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  text-align: center;
}

/* Reset the global .vp-doc bullet dot added for prose lists — this is a
 * diagram, not a bulleted list. */
.diagram-flow-step::before {
  content: none;
}

.diagram-flow-step:last-child {
  margin-right: 0;
}

.diagram-flow-step:not(:last-child)::after {
  content: "\2192";
  position: absolute;
  top: 50%;
  right: -1.7em;
  transform: translateY(-50%);
  color: var(--vp-c-brand-1);
  font-size: 1.15rem;
  line-height: 1;
}

.diagram-flow-label {
  font-family: var(--vp-font-family-base);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  line-height: 1.35;
}

.diagram-flow-note {
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
  line-height: 1.3;
}

/* Forced vertical layout */
.diagram-flow--vertical {
  flex-direction: column;
  align-items: stretch;
}

.diagram-flow--vertical .diagram-flow-step {
  margin: 0 0 1.9em 0;
  min-width: 0;
}

.diagram-flow--vertical .diagram-flow-step:last-child {
  margin-bottom: 0;
}

.diagram-flow--vertical .diagram-flow-step:not(:last-child)::after {
  top: auto;
  right: auto;
  bottom: -1.65em;
  left: 50%;
  transform: translateX(-50%);
}

/* Auto-collapse to vertical on narrow viewports unless the diagram is
 * already forced horizontal via a future prop — there isn't one, so this
 * always applies below the breakpoint. */
@media (max-width: 640px) {
  .diagram-flow:not(.diagram-flow--vertical) {
    flex-direction: column;
    align-items: stretch;
  }

  .diagram-flow:not(.diagram-flow--vertical) .diagram-flow-step {
    margin: 0 0 1.9em 0;
    min-width: 0;
  }

  .diagram-flow:not(.diagram-flow--vertical) .diagram-flow-step:last-child {
    margin-bottom: 0;
  }

  .diagram-flow:not(.diagram-flow--vertical) .diagram-flow-step:not(:last-child)::after {
    top: auto;
    right: auto;
    bottom: -1.65em;
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>
