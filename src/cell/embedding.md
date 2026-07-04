---
title: Embedding formulon-cell
description: Compose presets, extensions, and command helpers from the formulon-cell reference UI.
---

# Embedding Guide

`formulon-cell` is a reference UI library, so its pieces are intentionally reusable. The bundled playground mounts the package with `presets.full()`, but hosts that adopt ideas from it should usually start with a smaller preset and add only the pieces they need.

Do not treat the default chrome as a complete Excel-compatible application shell. It is useful for integration testing and examples; production products should decide their own feature coverage, UX, and quality bar.

::: info Glossary: preset vs extension
A *preset* is a curated list of features. An *extension* is a single composable feature factory. `presets.full()` returns what amounts to a long array of extensions; you can build the same array yourself.
:::

## Three host shapes

<DiagramLayers :layers="[
  { nodes: ['Host application'] },
  { nodes: ['Spreadsheet.mount(host, options)'] },
  { title: 'What mount() wires up', nodes: [
    { label: 'WorkbookHandle', note: 'WASM engine, or 簡易エンジン stub if preferStub: true' },
    { label: 'features + extensions', note: 'chrome — dialogs, toolbars, panels' },
    { label: 'store (zustand)', note: 'selection, undo, cell data' }
  ] },
  { nodes: [{ label: 'Host code', note: 'reads instance.store.getState(), calls command helpers, subscribes to events' }] }
]" label="Host application mounts Spreadsheet, which wires up WorkbookHandle, features/extensions, and the store; host code then reads and drives the store directly" />

1. **Drop-in spreadsheet.** Use a preset, accept the default chrome, customize via i18n and themes.
2. **Mixed chrome.** Use `presets.minimal()` and add only the dialogs / toolbars you need as extensions.
3. **Headless surface.** Mount the canvas without chrome, drive it from your application's own toolbar via [command helpers](#command-helpers).

## Drop-in mount

```ts
import { Spreadsheet, WorkbookHandle, presets } from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'
import '@libraz/formulon-cell/styles/paper.css'

const host = document.getElementById('sheet')!
const workbook = await WorkbookHandle.createDefault()

const instance = await Spreadsheet.mount(host, {
  workbook,
  features: presets.full(),
  locale: 'en',
  theme: 'paper'
})
```

## Selective extensions

`MountOptions` has two independent knobs for feature composition:

- **`features: FeatureFlags`** — a plain object of booleans that turns a built-in on or off (e.g. `{ findReplace: false }`). `presets.minimal()` / `presets.standard()` / `presets.full()` each return one of these objects — never an array, so don't spread one into a list.
- **`extensions: ExtensionInput[]`** — an array of extension *factories* (zero-argument functions returning an `Extension`) that mount alongside — or, once you've disabled the matching built-in, in place of — the default chrome.

<DiagramLayers :layers="[
  { nodes: ['MountOptions'] },
  { nodes: [
    { label: 'features: FeatureFlags', note: '{ findReplace: false } — object, toggles a built-in off/on' },
    { label: 'extensions: ExtensionInput[]', note: '[findReplace(), formatDialog()] — array of factories' }
  ] }
]" label="MountOptions.features is a boolean-flag object; MountOptions.extensions is a separate array of zero-argument extension factories" />

Replaceable factories live in the same export — verified against `extensions/index.ts`, called with **no arguments**:

```ts
import {
  Spreadsheet,
  presets,
  findReplace,
  formatDialog,
  namedRangeDialog,
  hyperlinkDialog,
  pivotTableDialog,
  validationList,
  hoverComment,
  viewToolbar,
  quickAnalysis
} from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  workbook,
  // Disable the built-ins you want to replace or drop...
  features: { ...presets.minimal(), findReplace: false },
  // ...and mount your own selection through `extensions` instead.
  extensions: [findReplace(), formatDialog(), namedRangeDialog()]
})
```

`autocomplete` has no matching extension factory — it is a `features` flag only (`features: { autocomplete: false }` turns it off; there is nothing to substitute it with).

The order in the `extensions` array is the activation order. Most extensions are independent, but a few cooperate (e.g. `pasteSpecial` integrates with the clipboard command helper). When in doubt, check the order `allBuiltIns` mounts internally.

## Headless mount

```ts
const headless = await Spreadsheet.mount(host, {
  workbook,
  features: presets.minimal(),
  locale: 'en'
})

// Read what the engine knows
const state = headless.store.getState()
const active = state.selection.active
```

From there, drive selection and edits from your own toolbar using [command helpers](#command-helpers).

## Command helpers

The package exports flat, engine-backed command functions — the same ones the chrome and extensions call internally — that operate on a `State` snapshot (`instance.store.getState()`), not on the store object itself. There are no `clipboardCommands` / `formattingCommands` grouped namespaces; import the functions you need directly:

```ts
import { copy, cut, pasteTSV, applyPasteSpecial, toggleBold, setNumFmt, addConditionalRule, listComments } from '@libraz/formulon-cell'

const state = instance.store.getState()

copy(state)                                    // clipboard
toggleBold(state, instance.store)               // formatting (some helpers also take the store)
setNumFmt(state, instance.store, '#,##0.00')
listComments(state)                             // read-only helpers take just the state
addConditionalRule(instance.store, {             // a few rule/history helpers take the store directly
  kind: 'cell-value',
  range: { sheet: 0, r0: 1, c0: 1, r1: 10, c1: 1 },
  op: '>',
  a: 100,
  apply: { fill: '#ffe4e4' }
})
```

Check `@libraz/formulon-cell`'s `index.ts` re-exports for the full list — clipboard (`copy`/`cut`/`pasteTSV`/`applyPasteSpecial`), formatting (`toggleBold`/`setNumFmt`/`setFont`/…), named ranges (`listDefinedNames`/`upsertDefinedName`/…), comments (`setComment`/`listComments`/…), hyperlinks (`setHyperlink`/`listHyperlinks`/…), conditional formatting (`addConditionalRule`/`listConditionalRules`/…), and selection aggregates (`aggregateSelection`/`visibleStatusAggregates`) for status bars.

::: tip Same code path as the built-in chrome
Whatever the built-in toolbars do, the command helpers do the same way. That means features stay in sync — a host-built toolbar gets the same undo entries, the same recalc behavior, and the same event emissions.
:::

## Ribbon toolbar

The default chrome's ribbon is a separate mount from the grid: `Spreadsheet.mountToolbar(host, instance, opts)` in core. If you only mount `<Spreadsheet>` (or call `Spreadsheet.mount()` directly), you get a bare grid with no ribbon — mount the toolbar alongside it explicitly:

```vue
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Spreadsheet as CoreSpreadsheet, type RibbonTab, type SpreadsheetInstance, type ToolbarInstance } from '@libraz/formulon-cell'
import { Spreadsheet } from '@libraz/formulon-cell-vue'

const instance = ref<SpreadsheetInstance | null>(null)
const activeTab = ref<RibbonTab>('home')
const toolbarHost = ref<HTMLDivElement | null>(null)
let toolbar: ToolbarInstance | null = null

watch(instance, async (next) => {
  await nextTick()
  if (!next || !toolbarHost.value) return
  toolbar?.dispose()
  toolbar = CoreSpreadsheet.mountToolbar(toolbarHost.value, next, {
    lang: 'en',
    activeTab: activeTab.value,
    onTabChange: (tab) => (activeTab.value = tab)
  })
})
</script>

<template>
  <div ref="toolbarHost"></div>
  <Spreadsheet locale="en" @ready="(inst) => (instance = inst)" />
</template>
```

The ribbon DOM, menu factories, activation model, and dropdown dispatcher all live in `@libraz/formulon-cell`, so framework wrappers and host-built toolbars use the same command path.

## Lifecycle hooks

Mount returns a `SpreadsheetInstance` with `dispose()`. `Spreadsheet.mount()` **rejects** if it can't produce an instance (most commonly when the WASM engine can't start — see [Stub engine](/cell/index#no-sharedarraybuffer-no-silent-fallback)), so wrap it in try/catch or pass `MountOptions.onError`:

```ts
useEffect(() => {
  let instance: SpreadsheetInstance | undefined
  ;(async () => {
    try {
      instance = await Spreadsheet.mount(host, {
        workbook,
        features: presets.minimal(),
        onError: (err) => showConfigurationError(err),
      })
    } catch (err) {
      // onError already ran; this catch guards callers that omit it.
      showConfigurationError(err)
    }
  })()
  return () => instance?.dispose()
}, [])
```

`dispose()` detaches event listeners, unmounts DOM, and releases the engine reference held by the chrome. The `WorkbookHandle` itself is owned by the caller; release it with `wb.dispose()` when the application is done. The React and Vue adapters expose the same failure as an `onError` prop / `error` event plus an `errorFallback` prop for a framework-native fallback UI.

## Stub-engine detection

`preferStub: true` is the explicit, opt-in way to get the in-memory stub engine — for tests and demos only, never as an automatic production fallback:

```ts
import { WorkbookHandle } from '@libraz/formulon-cell'

const wb = await WorkbookHandle.createDefault({ preferStub: true })
if (wb.isStub) {
  showBanner('Running on the 簡易エンジン (stub) — only a small formula subset evaluates, and save is unavailable.')
}
```

`wb.isStub` (and the module-level `isUsingStub()`) reflect whether the stub engine is in use. It does not change at runtime once the workbook is created. Without `preferStub`, a missing `SharedArrayBuffer` makes `createDefault()` reject instead — see [Bundler setup](/cell/bundler) for the COOP/COEP requirements.

## React adapter

```tsx
import { Spreadsheet, presets } from '@libraz/formulon-cell-react'

export function Sheet() {
  return (
    <Spreadsheet
      features={presets.standard()}
      locale="en"
      theme="paper"
      onSelectionChange={(event) => console.log(event.active)}
    />
  )
}
```

The React adapter mounts and disposes for you and forwards events as props. Pass `onError` and/or `errorFallback` to handle a rejected mount (see [Lifecycle hooks](#lifecycle-hooks)) instead of letting it surface as an unhandled rejection. For more control, drop down to the vanilla package.

## Vue adapter

```vue
<script setup lang="ts">
import { Spreadsheet, presets } from '@libraz/formulon-cell-vue'
</script>

<template>
  <Spreadsheet
    :features="presets.standard()"
    locale="en"
    theme="paper"
    @selection-change="(event) => console.log(event.active)"
    @error="(err) => showConfigurationError(err)"
  />
</template>
```

## Read next

- [i18n](/cell/i18n) — locale registration and overrides.
- [API surface](/cell/api) — events, store, command helpers.
- [Bundler setup](/cell/bundler) — what the host must serve.
