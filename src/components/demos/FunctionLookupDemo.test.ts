import { expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mountDemo } from '../../test/cellHarness'
import { lang } from '../../test/siteData'
import FormulaInput from './FormulaInput.vue'
import FunctionLookupDemo from './FunctionLookupDemo.vue'

it('searches localized descriptions, evaluates a selected example and preserves edits on locale changes', async () => {
  const wrapper = mountDemo(FunctionLookupDemo)
  await expect.poll(() => wrapper.find('.demo-frame').attributes('data-state')).toBe('ready')
  await expect.poll(() => wrapper.findComponent(FormulaInput).exists()).toBe(true)
  const input = wrapper.findComponent(FormulaInput)
  expect(input.props('functionName')).toBe('ROUND')
  input.vm.$emit('submit')
  await nextTick()
  expect(wrapper.find('.demo-subpanel .demo-status strong').text()).toBe('3.142')

  await wrapper.find('input[type="search"]').setValue('四捨五入')
  expect(wrapper.findAll('.demo-chip').map((chip) => chip.text())).toContain('ROUND')
  await wrapper.find('input[type="search"]').setValue('zzzz-no-function')
  expect(wrapper.find('.demo-namelist [role="status"]').text()).toContain('No matching functions')
  await wrapper.find('input[type="search"]').setValue('XLOOKUP')
  await wrapper.find('.demo-chip').trigger('click')
  expect(input.props('functionName')).toBe('XLOOKUP')
  input.vm.$emit('submit')
  await nextTick()
  expect(wrapper.find('.demo-subpanel .demo-status strong').text()).toBe('b')

  input.vm.$emit('update:modelValue', '=ROUND(12.345,2)')
  await nextTick()
  lang.value = 'ja'
  await nextTick()
  expect(input.props('modelValue')).toBe('=ROUND(12.345,2)')
  expect(input.props('label')).toBe('試す')
  input.vm.$emit('submit')
  await nextTick()
  expect(wrapper.find('.demo-subpanel .demo-status strong').text()).toBe('12.35')
})
