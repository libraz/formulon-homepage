---
title: formulon-cell options
description: Choose the visible UI, editable cells, navigation bounds, menus, and overlay root.
---

# Options

`Spreadsheet.mount(host, options)` accepts independent options for the UI profile, interaction permissions, navigation, context menu, and floating UI. Start with a profile and add only the restrictions or host integrations the page needs.

## UI profile and feature switches

`ui.profile` chooses a starting surface:

| Profile | Starting point |
| --- | --- |
| `embedded` | Every built-in feature off, no ribbon, no print. Turn individual pieces back on with `ui.features`. |
| `minimal` | `presets.minimal()`: formula bar, status bar, clipboard, keyboard shortcuts, and wheel scrolling. |
| `standard` | `presets.standard()`: adds sheet tabs, context menu, Find/Replace, format painter, Quick Analysis, charts, and autocomplete, without the authoring dialogs. |
| `excel365` | Every feature except the opt-in ones listed below. This is the profile used when `ui.profile` is omitted. |
| `full` | Same feature set as `excel365`. |

`ui.platform` is resolved independently from `ui.profile`. Use `default` for the default surface, `mac` for an explicit Mac surface, or `auto` for browser detection; iPad and iPhone user agents, including touch-enabled `MacIntel`, resolve to `default`. The platform also sets the grid's screen scale and the defaults of a workbook the mount creates. See [Platform and Mac UI](/cell/platform) for the Mac ribbon, sheet geometry, and limits.

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: {
    profile: 'standard',
    theme: 'ink',
    features: {
      ribbon: true,
      sheetTabs: true,
      statusBar: false,
      comments: false,
      charts: false
    }
  }
})
```

`ui.features` takes readable on/off switches. Most of them share their name with a lower-level feature flag; a few are renamed or exist only at the UI level:

| `ui.features` switch | Feature flag |
| --- | --- |
| `formulaBar`, `viewToolbar`, `sheetTabs`, `statusBar`, `localeSwitcher`, `workbookObjects`, `contextMenu`, `findReplace`, `formatDialog`, `formatPainter`, `namedRanges`, `hyperlink`, `pasteSpecial`, `quickAnalysis`, `charts`, `pageSetup`, `validation`, `autocomplete`, `clipboard`, `shortcuts`, `wheel`, `watchWindow`, `slicer` | Same name. |
| `conditionalFormatting` | `conditional` |
| `comments` | `commentDialog` |
| `pivotTable` | `pivotTableDialog` |
| `ribbon` | None. Mounts the ribbon; on by default except in `embedded`. |
| `print` | None. Enables `instance.print()`; on by default except in `embedded`. `print: false` also turns off `pageSetup` unless you set it. |

The flags `borderDraw`, `iterative`, `fxDialog`, `illustrations`, `hoverComment`, `errorIndicators`, and `gotoSpecial` have no switch; set them through `ui.advancedFeatures` or the top-level `features` option. A flag that is not mentioned is on, except four opt-in flags that start off in every profile: `watchWindow`, `slicer`, `viewToolbar`, and `localeSwitcher`.

`localeSwitcher` adds the built-in language selector below the formula bar. It is opt-in because many hosts already own a language menu; see [Language switching](/cell/language-switching). `validation` controls input assistance and list dropdowns in cells, while `openDataValidationDialog()` opens a page of the Format Cells dialog and therefore needs `formatDialog`.

The initial resolution order is:

1. The selected `ui.profile` supplies the starting feature set.
2. `ui.advancedFeatures` changes feature flags directly.
3. `ui.features` changes the user-facing switches.
4. Top-level `features` overrides all of the above.

The top-level `theme` takes precedence over `ui.theme` (default `paper`; the built-in themes are `paper`, `ink`, and `contrast`). The top-level `toolbar` takes precedence over the profile's ribbon choice, so a shared profile stays reusable while each host decides where its toolbar goes.

::: info When does the ribbon appear?
Only when `toolbar` is `true` or an options object, or when you pass a `ui` whose profile has the ribbon on. A mount with no `ui` and no `toolbar` has no ribbon, even though its features resolve to the `excel365` set. Feature flags choose built-in features; they do not mount the ribbon.
:::

`setUi()` keeps the current workbook while re-resolving the profile, platform, and theme. Pass the complete UI configuration: omitted fields return to their defaults. It also reapplies the original top-level `features`, `theme`, and `toolbar` overrides. A platform change closes an open Mac formula palette and discards its suspended draft, re-reads row heights and column widths, and clears the undo history. Use `setFeatures()`, `setTheme()`, or `setToolbar()` to change one of those values directly.

<CellEmbedDemo scenario="profiles" />

## Presets and extensions

`presets.minimal()`, `presets.standard()`, and `presets.full()` return `FeatureFlags` objects. Pass one to the top-level `features` option:

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  features: {
    ...presets.standard(),
    findReplace: false,
    formatDialog: true
  }
})
```

`extensions` accepts extension objects, including objects returned by factories such as `findReplace()`. Use it when a host supplies a replacement or an additional surface:

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  features: { ...presets.minimal(), findReplace: false },
  extensions: [findReplace()]
})
```

Keep `features` and `extensions` as separate concerns: the first enables or disables built-in features, while the second mounts extension objects. [Extensions](/cell/extensions) lists the factories and the replacement pattern.

## Interaction policy

`policy` controls what a user may do through the grid, keyboard, clipboard, context menu, and built-in toolbar. It is independent from the visible UI profile. Undo and redo re-check the current policy.

Use `viewerPolicy()` for a selectable, copyable viewer. It denies every mutation, and print and export stay denied until the host allows them. This example allows export:

```ts
const policy = {
  ...viewerPolicy(),
  operations: {
    export: true
  }
}
```

Use `fixedFormPolicy()` for a form with declared input cells:

```ts
const policy = fixedFormPolicy([
  { sheet: 0, r0: 3, c0: 1, r1: 12, c1: 2 }
])
```

The policy helper accepts a range list, a predicate, or `{ ranges }` / `{ predicate }`. A predicate receives `{ addr, operation, origin }`:

```ts
const policy = fixedFormPolicy(({ addr, operation }) =>
  addr.sheet === 0 &&
  addr.col === 2 &&
  addr.row >= 3 &&
  addr.row <= 12 &&
  operation === 'valueEdit'
)
```

A custom policy is a plain `InteractionPolicy` object. Once a policy is supplied, any operation it does not allow is denied:

| Field | Meaning |
| --- | --- |
| `operations` | Per-operation `true` / `false`. |
| `defaultOperation` | `'deny'` (default) or `'allow'` for operations not listed in `operations`. |
| `readOnly` | Denies every mutating operation, whatever `operations` says. |
| `editable` | Cells that may change: a range list, a predicate, or `{ ranges }` / `{ predicate }`. Omitted means every cell. |
| `selection`, `copy` | Whether the user may select cells and copy them. |
| `batchDenied` | `'reject'` fails a whole paste or fill when one cell is denied; `'skipIneligible'` writes the allowed cells. |
| `restrict` | A final synchronous check that can deny a request but never grant one the policy already denied. |

The operation names are `valueEdit`, `formulaEdit`, `clear`, `paste`, `fill`, `moveCells`, `format`, `insertRows`, `deleteRows`, `insertColumns`, `deleteColumns`, `resizeRows`, `resizeColumns`, `sort`, `merge`, `filter`, `table`, `comment`, `hyperlink`, `validation`, `namedRange`, `sheet`, `object`, `protection`, `pageSetup`, `print`, and `export`. Use `instance.setPolicy()` when a view changes from editable to read-only, and `instance.commands.canExecute()` to ask whether a given operation would be allowed.

Protection and merged cells remain part of authorization. A write touching a merged range is checked across the merge and committed at its anchor. Composite edits, including multi-area formatting and Clear, are re-authorized when they are executed and again when they are undone or redone, so a policy change can reject a later replay.

::: warning A policy also limits the built-in UI
While a policy is active, the only built-in features are the formula bar, clipboard, keyboard shortcuts, wheel scrolling, and context menu. Dialogs, panels, and the language selector stay unavailable even when their flags are true, and allowing an operation does not bring its UI back. A mounted ribbon stays visible but disables the commands the policy denies. Provide host-owned controls for anything else, and authorize low-level helpers yourself when host code calls them.
:::

<CellEmbedDemo scenario="form" />

## Viewport and keyboard navigation

`viewport.range` bounds the visible and selectable rectangle. It does not remove workbook data. Coordinates are zero-based and inclusive:

```ts
const viewport = {
  range: { sheet: 0, r0: 0, c0: 0, r1: 30, c1: 6 },
  tabNavigation: 'editable' as const,
  tabBoundary: 'stop' as const
}
```

The other options are:

- `selectable`: a range list or predicate that narrows which cells may be selected further.
- `tabNavigation`: `normal` follows the grid, while `editable` follows cells allowed by the active policy.
- `tabBoundary`: `stop` keeps focus in the configured area, while `leave` lets Tab leave it.
- `autoExpand`: lets the navigation area grow with the sheet. Combining it with a fixed `range` throws.

Arrow keys, Tab, the move after Enter, and movement inside a selection skip hidden rows and columns and step over merged cells. On the `mac` [platform](/cell/platform), Tab moves along a row and Return goes back to the column where the Tab run started.

While a formula is being edited in the cell or the formula bar, an arrow key at an operand position (after `=`, an operator, a comma, or an open parenthesis) inserts a reference to the neighboring cell, and further arrow keys move or extend it. Typing into a cell starts in this pointing mode, F2 switches between pointing and editing the text, and Ctrl+Arrow jumps to the edge of the data. Ctrl+Z undoes within the formula being edited and Ctrl+Y or Ctrl+Shift+Z redoes, separately from the sheet's undo history; Cmd works in place of Ctrl. A URL typed into a cell becomes a hyperlink when the entry is committed.

Use `instance.setViewportOptions()` to switch a report area or form page after mount. A fixed range targets one sheet at a time; include the sheet index in the range when changing sheets.

## Context menu

Choose one of three modes:

```ts
import type { ContextMenuOptions } from '@libraz/formulon-cell'

const noMenu: ContextMenuOptions = { mode: 'disabled' }

const builtInMenu: ContextMenuOptions = {
  mode: 'builtIn',
  items: ['copy', 'cut'],
  transform: ({ defaultItems }) => defaultItems
}

const hostMenu: ContextMenuOptions = {
  mode: 'host',
  onOpen: ({ cell, selection, canExecute }) => {
    openApplicationMenu({ cell, selection, canCopy: canExecute('copy').allowed })
  }
}
```

`builtIn` keeps the package menu and can limit or transform the item snapshot. `host` suppresses the package and browser menu and passes the current cell, selection, and a permission query (`canExecute`, alias `permission`) to the host. `disabled` removes the right-click menu.

An item returned from `transform` has an `id` and optionally `label`, `hint`, `separator`, `children`, `disabled`, and `disabledReason`. Give it an `action` callback to open a host dialog or dispatch an application event, or a `command` to submit a cell batch that goes through the active policy. The `items` option is typed with the built-in item IDs, so an editor completes them; prefix custom IDs (for example `host:details`) so they stay distinct from built-ins.

## Overlay placement

Floating menus, tooltips, and built-in dialogs are placed in an overlay portal. Set `overlays.root` when a host modal or fullscreen container owns the presentation boundary:

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  overlays: { root: modalSurface }
})
```

`root` may also be a resolver:

```ts
instance.setOverlayOptions({
  root: () => document.querySelector<HTMLElement>('.modal-surface')!
})
```

The root must be an `HTMLElement` in the same document as the mounted host. See [Modals and dialogs](/cell/modals) for native `<dialog>` and fullscreen examples.

## Change settings after mount {#runtime-changes}

These methods update integration settings without replacing the workbook:

```ts
instance.setUi(nextUi)
instance.setFeatures(nextFeatures)
instance.setExtensions(nextExtensions)
instance.setPolicy(nextPolicy)
instance.setViewportOptions(nextViewport)
instance.setContextMenu(nextContextMenu)
instance.setOverlayOptions(nextOverlays)
instance.setToolbar(nextToolbar)
instance.setTheme(nextTheme)
instance.setLocale(nextLocale) // returns false when the change is rolled back
```

React and Vue adapters call the matching setter when a prop changes.

## Other mount options

| Option | Use it for | Details |
| --- | --- | --- |
| `workbook` | Mount a workbook the host created or loaded. Omitted creates a default workbook. | [Install](/cell/install#host-sizing) |
| `locale`, `strings` | UI language (default `ja`) and label overrides. | [Internationalization](/cell/i18n) |
| `toolbar` | `true` or ribbon options to mount the ribbon inside the host. | [Ribbon toolbar](/cell/toolbar) |
| `functions` | Host functions offered in formula autocomplete and callable through `instance.formula`. | [Custom cells and host functions](/cell/custom-cells#host-functions) |
| `seed` | A callback that fills a mount-created workbook before first render, mostly for demos. | [Custom cells and host functions](/cell/custom-cells#host-functions) |
| `onError`, `renderError` | Mount-failure callback; set `renderError: false` to suppress the built-in error panel. | [Install](/cell/install) |
| `getWorkbookName`, `uploadStatus`, `macroRecording` | Watch Window title and status-bar indicators. | [Host integration](/cell/host-integration#status-bar) |
| `printerProfiles`, `printerProfileId`, `refreshPrinterProfiles` | Printable areas for the print and PDF flow. | [Host integration](/cell/host-integration#printer-profiles) |
| `captureScreenClip` | Insert → Screenshot → Screen Clipping in a native shell. | [Host integration](/cell/host-integration#native-screen-capture) |
| `getFunctionArgumentHelp` | Per-argument help in the Mac formula palette. | [Platform and Mac UI](/cell/platform#function-arguments-palette) |

The `MountOptions` type in the package declarations is the complete reference.
