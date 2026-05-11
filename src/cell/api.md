---
title: formulon-cell API surface
description: Main API concepts exposed by the formulon-cell UI package.
---

# API Surface

`formulon-cell` is built from composable pieces: a `WorkbookHandle` over the engine, the `Spreadsheet` mounter that produces a `SpreadsheetInstance`, a typed event bus, a zustand-backed store, command helpers, an i18n controller, and a theme controller. The main engine remains `@libraz/formulon`; these APIs provide an app-facing spreadsheet surface around it.

::: info Glossary: WorkbookHandle
A thin wrapper over a `@libraz/formulon` workbook instance plus the engine status. It lets `Spreadsheet.mount()` and host code share the same workbook without managing native memory directly.
:::

## WorkbookHandle

```ts
import { WorkbookHandle, isUsingStub } from '@libraz/formulon-cell'

const wb = await WorkbookHandle.createDefault()
// or
const wb = await WorkbookHandle.createEmpty()
// or
const wb = await WorkbookHandle.fromBytes(arrayBufferOrUint8Array)

if (isUsingStub()) {
  // SharedArrayBuffer is unavailable — recalc is a no-op
}
```

`WorkbookHandle` owns the engine reference. Pass it to `Spreadsheet.mount({ workbook })` so the UI and the engine share state.

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

Beyond the presets, replaceable UI pieces are factories you can pass in `features`:

```ts
import {
  Spreadsheet,
  presets,
  formatDialogExtension,
  findReplaceExtension,
  hoverCommentsExtension
} from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  workbook,
  features: [
    ...presets.minimal(),
    findReplaceExtension(),
    hoverCommentsExtension({ delayMs: 200 }),
    formatDialogExtension({ accent: 'orange' })
  ]
})
```

See [Embedding guide](/cell/embedding) for the catalogue and lifecycle.

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

The chrome and extensions read from a zustand store. The host can subscribe to the same store without re-implementing reactive state:

```ts
import { useSpreadsheetStore } from '@libraz/formulon-cell'

const selection = useSpreadsheetStore.getState().selection
const unsubscribe = useSpreadsheetStore.subscribe(
  (state) => state.selection,
  (sel) => console.log(sel)
)
```

## Command Helpers

The package exports command helpers for host chrome that does not want the built-in UI:

- clipboard and paste-special helpers,
- formatting commands,
- named ranges, comments, hyperlinks, and validation commands,
- selection aggregates for status bars,
- workbook object and compatibility summaries,
- sheet views, page setup, protection, trace arrows, slicers, and session charts.

The split is intentional: the bundled playground uses these pieces to present a spreadsheet UI; applications can reuse the engine-backed commands without adopting the playground chrome.

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
