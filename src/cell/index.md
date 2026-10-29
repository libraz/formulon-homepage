---
title: formulon-cell
description: Embed an Excel-like spreadsheet UI in a browser application.
---

# formulon-cell

`@libraz/formulon-cell` puts a spreadsheet inside a web page: a canvas-rendered grid with a formula bar, ribbon, sheet tabs, and dialogs, calculated by the Formulon WASM engine. The core package is framework-free DOM code; the React and Vue packages are thin adapters over the same mount call.

::: warning Compatibility status
formulon-cell targets desktop-spreadsheet behavior, but it is still beta. Basic workbook workflows work; dialogs, detailed control behavior, keyboard interaction, and accessibility are not yet guaranteed to match a desktop spreadsheet, and bugs may remain. Treat it as an integration surface to evaluate, not as a drop-in replacement or a finished end-user product.
:::

The current release is `0.12.0`. Install the core and adapter packages at the same version; the release uses `@libraz/formulon@0.18.0` and requires Node.js 22 or later. See [Install](/cell/install) for the commands and a first mount.

## Packages

| Package | Use it when |
| --- | --- |
| `@libraz/formulon-cell` | The host owns the DOM and lifecycle. |
| `@libraz/formulon-cell-react` | The host application uses React 18 or later. |
| `@libraz/formulon-cell-vue` | The host application uses Vue 3.3 or later. |

The adapters install the core package as a dependency. They re-export its types and the common runtime helpers (`WorkbookHandle`, `presets`, the policy helpers, extension factories); lower-level command helpers such as `exportCSV()` are imported from `@libraz/formulon-cell`.

## Choose a starting point

The three demos below configure the same grid differently. The UI controls, the cells a user may edit, and the visible area are independent options.

### Read-only workbook viewer

Use the embedded UI profile with `viewerPolicy()` when the application displays a workbook and lets readers select or copy cells:

```ts
import { Spreadsheet, viewerPolicy, WorkbookHandle } from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const workbook = await WorkbookHandle.loadBytes(reportBytes)
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: {
    profile: 'embedded',
    theme: 'paper',
    features: { clipboard: true, shortcuts: true }
  },
  toolbar: false,
  policy: viewerPolicy(),
  contextMenu: { mode: 'disabled' }
})
```

Add a `viewport.range` when the page shows one bounded report area. The range uses zero-based, inclusive row and column coordinates; see [Options](/cell/options).

<CellEmbedDemo scenario="viewer" />

### Fixed-input form

Use `fixedFormPolicy()` when an application pre-fills a sheet and accepts values only in declared cells:

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: {
    profile: 'embedded',
    features: { clipboard: true, shortcuts: true }
  },
  policy: fixedFormPolicy([
    { sheet: 0, r0: 2, c0: 1, r1: 20, c1: 3 }
  ]),
  viewport: {
    range: { sheet: 0, r0: 0, c0: 0, r1: 24, c1: 5 },
    tabNavigation: 'editable',
    tabBoundary: 'stop'
  }
})
```

The host can fill initial values with `instance.applyChanges()` and keep user editing under the policy. See [Embedding](/cell/embedding) for the distinction between host updates and user-facing commands.

<CellEmbedDemo scenario="form" />

### Application-owned controls

Use `presets.minimal()` or the `embedded` profile when the surrounding application already has its own toolbar and menus. The host can add a context menu, call a command helper, or open a built-in dialog from an application button; see [Embedding](/cell/embedding#host-owned-toolbar).

<CellEmbedDemo scenario="profiles" />

## Documentation map

- [Install](/cell/install) — packages, styles, a first mount, sizing, errors, and disposal.
- [Bundler setup](/cell/bundler) — Vite configuration and WASM asset checks.
- [Options](/cell/options) — UI profiles, feature switches, policies, viewport, menus, and runtime changes.
- [Platform and Mac UI](/cell/platform) — choose `default`, `mac`, or `auto` and use Mac-specific surfaces.
- [Language switching](/cell/language-switching) — coordinate UI dictionaries, workbook profiles, formula text, and host controls.
- [Embedding](/cell/embedding) — viewer, form, host-owned controls, and host-owned updates.
- [Modals and dialogs](/cell/modals) — overlay placement and direct dialog entry points.
- [Ribbon toolbar](/cell/toolbar) — the inline or separate ribbon, tab sets, dropdown handlers, and commands.
- [Charts](/cell/charts) — create charts, map workbook cells to series, and configure supported settings.
- [Custom cells and host functions](/cell/custom-cells) — display formatters and host functions for autocomplete.
- [Framework adapters](/cell/frameworks) — React and Vue component usage.
- [Hooks and composables](/cell/hooks) — host controls that follow selection, edits, and locale.
- [API surface](/cell/api) — public exports and events.
- [Demo](/cell/demo) — an interactive example.
- [Extensions](/cell/extensions) — add, replace, and remove optional UI.
- [Theming](/cell/theming) — built-in themes and CSS token overrides.
- [Internationalization](/cell/i18n) — locale dictionaries and label overrides.
- [Host integration](/cell/host-integration) — files, status, printing, and host callbacks.
