import type { SpreadsheetInstance } from '@libraz/formulon-cell'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { captureMounts, cellNumber, mountDemo, ready } from '../../test/cellHarness'
import CellEmbedDemo from './CellEmbedDemo.vue'
import type { CellEmbedScenario } from './cellEmbedScenarios'

const addr = (row: number, col: number) => ({ sheet: 0, row, col })

type MountCapture = Awaited<ReturnType<typeof captureMounts>>

function firstInstance(captured: MountCapture): SpreadsheetInstance {
  const instance = captured.instances[0]
  if (!instance) throw new Error('The demo did not mount a spreadsheet instance')
  return instance
}

function numberValue(instance: SpreadsheetInstance, row: number, col: number): number {
  const value = cellNumber(instance, row, col)
  if (value?.kind !== 'number') throw new Error(`Expected number at ${row}:${col}`)
  return value.value
}

async function mountScenario(scenario: CellEmbedScenario) {
  const captured = await captureMounts()
  const wrapper = mountDemo(CellEmbedDemo, { scenario })
  return { captured, wrapper }
}

describe('CellEmbedDemo', () => {
  it('mounts a viewer with the embedded chrome and blocks writes', async () => {
    const { captured, wrapper } = await mountScenario('viewer')
    await ready(wrapper)
    const instance = firstInstance(captured)
    const host = wrapper.find('.cell-embed-demo__host').element

    expect(host.querySelector('.fc-host__ribbon')).toBeNull()
    expect(host.querySelector('.fc-host__statusbar')).toBeNull()
    expect(host.querySelector('.fc-host__formulabar')).not.toBeNull()

    const result = instance.commands.execute({
      type: 'cellBatch',
      operation: 'valueEdit',
      origin: 'instanceApi',
      changes: [{ addr: addr(1, 1), input: '99' }]
    })
    expect(result.status).toBe('rejected')
    expect(result.rejected[0]?.code).toBe('readOnly')
    expect(numberValue(instance, 1, 1)).toBe(42)
  })

  it('accepts editable boundary cells and refreshes calculated values after keyboard edits', async () => {
    const { captured, wrapper } = await mountScenario('form')
    await ready(wrapper)
    const instance = firstInstance(captured)

    const inputEdit = instance.commands.execute({
      type: 'cellBatch',
      operation: 'valueEdit',
      origin: 'instanceApi',
      changes: [{ addr: addr(1, 1), input: '7' }]
    })
    expect(inputEdit.status).toBe('applied')
    await expect.poll(() => numberValue(instance, 1, 3)).toBe(840)
    await expect.poll(() => wrapper.text()).toContain('B2=7 · D2=840')

    const formulaBar = page.getByRole('textbox', { name: /formula bar/i })
    await formulaBar.fill('8')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => numberValue(instance, 1, 3)).toBe(960)
    await expect.poll(() => wrapper.text()).toContain('B2=8 · D2=960')

    const edgeEdit = instance.commands.execute({
      type: 'cellBatch',
      operation: 'valueEdit',
      origin: 'instanceApi',
      changes: [{ addr: addr(3, 2), input: '90' }]
    })
    expect(edgeEdit.status).toBe('applied')
    await expect.poll(() => numberValue(instance, 3, 2)).toBe(90)
    await expect.poll(() => numberValue(instance, 3, 3)).toBe(270)
  })

  it('rejects calculated and outside cells through the form policy command', async () => {
    const { captured, wrapper } = await mountScenario('form')
    await ready(wrapper)
    const instance = firstInstance(captured)

    expect(numberValue(instance, 1, 3)).toBe(240)
    expect(instance.workbook.cellFormula(addr(1, 3))).toBe('=B2*C2')

    await page.getByRole('button', { name: /Try editing D2/i }).click()
    await expect.poll(() => wrapper.text()).toContain('D2 rejected (cellIneligible)')
    expect(numberValue(instance, 1, 3)).toBe(240)
    expect(instance.workbook.cellFormula(addr(1, 3))).toBe('=B2*C2')

    const outsideCells = [addr(1, 0), addr(1, 3), addr(4, 1)]
    for (const target of outsideCells) {
      const result = instance.commands.execute({
        type: 'cellBatch',
        operation: 'valueEdit',
        origin: 'instanceApi',
        changes: [{ addr: target, input: '999' }]
      })
      expect(result.status).toBe('rejected')
      expect(result.rejected[0]?.code).toBe('cellIneligible')
    }
  })

  it('refreshes dependent cells after a trusted host snapshot', async () => {
    const { captured, wrapper } = await mountScenario('host-sync')
    await ready(wrapper)
    const instance = firstInstance(captured)

    await page.getByRole('button', { name: /Apply host snapshot/i }).click()
    await expect.poll(() => numberValue(instance, 1, 3)).toBe(25.86)
    await expect.poll(() => numberValue(instance, 4, 1)).toBe(115)
    await expect.poll(() => numberValue(instance, 4, 2)).toBe(3225)
    await expect.poll(() => numberValue(instance, 4, 3)).toBe(28.04)
    expect(wrapper.text()).toContain('changeBatch: applied')
  })

  it('changes profiles around the same workbook and preserves edited values', async () => {
    const { captured, wrapper } = await mountScenario('profiles')
    await ready(wrapper)
    const instance = firstInstance(captured)

    const edit = instance.commands.execute({
      type: 'cellBatch',
      operation: 'valueEdit',
      origin: 'instanceApi',
      changes: [{ addr: addr(1, 1), input: '77' }]
    })
    expect(edit.status).toBe('applied')
    await expect.poll(() => numberValue(instance, 1, 1)).toBe(77)

    await page.getByRole('tab', { name: 'excel365', exact: true }).click()
    await expect.poll(() => wrapper.find('.fc-host__ribbon').exists()).toBe(true)
    expect(captured.instances).toHaveLength(1)
    expect(captured.instances[0]).toBe(instance)
    expect(numberValue(instance, 1, 1)).toBe(77)

    await page.viewport(390, 700)
    const ribbonShell = wrapper.find('.fc-tb__ribbon-shell').element as HTMLElement
    expect(ribbonShell.clientWidth).toBeGreaterThan(0)
    expect(ribbonShell.scrollWidth).toBeGreaterThan(ribbonShell.clientWidth)
    expect(getComputedStyle(ribbonShell).overflowX).toBe('auto')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    ribbonShell.scrollLeft = ribbonShell.scrollWidth
    expect(ribbonShell.scrollLeft).toBeGreaterThan(0)
  })

  // These four states cover every pair of the three independent chrome switches.
  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, true],
    [true, true, false]
  ])('sets formula=%s sheets=%s status=%s without remounting', async (formula, sheets, status) => {
    const { captured, wrapper } = await mountScenario('profiles')
    await ready(wrapper)
    const instance = firstInstance(captured)
    if (!formula) await page.getByRole('button', { name: 'Formula bar', exact: true }).click()
    if (sheets) await page.getByRole('button', { name: 'Sheet tabs', exact: true }).click()
    if (status) await page.getByRole('button', { name: 'Status bar', exact: true }).click()
    expect(wrapper.find('.fc-host__formulabar').exists()).toBe(formula)
    expect(wrapper.find('.fc-host__sheetbar').exists()).toBe(sheets)
    expect(wrapper.find('.fc-host__statusbar').exists()).toBe(status)
    expect(captured.instances).toEqual([instance])
  })

  it('updates visible UI labels when the mounted locale changes', async () => {
    const { captured, wrapper } = await mountScenario('theme-locale')
    await ready(wrapper)
    const instance = firstInstance(captured)
    const labels = wrapper.findAll('.demo-result dd').at(-1)
    const english = labels?.text() ?? ''

    expect(instance.i18n.locale).toBe('en')
    expect(english).toContain('Copy')

    await page.getByRole('tab', { name: 'ja', exact: true }).click()
    await expect.poll(() => instance.i18n.locale).toBe('ja')
    await expect
      .poll(() => wrapper.findAll('.demo-result dd').at(-1)?.text() ?? '')
      .toContain('コピー')
    expect(wrapper.find('.fc-host__ribbon').exists()).toBe(false)
    expect(wrapper.find('.fc-host__statusbar').exists()).toBe(false)
    await page.getByRole('tab', { name: 'ink', exact: true }).click()
    expect(wrapper.find('.cell-embed-demo__host').attributes('data-fc-theme')).toBe('ink')
  })

  it('keeps the native overlay closed until requested and bounds its opened layout', async () => {
    await page.viewport(390, 844)
    const { captured, wrapper } = await mountScenario('overlay')
    await expect.poll(() => wrapper.find('dialog').exists()).toBe(true)
    const frame = wrapper.find('.demo-frame').element
    const dialog = wrapper.find('dialog').element as HTMLDialogElement

    expect(captured.instances).toHaveLength(0)
    expect(dialog.open).toBe(false)
    expect(frame.getBoundingClientRect().height).toBeLessThan(400)

    await page.getByRole('button', { name: /Open sheet/i }).click()
    await expect.poll(() => dialog.open).toBe(true)
    await expect.poll(() => wrapper.find('.fc-host__canvas').exists()).toBe(true)
    const opened = dialog.getBoundingClientRect()
    expect(opened.width).toBeLessThanOrEqual(390)
    expect(opened.height).toBeLessThan(600)
    expect(dialog.querySelector('.fc-host__ribbon')).toBeNull()

    await page.getByRole('button', { name: /Open format dialog/i }).click()
    await expect.poll(() => dialog.querySelector('.fc-fmtdlg')).not.toBeNull()
    expect(dialog.contains(dialog.querySelector('.fc-fmtdlg'))).toBe(true)

    const closeFormat = wrapper.find('.fc-fmtdlg__close')
    expect(closeFormat.exists()).toBe(true)
    await userEvent.click(closeFormat.element)
    await expect
      .poll(() => dialog.querySelector('.fc-fmtdlg')?.getClientRects().length ?? 0)
      .toBe(0)

    await page.getByRole('button', { name: /Open find/i }).click()
    await expect
      .poll(() => dialog.querySelector('.fc-find')?.getClientRects().length ?? 0)
      .toBeGreaterThan(0)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => dialog.querySelector('.fc-find')?.getClientRects().length ?? 0).toBe(0)
    expect(dialog.open).toBe(true)

    await userEvent.keyboard('{Escape}')
    await expect.poll(() => dialog.open).toBe(false)
  })
})
