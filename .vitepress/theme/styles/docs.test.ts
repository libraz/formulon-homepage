import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import english from '../../../src/cell/hooks.md?raw'
import japanese from '../../../src/ja/cell/hooks.md?raw'

/** Render the actual comparison rows; no duplicated column widths or content fixture. */
function renderHookTable(source: string) {
  const block = source.match(/<div class="wide-table cell-hook-table">([\s\S]*?)<\/div>/)
  expect(block, 'the hook comparison remains inside its scrolling wrapper').not.toBeNull()
  if (!block) throw new Error('Missing hook comparison')
  const rows = block[1].split('\n').filter((line) => line.trim().startsWith('|'))
  const host = document.createElement('div')
  host.className = 'vp-doc'
  host.style.cssText = 'padding: 24px; max-width: 916px; margin: auto; box-sizing: border-box'
  const scroller = document.createElement('div')
  scroller.className = 'wide-table cell-hook-table'
  const table = document.createElement('table')
  rows
    .filter((_, index) => index !== 1)
    .forEach((row, index) => {
      const tr = table.insertRow()
      row
        .split('|')
        .slice(1, -1)
        .forEach((text) => {
          const cell = document.createElement(index === 0 ? 'th' : 'td')
          const code = text.trim().match(/^`(.+)`$/)
          if (code) {
            const child = document.createElement('code')
            child.textContent = code[1]
            cell.append(child)
          } else cell.textContent = text.trim()
          tr.append(cell)
        })
    })
  scroller.append(table)
  host.append(scroller)
  document.body.append(host)
  return { table, scroller }
}

describe.each([
  ['en', english],
  ['ja', japanese]
])('%s hook comparison', (_, source) => {
  it.each([1440, 390])('keeps purpose text readable and scrolls at %ipx', async (width) => {
    await page.viewport(width, 900)
    const { table, scroller } = renderHookTable(source)
    expect(table.getBoundingClientRect().width).toBeGreaterThanOrEqual(1100)
    const first = table.rows[1].cells[0]
    expect(first.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      parseFloat(getComputedStyle(first).fontSize) * 14
    )
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    expect(getComputedStyle(scroller).overflowX).toBe('auto')
    scroller.scrollLeft = scroller.scrollWidth
    expect(scroller.scrollLeft).toBeGreaterThan(0)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
  })
})
