---
title: Install formulon-cell
description: Install the beta spreadsheet UI package for the Formulon WASM engine.
---

# Install

`formulon-cell` is the beta spreadsheet UI package used here as the Formulon
browser demo host. Install it when you want a desktop-spreadsheet-style browser
surface around the `@libraz/formulon` WASM engine.

```sh
npm install @libraz/formulon-cell zustand
```

`zustand` is a peer dependency because host applications can read the same store
that the built-in chrome subscribes to.

The UI surface is still evolving. Use your package manager lockfile for
application reproducibility, and upgrade intentionally when new releases land.

## Quick Start

```ts
import { Spreadsheet, WorkbookHandle, presets } from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const host = document.getElementById('sheet')!
const workbook = await WorkbookHandle.createDefault()

const sheet = await Spreadsheet.mount(host, {
  workbook,
  features: presets.full(),
  locale: 'en'
})

sheet.i18n.setLocale('ja')
sheet.setTheme('ink')
```

## Runtime Requirement

The Formulon WASM package uses pthreads. Browsers require a
cross-origin-isolated page before `SharedArrayBuffer` is available:

```txt
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without those headers, `formulon-cell` falls back to an in-memory stub engine.
The UI remains useful for layout and interaction work, but formula evaluation,
recalculation, and workbook round-trip behavior are no longer representative of
the real engine.
