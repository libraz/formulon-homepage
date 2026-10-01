import { expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { captureMounts, cellNumber, mountDemo, ready } from '../../../src/test/cellHarness'
import HomeCellDemo from './HomeCellDemo.vue'

it('keeps the function picker result and displayed grid in sync without extra chrome', async () => {
  const { instances } = await captureMounts()
  const wrapper = mountDemo(HomeCellDemo)
  await ready(wrapper)
  const instance = instances[0]
  expect(wrapper.find('.fc-toolbar-shell').exists()).toBe(false)
  expect(cellNumber(instance, 1, 5)).toEqual({ kind: 'number', value: 9510 })
  for (const [name, value] of [
    ['MAX', 1890],
    ['COUNT', 6],
    ['ROUND', 4120]
  ] as const) {
    await page.getByRole('button', { name: new RegExp(`^${name} `) }).click()
    expect(cellNumber(instance, 1, 5)).toEqual({ kind: 'number', value })
    expect(cellNumber(instance, 1, 4)).toEqual({ kind: 'text', value: name })
    expect(wrapper.find('.fln-demo-result strong').text()).toBe(value.toLocaleString('en-US'))
  }
  expect(
    instance.commands.execute({
      type: 'cellBatch',
      operation: 'valueEdit',
      origin: 'instanceApi',
      changes: [{ addr: { sheet: 0, row: 1, col: 1 }, input: '999' }]
    }).status
  ).toBe('rejected')
})
