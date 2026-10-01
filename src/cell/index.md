---
title: formulon-cell
description: Embed an Excel-like spreadsheet UI in a browser application.
---

# formulon-cell

`@libraz/formulon-cell` is a browser UI kit for embedding a workbook-like grid in an application. The vanilla package provides the DOM core, and the React and Vue packages provide framework adapters. The kit is designed around an Excel-like surface, while individual controls and interactions continue to evolve.

The documentation focuses on integration decisions that stay useful as the UI grows: which surrounding controls to show, which cells users may edit, where menus and dialogs should open, and how to connect host-owned controls.

The demos on this page show that UI controls, editing permissions, and viewport bounds can be configured independently.

## Packages

| Package | Use it when |
| --- | --- |
| `@libraz/formulon-cell` | The host owns the DOM and lifecycle. |
| `@libraz/formulon-cell-react` | The host application uses React 18 or later. |
| `@libraz/formulon-cell-vue` | The host application uses Vue 3. |

The core package exposes `Spreadsheet.mount()`, `WorkbookHandle`, presets, policies, viewport and context-menu options, overlay placement, and imperative dialog openers. The framework packages wrap the same surface for their component lifecycle.

## Choose a starting point

### Read-only workbook viewer

Use the embedded UI profile with `viewerPolicy()` when the application displays a workbook and lets readers select or copy cells:

```ts
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

Use `presets.minimal()` or the `embedded` profile when the surrounding application already has its own toolbar and menus. The host can add a context menu, call a command helper, or open a built-in dialog from an application button. [Modals and dialogs](/cell/modals) covers native `<dialog>`, framework modals, and fullscreen surfaces.

<CellEmbedDemo scenario="profiles" />

## Documentation map

- [Install](/cell/install) — packages, styles, sizing, errors, and disposal.
- [Bundler setup](/cell/bundler) — current Vite setup and asset checks.
- [Options](/cell/options) — UI profiles, feature switches, policies, viewport, menus, and runtime changes.
- [Embedding](/cell/embedding) — viewer, form, host-owned controls, and host-owned updates.
- [Modals and dialogs](/cell/modals) — overlay placement and direct dialog entry points.
- [Framework adapters](/cell/frameworks) — React and Vue component usage.
- [Hooks and composables](/cell/hooks) — host controls that follow selection, edits, and locale.
- [API surface](/cell/api) — public exports and events.
- [Demo](/cell/demo) — an interactive example.
- [Extensions](/cell/extensions) — add, replace, and remove optional UI.
- [Theming](/cell/theming) — built-in themes and CSS token overrides.
- [Internationalization](/cell/i18n) — locale dictionaries and label overrides.
- [Host integration](/cell/host-integration) — files, status, printing, and host callbacks.
