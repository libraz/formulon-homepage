import { expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { captureMounts, cellNumber, mountDemo, ready } from '../../test/cellHarness'
import { isDark, lang } from '../../test/siteData'
import DemoSheet from './DemoSheet.vue'

it('refreshes the displayed dependent cells and avoids cramped embedded chrome', async () => {
  const { instances } = await captureMounts()
  const wrapper = mountDemo(DemoSheet, {
    seed: (wb: import('@libraz/formulon-cell').WorkbookHandle) => {
      wb.setNumber({ sheet: 0, row: 0, col: 0 }, 2)
      wb.setFormula({ sheet: 0, row: 0, col: 1 }, '=A1*3')
      wb.recalc()
    }
  })
  await ready(wrapper)
  const instance = instances[0]
  expect(wrapper.find('.fc-toolbar-shell').exists()).toBe(false)
  expect(cellNumber(instance, 0, 1)).toEqual({ kind: 'number', value: 6 })
  instance.applyChanges([{ addr: { sheet: 0, row: 0, col: 0 }, input: '7' }])
  expect(cellNumber(instance, 0, 1)).toEqual({ kind: 'number', value: 21 })
  const dispose = vi.spyOn(instance, 'dispose')
  const disposeWorkbook = vi.spyOn(instance.workbook, 'dispose')
  wrapper.unmount()
  expect(dispose).toHaveBeenCalledTimes(1)
  expect(disposeWorkbook).toHaveBeenCalledTimes(1)
})

it('reenables editing and context menus after leaving read-only mode', async () => {
  const { instances } = await captureMounts()
  const wrapper = mountDemo(DemoSheet, { seed: () => {}, readOnly: true })
  await ready(wrapper)
  const instance = instances[0]
  const edit = () =>
    instance.commands.execute({
      type: 'cellBatch',
      operation: 'valueEdit',
      origin: 'instanceApi',
      changes: [{ addr: { sheet: 0, row: 0, col: 0 }, input: '7' }]
    })
  expect(edit().status).toBe('rejected')
  const menu = vi.spyOn(instance, 'setContextMenu')
  await wrapper.setProps({ readOnly: false })
  await expect.poll(() => menu.mock.calls.length).toBe(1)
  expect(menu).toHaveBeenCalledWith(undefined)
  expect(edit().status).toBe('applied')
  lang.value = 'ja'
  isDark.value = true
  const theme = vi.spyOn(instance, 'setTheme')
  await nextTick()
  expect(instance.i18n.locale).toBe('ja')
  expect(theme).toHaveBeenCalledWith('ink')
})
