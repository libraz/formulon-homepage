---
title: Extensions
description: Select, replace, and compose optional formulon-cell UI features without taking over the spreadsheet mount.
---

# Extensions

An extension is an object with an `id` and a `setup()` function. The spreadsheet calls `setup()` during mount, and the returned handle is disposed with the spreadsheet. Built-in dialogs and panels are extensions too, which is why the same mechanism can add, replace, or remove them.

Three options work together: a `ui.profile` or preset chooses the starting surface, `features` turns built-in pieces on or off, and `extensions` mounts additional extension objects. The profiles and the full switch list are in [Options](/cell/options#ui-profile-and-feature-switches).

## Turn built-in features on or off

```ts
import { presets, Spreadsheet } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  features: {
    ...presets.standard(),
    formatDialog: true,
    contextMenu: false,
  },
})

// A role change can update the running surface.
instance.setFeatures({ ...presets.standard(), clipboard: false })
```

`setFeatures()` replaces the whole flag set, so spread the preset again rather than passing only the changed key. Use `ui.features` for readable profile configuration and `features` when an already-built `FeatureFlags` object is convenient; the explicit `features` option wins for keys supplied in both places. An active [interaction policy](/cell/options#interaction-policy) turns most built-ins off regardless of these flags.

## Add a built-in extension selectively

Each replaceable built-in has a factory. This is useful when the default profile is small but one dialog or panel is needed.

```ts
import {
  Spreadsheet,
  findReplace,
  formatDialog,
  presets,
} from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  features: {
    ...presets.minimal(),
    findReplace: false,
    formatDialog: false,
  },
  extensions: [findReplace(), formatDialog()],
})
```

Most factories share their name with the feature flag they replace. The public factories are:

- Navigation and review: `contextMenu`, `findReplace`, `goToSpecialDialog`, `quickAnalysis`, `watchWindow`, `viewToolbar`.
- Editing and formatting: `clipboard`, `pasteSpecial`, `formatDialog`, `formatPainter`, `borderDraw`, `validationList`.
- Workbook authoring: `conditionalDialog`, `namedRangeDialog`, `hyperlinkDialog`, `commentDialog`, `hoverComment`, `iterativeDialog`, `pageSetupDialog`.
- Visual objects and summaries: `charts`, `illustrations`, `pivotTableDialog`, `slicer`, `workbookObjects`.
- Host-facing controls: `statusBar`, `wheel`.

`allBuiltIns()` returns the default-on factories as one array, for a mount that turns every flag off and composes the surface from extensions instead. The formula bar, sheet tabs, language selector, autocomplete, and error indicators have flags but no factory. The package root exports these factories; they are also available from `@libraz/formulon-cell/extensions`.

## Write a small host extension

Use a custom extension when an application needs a listener or control that should be mounted and disposed with the spreadsheet.

```ts
import type { Extension } from '@libraz/formulon-cell'

const saveShortcut: Extension = {
  id: 'hostSaveShortcut',
  setup({ host }) {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveFromHost()
      }
    }

    host.addEventListener('keydown', onKeyDown)
    return {
      dispose() {
        host.removeEventListener('keydown', onKeyDown)
      },
    }
  },
}

await Spreadsheet.mount(host, { extensions: [saveShortcut] })
```

The `setup()` context includes the host element and its chrome elements (`grid`, `formulabar`, `statusbar`, `canvas`, a polite `a11y` live region), `getWb()`, `store`, `history`, `i18n`, `refreshCells()`, `invalidate()`, `resolve(id)` for another extension's handle, and `onWorkbookChange()`. Always read the workbook through `getWb()`, because `setWorkbook()` swaps it. Return `dispose()` for anything the extension registers. A handle may also implement `rebindWorkbook()` (called after `setWorkbook()`) and `setStrings()` (called after a locale change), and expose application methods such as `open()`; it is available as `instance.features[id]`. An optional `priority` orders setup (lower runs first, default 50).

## Replace a built-in surface

To provide an application-specific implementation, disable the built-in flag and register an extension using the same id. The host can then keep the rest of the default surface.

```ts
const customMenu: Extension = {
  id: 'contextMenu',
  setup({ host, store }) {
    const menu = attachApplicationMenu(host, store)
    return { dispose: () => menu.dispose() }
  },
}

await Spreadsheet.mount(host, {
  features: { ...presets.standard(), contextMenu: false },
  extensions: [customMenu],
})
```

Keep custom extensions focused on the host's UI. Use `contextMenu` mount options when only menu items need to change, and use [Modal and overlay options](/cell/modals) when an existing dialog should own the placement.

Most instance openers, such as `openFindReplace()`, target the built-in feature and do nothing once it is disabled; open a replacement through its own handle, `instance.features[id]`. Three openers look for a replacement first: `openQuickAnalysis()`, `openWorkbookObjects()` (also `openPivotFieldList()`), and `openPivotTableDialog()` call the `open()` (or `openPivotFieldList()`) method of an extension registered with id `quickAnalysis`, `workbookObjects`, or `pivotTableDialog`.

## Update and remove extensions

The live instance can add or remove a feature after mount:

```ts
instance.use(findReplace())
instance.remove('findReplace')
instance.setExtensions([formatDialog()])
```

`use()` mounts one more extension; an extension with an id that is already mounted replaces it. `remove(id)` disposes the matching extension and returns `true`, or returns `false` when no extension has that id. `setExtensions()` disposes every extension added through `extensions` or `use()` and mounts the new list. None of them enables or disables a built-in feature; use `setFeatures()` for that.

## Read next

- [API surface](/cell/api#extensions) — mount options and presets.
- [Embedding](/cell/embedding) — compose options for a concrete application layout.
- [Theming](/cell/theming) — style the grid and whichever extensions are enabled.
- [Language switching](/cell/language-switching) — use the selector extension or a host-owned locale control.
