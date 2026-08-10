/**
 * Shared design-space constants and box maths for the SVG diagram components.
 *
 * Everything is expressed in "design units". The frame renders a diagram at
 * `RENDER_SCALE` times its viewBox width, so the fixed `.fx-*` type sizes land
 * on screen at roughly the size the surrounding prose uses — a 10.5-unit label
 * renders at about 14.7px, a 8.5-unit note at about 11.9px — while still
 * scaling down with the column on narrow viewports.
 */
import { maxLineWidth, wrapText } from '../diagramText'

/** `.fx-note--strong` — box labels, in the reading face. */
export const LABEL_SIZE = 10.5
/** `.fx-tick` — secondary captions, in the mono face. */
export const NOTE_SIZE = 8.5
export const LABEL_LEADING = 13
export const NOTE_LEADING = 10.5
/** Space between the label block and the note block inside a box. */
export const NOTE_GAP = 3
export const PAD_X = 10
export const PAD_Y = 9
/** `.fx-axis-label` — row captions. */
export const CAPTION_SIZE = 9
/** Space under a row caption; wider than LANE_PAD so a lane never covers it. */
export const CAPTION_GAP = 10

export const RENDER_SCALE = 1.4
/** Widest a diagram may be drawn before it has to wrap or split into rows. */
export const CANVAS_MAX = 500
/** Widest a diagram may be and still read at phone-column width. */
export const NARROW_MAX = 212

export interface DiagramItem {
  label: string
  note?: string
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

/** Wrap one item's text to `maxContent` and report the size it then needs. */
export function measureContent(item: DiagramItem, maxContent: number): BoxContent {
  const labelLines = wrapText(item.label, LABEL_SIZE, maxContent)
  const noteLines = item.note ? wrapText(item.note, NOTE_SIZE, maxContent, true) : []
  const contentW = Math.max(
    maxLineWidth(labelLines, LABEL_SIZE),
    maxLineWidth(noteLines, NOTE_SIZE, true)
  )
  const contentH =
    labelLines.length * LABEL_LEADING +
    (noteLines.length > 0 ? NOTE_GAP + noteLines.length * NOTE_LEADING : 0)
  return { labelLines, noteLines, contentW, contentH }
}

/** Outer box height for a measured content block. */
export function boxHeight(content: BoxContent): number {
  return content.contentH + PAD_Y * 2
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
