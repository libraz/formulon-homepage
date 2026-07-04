---
title: formulon-cell API surface
description: Main API concepts exposed by the formulon-cell reference UI package.
---

# API Surface

`formulon-cell` is built from composable pieces: a `WorkbookHandle` over the engine, the `Spreadsheet` mounter that produces a `SpreadsheetInstance`, a typed event bus, a zustand-backed store, command helpers, an i18n controller, and a theme controller. The main engine remains `@libraz/formulon`; these APIs provide a reference spreadsheet surface for integration testing and examples, not a complete Excel-compatible UI layer.

::: info Glossary: WorkbookHandle
A thin wrapper over a `@libraz/formulon` workbook instance plus the engine status. It lets `Spreadsheet.mount()` and host code share the same workbook without managing native memory directly.
:::

## WorkbookHandle

```ts
import { WorkbookHandle } from '@libraz/formulon-cell'

// New empty workbook, backed by the WASM engine.
const wb = await WorkbookHandle.createDefault()

// Load an existing .xlsx / .xlsb / .xls / .csv from bytes.
const bytes = new Uint8Array(await file.arrayBuffer())
const loaded = await WorkbookHandle.loadBytes(bytes)

if (wb.isStub) {
  // preferStub: true was passed explicitly — the in-memory 簡易エンジン (stub
  // engine) is standing in, evaluating only a small formula subset.
}
```

`WorkbookHandle` exposes exactly two static factories, `createDefault(opts)` and `loadBytes(bytes, opts)` — there is no `createEmpty()` or `fromBytes()`. Both reject by default without `SharedArrayBuffer`; see [No SharedArrayBuffer, no silent fallback](/cell/index#no-sharedarraybuffer-no-silent-fallback) for the `preferStub` opt-in. Pass it to `Spreadsheet.mount({ workbook })` so the UI and the engine share state.

## Mounting

```ts
import { Spreadsheet, WorkbookHandle, presets } from '@libraz/formulon-cell'

const workbook = await WorkbookHandle.createDefault()
const instance = await Spreadsheet.mount(host, {
  workbook,
  features: presets.standard(),
  locale: 'en',
  theme: 'paper'
})
```

`Spreadsheet.mount()` returns a `SpreadsheetInstance` exposing:

| Field / method | Purpose |
| --- | --- |
| `workbook` | The `WorkbookHandle` |
| `store` | Reactive zustand store used by the chrome |
| `history` | Undo / redo stack |
| `i18n` | Runtime locale controller |
| `setTheme(name)` | Switch between `paper`, `ink`, or custom themes |
| `on(event, fn)` | Subscribe to typed events |
| `dispose()` | Tear the mount down and detach event listeners |

## Presets

Presets bundle features into common levels of UI density:

| Preset | Use it for |
| --- | --- |
| `presets.minimal()` | Bare grid, formula bar, status bar, basic keymap |
| `presets.standard()` | Common app chrome: View toolbar, Quick Analysis, workbook object inspector, context menu, find/replace, clipboard, format painter, wheel scroll |
| `presets.full()` | Default full chrome: format dialog, paste special, conditional formatting, iterative calculation, Go To Special, page setup, named ranges, hyperlinks, PivotTable creation, validation, autocomplete, hover comments, spreadsheet keymap |

::: tip Pick the smallest preset that still ships your feature
Each preset adds DOM and bundle weight. If a host already provides its own dialogs, drop down to `presets.minimal()` and use [Command helpers](#command-helpers) directly.
:::

## Extensions

Beyond the presets, replaceable UI pieces are zero-argument factories you pass through a separate `extensions` array — `features` stays a boolean-flag object:

```ts
import { Spreadsheet, presets, findReplace, formatDialog, hoverComment } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  workbook,
  features: { ...presets.minimal(), findReplace: false },
  extensions: [findReplace(), formatDialog(), hoverComment()]
})
```

See [Embedding guide](/cell/embedding#selective-extensions) for the full factory catalogue, the `features` vs `extensions` split, and lifecycle hooks.

## Events

```ts
const off = instance.on('selectionChange', (event) => {
  console.log(event.active)
})

off()
```

Common events:

| Event | When it fires |
| --- | --- |
| `cellChange` | A cell value or formula was edited |
| `selectionChange` | Active cell or selection rectangles changed |
| `workbookChange` | Sheet added / removed / renamed, defined names changed |
| `localeChange` | `i18n.setLocale()` swapped the active dictionary |
| `themeChange` | `setTheme()` switched themes |
| `recalc` | Engine completed a recalculation pass |

## Store

The chrome and extensions read from a per-mount [zustand](https://github.com/pmndrs/zustand) vanilla store, exposed as `instance.store`. There is no global `useSpreadsheetStore` hook — each `Spreadsheet.mount()` call creates its own store, and the host subscribes to that instance directly:

```ts
const selection = instance.store.getState().selection

const unsubscribe = instance.store.subscribe((state) => {
  console.log(state.selection)
})
```

`subscribe` takes a whole-state listener (`(state, prevState) => void`), not a selector — filter inside the callback if you only care about part of `State`.

## Command Helpers

The package exports command helpers for host chrome that does not want the built-in UI:

- clipboard and paste-special helpers,
- formatting commands,
- named ranges, comments, hyperlinks, and validation commands,
- selection aggregates for status bars,
- workbook object and compatibility summaries,
- sheet views, page setup, protection, trace arrows, slicers, and session charts.

The split is intentional: the bundled playground uses these pieces to present a reference spreadsheet UI; applications can reuse the engine-backed commands without adopting the playground chrome.

## i18n controller

```ts
instance.i18n.setLocale('ja')
instance.i18n.extend('ja', { contextMenu: { copy: 'コピーする' } })

import fr from './fr.js'
instance.i18n.register('fr', fr)
instance.i18n.setLocale('fr')
```

See [i18n](/cell/i18n) for the dictionary shape and override patterns.

## Theme controller

`setTheme('paper' | 'ink' | string)` switches between bundled themes or a custom theme registered via CSS variable tokens.

```css
.fc-theme-mine {
  --fc-grid-bg: #faf6e8;
  --fc-grid-line: #b09870;
  /* ...full token list documented in styles/paper.css */
}
```

```ts
instance.setTheme('mine')
```

## Read next

- [Embedding guide](/cell/embedding) — preset / extension architecture, headless mode.
- [i18n](/cell/i18n) — dictionary shape, register / extend / swap.
- [Bundler setup](/cell/bundler) — what the host must serve.
