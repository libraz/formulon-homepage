---
title: Install formulon-cell
description: Install and mount the formulon-cell spreadsheet UI kit.
---

# Install

Install the core package and its `zustand` peer dependency:

```sh
npm install @libraz/formulon-cell zustand
```

For framework applications, install one adapter as well:

```sh
npm install @libraz/formulon-cell-react react react-dom
npm install @libraz/formulon-cell-vue vue
```

Import the core stylesheet once in the browser entry point. The package export is `@libraz/formulon-cell/styles.css`.

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
