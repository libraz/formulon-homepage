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
    const bar = requiredElement('.cell-full-demo__bar')
    const platform = requiredElement<HTMLSelectElement>('.cell-full-demo__platform select')
    expect(surface.getBoundingClientRect().height).toBeCloseTo(height, 0)
    expect(sheet.getBoundingClientRect().height).toBeGreaterThan(height - 60)
    expect(bar.getBoundingClientRect().width).toBeLessThanOrEqual(width)
    expect(bar.getBoundingClientRect().right).toBeLessThanOrEqual(width)
    expect(platform.getBoundingClientRect().right).toBeLessThanOrEqual(width)
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
    await userEvent.selectOptions(
      requiredElement<HTMLSelectElement>('.cell-full-demo__platform select'),
      'mac'
    )
    await expect.poll(() => instance.host.dataset.fcPlatform).toBe('mac')
    expect(instance.i18n.locale).toBe('ja')
    expect(instance.host.dataset.fcTheme).toBe('ink')
  })

  it('switches to Mac chrome and its palette without remounting the edited workbook', async () => {
    const { instances } = await openDemo()
    const instance = instances[0]
    const result = instance.commands.execute({
      type: 'cellBatch',
      operation: 'valueEdit',
      origin: 'instanceApi',
      changes: [{ addr: { sheet: 0, row: 1, col: 1 }, input: '20000' }]
    })
    expect(result.status).toBe('applied')
    expect(cellNumber(instance, 1, 3)).toEqual({ kind: 'number', value: 12600 })

    const platform = requiredElement<HTMLSelectElement>('.cell-full-demo__platform select')
    await userEvent.selectOptions(platform, 'mac')
    await expect.poll(() => instance.host.dataset.fcPlatform).toBe('mac')
    expect(instances).toEqual([instance])
    expect(cellNumber(instance, 1, 1)).toEqual({ kind: 'number', value: 20000 })
    expect(cellNumber(instance, 1, 3)).toEqual({ kind: 'number', value: 12600 })
    await expect.element(page.getByRole('tab', { name: 'Draw', exact: true })).toBeVisible()

    instance.openFunctionArguments('SUM')
    await expect
      .poll(() => document.querySelector('.fc-mac-formula-palette:not([hidden])'))
      .not.toBeNull()
    const palette = requiredElement('.fc-mac-formula-palette')
    expect(palette.textContent).toContain('numbers')
    expect(palette.textContent).toContain('The values or range to add.')
    expect(palette.querySelector('a')?.getAttribute('href')).toContain('/workbook/formula-engine')

    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => document.querySelector('.fc-mac-formula-palette:not([hidden])'))
      .toBeNull()
    expect(document.querySelector('.cell-full-demo__overlay')).not.toBeNull()

    lang.value = 'ja'
    await nextTick()
    expect(instance.i18n.locale).toBe('ja')
    instance.openFunctionArguments('SUM')
    await expect
      .poll(() => document.querySelector('.fc-mac-formula-palette:not([hidden])'))
      .not.toBeNull()
    const japanesePalette = requiredElement('.fc-mac-formula-palette')
    expect(japanesePalette.textContent).toContain('数値')
    expect(japanesePalette.textContent).toContain('合計する値または範囲。')
    expect(japanesePalette.querySelector('a')?.getAttribute('href')).toContain(
      '/ja/workbook/formula-engine'
    )
    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => document.querySelector('.fc-mac-formula-palette:not([hidden])'))
      .toBeNull()

    await userEvent.selectOptions(platform, 'default')
    await expect.poll(() => instance.host.dataset.fcPlatform).toBe('default')
    expect(instances).toEqual([instance])
    expect(cellNumber(instance, 1, 1)).toEqual({ kind: 'number', value: 20000 })
    expect(document.querySelector('.fc-mac-formula-palette')).toBeNull()
  })

  it('restores a compound formula-bar draft when the Mac palette is cancelled', async () => {
    const { instances } = await openDemo()
    const instance = instances[0]
    const platform = requiredElement<HTMLSelectElement>('.cell-full-demo__platform select')
    await userEvent.selectOptions(platform, 'mac')
    await expect.poll(() => instance.host.dataset.fcPlatform).toBe('mac')

    const formulaInput = requiredElement<HTMLTextAreaElement>('.fc-host__formulabar-input')
    const draft = '=1+SUM(2,3)*4'
    const caret = draft.indexOf('2') + 1
    const beforeValue = instance.workbook.getValue({ sheet: 0, row: 0, col: 0 })
    const beforeFormula = instance.workbook.cellFormula({ sheet: 0, row: 0, col: 0 })
    await userEvent.fill(formulaInput, draft)
    formulaInput.setSelectionRange(caret, caret)
    formulaInput.dispatchEvent(new Event('select', { bubbles: true }))
    expect(formulaInput.value).toBe(draft)
    expect(formulaInput.selectionStart).toBe(caret)
    expect(formulaInput.selectionEnd).toBe(caret)
    expect(formulaInput.closest('.fc-host__formulabar')?.getAttribute('data-fc-editing')).toBe('1')

    instance.openFunctionArguments('SUM')
    await expect
      .poll(() => document.querySelector('.fc-mac-formula-palette:not([hidden])'))
      .not.toBeNull()
    const paletteArgument = requiredElement<HTMLInputElement>(
      '.fc-mac-formula-palette input[data-argument-index="0"]'
    )
    await userEvent.fill(paletteArgument, '99')
    expect(paletteArgument.value).toBe('99')

    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => document.querySelector('.fc-mac-formula-palette:not([hidden])'))
      .toBeNull()
    expect(document.querySelector('.cell-full-demo__overlay')).not.toBeNull()
    expect(instance.workbook.getValue({ sheet: 0, row: 0, col: 0 })).toEqual(beforeValue)
    expect(instance.workbook.cellFormula({ sheet: 0, row: 0, col: 0 })).toBe(beforeFormula)
    expect(formulaInput.isConnected).toBe(true)
    expect(document.activeElement).toBe(formulaInput)
    expect(formulaInput.value).toBe(draft)
    expect(formulaInput.selectionStart).toBe(caret)
    expect(formulaInput.selectionEnd).toBe(caret)
    expect(formulaInput.closest('.fc-host__formulabar')?.getAttribute('data-fc-editing')).toBe('1')
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
