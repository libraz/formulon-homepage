/**
 * Layout for DiagramFlow: an ordered sequence of numbered boxes, laid left to
 * right and wrapping onto further rows, or stacked into one column.
 */
import {
  boxHeight,
  CANVAS_MAX,
  clamp,
  type DiagramBox,
  type DiagramItem,
  type DiagramScene,
  EMPTY_SCENE,
  indexLabel,
  lineTo,
  measureContent,
  NARROW_MAX,
  PAD_X,
  r2
} from './diagramGeometry'

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

/** Left to right, wrapping onto further rows once a row fills the column. */
export function layoutFlowWide(items: DiagramItem[]): DiagramScene {
  const maxContent = MAX_BOX_W - PAD_X * 2
  const contents = items.map((step) => measureContent(step, maxContent))
  if (contents.length === 0) return EMPTY_SCENE
  const widths = contents.map(
    (c) => clamp(c.contentW, MIN_BOX_W - PAD_X * 2, maxContent) + PAD_X * 2
  )
  const height = Math.max(...contents.map((c) => boxHeight(c, true)))

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
      boxes[i] = {
        ...contents[i],
        x,
        y,
        w: widths[i],
        h: height,
        tone: items[i].tone ?? 'card',
        index: indexLabel(i)
      }
      if (position > 0) {
        arrows.push(lineTo(x - ARROW_GAP + 3, y + height / 2, x, y + height / 2))
      }
      x += widths[i] + ARROW_GAP
    })
    rowEdges.push({ left: indent, right: x - ARROW_GAP, cy: y + height / 2 })
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
}

/** Single column, top to bottom. */
export function layoutFlowStacked(items: DiagramItem[]): DiagramScene {
  const maxContent = NARROW_MAX - PAD_X * 2
  const contents = items.map((step) => measureContent(step, maxContent))
  if (contents.length === 0) return EMPTY_SCENE
  const width =
    clamp(Math.max(...contents.map((c) => c.contentW)), STACK_MIN_W - PAD_X * 2, maxContent) +
    PAD_X * 2

  const boxes: DiagramBox[] = []
  const arrows: string[] = []
  let y = 0
  contents.forEach((content, i) => {
    const h = boxHeight(content, true)
    boxes.push({
      ...content,
      x: 0,
      y,
      w: width,
      h,
      tone: items[i].tone ?? 'card',
      index: indexLabel(i)
    })
    if (i > 0) arrows.push(lineTo(width / 2, y - STACK_GAP + 3, width / 2, y))
    y += h + STACK_GAP
  })

  return { width, height: y - STACK_GAP, boxes, lanes: [], arrows, captions: [] }
}
