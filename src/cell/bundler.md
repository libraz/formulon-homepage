---
title: Bundler setup
description: Vite and browser settings required by formulon-cell and the Formulon WASM engine.
---

# Bundler Setup

`formulon-cell` reuses the pthread-enabled `@libraz/formulon` WASM module. The
same browser bundling constraints apply to the UI package.

## Vite

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps: {
    exclude: ['@libraz/formulon-cell', '@libraz/formulon']
  },
  build: {
    target: 'es2022'
  },
  worker: {
    format: 'es'
  }
})
```

## Why These Settings Matter

The `server` and `preview` headers above only cover local Vite serving. Your
production host must send the same COOP/COEP headers for pages that run the
spreadsheet engine.

Workers must be emitted as ES modules because the Formulon scheduler is spawned
through Emscripten with module workers.

The main and worker builds need an ES2022 target because the engine wrapper uses
top-level await and conditional dynamic imports.

Dependency pre-bundling should skip both packages so the Emscripten wrapper can
keep control of worker and WASM asset resolution.

The COOP/COEP headers are required for `SharedArrayBuffer`. Without them,
`WorkbookHandle.createDefault()` falls back to the stub engine.
