import { config, enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, vi } from 'vitest'
import { page } from 'vitest/browser'
import { defineComponent } from 'vue'
import '@libraz/formulon-cell/styles.css'
import '../../.vitepress/theme/custom.css'
import { isDark, lang } from './siteData'

config.global.components.ClientOnly = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      slots.default?.()
})
beforeEach(async () => {
  lang.value = 'en'
  isDark.value = false
  await page.viewport(1280, 900)
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
  document.documentElement.classList.remove('cell-demo-overlay-open')
})

// Vitest runs afterEach hooks in reverse registration order: unmount before cleanup.
enableAutoUnmount(afterEach)
