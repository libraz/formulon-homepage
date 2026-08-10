/**
 * Box maths for the precedence-cascade figure.
 *
 * A cascade band is left-aligned and carries three optional text runs — a
 * mono micro-label, the declaration itself, and a note — so it cannot reuse
 * the centred box maths in diagramGeometry.ts. Type sizes and padding do come
 * from there, so a cascade band sits on the same rhythm as every other figure.
 */
import { wrapText } from '../diagramText'
import {
  CAPTION_SIZE,
  LABEL_LEADING,
  LABEL_SIZE,
  NOTE_GAP,
  NOTE_LEADING,
  NOTE_SIZE,
  PAD_X,
  PAD_Y,
  r2
} from './diagramGeometry'

/** Left channel the cascade-direction arrow runs down. */
const GUTTER = 22
/** Padding between the container band and the declarations it groups. */
const LANE_PAD = 7
/** Vertical gutter between two competing declarations. */
const BAND_GAP = 6
/** Space under a band's micro-label. */
const TAG_GAP = 4
/** Vertical gutter between the container and the resolved value. */
const DROP_GAP = 18

export interface CascadeBand {
  /** Mono micro-label above the declaration (e.g. a cascade layer name). */
  tag?: string
  label: string
  note?: string
}

interface TextLine {
  text: string
  y: number
}

export interface CascadeBox {
  x: number
  y: number
  w: number
  h: number
  tag: TextLine | null
  labels: TextLine[]
  notes: TextLine[]
}

/** Everything one cascade `<svg>` draws, in design units. */
export interface CascadeScene {
  width: number
  height: number
  /** Container band standing for the scope the declarations compete in. */
  lane: { x: number; y: number; w: number; h: number }
  bands: CascadeBox[]
  /** The value that wins, drawn under the container. */
  resolved: CascadeBox
  arrows: string[]
  /** Left inset of every text run inside a box. */
  padX: number
}

/** Lay one band out at `(x, y)` and resolve its text baselines. */
function placeBand(band: CascadeBand, x: number, y: number, w: number): CascadeBox {
  const maxContent = w - PAD_X * 2
  const labelLines = wrapText(band.label, LABEL_SIZE, maxContent)
  const noteLines = band.note ? wrapText(band.note, NOTE_SIZE, maxContent, true) : []

  let cursor = y + PAD_Y
  const tag = band.tag ? { text: band.tag, y: cursor + CAPTION_SIZE } : null
  if (band.tag) cursor += CAPTION_SIZE + TAG_GAP

  const labels = labelLines.map((text, i) => ({
    text,
    y: cursor + i * LABEL_LEADING + LABEL_LEADING / 2 + LABEL_SIZE * 0.35
  }))
  cursor += labelLines.length * LABEL_LEADING
  if (noteLines.length > 0) cursor += NOTE_GAP

  const notes = noteLines.map((text, i) => ({
    text,
    y: cursor + i * NOTE_LEADING + NOTE_LEADING / 2 + NOTE_SIZE * 0.35
  }))
  cursor += noteLines.length * NOTE_LEADING

  return { x, y, w, h: cursor - y + PAD_Y, tag, labels, notes }
}

/**
 * Stack `bands` inside one container at `width` design units, with `resolved`
 * drawn underneath as the value that wins.
 */
export function buildCascade(
  bands: CascadeBand[],
  resolved: CascadeBand,
  width: number
): CascadeScene {
  const laneX = GUTTER
  const laneW = width - GUTTER
  const bandX = laneX + LANE_PAD
  const bandW = laneW - LANE_PAD * 2

  const boxes: CascadeBox[] = []
  let y = LANE_PAD
  for (const band of bands) {
    const box = placeBand(band, bandX, y, bandW)
    boxes.push(box)
    y += box.h + BAND_GAP
  }
  const laneH = y - BAND_GAP + LANE_PAD

  const resolvedBox = placeBand(resolved, laneX, laneH + DROP_GAP, laneW)
  const channel = r2(GUTTER / 2)
  const centre = r2(laneX + laneW / 2)

  return {
    width,
    height: resolvedBox.y + resolvedBox.h,
    lane: { x: laneX, y: 0, w: laneW, h: laneH },
    bands: boxes,
    resolved: resolvedBox,
    arrows: [
      // Cascade direction, spanning the competing declarations.
      `M ${channel} ${r2(LANE_PAD + 2)} L ${channel} ${r2(laneH - LANE_PAD - 2)}`,
      // Container to the value that wins.
      `M ${centre} ${r2(laneH + 3)} L ${centre} ${r2(resolvedBox.y)}`
    ],
    padX: PAD_X
  }
}
