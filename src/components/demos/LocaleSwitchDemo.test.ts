import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { nextTick } from 'vue'
import { captureMounts, cellNumber, mountDemo, ready } from '../../test/cellHarness'
import { isDark, lang } from '../../test/siteData'
import LocaleSwitchDemo from './LocaleSwitchDemo.vue'

const profileFor = {
  en: 'mac-en_US',
  ja: 'mac-ja_JP',
  de: 'mac-de_DE',
  fr: 'mac-fr_FR',
  zh: 'mac-zh_CN',
  ko: 'mac-ko_KR',
  th: 'mac-th_TH'
} as const

async function mountLocaleDemo() {
  const captured = await captureMounts()
  const wrapper = mountDemo(LocaleSwitchDemo)
  await ready(wrapper)
  const instance = captured.instances[0]
  if (!instance) throw new Error('The locale demo did not mount a spreadsheet instance')
  return { captured, wrapper, instance }
}

describe('LocaleSwitchDemo (real package)', () => {
  it('exposes every built-in locale through the real grid selector', async () => {
    const { wrapper, instance } = await mountLocaleDemo()
    const selector = wrapper.find('.locale-switch-demo__host .fc-host__locale-switcher-select')
    expect(selector.exists()).toBe(true)
    expect(selector.findAll('option').map((option) => option.attributes('value'))).toEqual([
      'en',
      'ja',
      'de',
      'fr',
      'zh',
      'ko',
      'th'
    ])

    for (const locale of ['en', 'ja', 'de', 'fr', 'zh', 'ko', 'th'] as const) {
      await userEvent.selectOptions(selector.element as HTMLSelectElement, locale)
      await expect.poll(() => instance.locale).toBe(locale)
      expect(instance.workbook.spreadsheetProfileId()).toBe(profileFor[locale])
    }
  })

  it('switches en to de to ja without remounting and keeps edited values', async () => {
    const { captured, wrapper, instance } = await mountLocaleDemo()
    const hostSelector = wrapper.find('[data-host-locale]')
    expect(instance.locale).toBe('en')
    expect(instance.workbook.spreadsheetProfileId()).toBe(profileFor.en)
    expect(wrapper.find('[data-readout="formula"]').text()).toContain('=SUM(B2,B3)+IF(D2,1,0)')
    const localeEvents: string[] = []
    const stopLocaleEvents = instance.on('localeChange', (change) => {
      localeEvents.push(change.locale)
    })
    const englishCurrency = wrapper.find('[data-readout="currency"]').text()

    const edit = instance.commands.execute({
      type: 'cellBatch',
      operation: 'valueEdit',
      origin: 'instanceApi',
      changes: [{ addr: { sheet: 0, row: 2, col: 1 }, input: '14' }]
    })
    expect(edit.status).toBe('applied')
    await expect.poll(() => cellNumber(instance, 2, 1)).toEqual({ kind: 'number', value: 14 })

    await userEvent.selectOptions(hostSelector.element as HTMLSelectElement, 'de')
    await expect.poll(() => instance.locale).toBe('de')
    expect(wrapper.find('[data-host-set-result]').text()).toBe('true')
    expect(instance.workbook.spreadsheetProfileId()).toBe(profileFor.de)
    expect(wrapper.find('[data-readout="formula"]').text()).toContain('SUMME')
    expect(wrapper.find('[data-readout="values"]').text()).toContain('1.234,5')
    expect(wrapper.find('[data-readout="values"]').text()).toContain('WAHR')
    expect(wrapper.find('[data-readout="values"]').text()).toContain('02.01.2026')
    expect(localeEvents).toEqual(['de'])
    expect(wrapper.find('[data-readout="currency"]').text()).not.toBe(englishCurrency)
    expect(wrapper.find('[data-readout="currency"]').text()).toContain('€')

    const localizedFormulaEdit = instance.commands.execute({
      type: 'cellBatch',
      operation: 'valueEdit',
      origin: 'instanceApi',
      changes: [{ addr: { sheet: 0, row: 1, col: 4 }, input: '=SUMME(1,5;2)' }]
    })
    expect(localizedFormulaEdit.status).toBe('applied')
    await expect
      .poll(() => instance.workbook.cellFormula({ sheet: 0, row: 1, col: 4 }))
      .toBe('=SUM(1.5,2)')
    await expect
      .poll(() => wrapper.find('[data-readout="formula"]').text())
      .toContain('=SUM(1.5,2)')
    expect(wrapper.find('[data-readout="formula"]').text()).toContain('SUMME')

    await userEvent.selectOptions(hostSelector.element as HTMLSelectElement, 'ja')
    await expect.poll(() => instance.locale).toBe('ja')
    expect(instance.workbook.spreadsheetProfileId()).toBe(profileFor.ja)
    expect(wrapper.find('[data-readout="facts"]').text()).toContain('ymd')
    expect(wrapper.find('[data-readout="values"]').text()).toContain('2026/01/02')
    expect(cellNumber(instance, 2, 1)).toEqual({ kind: 'number', value: 14 })
    expect(localeEvents).toEqual(['de', 'ja'])
    await userEvent.selectOptions(hostSelector.element as HTMLSelectElement, 'ja')
    expect(localeEvents).toEqual(['de', 'ja'])
    expect(captured.instances).toEqual([instance])
    expect(instance.i18n.strings.localeSwitcher.label).toContain('言語')
    stopLocaleEvents()
  })

  it('follows site locale and theme changes on the mounted instance', async () => {
    const { captured, instance } = await mountLocaleDemo()
    const setLocale = vi.spyOn(instance, 'setLocale')
    const setTheme = vi.spyOn(instance, 'setTheme')

    lang.value = 'ja'
    isDark.value = true
    await nextTick()

    expect(setLocale).toHaveBeenCalledWith('ja')
    expect(setTheme).toHaveBeenCalledWith('ink')
    expect(instance.locale).toBe('ja')
    expect(instance.host.dataset.fcTheme).toBe('ink')
    expect(captured.instances).toEqual([instance])
  })

  it('cleans up on reset and remains inside a dark mobile viewport', async () => {
    await page.viewport(390, 844)
    isDark.value = true
    const { captured, instance } = await mountLocaleDemo()
    const dispose = vi.spyOn(instance, 'dispose')

    expect(instance.host.dataset.fcTheme).toBe('ink')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    expect(dispose).toHaveBeenCalledTimes(1)
    await expect.poll(() => captured.instances.length).toBe(2)
    expect(captured.instances[1]).not.toBe(instance)
  })
})
