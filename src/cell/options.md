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
| `embedded` | Grid-oriented surface for an application that owns the surrounding controls. |
| `minimal` | Small set of common spreadsheet controls. |
| `standard` | A broader everyday spreadsheet surface. |
| `excel365` | Full desktop-style surface. |
| `full` | Full surface, equivalent to the full preset. |

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

Use `ui.features` for named UI switches such as `ribbon`, `formulaBar`, `sheetTabs`, `statusBar`, `contextMenu`, `formatDialog`, `comments`, `charts`, `print`, and `clipboard`. Use `ui.advancedFeatures` or the top-level `features` option when the host needs the lower-level feature flag names.

`openDataValidationDialog()` requires `formatDialog: true`; `validation` controls cell validation assistance and list dropdowns.

The initial resolution order is:

1. The selected `ui.profile` supplies the starting feature set.
2. `ui.advancedFeatures` changes feature flags directly.
3. `ui.features` changes the user-facing switches.
4. Top-level `features` takes precedence over the UI profile.

The top-level `theme` takes precedence over `ui.theme`. The top-level `toolbar` takes precedence over the profile's ribbon choice. This makes a shared profile reusable while each host still controls its own toolbar placement.

Without `ui.profile`, the feature profile resolves to `excel365`. The ribbon mounts only when `toolbar` enables it or a supplied `ui` resolves to a ribbon-enabled profile. Feature flags select built-in extensions; they do not by themselves choose the surrounding ribbon layout.

`setUi()` also reapplies the original top-level `features`, `theme`, and `toolbar` overrides. Use `setFeatures()`, `setTheme()`, or `setToolbar()` to change those values directly.

The built-in themes are `paper`, `ink`, and `contrast`. A host can call `instance.setTheme()` after mount when the surrounding application changes appearance.

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

Keep `features` and `extensions` as separate concerns: the first enables or disables built-in features, while the second mounts extension objects.

## Interaction policy

`policy` controls what a user may do through the grid, keyboard, clipboard, context menu, and built-in toolbar. It is independent from the visible UI profile.

Use `viewerPolicy()` for a selectable, copyable viewer:

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

For a custom policy, `defaultOperation: 'deny'` is a useful starting point. Add only the operations that the host UI actually exposes. Use `instance.setPolicy()` when a view changes from editable to read-only.

::: info Policy and built-in UI
While a policy is active, built-in UI is limited to the formula bar, clipboard, shortcuts, wheel scrolling, and context menu. Other built-ins remain unavailable even if their flags are true; authorizing an operation alone does not enable its UI. Host-owned code must authorize low-level helpers separately.
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
- `autoExpand`: lets the navigation area grow with the sheet. Do not combine it with a fixed `range`.

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

`builtIn` keeps the package menu and can limit or transform the item snapshot. A `transform` callback can append a host action whose `action` opens a host dialog or dispatches an application event. `host` suppresses the package and browser menu and passes the current cell and selection to the host. `disabled` removes the right-click menu.

The exact built-in item IDs are part of the package's public type declarations. Keep custom IDs prefixed by the host application so they remain distinct from built-ins.

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

## Runtime and error options

The following methods update integration settings without replacing the workbook:

```ts
instance.setUi(nextUi)
instance.setFeatures(nextFeatures)
instance.setPolicy(nextPolicy)
instance.setViewportOptions(nextViewport)
instance.setContextMenu(nextContextMenu)
instance.setOverlayOptions(nextOverlays)
instance.setToolbar(nextToolbar)
instance.setTheme(nextTheme)
```

Use `locale` and `strings` at mount time for labels, and `instance.i18n` for locale changes after mount. Use `onError` for a host error surface; set `renderError: false` when the host or framework renders the fallback itself.

The shipped package type declarations remain the complete option reference. These pages describe the combinations that are useful when embedding the UI and avoid duplicating every feature flag.
