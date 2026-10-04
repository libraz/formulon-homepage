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

it('spills array functions down column F and clears the spill when switching back', async () => {
  const { instances } = await captureMounts()
  const wrapper = mountDemo(HomeCellDemo)
  await ready(wrapper)
  const instance = instances[0]
  const result = () => wrapper.find('.fln-demo-result')

  await page.getByRole('button', { name: /^SORT / }).click()
  expect(cellNumber(instance, 1, 5)).toEqual({ kind: 'number', value: 1890 })
  expect(cellNumber(instance, 6, 5)).toEqual({ kind: 'number', value: 1280 })
  expect(result().text()).toContain('F2:F7')
  expect(result().find('strong').text()).toBe('1,890, 1,750, 1,610, 1,560, 1,420, 1,280')

  await page.getByRole('button', { name: /^FILTER / }).click()
  expect(cellNumber(instance, 4, 5)).toEqual({ kind: 'text', value: 'Jun' })
  expect(cellNumber(instance, 5, 5)).toEqual({ kind: 'blank' })
  expect(result().text()).toContain('F2:F5')

  await page.getByRole('button', { name: /^MAX / }).click()
  expect(cellNumber(instance, 1, 5)).toEqual({ kind: 'number', value: 1890 })
  for (let row = 2; row <= 6; row += 1)
    expect(cellNumber(instance, row, 5)).toEqual({ kind: 'blank' })
  expect(result().text()).not.toContain('F2:F')
  expect(result().find('strong').text()).toBe('1,890')
})
