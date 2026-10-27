import { describe, expect, it } from 'vitest'
import { measureText } from '../diagramText'
import {
  type DiagramItem,
  type DiagramScene,
  LABEL_SIZE,
  NOTE_SIZE,
  PAD_X,
  PAD_Y
} from './diagramGeometry'
import { layoutFlowStacked, layoutFlowWide } from './flowLayout'
import { type LayerRow, layoutLayersNarrow, layoutLayersWide } from './layersLayout'

const pages = import.meta.glob('../../../../src/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

interface Figure {
  page: string
  kind: 'DiagramFlow' | 'DiagramLayers'
  props: Record<string, unknown>
}

/**
 * Parse the object/array literal of a bound prop. The pages only use
 * single-quoted strings, bare keys, and trailing commas, so rewriting those
 * into JSON is enough; anything else fails the parse loudly.
 */
function parseLiteral(source: string): unknown {
  let json = ''
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === "'") {
      let text = ''
      for (i++; i < source.length && source[i] !== "'"; i++) {
        text += source[i] === '\\' ? source[++i] : source[i]
      }
      json += JSON.stringify(text)
    } else if (/[A-Za-z_]/.test(ch)) {
      const word = source.slice(i).match(/^[A-Za-z_]\w*/)?.[0] ?? ch
      json += /^\s*:/.test(source.slice(i + word.length)) ? JSON.stringify(word) : word
      i += word.length - 1
    } else {
      json += ch
    }
  }
  return JSON.parse(json.replace(/,(\s*[\]}])/g, '$1'))
}

/** Every DiagramFlow / DiagramLayers tag in a page, with its props parsed. */
function figuresIn(page: string, source: string): Figure[] {
  const figures: Figure[] = []
  for (const tag of source.matchAll(/<(DiagramFlow|DiagramLayers)\b([\s\S]*?)\/>/g)) {
    const props: Record<string, unknown> = {}
    for (const attr of tag[2].matchAll(/(:?)([\w-]+)="([^"]*)"/g)) {
      const [, bound, name, value] = attr
      props[name] = bound ? parseLiteral(value) : value
    }
    if (/(^|\s)vertical(\s|$)/.test(tag[2])) props.vertical = true
    figures.push({ page, kind: tag[1] as Figure['kind'], props })
  }
  return figures
}

const figures = Object.entries(pages).flatMap(([path, source]) =>
  figuresIn(path.replace(/^.*\/src\//, ''), source)
)

const asItem = (node: string | DiagramItem): DiagramItem =>
  typeof node === 'string' ? { label: node } : node

function flowItems(steps: unknown): DiagramItem[] {
  const list =
    typeof steps === 'string'
      ? steps.split(/\s*(?:→|->)\s*/).filter(Boolean)
      : (steps as Array<string | DiagramItem>)
  return list.map(asItem)
}

function layerRows(layers: unknown): LayerRow[] {
  return (layers as Array<{ title?: string; nodes: Array<string | DiagramItem> }>).map((l) => ({
    title: l.title,
    nodes: l.nodes.map(asItem)
  }))
}

function scenesOf(figure: Figure): DiagramScene[] {
  if (figure.kind === 'DiagramFlow') {
    const items = flowItems(figure.props.steps)
    return [layoutFlowWide(items), layoutFlowStacked(items)]
  }
  const rows = layerRows(figure.props.layers)
  return [layoutLayersWide(rows), layoutLayersNarrow(rows)]
}

function itemsOf(figure: Figure): DiagramItem[] {
  return figure.kind === 'DiagramFlow'
    ? flowItems(figure.props.steps)
    : layerRows(figure.props.layers).flatMap((row) => row.nodes)
}

type Box = DiagramScene['boxes'][number]
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** Identifier joints (`.`, `_`) are legitimate break points, so they split words. */
const LATIN_WORD = /[A-Za-z0-9'’]+/g

describe('doc diagrams', () => {
  it('finds the figures in both locales', () => {
    expect(figures.length).toBeGreaterThan(40)
  })

  for (const figure of figures) {
    const name = `${figure.page} ${figure.kind} "${itemsOf(figure)[0]?.label}"`

    it(`${name}: text fits its box and boxes do not collide`, () => {
      for (const scene of scenesOf(figure)) {
        for (const box of scene.boxes) {
          const inner = box.w - PAD_X * 2 + 0.01
          for (const line of box.labelLines)
            expect(measureText(line, LABEL_SIZE)).toBeLessThan(inner)
          for (const line of box.noteLines) expect(measureText(line, NOTE_SIZE)).toBeLessThan(inner)
          expect(box.h).toBeGreaterThanOrEqual(box.contentH + PAD_Y * 2 - 0.01)
        }
        scene.boxes.forEach((a, i) => {
          for (const b of scene.boxes.slice(i + 1)) expect(overlaps(a, b), name).toBe(false)
        })
      }
    })

    it(`${name}: no word is split across lines in the wide layout`, () => {
      const [wide] = scenesOf(figure)
      const items = itemsOf(figure)
      wide.boxes.forEach((box, i) => {
        const pairs: Array<[string, string[]]> = [
          [items[i].label, box.labelLines],
          [items[i].note ?? '', box.noteLines]
        ]
        for (const [source, lines] of pairs) {
          const joined = ` ${lines.join(' ')} `
          for (const word of source.match(LATIN_WORD) ?? []) {
            expect(joined.includes(word), `"${word}" in ${lines.join(' | ')}`).toBe(true)
          }
        }
      })
    })

    it(`${name}: a box holds at most two lines of note`, () => {
      const [wide] = scenesOf(figure)
      for (const box of wide.boxes) expect(box.noteLines.length).toBeLessThanOrEqual(2)
    })

    it(`${name}: closes with a caption line`, () => {
      expect(typeof figure.props.caption, name).toBe('string')
      expect(String(figure.props.caption).trim()).not.toBe('')
    })
  }

  it('every page draws the same figures in English and Japanese', () => {
    const shape = (page: string) =>
      figures
        .filter((f) => f.page === page)
        .map((f) =>
          f.kind === 'DiagramFlow'
            ? `flow:${flowItems(f.props.steps).length}`
            : `layers:${layerRows(f.props.layers)
                .map((r) => r.nodes.length)
                .join('/')}`
        )
    const english = [...new Set(figures.map((f) => f.page).filter((p) => !p.startsWith('ja/')))]
    for (const page of english) expect(shape(`ja/${page}`), page).toEqual(shape(page))
  })
})
