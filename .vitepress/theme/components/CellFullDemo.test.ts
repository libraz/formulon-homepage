import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { nextTick } from 'vue'
import {
  captureMounts,
  cellNumber,
  mountDemo,
  requiredElement
} from '../../../src/test/cellHarness'
import { isDark, lang } from '../../../src/test/siteData'
import CellFullDemo from './CellFullDemo.vue'

async function openDemo() {
  const capture = await captureMounts()
  const wrapper = mountDemo(CellFullDemo)
  await page.getByRole('button', { name: 'Open full demo', exact: true }).click()
  await expect.poll(() => capture.instances.length).toBe(1)
  await expect.poll(() => document.querySelector('.cell-full-demo__notice')).toBeNull()
  return { wrapper, ...capture }
}

describe('full spreadsheet demo', () => {
  it.each([
    [1440, 1000],
    [390, 844]
  ])('uses the complete %ix%i viewport after overlays mount', async (width, height) => {
    await page.viewport(width, height)
    const { instances } = await openDemo()
    const surface = requiredElement('.cell-full-demo__window')
    const sheet = requiredElement('.cell-full-demo__sheet')
    expect(surface.getBoundingClientRect().height).toBeCloseTo(height, 0)
    expect(sheet.getBoundingClientRect().height).toBeGreaterThan(height - 60)
    const canvas = requiredElement('.cell-full-demo__sheet canvas')
    expect(canvas.getBoundingClientRect().height).toBeGreaterThan(height * 0.6)
    if (width === 390) {
      const ribbon = requiredElement('.cell-full-demo__sheet .fc-tb__ribbon-shell')
      expect(getComputedStyle(ribbon).overflowX).toBe('auto')
      expect(ribbon.scrollWidth).toBeGreaterThan(ribbon.clientWidth)
      ribbon.scrollLeft = ribbon.scrollWidth
      expect(ribbon.scrollLeft).toBeGreaterThan(0)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
    }

    // The real library appends this portal as a sibling of the main window.
    const portal = requiredElement('.cell-full-demo__overlay > .fc-overlay-portal')
    expect(portal).not.toBeNull()
    expect(getComputedStyle(portal).position).toBe('absolute')
    const instance = instances[0]
    instance.openFormatDialog('number')
    await expect.poll(() => portal.children.length).toBeGreaterThan(0)
    expect(surface.getBoundingClientRect().height).toBeCloseTo(height, 0)
    expect(sheet.getBoundingClientRect().height).toBeGreaterThan(height - 60)
  })

  it('recalculates rendered dependent cells and follows site locale/theme', async () => {
    const { instances } = await openDemo()
    const instance = instances[0]
    expect(cellNumber(instance, 1, 3)).toEqual({ kind: 'number', value: 5400 })
    const result = instance.commands.execute({
      type: 'cellBatch',
      operation: 'valueEdit',
      origin: 'instanceApi',
      changes: [{ addr: { sheet: 0, row: 1, col: 1 }, input: '20000' }]
    })
    expect(result.status).toBe('applied')
    expect(cellNumber(instance, 1, 3)).toEqual({ kind: 'number', value: 12600 })
    const setTheme = vi.spyOn(instance, 'setTheme')
    lang.value = 'ja'
    isDark.value = true
    await nextTick()
    expect(instance.i18n.locale).toBe('ja')
    expect(setTheme).toHaveBeenCalledWith('ink')
    expect(document.querySelector('.cell-full-demo__close')?.getAttribute('aria-label')).toBe(
      'フルデモを閉じる'
    )
  })

  it('closes search first, then closes the demo, disposes and restores trigger focus', async () => {
    const { instances } = await openDemo()
    const instance = instances[0]
    const dispose = vi.spyOn(instance, 'dispose')
    instance.openFindReplace('find')
    await expect
      .poll(() => document.querySelector('.fc-find')?.getClientRects().length ?? 0)
      .toBeGreaterThan(0)
    await userEvent.keyboard('{Escape}')
    expect(document.querySelector('dialog')?.open).toBe(true)
    await expect
      .poll(() => document.querySelector('.fc-find')?.getClientRects().length ?? 0)
      .toBe(0)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.querySelector('.cell-full-demo__overlay')).toBeNull()
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(document.documentElement.classList.contains('cell-demo-overlay-open')).toBe(false)
    expect(document.activeElement?.textContent).toBe('Open full demo')
  })

  it('disposes a real mount resolving after the reader has already closed it', async () => {
    const { api, spy, original } = await captureMounts()
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    let mounted: Awaited<ReturnType<typeof api.Spreadsheet.mount>> | undefined
    let dispose: ReturnType<typeof vi.spyOn> | undefined
    spy.mockImplementation(async (...args) => {
      mounted = await original(...args)
      dispose = vi.spyOn(mounted, 'dispose')
      await pending
      return mounted
    })
    const wrapper = mountDemo(CellFullDemo)
    await page.getByRole('button', { name: 'Open full demo', exact: true }).click()
    await expect.poll(() => mounted).toBeDefined()
    await page.getByRole('button', { name: 'Close full demo', exact: true }).click()
    release?.()
    await expect.poll(() => dispose?.mock.calls.length).toBe(1)
    expect(document.querySelector('.cell-full-demo__overlay')).toBeNull()
    wrapper.unmount()
    expect(dispose?.mock.calls.length).toBe(1)
  })

  it('enters fullscreen on the window div and exits it when closing', async () => {
    await openDemo()
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click()
    await expect.poll(() => document.fullscreenElement?.className).toBe('cell-full-demo__window')
    await expect
      .element(page.getByRole('button', { name: 'Exit fullscreen', exact: true }))
      .toBeVisible()
    await page.getByRole('button', { name: 'Close full demo', exact: true }).click()
    await expect.poll(() => document.fullscreenElement).toBeNull()
  })
})
