---
title: formulon-cell API surface
description: Choose the package entry point, mount a spreadsheet, and connect the live instance to your application.
---

# API surface

Most applications use three pieces from `@libraz/formulon-cell`: `WorkbookHandle` for file and workbook data, `Spreadsheet.mount()` for the UI, and the returned `SpreadsheetInstance` for host actions. React and Vue re-export the same core types and add framework components.

## Import map

| Need | Import |
| --- | --- |
| Mount the vanilla DOM component | `@libraz/formulon-cell` → `Spreadsheet` |
| Load or save workbook data | `@libraz/formulon-cell` → `WorkbookHandle` |
| Select a UI profile | `@libraz/formulon-cell` → `presets`, `resolveSpreadsheetUiOptions` |
| Restrict a viewer or form | `@libraz/formulon-cell` → `viewerPolicy`, `fixedFormPolicy` |
| Add or replace optional UI | `@libraz/formulon-cell` → extension factories and `Extension` types |
| React component and hooks | `@libraz/formulon-cell-react` |
| Vue component and composables | `@libraz/formulon-cell-vue` |
| Styles | `@libraz/formulon-cell/styles.css` and an adapter toolbar stylesheet when using a separate toolbar component |

The root entry point also exports command helpers and public types. Keep the generated type declarations beside the version you install for the complete symbol list; this page explains how the main pieces fit together.

## WorkbookHandle

`WorkbookHandle` is the object shared by the file layer and the spreadsheet UI.

```ts
import { WorkbookHandle, Spreadsheet } from '@libraz/formulon-cell'

const workbook = await WorkbookHandle.createDefault()
const instance = await Spreadsheet.mount(host, { workbook })

const bytes = instance.workbook.save()
const loaded = await WorkbookHandle.loadBytes(new Uint8Array(fileBytes))
await instance.setWorkbook(loaded)
workbook.dispose()

function closeView() {
  instance.dispose()
}
```

Use `createDefault()` for a new workbook and `loadBytes()` for bytes obtained from a file or an API. Pass the handle to `Spreadsheet.mount()` when the host must prepare or load data first. `WorkbookHandle.save()` returns bytes for the host to download or upload.

A workbook supplied to the initial mount remains caller-owned. The instance owns its default-created workbook and any replacement passed to `setWorkbook()`. After replacement, dispose the original caller-owned handle once it is no longer used; the instance disposes its current replacement.

## Mounting and the live instance

```ts
import { Spreadsheet, presets } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  ui: {
    profile: 'standard',
    theme: 'paper',
    features: { comments: true },
  },
  locale: 'en',
})

instance.setTheme('ink')
instance.openFindReplace('find')
instance.dispose()
```

The host element is taken over by the mount. Give it a height in the surrounding layout and import `@libraz/formulon-cell/styles.css`. The mount options cover UI profile, feature switches, policies, viewport bounds, context menus, overlay roots, locale, extensions, toolbar, and host callbacks. The [Embedding guide](/cell/embedding) shows those choices in application-shaped examples.

The returned `SpreadsheetInstance` is the main host API:

| Member | Use it for |
| --- | --- |
| `workbook` | Read, modify, recalculate, load, or save workbook data. |
| `applyChanges()` | Apply a trusted batch from a server, import, or form. |
| `setPolicy()`, `setViewportOptions()` | Change permissions or the embedded area after mount. |
| `setContextMenu()`, `setOverlayOptions()` | Coordinate menus and dialogs with the host layout. |
| `setUi()`, `setFeatures()`, `setExtensions()` | Adjust the UI surface while it is mounted. |
| `i18n`, `setTheme()` | Change labels and visual theme. |
| `on()` | Subscribe to stable named events. |
| `print()`, `captureScreenClip()` | Invoke host-facing print and capture actions. |
| `dispose()` | Release the mounted UI and event subscriptions. |

## Presets

`presets` is a shorthand for a group of feature flags. It is useful when the application wants a known starting set of built-in features and then needs to adjust a few flags.

| Preset | Starting point |
| --- | --- |
| `presets.minimal()` | A compact grid with basic editing and status feedback. |
| `presets.standard()` | Common navigation, clipboard, selection, and analysis tools. |
| `presets.full()` | The broadest built-in spreadsheet surface. |

For an embedded component, `ui: { profile: 'embedded' }` is the clearer starting point because it also controls ribbon and print visibility. Pass `features` for individual switches; when both `ui.features` and `features` are supplied, the explicit `features` values win.

```ts
const instance = await Spreadsheet.mount(host, {
  ui: {
    profile: 'embedded',
    theme: 'paper',
    features: { contextMenu: false, sheetTabs: false },
  },
  features: { clipboard: true },
})
```

## Extensions

An extension adds a focused UI feature or host integration. Built-in factories are exported from the root package and from `@libraz/formulon-cell/extensions`. Disable the matching feature before supplying a replacement with the same id.

```ts
import { Spreadsheet, findReplace, presets } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  features: { ...presets.minimal(), findReplace: false },
  extensions: [findReplace()],
})
```

See [Extensions](/cell/extensions) for the composition pattern and the built-in feature groups.

Instance methods such as `openFindReplace()` target the built-in feature. For a dialog supplied through `extensions`, call the handle exposed by `instance.features[id]`; disabling the built-in also disables its instance opener.

## Events

`instance.on(name, handler)` returns an unsubscribe function. The event payloads are typed in TypeScript.

| Event | Use it for |
| --- | --- |
| `changeBatch` | React to an applied cell batch. |
| `cellChange` | Mirror a changed value or formula. |
| `selectionChange` | Update an inspector or host command state. |
| `workbookChange` | React to a workbook replacement. |
| `localeChange` | Persist a locale selection. |
| `themeChange` | Persist or coordinate a theme selection. |
| `recalc` | Refresh host content that depends on calculated cells. |

```ts
const unsubscribe = instance.on('selectionChange', ({ active, range }) => {
  inspector.show({ active, range })
})

unsubscribe()
```

For save flows and trusted updates, see [Host integration](/cell/host-integration).

## Command helpers

The root package exports focused helpers for applications that provide their own buttons or dialogs. Common groups include formatting, clipboard and CSV/TSV, find and replace, comments, hyperlinks, validation, filters, tables, sheet views, page setup, charts, slicers, and protection. Each helper works with the instance store or workbook state described by its type signature.

Use an instance method when the action opens one of the built-in dialogs, for example `openFormatDialog()` or `openPageSetup()`. Use a command helper when the host owns the surrounding control and wants to supply its own UI.

## Store access

`instance.store` is available for integrations that need a reactive view of selection, layout, or cell state. It is a per-instance store; there is no global spreadsheet store. Framework users normally prefer `useSelection()` or `useSpreadsheet()` from the adapter package so subscription cleanup follows component lifetime.

## i18n controller

```ts
instance.i18n.setLocale('ja')
instance.i18n.extend('ja', {
  contextMenu: { copy: 'コピー' },
})
```

`i18n` exposes `setLocale()`, `extend()`, `register()`, `subscribe()`, and the resolved `strings`. See [Internationalization](/cell/i18n) for runtime switching and custom labels.

## Theme controller

```ts
instance.setTheme('paper')
instance.setTheme('ink')
instance.setTheme('contrast')
instance.setTheme('brand') // requires a full custom palette
```

Built-in themes are `paper`, `ink`, and `contrast`. A custom name selects host CSS rules scoped to `data-fc-theme`; it requires a complete custom palette and does not inherit a built-in theme. See [Theming](/cell/theming) for token overrides.

## Read next

- [Hooks and composables](/cell/hooks) — selection, edit notifications, and shared language controls.
- [Embedding](/cell/embedding) — choose options for a full, minimal, or embedded surface.
- [React and Vue adapters](/cell/frameworks) — component props, events, hooks, and composables.
- [Host integration](/cell/host-integration) — files, save state, printing, and native hooks.
- [Extensions](/cell/extensions) — add, replace, and remove optional UI.
- [Theming](/cell/theming) — built-in themes and CSS token overrides.
- [Internationalization](/cell/i18n) — locale dictionaries and label overrides.
- [Modals and dialogs](/cell/modals) — overlay placement and dialog entry points.
