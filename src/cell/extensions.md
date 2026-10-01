---
title: Extensions
description: Select, replace, and compose optional formulon-cell UI features without taking over the spreadsheet mount.
---

# Extensions

Extensions are the unit for optional UI around the grid. A preset or `ui.profile` chooses a starting surface, `features` turns built-in pieces on or off, and `extensions` adds a built-in factory or a host-owned feature.

## Choose a starting surface

Use a UI profile when the goal is to choose the surrounding UI:

| Profile | Good starting point |
| --- | --- |
| `embedded` | A form or viewer placed inside an existing application screen. |
| `minimal` | A compact editable grid with a small amount of surrounding UI. |
| `standard` | A general-purpose spreadsheet area. |
| `full` or `excel365` | A broad desktop-style surface with optional authoring tools. |

```ts
const instance = await Spreadsheet.mount(host, {
  ui: {
    profile: 'embedded',
    features: { contextMenu: false, sheetTabs: false },
  },
})
```

`presets.minimal()`, `presets.standard()`, and `presets.full()` are useful when the host wants a `FeatureFlags` object directly. Add an explicit flag after a preset to adjust one feature.

<CellEmbedDemo scenario="profiles" />

## Turn built-in features on or off

The `ui.features` switches cover navigation and review, editing and formatting, workbook authoring, and host status. The lower-level `FeatureFlags` object uses the corresponding built-in ids; see [Options](/cell/options) for the complete switch list.

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

Use `ui.features` for readable profile configuration and `features` when an already-built `FeatureFlags` object is convenient. The explicit `features` option wins for keys supplied in both places.

If the instance has a `policy`, built-in UI is limited to the policy-supported routes even when other feature flags are true. See [Interaction policy](/cell/options#interaction-policy) before adding extensions for host-owned commands.

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

The factory and feature id share the same name in most cases. The public factories cover these user-facing groups:

- Navigation and review: `contextMenu`, `findReplace`, `goToSpecialDialog`, `quickAnalysis`, `watchWindow`, `viewToolbar`.
- Editing and formatting: `clipboard`, `pasteSpecial`, `formatDialog`, `formatPainter`, `borderDraw`, `validationList`.
- Workbook authoring: `conditionalDialog`, `namedRangeDialog`, `hyperlinkDialog`, `commentDialog`, `iterativeDialog`, `pageSetupDialog`.
- Visual objects and summaries: `charts`, `illustrations`, `pivotTableDialog`, `slicer`, `workbookObjects`.
- Host-facing controls: `statusBar`, `wheel`.

The package root exports these factories. They are also available from `@libraz/formulon-cell/extensions`.

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

The `setup()` context includes the host element, workbook accessor, store, history, i18n controller, and helpers for refreshing cells or resolving another extension. Return `dispose()` for anything the extension registers. A handle may also expose application methods such as `open()` or `refresh()`; the handle is available as `instance.features[id]`.

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

Instance methods such as `openFindReplace()` target the built-in feature. For a dialog supplied through `extensions`, call the handle exposed by `instance.features[id]`; disabling the built-in also disables its instance opener.

## Update and remove extensions

The live instance can add or remove a feature after mount:

```ts
instance.use(findReplace())
instance.remove('findReplace')
instance.setExtensions([formatDialog()])
```

`remove()` destroys a matching custom extension, if present, and returns `true`. It does not enable or disable a built-in feature; use `setFeatures()` for that. Keep host references to handles only when the application needs a custom method, and call `dispose()` through the extension lifecycle before dropping external references.

## Read next

- [API surface](/cell/api#extensions) — mount options and presets.
- [Embedding](/cell/embedding) — compose options for a concrete application layout.
- [Theming](/cell/theming) — style the grid and whichever extensions are enabled.
