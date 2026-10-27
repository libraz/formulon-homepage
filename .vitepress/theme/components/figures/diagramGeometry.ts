/**
 * Shared design-space constants and box maths for the SVG diagram components.
 *
 * Everything is expressed in "design units". The frame renders a diagram at
 * `RENDER_SCALE` times its viewBox width, so the fixed type sizes land on
 * screen a step below the surrounding prose — a 9.5-unit box name renders at
 * about 13.3px, an 8.5-unit note at about 11.9px — while still scaling down
 * with the column on narrow viewports.
 */
import { maxLineWidth, wrapText } from '../diagramText'

/** `.fx-hb` — box names, in the reading face. */
export const LABEL_SIZE = 9.5
/** `.fx-s` — the one or two lines of what a box holds, in the reading face. */
export const NOTE_SIZE = 8.5
export const LABEL_LEADING = 12.5
export const NOTE_LEADING = 11
/** Space between the label block and the note block inside a box. */
export const NOTE_GAP = 2.5
export const PAD_X = 10
export const PAD_Y = 9
/** `.fx-lbl` — row captions and sequence numbers, in the mono face. */
export const CAPTION_SIZE = 7.5
/** Space under a row caption; wider than LANE_PAD so a lane never covers it. */
export const CAPTION_GAP = 10
/** Extra top padding a numbered box reserves for its `.fx-lbl` index. */
export const INDEX_BAND = 9

export const RENDER_SCALE = 1.4
/** Widest a diagram may be drawn before it has to wrap or split into rows. */
export const CANVAS_MAX = 500
/** Widest a diagram may be and still read at phone-column width. */
export const NARROW_MAX = 212

/** `card` takes the primary accent stroke; `alt` the secondary one. */
export type DiagramTone = 'card' | 'alt'

export interface DiagramItem {
  label: string
  note?: string
  /** Secondary accent, for the nodes a figure sets apart (hosts, consumers). */
  tone?: DiagramTone
}

/** Wrapped text plus the intrinsic size the wrapped text needs. */
export interface BoxContent {
  labelLines: string[]
  noteLines: string[]
  /** Width of the widest wrapped line, excluding padding. */
  contentW: number
  /** Height of the text block, excluding padding. */
  contentH: number
}

export interface DiagramBox extends BoxContent {
  x: number
  y: number
  w: number
  h: number
  tone: DiagramTone
  /** Sequence number drawn at the top-left, e.g. "01". */
  index?: string
}

export interface DiagramLane {
  x: number
  y: number
  w: number
  h: number
}

export interface DiagramCaption {
  x: number
  y: number
  text: string
}

/** Everything one `<svg>` draws, in design units. */
export interface DiagramScene {
  width: number
  height: number
  boxes: DiagramBox[]
  lanes: DiagramLane[]
  /** Connector path data; each one is drawn with the arrow marker at its end. */
  arrows: string[]
  captions: DiagramCaption[]
}

export const EMPTY_SCENE: DiagramScene = {
  width: 1,
  height: 1,
  boxes: [],
  lanes: [],
  arrows: [],
  captions: []
}

/** Wrap one item's text to `maxContent` and report the size it then needs. */
export function measureContent(item: DiagramItem, maxContent: number): BoxContent {
  const labelLines = wrapText(item.label, LABEL_SIZE, maxContent)
  const noteLines = item.note ? wrapText(item.note, NOTE_SIZE, maxContent) : []
  const contentW = Math.max(
    maxLineWidth(labelLines, LABEL_SIZE),
    maxLineWidth(noteLines, NOTE_SIZE)
  )
  const contentH =
    labelLines.length * LABEL_LEADING +
    (noteLines.length > 0 ? NOTE_GAP + noteLines.length * NOTE_LEADING : 0)
  return { labelLines, noteLines, contentW, contentH }
}

/** Outer box height for a measured content block. */
export function boxHeight(content: BoxContent, numbered = false): number {
  return content.contentH + PAD_Y * 2 + (numbered ? INDEX_BAND : 0)
}

/** Two-digit sequence label for the box at `i`. */
export function indexLabel(i: number): string {
  return String(i + 1).padStart(2, '0')
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

/** Round to 2 decimals so path strings stay short and diff-stable. */
export function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Straight connector between two points. */
export function lineTo(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${r2(x1)} ${r2(y1)} L ${r2(x2)} ${r2(y2)}`
}

/**
 * Elbow connector: down from `(fromX, fromY)` to the mid-gutter, across, then
 * down into `(toX, toY)`. Used for the fan-out between layer rows, where a
 * diagonal would read as a data edge rather than as containment.
 */
export function elbow(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  midY: number
): string {
  if (Math.abs(fromX - toX) < 0.5) return lineTo(fromX, fromY, toX, toY)
  return [
    `M ${r2(fromX)} ${r2(fromY)}`,
    `L ${r2(fromX)} ${r2(midY)}`,
    `L ${r2(toX)} ${r2(midY)}`,
    `L ${r2(toX)} ${r2(toY)}`
  ].join(' ')
}
