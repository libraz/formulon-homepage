---
title: Embedding formulon-cell
description: Embed the spreadsheet UI with host-owned policies, commands, and lifecycle.
---

# Embedding guide

The core API separates the spreadsheet surface from the surrounding application. The host, or embedding application, chooses the visible UI, the cells that may be edited, the placement of floating UI, and the lifecycle of the workbook.

Before mounting, import the package stylesheet and give the host a height. See [Install](/cell/install) for the CSS import, sizing example, and disposal contract.

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: { profile: 'standard', theme: 'paper' },
  policy,
  viewport,
  contextMenu,
  overlays
})
```

The address types used in these options are zero-based. A cell is `{ sheet, row, col }`; a range is `{ sheet, r0, c0, r1, c1 }`, with both ends included.

## Use case: report viewer

For a report page, keep the grid compact and make every mutation unavailable:

```ts
import {
  Spreadsheet,
  viewerPolicy,
  WorkbookHandle
} from '@libraz/formulon-cell'
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
  viewport: {
    range: { sheet: 0, r0: 0, c0: 0, r1: 40, c1: 8 },
    tabBoundary: 'stop'
  },
  contextMenu: { mode: 'disabled' }
})
```

`viewerPolicy()` keeps selection and copying available while blocking editing. The host can still provide its own export or navigation buttons around the grid.

<CellEmbedDemo scenario="viewer" />

## Use case: fixed-input form

For a form, declare the input cells and guide Tab through them:

```ts
import {
  fixedFormPolicy,
  Spreadsheet,
  WorkbookHandle
} from '@libraz/formulon-cell'

const workbook = await WorkbookHandle.createDefault()
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

// Host-owned prefill or refresh. This is not a user editing command.
instance.applyChanges([
  { addr: { sheet: 0, row: 2, col: 1 }, input: 'Ada Lovelace' }
])
```

`fixedFormPolicy()` accepts a range list, an `EditableCells` predicate, or an object containing `ranges` or `predicate`. The helper allows value entry, clearing, paste, and fill in the declared cells. Use an explicit `InteractionPolicy` when the form needs a different set of operations. While a policy is active, built-in UI is limited to the formula bar, clipboard, shortcuts, wheel scrolling, and context menu; other built-ins remain unavailable even when their flags are true. See [Options](/cell/options#interaction-policy).

<CellEmbedDemo scenario="form" />

## Host-owned updates and user commands

`instance.applyChanges()` is a trusted host update. It is useful for prefilled values, server refreshes, and imports that the host has authorized. It addresses the workbook, including cells outside the current viewport, and the default history mode resets user history after a successful update.

Use `instance.commands.execute()` for user cell edits that must follow the active interaction policy. Exported low-level command helpers are trusted host APIs; the host must authorize their use. If a host update should be recorded as an undoable operation, pass `history: 'record'` and handle a rejected `ChangeBatchResult`:

```ts
const result = instance.applyChanges(
  [{ addr: { sheet: 0, row: 4, col: 2 }, input: 'Approved' }],
  { history: 'record', origin: 'server-refresh' }
)

if (result.status === 'rejected') showUpdateError(result.rejected)
```

## Use case: host-owned toolbar and menu

Start with a small UI profile and let the application own the surrounding controls:

```ts
import {
  presets,
  Spreadsheet
} from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  workbook,
  features: presets.minimal(),
  toolbar: false,
  contextMenu: {
    mode: 'host',
    onOpen: ({ cell, selection, permission }) => {
      openCellMenu({
        cell,
        selection,
        canEdit: permission({
          operation: 'valueEdit',
          origin: 'contextMenu',
          effects: [{ kind: 'cells', cells: [cell] }]
        }).allowed
      })
    }
  }
})
```

The `host` context-menu mode suppresses the browser and built-in menu and hands the current cell, selection, and permission query to the application. A host menu can call a public command helper or open a host modal.

For a built-in menu with one host action, use `mode: 'builtIn'` and a `transform` callback to change the current item snapshot:

```ts
import type { ContextMenuOptions } from '@libraz/formulon-cell'

const contextMenu: ContextMenuOptions = {
  mode: 'builtIn' as const,
  transform: ({ defaultItems }) => [
    ...defaultItems,
    {
      id: 'host:details',
      label: 'Open details',
      action: ({ cell }) => openDetails(cell)
    }
  ]
}
```

Use `{ mode: 'disabled' }` when the host supplies another interaction surface or when a compact viewer should have no right-click menu.

## Runtime changes

Settings can change after mount without replacing the workbook:

```ts
instance.setUi({ profile: 'minimal', theme: 'ink' })
instance.setPolicy(viewerPolicy())
instance.setViewportOptions({
  range: { sheet: 0, r0: 0, c0: 0, r1: 30, c1: 6 }
})
instance.setContextMenu({ mode: 'disabled' })
instance.setOverlayOptions({ root: modalSurface })
instance.setTheme('paper')
instance.setToolbar(false)
```

Use `setFeatures()` for a direct `FeatureFlags` update. `setUi()` resolves a profile and its UI switches; the original top-level `features`, `theme`, and `toolbar` options are also reapplied. Use `setFeatures()`, `setTheme()`, or `setToolbar()` to change those values directly. See [Options](/cell/options) for the precedence rules and option reference.

<CellEmbedDemo scenario="host-sync" />

## Lifecycle

Keep the instance and the workbook under the same view owner. Dispose both when the view is removed:

```ts
const instance = await Spreadsheet.mount(host, { workbook })

function closeView() {
  instance.dispose()
  workbook.dispose()
}
```

For asynchronous mounts, keep the host's unmount path safe when initialization rejects. Framework adapters expose the same lifecycle through their component props and events.

A workbook supplied to the initial mount remains caller-owned. The instance owns its default-created workbook and any replacement passed to `setWorkbook()`. After replacement, dispose the original caller-owned handle once it is no longer used; the instance disposes its current replacement.
