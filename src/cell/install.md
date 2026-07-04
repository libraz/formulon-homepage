---
title: Install formulon-cell
description: Install the reference UI library used for Formulon browser integration testing.
---

# Install

`formulon-cell` is the reference UI library used here for Formulon browser
integration testing. It is public, but it is not a complete Excel-compatible UI:
feature coverage is partial, UI/UX does not try to mirror Excel exactly, and UI
bugs may remain. Install it when you want a workbook-like browser surface around
the `@libraz/formulon` WASM engine for testing or reference.

```sh
npm install @libraz/formulon-cell zustand
```

`zustand` is a peer dependency because host applications can read the same store
that the built-in chrome subscribes to.

The UI surface is intentionally reference-grade. Use your package manager
lockfile for reproducibility, and upgrade intentionally when new releases land.

## Quick Start

```ts
import { Spreadsheet, WorkbookHandle, presets } from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const host = document.getElementById('sheet')!

try {
  const workbook = await WorkbookHandle.createDefault()

  const sheet = await Spreadsheet.mount(host, {
    workbook,
    features: presets.full(),
    locale: 'en'
  })

  sheet.i18n.setLocale('ja')
  sheet.setTheme('ink')
} catch (err) {
  // SharedArrayBuffer missing (no COOP/COEP), or WASM failed to init.
  showConfigurationError(err)
}
```

## Runtime Requirement

The Formulon WASM package uses pthreads. Browsers require a
cross-origin-isolated page before `SharedArrayBuffer` is available:

```txt
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without those headers, `WorkbookHandle.createDefault()` **rejects** by
default — it does not fall back to a degraded engine silently. Catch the
rejection (or pass `MountOptions.onError` to `Spreadsheet.mount()`) and show
the host a configuration error instead of a spreadsheet that looks fine but
never recalculates.

For tests and explicit demos only, opt in to the in-memory stub engine with
`preferStub: true`:

```ts
const wb = await WorkbookHandle.createDefault({ preferStub: true })
wb.isStub // true — the stub only evaluates a tiny formula subset (SUM,
          // AVERAGE, IF, …; everything else returns #NEEDS_ENGINE!) and
          // cannot load or save .xlsx/.xlsb bytes at all
```

See [Stub engine](/cell/index#no-sharedarraybuffer-no-silent-fallback) for the
full decision flow and [Bundler setup](/cell/bundler) for hosting the required
headers.
