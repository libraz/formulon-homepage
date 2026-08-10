/**
 * Deterministic text metrics for the hand-authored SVG diagrams.
 *
 * SVG has no auto-layout, and the diagram components take arbitrary English
 * and Japanese strings from markdown, so every box has to know its size before
 * anything is drawn. Static rendering runs in Node — no DOM, no canvas, no
 * `getComputedTextLength` — so widths are estimated by summing per-codepoint
 * advance factors instead of being measured.
 *
 * The factors are tuned by eye against the site's reading face (Inter) and mono
 * face (JetBrains Mono, falling back to IBM Plex Sans JP for CJK). They are
 * estimates, not metric-exact, and they deliberately run a little wide on
 * punctuation: an over-estimate grows a box, an under-estimate clips a label.
 */

/** Codepoints the CJK faces render on a full-width advance. */
function isFullWidth(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals, ideographic space, CJK punctuation
    (cp >= 0x3041 && cp <= 0x33ff) || // kana, bopomofo, CJK compatibility
    (cp >= 0x3400 && cp <= 0x4dbf) || // ideographs extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // ideographs
    (cp >= 0xf900 && cp <= 0xfaff) || // compatibility ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compatibility forms
    (cp >= 0xff01 && cp <= 0xff60) || // fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) // fullwidth signs
  )
}

/** Halfwidth katakana, which the same faces render on a half advance. */
function isHalfWidthKana(cp: number): boolean {
  return cp >= 0xff61 && cp <= 0xff9f
}

/** Full-width for line-breaking purposes: breakable at any character boundary. */
function isWideChar(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0
  return isFullWidth(cp) || isHalfWidthKana(cp)
}

const NARROW_LATIN = new Set([..." ilj|!.,;:'"])
const WIDE_LATIN = new Set([...'@#%&mw'])
/** `M` and `W` are far wider than the rest of the uppercase set. */
const EXTRA_WIDE_LATIN = new Set([...'MW'])

/** Advance of one character in em units. */
function advanceFactor(ch: string, mono: boolean): number {
  const cp = ch.codePointAt(0) ?? 0
  if (isFullWidth(cp)) return 1
  if (isHalfWidthKana(cp)) return 0.5
  // Dashes, ellipses and arrows come from the CJK fallback face at full width.
  if (cp === 0x2014 || cp === 0x2015 || cp === 0x2026) return 1
  if (cp >= 0x2190 && cp <= 0x21ff) return 1
  if (mono) return 0.6
  if (NARROW_LATIN.has(ch)) return 0.28
  if (EXTRA_WIDE_LATIN.has(ch)) return 0.88
  if (WIDE_LATIN.has(ch) || (ch >= 'A' && ch <= 'Z')) return 0.66
  return 0.55
}

/**
 * Estimated rendered width of `text` in the same units as `fontSize`.
 *
 * @param mono Measure against the mono face, where every Latin glyph shares
 *   one advance, instead of the proportional reading face.
 */
export function measureText(text: string, fontSize: number, mono = false): number {
  let units = 0
  for (const ch of text) units += advanceFactor(ch, mono)
  return units * fontSize
}

/** Widest of an already-wrapped set of lines. */
export function maxLineWidth(lines: string[], fontSize: number, mono = false): number {
  let widest = 0
  for (const line of lines) widest = Math.max(widest, measureText(line, fontSize, mono))
  return widest
}

/** Characters that may not start a line. */
const NO_BREAK_BEFORE = new Set([
  ...'、。，．・）」』】〕｝〉》｀！？：；’”',
  ...'!?,.:;)]}%',
  ...'…→←·/'
])

/** Characters that may not end a line. */
const NO_BREAK_AFTER = new Set([...'（「『【〔｛〈《‘“', ...'([{'])

/** Latin punctuation that reads as a segment boundary. */
const BREAK_AFTER = new Set([...'/·—-,)]}'])
const BREAK_BEFORE = new Set([...'([{'])

/**
 * Whether a line may be split between `prev` and `next`.
 *
 * Japanese has no inter-word spaces, so any character boundary is a candidate
 * as long as it does not strand closing punctuation at the start of a line or
 * an opening bracket at the end of one. English only breaks on word
 * boundaries, plus a few separators (`/`, `-`, `·`) that read as such.
 */
function canBreakBetween(prev: string, next: string): boolean {
  if (NO_BREAK_BEFORE.has(next)) return false
  if (NO_BREAK_AFTER.has(prev)) return false
  if (prev === ' ') return true
  if (next === ' ') return false
  if (isWideChar(prev) || isWideChar(next)) return true
  if (BREAK_AFTER.has(prev)) return true
  if (BREAK_BEFORE.has(next)) return true
  return false
}

/**
 * Greedily wrap `text` to lines no wider than `maxWidth`.
 *
 * Falls back to a hard break mid-token when a single unbreakable run is wider
 * than the box, so a long identifier degrades to two lines rather than
 * overflowing.
 */
export function wrapText(text: string, fontSize: number, maxWidth: number, mono = false): string[] {
  const source = text.trim()
  if (source === '') return []

  const lines: string[] = []
  let line: string[] = []
  let lineWidth = 0
  let breakAt = -1

  const flush = (cut: number) => {
    const head = line.slice(0, cut).join('').trimEnd()
    if (head !== '') lines.push(head)
    const rest = line.slice(cut)
    while (rest.length > 0 && rest[0] === ' ') rest.shift()
    line = rest
    lineWidth = measureText(line.join(''), fontSize, mono)
    breakAt = -1
    for (let k = 1; k < line.length; k++) {
      if (canBreakBetween(line[k - 1], line[k])) breakAt = k
    }
  }

  for (const ch of Array.from(source)) {
    const advance = advanceFactor(ch, mono) * fontSize
    if (line.length > 0 && lineWidth + advance > maxWidth) {
      const breakable = canBreakBetween(line[line.length - 1], ch)
      flush(breakable || breakAt <= 0 ? line.length : breakAt)
      // A hard break (breakAt <= 0) drops the whole line; the character below
      // then starts the next one.
    }
    if (line.length > 0 && canBreakBetween(line[line.length - 1], ch)) breakAt = line.length
    line.push(ch)
    lineWidth += advance
  }

  const tail = line.join('').trimEnd()
  if (tail !== '') lines.push(tail)
  return lines
}
