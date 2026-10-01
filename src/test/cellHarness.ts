import type { SpreadsheetInstance } from '@libraz/formulon-cell'
import { mount, type VueWrapper } from '@vue/test-utils'
import { expect, vi } from 'vitest'
import type { Component } from 'vue'
import { getCellApi } from '../components/demos/engine'

/** Observe real mounts without replacing the engine or spreadsheet implementation. */
export async function captureMounts() {
  const api = await getCellApi()
  const original = api.Spreadsheet.mount
  const instances: SpreadsheetInstance[] = []
  const spy = vi.spyOn(api.Spreadsheet, 'mount').mockImplementation(async (...args) => {
    const instance = await original(...args)
    instances.push(instance)
    return instance
  })
  return { api, instances, spy, original }
}

export function mountDemo(component: Component, props = {}): VueWrapper {
  const container = document.createElement('div')
  container.className = 'vp-doc'
  container.style.cssText = 'max-width: 900px; margin: auto; padding: 24px; box-sizing: border-box'
  document.body.append(container)
  return mount(component, { props, attachTo: container })
}

export async function ready(wrapper: VueWrapper) {
  await expect.poll(() => wrapper.find('.fc-host__canvas').exists()).toBe(true)
  await expect.poll(() => wrapper.find('[data-busy="true"]').exists()).toBe(false)
}

export function cellNumber(instance: SpreadsheetInstance, row: number, col: number) {
  return instance.store.getState().data.cells.get(`0:${row}:${col}`)?.value
}

export function requiredElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing rendered element: ${selector}`)
  return element
}
