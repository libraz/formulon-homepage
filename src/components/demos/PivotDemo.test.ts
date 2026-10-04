import { expect, it } from 'vitest'
import { mountDemo, ready } from '../../test/cellHarness'
import PivotDemo from './PivotDemo.vue'

const cellTexts = (wrapper: ReturnType<typeof mountDemo>) =>
  wrapper.findAll('[data-test="pivot"] td').map((td) => td.text())

const choose = async (wrapper: ReturnType<typeof mountDemo>, name: string, value: string) => {
  await wrapper.find<HTMLSelectElement>(`[data-test="${name}"]`).setValue(value)
}

it('projects the default pivot with row labels and a grand total', async () => {
  const wrapper = mountDemo(PivotDemo)
  await expect.poll(() => cellTexts(wrapper).length, { timeout: 10000 }).toBeGreaterThan(0)
  await expect.poll(() => wrapper.find('.fc-host__canvas').exists(), { timeout: 10000 }).toBe(true)
  await ready(wrapper)
  const texts = cellTexts(wrapper)
  for (const label of ['East', 'West', 'North']) expect(texts).toContain(label)
  expect(texts).toContain(String(120 + 80 + 150 + 90 + 200 + 60 + 110 + 70))
  wrapper.unmount()
})

it('rebuilds the output when the aggregation or row field changes', async () => {
  const wrapper = mountDemo(PivotDemo)
  await expect.poll(() => cellTexts(wrapper).length, { timeout: 10000 }).toBeGreaterThan(0)
  await expect.poll(() => wrapper.find('.fc-host__canvas').exists(), { timeout: 10000 }).toBe(true)
  await ready(wrapper)
  const sum = cellTexts(wrapper)

  await choose(wrapper, 'agg', '1')
  const count = cellTexts(wrapper)
  expect(count).not.toEqual(sum)
  expect(count).toContain('8')

  await choose(wrapper, 'row', 'Product')
  const byProduct = cellTexts(wrapper)
  expect(byProduct).toContain('Widget')
  expect(byProduct).toContain('Gadget')
  expect(byProduct).not.toContain('East')

  await choose(wrapper, 'agg', '0')
  await choose(wrapper, 'col', 'Quarter')
  const crossed = cellTexts(wrapper)
  expect(crossed).toContain('Q1')
  expect(crossed).toContain('Q2')
  wrapper.unmount()
})
