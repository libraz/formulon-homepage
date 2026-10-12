import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { loadDemoPackageAliases } from './scripts/demo-package-aliases.mjs'

const demoPackageConfig = loadDemoPackageAliases()

export default defineConfig({
  plugins: [vue()],
  publicDir: 'src/public',
  optimizeDeps: {
    include: ['zustand/vanilla'],
    exclude: ['@libraz/formulon', '@libraz/formulon-cell']
  },
  resolve: {
    alias: [
      ...demoPackageConfig.aliases,
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      {
        find: 'vitepress',
        replacement: fileURLToPath(new URL('./src/test/siteData.ts', import.meta.url))
      }
    ]
  },
  test: {
    include: ['src/**/*.test.ts', '.vitepress/theme/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 15000,
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      viewport: { width: 1280, height: 900 },
      screenshotFailures: false
    }
  }
})
