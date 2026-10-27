import { expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mountDemo } from '../../test/cellHarness'
import { lang } from '../../test/siteData'
import ValidationDemo from './ValidationDemo.vue'

it('checks a candidate without writing it, then allows a direct write that violates the rule', async () => {
  const wrapper = mountDemo(ValidationDemo)
  await expect
    .poll(() => {
      const frame = wrapper.find('.demo-frame')
      return frame.attributes('data-state') === 'error'
        ? frame.find('.demo-frame__panel--error').text()
        : frame.attributes('data-state')
    })
    .toBe('ready')

  const result = (testId: string) => wrapper.find(`[data-testid="${testId}"]`)
  const readout = (testId: string) => result(testId).text()
  const candidate = wrapper.find<HTMLInputElement>('[data-testid="candidate"]')
  const write = wrapper.find<HTMLButtonElement>('[data-testid="write-value"]')

  expect(readout('validation-call')).toBe('success')
  expect(readout('rule-found')).toBe('yes')
  expect(result('validation-status').attributes('data-valid')).toBe('false')
  expect(readout('stored-value')).toBe('50')
  expect(wrapper.find('.demo-result dt').text()).toBe('Validation call')

  lang.value = 'ja'
  await nextTick()
  expect(wrapper.find('.demo-frame__title').text()).toContain('入力規則')
  expect(wrapper.find('label.demo-field .demo-label').text()).toBe('書き込む候補値')
  expect(readout('rule-found')).toBe('あり')
  expect(readout('validation-status')).toBe('規則外')
  expect(wrapper.findAll('.demo-result dt')[3].text()).toBe('現在の A1 の値')
  lang.value = 'en'
  await nextTick()

  await write.trigger('click')
  expect(readout('write-status')).toBe('success')
  expect(readout('stored-value')).toBe('150')
  expect(result('validation-status').attributes('data-valid')).toBe('false')

  await candidate.setValue('75')
  expect(result('validation-status').attributes('data-valid')).toBe('true')
  expect(readout('stored-value')).toBe('150')

  await candidate.setValue('0')
  expect(result('validation-status').attributes('data-valid')).toBe('true')
  await candidate.setValue('100')
  expect(result('validation-status').attributes('data-valid')).toBe('true')
  await candidate.setValue('101')
  expect(result('validation-status').attributes('data-valid')).toBe('false')

  await candidate.setValue('')
  expect(write.element.disabled).toBe(true)
  expect(readout('stored-value')).toBe('150')

  await wrapper.find('.demo-frame__reset').trigger('click')
  await expect.poll(() => wrapper.find('.demo-frame').attributes('data-state')).toBe('ready')
  expect(wrapper.find<HTMLInputElement>('[data-testid="candidate"]').element.value).toBe('150')
  expect(result('validation-status').attributes('data-valid')).toBe('false')
  expect(readout('stored-value')).toBe('50')
  wrapper.unmount()
})
