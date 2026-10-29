---
title: Bundler setup
description: Configure a browser bundler for formulon-cell and its WASM asset.
---

# Bundler setup

`formulon-cell` is an ESM browser package. The engine package `@libraz/formulon` is an Emscripten build that locates its `.wasm` file next to its own JavaScript through `import.meta.url`, so the bundler only has to leave that package intact and emit the asset.

## Vite

This is the smallest useful starting point for a Vite application:

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    exclude: ['@libraz/formulon-cell', '@libraz/formulon']
  },
  build: {
    target: 'es2022'
  }
})
```

The exclusion keeps Vite's dev-server pre-bundling from moving the engine JavaScript away from its `.wasm` file. The ES2022 target is required because the engine factory uses top-level `await`.

```ts
// browser entry point
import '@libraz/formulon-cell/styles.css'
```

## Other bundlers

For webpack, esbuild, and equivalent tools, keep the package in the browser ESM build and make sure the generated application serves the emitted Formulon WASM asset. No special cross-origin-isolation headers are required by the default `formulon-cell` loader.

When initialization fails in the deployed application, inspect the browser network panel first. The package JavaScript and its `.wasm` asset must both be present in the deployed output and reachable from the page.

## Serve the WASM from another URL {#locate-file}

To serve the `.wasm` file from a CDN or a sub-path, create the workbook yourself and pass a resolver to `WorkbookHandle.createDefault()` or `WorkbookHandle.loadBytes()`:

```ts
import { Spreadsheet, WorkbookHandle } from '@libraz/formulon-cell'

const workbook = await WorkbookHandle.createDefault({
  locateFile: (path) => `https://cdn.example.com/formulon/${path}`,
})
await Spreadsheet.mount(host, { workbook })
```

The engine loads once per page, so the first load's resolver decides the URL and later loads reuse that module.

## Checklist

- Import `@libraz/formulon-cell/styles.css` once.
- Keep `@libraz/formulon-cell` and `@libraz/formulon` out of Vite dependency pre-bundling.
- Build for a modern browser target such as ES2022.
- Verify that the generated `.wasm` asset is copied and served.
- Give the mounted host a height; bundler configuration cannot provide layout size.

The default loader is single-threaded, starts no workers, and does not use `SharedArrayBuffer`. Only an application that imports `@libraz/formulon/threads` directly needs `worker: { format: 'es' }` in the Vite config and the cross-origin isolation headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`).
