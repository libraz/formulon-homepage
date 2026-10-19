---
title: Install formulon-cell
description: Install and mount the formulon-cell spreadsheet UI kit.
---

# Install

The current cell packages use `@libraz/formulon@0.16.0` and require Node.js 22 or later.

Install the core package and its `zustand` peer dependency:

```sh
npm install @libraz/formulon-cell@0.10.0 zustand
```

For framework applications, install one adapter as well:

```sh
npm install @libraz/formulon-cell-react@0.10.0 react react-dom
npm install @libraz/formulon-cell-vue@0.10.0 vue
```

Import the core stylesheet once in the browser entry point. `@libraz/formulon-cell/styles.css` covers the grid, dialogs, overlays, the ribbon, and all three built-in themes. The individual files under `@libraz/formulon-cell/styles/` (`tokens.css`, `paper.css`, `ink.css`, `contrast.css`, `toolbar.css`) exist for setups that assemble the stylesheet themselves.

```ts
import '@libraz/formulon-cell/styles.css'
```

## Quick start

Give the spreadsheet a host with a defined height. `Spreadsheet.mount()` takes over the host's children and returns an instance that the host owns.

```html
<div id="sheet" style="height: 480px; min-height: 320px"></div>
```

```ts
import {
  Spreadsheet,
  WorkbookHandle,
  presets
} from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const host = document.querySelector<HTMLElement>('#sheet')!
let workbook: WorkbookHandle | undefined
let instance: Awaited<ReturnType<typeof Spreadsheet.mount>> | undefined
function disposeView() {
  instance?.dispose()
  instance = undefined
  workbook?.dispose()
  workbook = undefined
}

try {
  const nextWorkbook = await WorkbookHandle.createDefault({ locale: 'en' })
  workbook = nextWorkbook
  instance = await Spreadsheet.mount(host, {
    workbook: nextWorkbook,
    features: presets.standard(),
    locale: 'en'
  })
} catch (error) {
  showSpreadsheetError(error)
  disposeView()
}

// Register disposeView with the surrounding view's cleanup hook.
```

::: tip Two locale arguments
The `locale` passed to `createDefault()` only picks the workbook's default font. The `locale` passed to `mount()` selects the UI language and the calculation profile (number formats, separators, localized function names). When `mount()` receives no `locale`, the UI starts in Japanese, so pass the language your application uses.
:::

`WorkbookHandle.createDefault()` loads the default Formulon WASM package. The current default loader does not require `SharedArrayBuffer` or COOP/COEP headers. A failed WASM or WebAssembly initialization rejects the promise; handle that failure at the host boundary instead of leaving an empty surface.

`Spreadsheet.mount()` also accepts `onError`. The core error panel is rendered by default; set `renderError: false` when a framework or host renders its own fallback.

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  onError: (error) => showSpreadsheetError(error),
  renderError: false
})
```

## Host sizing

The grid fills the mounted element. Set a height on the host or on a containing layout with a definite height. A flex layout commonly needs `min-height: 0` on the panel that contains the host:

```css
.sheet-panel {
  display: flex;
  min-height: 0;
  height: 100%;
}

.sheet-host {
  flex: 1 1 auto;
  min-height: 320px;
}
```

Use `instance.dispose()` when the host leaves the page. Dispose a `WorkbookHandle` when the application no longer owns it. React and Vue adapters perform the mount and disposal as part of their component lifecycle.

A workbook passed to the initial `mount()` remains caller-owned. The instance owns a workbook it creates itself and any replacement passed to `setWorkbook()`. Dispose the original caller-owned handle after replacement when it is no longer needed; the instance disposes its current replacement.

## Optional stub engine

`WorkbookHandle.createDefault({ preferStub: true })` is an explicit in-memory engine choice for tests and small demos. It is useful when the host does not want to load WASM, but it does not provide the same workbook surface as the default engine. Keep the choice visible in test or demo code rather than making it an automatic fallback.

See [Options](/cell/options) for the UI profile and feature choices, and [Bundler setup](/cell/bundler) for a small Vite configuration.
