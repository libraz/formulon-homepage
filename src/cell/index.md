---
title: formulon-cell
description: formulon-cell is a reference UI library for Formulon browser integration testing.
---

# formulon-cell

`@libraz/formulon-cell` is a publicly available **reference UI library for Formulon integration testing**. It sits on top of the `@libraz/formulon` WASM calculation engine so the browser package can be exercised through a workbook-like surface.

It is not a complete spreadsheet product. It does not cover every workbook feature, does not try to match Excel UI/UX exactly, and may still contain UI bugs. Use it as a reference implementation and integration-test harness for the engine.

::: warning Scope: integration-test UI, not an Excel replacement
`formulon-cell` exists to exercise `@libraz/formulon` in a real browser. Its basic workbook workflows — selection, editing, formula entry, recalculation, and file handling — are usable. Its scope is still much smaller than Excel's: detailed control behaviour, dialogs, keyboard interaction, accessibility, and other UI/UX are not guaranteed to match Excel, and UI defects remain possible. Do not present it to end users as an Excel substitute or rely on it as a complete spreadsheet product.
:::

The package includes desktop-spreadsheet-style chrome around the engine — a canvas-rendered grid, formula bar, status bar, sheet tabs, selection, keyboard editing, context menus, runtime i18n, theme tokens, and optional authoring dialogs. If your application only needs calculation, workbook loading, or headless regression checks, start with the Formulon runtime docs instead.

::: info Glossary: chrome (UI)
The non-content parts of a UI surface that surround the working area — toolbars, menus, status bar, scrollbars, dialogs. *Chrome* in this sense is unrelated to the Chrome browser.
:::

::: info Glossary: canvas-rendered grid
A grid drawn into an HTML `<canvas>` element rather than as DOM nodes. The grid stays performant on workbooks with tens of thousands of cells because cells are not individual elements; the trade-off is that DOM-based accessibility and CSS styling apply only to the chrome around the canvas.
:::

## What It Is For

- Exercising a real browser workbook backed by `@libraz/formulon`.
- Function entry, formula recalculation, and visible cell results.
- A canvas-rendered spreadsheet surface using the same store and command helpers that host applications can compose.
- Runtime i18n with `en` and `ja` dictionaries.
- Light (`paper`), dark (`ink`), and high-contrast (`contrast`) themes through CSS variable tokens.
- A reference UI for integration testing and examples, not the canonical Formulon product interface.

## Packages

| Package | Purpose |
| --- | --- |
| `@libraz/formulon-cell` | Vanilla TS / DOM core, framework-free |
| `@libraz/formulon-cell-react` | React 18+ component and hooks |
| `@libraz/formulon-cell-vue` | Vue 3 component and composables |

```sh
npm install @libraz/formulon-cell zustand
# adapters (optional)
npm install @libraz/formulon-cell-react react react-dom
npm install @libraz/formulon-cell-vue vue
```

::: info Why is zustand a peer?
`zustand` is exposed as a peer dependency so host applications can subscribe to *the same store* the built-in chrome subscribes to. This lets you build custom status bars, side panels, or analytics observers without forking the package.
:::

## No SharedArrayBuffer, no silent fallback

The WASM engine ships pthread-enabled and needs `SharedArrayBuffer`. Without cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`), `WorkbookHandle.createDefault()` **rejects** — it does not quietly hand you a degraded engine. A host configuration problem should look like an error, not like a spreadsheet that mysteriously never recalculates.

<DiagramLayers :layers="[
  { nodes: ['Spreadsheet.mount(host, options)'] },
  { nodes: ['WorkbookHandle.createDefault()'] },
  { title: 'SharedArrayBuffer available?', nodes: [
    { label: 'Yes', note: 'COOP/COEP set correctly' },
    { label: 'No, preferStub not set', note: 'default behavior' },
    { label: 'No, preferStub: true', note: 'explicit opt-in' }
  ] },
  { title: 'Outcome', nodes: [
    { label: 'WASM engine loads', note: 'real recalc, .xlsx round-trip, formula evaluation' },
    { label: 'Promise rejects', note: 'host catches via try/catch or MountOptions.onError' },
    { label: 'Stub engine loads', note: 'wb.isStub / isUsingStub() → true — tests/demos only' }
  ] }
]" label="Spreadsheet.mount flow: WorkbookHandle.createDefault rejects without SharedArrayBuffer unless preferStub is set" />

Pass `preferStub: true` only for tests and explicit demos — never as a silent production fallback. Wrap the call so the rejection has somewhere to go:

```ts
import { WorkbookHandle } from '@libraz/formulon-cell'

try {
  const wb = await WorkbookHandle.createDefault()
  // wb.isStub is false here — the real WASM engine is running
} catch (err) {
  // SharedArrayBuffer missing (no COOP/COEP) or WASM failed to init
  showConfigurationError(err)
}

// Tests / demos only — never as an automatic production fallback:
const wb = await WorkbookHandle.createDefault({ preferStub: true })
wb.isStub // true
```

`Spreadsheet.mount()` propagates the same rejection; pass `MountOptions.onError` (and optionally `renderError: false`) if you'd rather handle the failure yourself than let core render its built-in error panel. See [Embedding guide](/cell/embedding#lifecycle-hooks) for `onError` and the framework adapters' `error` event / `errorFallback` prop.

See [Bundler setup](/cell/bundler) for the hosting headers and [Install](/cell/install) for the runtime contract.

## Reference Playground

The homepage includes a compact live function picker. The larger playground opens the bundled `formulon-cell` UI in an overlay window so it remains clearly framed as an integration-test surface rather than the Formulon product itself.

[Open the reference playground](/cell/demo)

## Read next

- [Install](/cell/install) — package install and stub-engine contract.
- [Bundler setup](/cell/bundler) — Vite / webpack / esbuild requirements.
- [Embedding guide](/cell/embedding) — presets, extensions, command helpers, headless usage.
- [i18n](/cell/i18n) — locale switching and dictionary registration.
- [API surface](/cell/api) — Spreadsheet / WorkbookHandle / events / store.
