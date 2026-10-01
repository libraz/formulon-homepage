---
title: Bundler setup
description: Configure a browser bundler for formulon-cell and its WASM asset.
---

# Bundler setup

`formulon-cell` is an ESM browser package. Import the package stylesheet from its public export and let the `@libraz/formulon` package resolve its own WASM asset.

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

The dependency exclusion prevents Vite from pre-bundling the package wrappers; the normal application build handles them. The ES2022 target supports the ESM features used by the browser package.

```ts
// browser entry point
import '@libraz/formulon-cell/styles.css'
```

## Other bundlers

For webpack, esbuild, and equivalent tools, keep the package in the browser ESM build and make sure the generated application serves the emitted Formulon WASM asset. No special cross-origin-isolation headers are required by the default `formulon-cell` loader.

When initialization fails in the deployed application, inspect the browser network panel first. The package JavaScript and its `.wasm` asset must both be present in the deployed output and reachable from the page.

## Checklist

- Import `@libraz/formulon-cell/styles.css` once.
- Keep `@libraz/formulon-cell` and `@libraz/formulon` out of Vite dependency pre-bundling.
- Build for a modern browser target such as ES2022.
- Verify that the generated `.wasm` asset is copied and served.
- Give the mounted host a height; bundler configuration cannot provide layout size.

The default loader is single-threaded and does not use `SharedArrayBuffer`. If an application separately imports a threaded Formulon entry point, its hosting requirements belong to that separate integration.
