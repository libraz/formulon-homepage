<script setup lang="ts">
/**
 * DiagramLayers — a stacked-row diagram for architecture layers, or a flow
 * that fans out into parallel branches and (optionally) converges again.
 *
 * Each layer is a row; a row with more than one node renders those nodes side
 * by side on a shared `.fx-lane` band, which reads as either "these are the
 * parts of this layer" (architecture diagrams) or "the flow splits here"
 * (branching diagrams). Rows are connected top to bottom: a single node drops
 * straight into the next row, several nodes are fanned into through an elbow.
 *
 * Usage:
 *   <DiagramLayers :layers="[
 *     { title: 'L4', nodes: ['AI agents', 'Browser apps'] },
 *     { title: 'L3', nodes: [{ label: '@libraz/formulon-mcp', note: 'stdio · 33 tools' }] },
 *     { title: 'L1', nodes: ['C++17 calculation core'] }
 *   ]" />
 *
 * For a simple linear sequence with no branching, prefer DiagramFlow — it
 * reads better for that case. Presentation comes entirely from the `.fx-*`
 * classes in styles/figures.css, which are built from theme tokens, so the
 * diagram tracks light/dark mode.
 */
import { computed, useId } from 'vue'
import FigureFrame from './FigureFrame.vue'
import DiagramCanvas from './figures/DiagramCanvas.vue'
import {
  type BoxContent,
  boxHeight,
  CANVAS_MAX,
  CAPTION_GAP,
  CAPTION_SIZE,
  type DiagramBox,
  type DiagramCaption,
  type DiagramItem,
  type DiagramLane,
  type DiagramScene,
  elbow,
  lineTo,
  measureContent,
  NARROW_MAX,
  PAD_X,
  RENDER_SCALE
} from './figures/diagramGeometry'

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

// --- Geometry ---------------------------------------------------------

/** Narrowest a node may be before a row splits onto a second line. */
const NODE_MIN_W = 96
const NODE_MAX_W = 176
/** Horizontal gutter between nodes of one row. */
const NODE_GAP = 12
/** Vertical gutter between rows, which the connectors run through. */
const ROW_GAP = 28
/** Padding between a lane band and the nodes it groups. */
const LANE_PAD = 7
/** Narrowest the whole stack may be, so a column of short labels is not skinny. */
const STACK_MIN_W = 240

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

interface RowPlan {
  title?: string
  items: DiagramItem[]
  /** Nodes per line; a row too wide for the canvas becomes a balanced grid. */
  columns: number
  /** Intrinsic width this row would like, gutters included. */
  naturalW: number
}

/**
 * Work out how many nodes a row puts on one line, and how wide it would like
 * to be. `canvas` is the widest the stack may become; `maxNode` caps a single
 * node so one long label cannot stretch the whole diagram.
 *
 * A row that does not fit becomes a grid with the lines balanced (7 nodes read
 * as 4 + 3, not 4 + 4 + ... + 1).
 */
function planRows(canvas: number, maxNode: number): RowPlan[] {
  const perLine = Math.max(1, Math.floor((canvas + NODE_GAP) / (NODE_MIN_W + NODE_GAP)))
  return rows.value.map((row) => {
    const count = row.nodes.length
    const columns = Math.ceil(count / Math.max(1, Math.ceil(count / perLine)))
    const naturalW =
      columns < count
        ? canvas
        : row.nodes.reduce((sum, node) => {
            const content = measureContent(node, maxNode - PAD_X * 2)
            return sum + clamp(content.contentW + PAD_X * 2, NODE_MIN_W, maxNode)
          }, 0) +
          (count - 1) * NODE_GAP
    return { title: row.title, items: row.nodes, columns, naturalW }
  })
}

/** Lay a set of row plans out into a scene of the given stack width. */
function buildScene(plans: RowPlan[], stackW: number): DiagramScene {
  const boxes: DiagramBox[] = []
  const lanes: DiagramLane[] = []
  const captions: DiagramCaption[] = []
  const arrows: string[] = []
  /** Where the connector out of each row leaves, and where it lands. */
  const anchors: Array<{ exitX: number; exitY: number; entries: Array<{ x: number; y: number }> }> =
    []

  const left = LANE_PAD
  let y = 0

  plans.forEach((plan, rowIndex) => {
    if (rowIndex > 0) y += ROW_GAP
    if (plan.title) {
      captions.push({ x: left, y: y + CAPTION_SIZE, text: plan.title })
      y += CAPTION_SIZE + CAPTION_GAP
    }

    const columns = plan.columns
    const nodeW = (stackW - (columns - 1) * NODE_GAP) / columns
    // Text is wrapped against the width the node actually gets, not the width
    // it asked for while the stack was still being sized.
    const contents = plan.items.map((item) => measureContent(item, nodeW - PAD_X * 2))
    const lines: BoxContent[][] = []
    for (let i = 0; i < contents.length; i += columns) {
      lines.push(contents.slice(i, i + columns))
    }
    const lineHeights = lines.map((line) => Math.max(...line.map(boxHeight)))
    const rowH = lineHeights.reduce((sum, h) => sum + h, 0) + (lines.length - 1) * NODE_GAP
    const grouped = contents.length > 1
    const rowTop = y

    const entries: Array<{ x: number; y: number }> = []
    let lineY = rowTop
    lines.forEach((line, lineIndex) => {
      const lineW = line.length * nodeW + (line.length - 1) * NODE_GAP
      const lineX = left + (stackW - lineW) / 2
      line.forEach((content, i) => {
        const x = lineX + i * (nodeW + NODE_GAP)
        boxes.push({ ...content, x, y: lineY, w: nodeW, h: lineHeights[lineIndex] })
        if (lineIndex === 0) entries.push({ x: x + nodeW / 2, y: lineY })
      })
      lineY += lineHeights[lineIndex] + NODE_GAP
    })

    if (grouped) {
      lanes.push({
        x: left - LANE_PAD,
        y: rowTop - LANE_PAD,
        w: stackW + LANE_PAD * 2,
        h: rowH + LANE_PAD * 2
      })
    }

    anchors.push({
      exitX: left + stackW / 2,
      exitY: rowTop + rowH + (grouped ? LANE_PAD : 0),
      // A grid row is fanned into once, at its band: splitting to the first
      // line only would leave the rest of the grid dangling.
      entries: lines.length > 1 ? [{ x: left + stackW / 2, y: rowTop - LANE_PAD }] : entries
    })

    y = rowTop + rowH + (grouped ? LANE_PAD : 0)
  })

  for (let i = 0; i < anchors.length - 1; i++) {
    const from = anchors[i]
    const to = anchors[i + 1]
    // Turn above the middle of the gutter so the horizontal run clears the next
    // row's caption.
    const midY = from.exitY + (to.entries[0].y - from.exitY) * 0.45
    for (const entry of to.entries) {
      arrows.push(
        Math.abs(entry.x - from.exitX) < 0.5
          ? lineTo(from.exitX, from.exitY + 3, entry.x, entry.y)
          : elbow(from.exitX, from.exitY + 3, entry.x, entry.y, midY)
      )
    }
  }

  return {
    width: stackW + LANE_PAD * 2,
    height: y + LANE_PAD,
    boxes,
    lanes,
    arrows,
    captions
  }
}

const EMPTY_SCENE: DiagramScene = {
  width: 1,
  height: 1,
  boxes: [],
  lanes: [],
  arrows: [],
  captions: []
}

const wide = computed<DiagramScene>(() => {
  if (rows.value.length === 0) return EMPTY_SCENE
  const plans = planRows(CANVAS_MAX, NODE_MAX_W)
  const stackW = clamp(Math.max(...plans.map((p) => p.naturalW)), STACK_MIN_W, CANVAS_MAX)
  return buildScene(plans, stackW)
})

/** One node per line, for a phone-width column. */
const narrow = computed<DiagramScene>(() => {
  if (rows.value.length === 0) return EMPTY_SCENE
  const stackW = NARROW_MAX - LANE_PAD * 2
  const plans = planRows(stackW, stackW).map((plan) => ({ ...plan, columns: 1 }))
  return buildScene(plans, stackW)
})

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
    :alt-view-box="alt ? `0 0 ${alt.width} ${alt.height}` : undefined"
    :alt-width="alt ? Math.round(alt.width * RENDER_SCALE) : undefined"
  >
    <DiagramCanvas :scene="wide" :marker-id="mainMarker" />
    <template v-if="alt" #alt>
      <DiagramCanvas :scene="alt" :marker-id="altMarker" />
    </template>
  </FigureFrame>
</template>
