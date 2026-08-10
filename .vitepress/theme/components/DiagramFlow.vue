<script setup lang="ts">
/**
 * DiagramFlow — a linear, box-and-arrow process diagram for markdown content.
 *
 * Renders an ordered sequence of steps as connected boxes: left to right,
 * wrapping onto further rows when the sequence outgrows the column, and
 * stacking into a single column on phone-width viewports (or always, via
 * `vertical`). Authored without any raw SVG or diagram syntax.
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
 * Presentation comes entirely from the `.fx-*` classes in styles/figures.css,
 * which are built from theme tokens, so the diagram tracks light/dark mode.
 */
import { computed, useId } from 'vue'
import FigureFrame from './FigureFrame.vue'
import DiagramCanvas from './figures/DiagramCanvas.vue'
import {
  boxHeight,
  CANVAS_MAX,
  type DiagramBox,
  type DiagramScene,
  lineTo,
  measureContent,
  NARROW_MAX,
  PAD_X,
  RENDER_SCALE,
  r2
} from './figures/diagramGeometry'

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
     * already stacks to vertical automatically on narrow viewports). */
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

// --- Geometry ---------------------------------------------------------

const MIN_BOX_W = 66
const MAX_BOX_W = 136
/** Horizontal gutter a connector runs through. */
const ARROW_GAP = 26
/** Vertical gutter between wrapped rows of the horizontal layout. */
const ROW_GAP = 28
/** Left channel the wrap connector descends in when the flow needs two rows. */
const WRAP_INDENT = 16
/** Vertical gutter between boxes of the stacked layout. */
const STACK_GAP = 22
const STACK_MIN_W = 140

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

const EMPTY_SCENE: DiagramScene = {
  width: 1,
  height: 1,
  boxes: [],
  lanes: [],
  arrows: [],
  captions: []
}

/** Left to right, wrapping onto further rows once a row fills the column. */
const wide = computed<DiagramScene>(() => {
  const maxContent = MAX_BOX_W - PAD_X * 2
  const contents = items.value.map((step) => measureContent(step, maxContent))
  if (contents.length === 0) return EMPTY_SCENE
  const widths = contents.map(
    (c) => clamp(c.contentW, MIN_BOX_W - PAD_X * 2, maxContent) + PAD_X * 2
  )
  const height = Math.max(...contents.map(boxHeight))

  const rows: number[][] = []
  let row: number[] = []
  let rowW = 0
  contents.forEach((_, i) => {
    const advance = (row.length > 0 ? ARROW_GAP : 0) + widths[i]
    if (row.length > 0 && rowW + advance > CANVAS_MAX) {
      rows.push(row)
      row = []
      rowW = 0
    }
    rowW += row.length > 0 ? advance : widths[i]
    row.push(i)
  })
  if (row.length > 0) rows.push(row)

  const indent = rows.length > 1 ? WRAP_INDENT : 0
  const boxes: DiagramBox[] = []
  const arrows: string[] = []
  const rowEdges: Array<{ left: number; right: number; cy: number }> = []

  rows.forEach((entries, rowIndex) => {
    const y = rowIndex * (height + ROW_GAP)
    let x = indent
    entries.forEach((i, position) => {
      boxes[i] = { ...contents[i], x, y, w: widths[i], h: height }
      if (position > 0) {
        arrows.push(lineTo(x - ARROW_GAP + 3, y + height / 2, x, y + height / 2))
      }
      x += widths[i] + ARROW_GAP
    })
    rowEdges.push({
      left: indent,
      right: x - ARROW_GAP,
      cy: y + height / 2
    })
  })

  // Wrap connector: out of the last box of a row, down the left channel, into
  // the first box of the next one.
  for (let i = 0; i < rowEdges.length - 1; i++) {
    const from = rowEdges[i]
    const to = rowEdges[i + 1]
    const gutterY = r2((from.cy + to.cy) / 2)
    const channel = r2(WRAP_INDENT / 2)
    arrows.push(
      [
        `M ${r2(from.right + 3)} ${r2(from.cy)}`,
        `L ${r2(from.right + 9)} ${r2(from.cy)}`,
        `L ${r2(from.right + 9)} ${gutterY}`,
        `L ${channel} ${gutterY}`,
        `L ${channel} ${r2(to.cy)}`,
        `L ${r2(to.left)} ${r2(to.cy)}`
      ].join(' ')
    )
  }

  return {
    // The wrap connector steps 9 units past the last box before turning down.
    width: Math.max(...rowEdges.map((r) => r.right)) + (rows.length > 1 ? 10 : 0),
    height: rows.length * height + (rows.length - 1) * ROW_GAP,
    boxes,
    lanes: [],
    arrows,
    captions: []
  }
})

/** Single column, top to bottom. */
const stacked = computed<DiagramScene>(() => {
  const maxContent = NARROW_MAX - PAD_X * 2
  const contents = items.value.map((step) => measureContent(step, maxContent))
  if (contents.length === 0) return EMPTY_SCENE
  const width =
    clamp(Math.max(...contents.map((c) => c.contentW)), STACK_MIN_W - PAD_X * 2, maxContent) +
    PAD_X * 2

  const boxes: DiagramBox[] = []
  const arrows: string[] = []
  let y = 0
  contents.forEach((content, i) => {
    const h = boxHeight(content)
    boxes.push({ ...content, x: 0, y, w: width, h })
    if (i > 0) arrows.push(lineTo(width / 2, y - STACK_GAP + 3, width / 2, y))
    y += h + STACK_GAP
  })

  return {
    width,
    height: y - STACK_GAP,
    boxes,
    lanes: [],
    arrows,
    captions: []
  }
})

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
    :alt-view-box="alt ? `0 0 ${alt.width} ${alt.height}` : undefined"
    :alt-width="alt ? Math.round(alt.width * RENDER_SCALE) : undefined"
  >
    <DiagramCanvas :scene="main" :marker-id="mainMarker" />
    <template v-if="alt" #alt>
      <DiagramCanvas :scene="alt" :marker-id="altMarker" />
    </template>
  </FigureFrame>
</template>
