import { mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { defineComponent, h, nextTick, ref } from 'vue'
import { lang } from '../../test/siteData'
import FormulaInput from './FormulaInput.vue'
import { loadFormulaCatalog } from './formulaCatalog'

const Harness = defineComponent({
  components: { FormulaInput },
  props: {
    initial: { type: String, required: true },
    functionName: { type: String, default: '' }
  },
  setup(props, { expose }) {
    const value = ref(props.initial)
    const submitted = ref(0)
    expose({ value, submitted })
    return () =>
      h(FormulaInput, {
        modelValue: value.value,
        label: 'Formula',
        actionLabel: 'Evaluate',
        functionName: props.functionName,
        placeholder: '=ROUND(PI(), 2)',
        'onUpdate:modelValue': (next: string) => {
          value.value = next
        },
        onSubmit: () => {
          submitted.value += 1
        }
      })
  }
})

const PairHarness = defineComponent({
  setup() {
    const first = ref('=ROUND(12.345,2)')
    const second = ref('=IF(A1>0,1,0)')
    return () =>
      h('div', [
        h(FormulaInput, {
          modelValue: first.value,
          label: 'First formula',
          actionLabel: 'Evaluate',
          functionName: 'ROUND',
          'onUpdate:modelValue': (next: string) => {
            first.value = next
          }
        }),
        h(FormulaInput, {
          modelValue: second.value,
          label: 'Second formula',
          actionLabel: 'Evaluate',
          functionName: 'IF',
          'onUpdate:modelValue': (next: string) => {
            second.value = next
          }
        })
      ])
  }
})

async function mountInput(initial: string, functionName = ''): Promise<VueWrapper> {
  const host = document.createElement('div')
  document.body.append(host)
  const wrapper = mount(Harness, {
    props: { initial, functionName },
    attachTo: host
  })
  await expect
    .poll(() => wrapper.find('[data-formula-input]').attributes('data-catalog-state'), {
      timeout: 15000
    })
    .toBe('ready')
  return wrapper
}

function inputOf(wrapper: VueWrapper): HTMLInputElement {
  return wrapper.find('input').element as HTMLInputElement
}

async function placeCaret(input: HTMLInputElement, position: number) {
  input.focus()
  input.setSelectionRange(position, position)
  input.dispatchEvent(new Event('select', { bubbles: true }))
  await nextTick()
}

describe('FormulaInput (real engine catalog)', () => {
  beforeEach(async () => {
    lang.value = 'en'
    await page.viewport(1280, 900)
  })

  it('shows a nested argument guide and suppresses proposals in quoted text', async () => {
    const formula = '=IF(SUM({1,2;3,4})>3,"a,b","no"'
    const wrapper = await mountInput(formula)
    const input = inputOf(wrapper)
    await placeCaret(input, formula.length)

    expect(wrapper.find('[data-active-function="IF"]').exists()).toBe(true)
    expect(wrapper.find('[data-active-argument]').text()).toContain('value_if_false')
    expect(wrapper.find('.formula-input__syntax').text()).toContain('Array constants')
    expect(wrapper.find('.formula-input__syntax').text()).toContain('Formulas start')

    const quoted = '="ROU"'
    await userEvent.fill(input, quoted)
    await placeCaret(input, quoted.indexOf('ROU') + 2)
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)

    const sheetName = "='Sheet ROU'!A1"
    await userEvent.fill(input, sheetName)
    await placeCaret(input, sheetName.indexOf('ROU') + 2)
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)

    const quotedArgument = '=IF("value,with,comma",1,0)'
    await userEvent.fill(input, quotedArgument)
    await placeCaret(input, quotedArgument.indexOf('with') + 2)
    expect(wrapper.find('[data-active-function="IF"]').exists()).toBe(true)
    expect(wrapper.find('[data-active-argument]').text()).toContain('logical_test')
  })

  it('replaces a whole token in the middle while preserving the suffix and caret', async () => {
    const wrapper = await mountInput('=XLOokup(1,2)')
    const input = inputOf(wrapper)
    await userEvent.fill(input, '=XLOokup(1,2)')
    await placeCaret(input, 4)
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)

    await userEvent.keyboard('{Enter}')
    expect(input.value).toBe('=XLOOKUP(1,2)')
    expect(input.selectionStart).toBe(9)
    expect((wrapper.vm as unknown as { submitted: number }).submitted).toBe(0)
  })

  it('uses Enter for completion, Tab for completion, Escape for dismissal, and Enter for submit', async () => {
    const wrapper = await mountInput('=XLO')
    const input = inputOf(wrapper)
    await placeCaret(input, input.value.length)
    await userEvent.keyboard('{Escape}')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)

    await userEvent.fill(input, '=XLO')
    await placeCaret(input, input.value.length)
    await userEvent.keyboard('{Tab}')
    expect(input.value).toMatch(/^=XLOOKUP\(/)
    expect((wrapper.vm as unknown as { submitted: number }).submitted).toBe(0)

    await userEvent.fill(input, '=1+1')
    await placeCaret(input, input.value.length)
    await userEvent.keyboard('{Enter}')
    expect((wrapper.vm as unknown as { submitted: number }).submitted).toBe(1)
  })

  it('moves the selected candidate and ignores composing Enter', async () => {
    const wrapper = await mountInput('=RO')
    const input = inputOf(wrapper)
    await placeCaret(input, input.value.length)
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    await userEvent.fill(input, '=RO')
    await placeCaret(input, input.value.length)
    const options = wrapper.findAll('[role="option"]')
    expect(options.length).toBeGreaterThan(1)
    expect(options[0]?.attributes('aria-selected')).toBe('true')

    await userEvent.keyboard('{ArrowDown}')
    expect(options[1]?.attributes('aria-selected')).toBe('true')
    await userEvent.keyboard('{ArrowUp}')
    expect(options[0]?.attributes('aria-selected')).toBe('true')

    const chosen = options[0]?.find('code').text()
    const composingEnter = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      isComposing: true,
      key: 'Enter'
    })
    input.dispatchEvent(composingEnter)
    expect(input.value).toBe('=RO')
    expect((wrapper.vm as unknown as { submitted: number }).submitted).toBe(0)

    await userEvent.keyboard('{Enter}')
    expect(input.value).toBe(`=${chosen ?? ''}(`)
    expect((wrapper.vm as unknown as { submitted: number }).submitted).toBe(0)
  })

  it('keeps the candidate panel within a narrow viewport', async () => {
    await page.viewport(390, 900)
    const wrapper = await mountInput('=XLO')
    const input = inputOf(wrapper)
    await userEvent.fill(input, '=XLO')
    await placeCaret(input, input.value.length)
    const panel = wrapper.find('.formula-input__suggestions').element as HTMLElement
    expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth)
    for (const button of wrapper.findAll('.formula-input__suggestion')) {
      const element = button.element as HTMLElement
      expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth)
    }
  })

  it('keeps the formula while changing locale and gives distinct ids to multiple inputs', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const wrapper = mount(PairHarness, { attachTo: host })
    await expect.poll(() => wrapper.findAll('[data-formula-input]')).toHaveLength(2)
    await expect
      .poll(() => wrapper.findAll('[data-formula-input][data-catalog-state="ready"]'))
      .toHaveLength(2)
    const inputs = wrapper.findAll('input')
    const firstInput = inputs[0]?.element as HTMLInputElement
    const secondInput = inputs[1]?.element as HTMLInputElement
    expect(firstInput.id).not.toBe(secondInput.id)

    lang.value = 'ja'
    await nextTick()
    expect(firstInput.value).toBe('=ROUND(12.345,2)')
    expect(wrapper.find('[data-active-function="ROUND"]').text()).toContain('引数ガイド')

    lang.value = 'en'
    await nextTick()
    expect(firstInput.value).toBe('=ROUND(12.345,2)')
  })

  it('falls back to numbered arguments for engine functions without a published signature', async () => {
    const catalog = await loadFormulaCatalog()
    const fallbackName = catalog.names.find((name) =>
      catalog.signatures[name.toUpperCase()]?.some((arg) => /^\[?arg\d/.test(arg))
    )
    expect(fallbackName).toBeTruthy()
    const wrapper = await mountInput(`=${fallbackName ?? 'UNKNOWN'}(`, fallbackName)
    expect(wrapper.find('.formula-input__guide').text()).toContain('arg1')
    expect(wrapper.find('[data-active-argument] .formula-input__example').exists()).toBe(false)
  })

  it('keeps a variadic function trailing argument distinct from its repeat marker', async () => {
    const formula = '=LET(name,1,name+1'
    const wrapper = await mountInput(formula, 'LET')
    const input = inputOf(wrapper)
    await placeCaret(input, formula.length)
    expect(wrapper.find('[data-active-argument]').text()).toContain('calculation')
  })

  it('uses array guidance for SORTBY and the published cols name for SEQUENCE', async () => {
    const sortBy = '=SORTBY(A1:A3,'
    const sortWrapper = await mountInput(sortBy, 'SORTBY')
    const sortInput = inputOf(sortWrapper)
    await placeCaret(sortInput, sortBy.length)
    expect(sortWrapper.find('[data-active-argument]').text()).toContain('range or array')

    const sequence = '=SEQUENCE(3,'
    const sequenceWrapper = await mountInput(sequence, 'SEQUENCE')
    const sequenceInput = inputOf(sequenceWrapper)
    await placeCaret(sequenceInput, sequence.length)
    expect(sequenceWrapper.find('[data-active-argument]').text()).toContain('columns')
  })

  it('does not flag valid zero-argument calls and keeps suggestion options accessible', async () => {
    const zeroArgument = await mountInput('=PI()', 'PI')
    const zeroInput = inputOf(zeroArgument)
    await placeCaret(zeroInput, '=PI()'.indexOf(')'))
    expect(zeroArgument.find('.formula-input__no-active').text()).not.toContain('extra')

    const trueArgument = await mountInput('=TRUE()', 'TRUE')
    const trueInput = inputOf(trueArgument)
    await placeCaret(trueInput, '=TRUE()'.indexOf(')'))
    expect(trueArgument.find('.formula-input__no-active').text()).not.toContain('extra')

    await userEvent.fill(zeroInput, '=PI(1)')
    await placeCaret(zeroInput, '=PI(1'.length)
    expect(zeroArgument.find('.formula-input__no-active').text()).toBe(
      'This function takes no arguments.'
    )

    const wrapper = await mountInput('=IF(')
    const input = inputOf(wrapper)
    await placeCaret(input, input.value.length)
    expect(wrapper.find('[role="option"] button').exists()).toBe(false)
    expect(wrapper.find('[data-active-argument][role="status"][aria-live="polite"]').exists()).toBe(
      true
    )
  })
})
