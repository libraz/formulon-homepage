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
| Select a UI profile or platform | `@libraz/formulon-cell` → `presets`, `resolveSpreadsheetUiOptions`, `resolveSpreadsheetPlatform` |
| Mount a separate ribbon or read its model | `@libraz/formulon-cell` → `Spreadsheet.mountToolbar`, `buildRibbonModel`, `RibbonProfile`; see [Ribbon toolbar](/cell/toolbar) |
| Restrict a viewer or form | `@libraz/formulon-cell` → `viewerPolicy`, `fixedFormPolicy` |
| Add or replace optional UI | `@libraz/formulon-cell` or `@libraz/formulon-cell/extensions` → extension factories and `Extension` types |
| Load one locale dictionary | `@libraz/formulon-cell/i18n/en` (also `ja`, `de`, `fr`, `zh`, `ko`, `th`) |
| Lay out chart drawing elements without a spreadsheet | `@libraz/formulon-cell/charts` → `layoutChart`; see [Charts](#charts) |
| React component and hooks | `@libraz/formulon-cell-react` |
| Vue component and composables | `@libraz/formulon-cell-vue` |
| Styles | `@libraz/formulon-cell/styles.css` (grid, dialogs, ribbon, all themes) |

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

Use `createDefault()` for a new workbook and `loadBytes()` for `.xlsx` bytes obtained from a file or an API. Pass the handle to `Spreadsheet.mount()` when the host must prepare or load data first. `save()` returns `.xlsx` bytes for the host to download or upload; [Host integration](/cell/host-integration#saved-state) lists what the file keeps and how to read load and save loss reports or write `.xlsb`. `createDefault({ locale, platform })` creates a workbook with the defaults of the `default` or `mac` platform; see [Platform and Mac UI](/cell/platform#sheet-geometry). Wrap a multi-cell write in `workbook.withBatchedRecalc(() => { … })` to recalculate once at the end instead of after every cell. [Install](/cell/install#host-sizing) explains which handles the instance disposes.

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
| `workbook`, `setWorkbook()` | Read, modify, recalculate, or save workbook data; swap in another workbook. |
| `applyChanges()` | Apply a trusted batch from a server, import, or form. |
| `commands` | Run policy-checked user edits (`execute()`), ask `canExecute()`, and `subscribe()` to every batch result, including rejections. |
| `undo()`, `redo()`, `history` | Drive the undo stack from host buttons. Both methods return `false` when no step was applied. |
| `recalc()` | Recalculate the workbook and repaint. |
| `setPolicy()`, `setViewportOptions()`, `setContextMenu()`, `setOverlayOptions()`, `setUi()`, `setFeatures()`, `setExtensions()`, `setToolbar()`, `setTheme()` | Change mount options after mount; see [Options](/cell/options#runtime-changes). |
| `locale`, `setLocale()`, `i18n` | Read or change the UI locale and calculation profile; register and extend dictionaries. `setLocale()` returns `false` when the change is rolled back. |
| `open…Dialog()`, `openFindReplace()`, `openFormatDialog()`, `openPageSetup()`, … | Open a built-in dialog from host UI; see [Modals and dialogs](/cell/modals#open-a-built-in-dialog-from-host-ui). |
| `openChartSettings(tab?)` | Open the settings of the selected chart; returns `false` when no chart is selected. |
| `followActiveHyperlink()` | Follow the hyperlink on the active cell as Ctrl/Cmd+click does; returns `false` when there is none. |
| `openWatchWindow()`, `closeWatchWindow()`, `toggleWatchWindow()` | Show the Watch Window panel. |
| `tracePrecedents()`, `traceDependents()`, `clearTraces()` | Draw or clear formula trace arrows from the active cell. The trace methods return the count of arrows added. |
| `setSheetProtected()`, `toggleSheetProtection()`, `isSheetProtected()` | Protect the active sheet, optionally with a password and permission set. |
| `addSlicer()`, `removeSlicer()` | Add a slicer for a table column. Requires the opt-in `slicer` feature. |
| `print()`, `captureScreenClip()`, `setUploadStatus()`, `setMacroRecording()` | Host-facing print, capture, and status actions; see [Host integration](/cell/host-integration). |
| `formula`, `cells` | Host function registry and custom cell formatters; see [Custom cells and host functions](/cell/custom-cells). |
| `toolbar`, `features`, `use()`, `remove()` | The mounted ribbon (see [Ribbon toolbar](/cell/toolbar#toolbarinstance)), extension handles, and extension registration. |
| `store` | Per-instance reactive state (selection, layout, cells). |
| `on()`, `off()` | Subscribe to named events. |
| `dispose()` | Release the mounted UI and event subscriptions. |

## Presets and extensions {#extensions}

`presets.minimal()`, `presets.standard()`, and `presets.full()` return `FeatureFlags` objects for the top-level `features` option; the `minimal`, `standard`, and `full` UI profiles use the same sets. [Options](/cell/options#ui-profile-and-feature-switches) lists what each one turns on and how `ui.features` and `features` combine. [Extensions](/cell/extensions) covers the factories, custom extensions, and replacing a built-in.

## Host functions {#host-functions}

The `functions` and `seed` mount options and the `instance.formula` registry are covered in [Custom cells and host functions](/cell/custom-cells#host-functions).

## Events

`instance.on(name, handler)` returns an unsubscribe function. The event payloads are typed in TypeScript.

| Event | Payload | Use it for |
| --- | --- | --- |
| `changeBatch` | `ChangeBatchResult`: `status`, `applied`, `rejected`, `revision` | React to an applied cell batch. Rejected user edits reach `instance.commands.subscribe()` instead. |
| `cellChange` | `{ addr, value, formula }` | Mirror a changed value or formula. |
| `selectionChange` | `{ active, anchor, range }` | Update an inspector or host command state. |
| `workbookChange` | `{ workbook }` | React to a workbook replacement. |
| `localeChange` | `{ locale, strings }` | Persist a locale selection. |
| `themeChange` | `{ theme }` | Persist or coordinate a theme selection. |
| `recalc` | `{ dirty }`: `sheet:row:col` keys of the cells edited since the previous pass | Refresh host content that depends on calculated cells. Recomputed dependents are not listed. |

```ts
const unsubscribe = instance.on('selectionChange', ({ active, range }) => {
  inspector.show({ active, range })
})

unsubscribe()
```

The `selectionChange` event contains `active`, `anchor`, and the primary `range`. It does not include disjoint ranges. Framework `useSelection()` / `useSpreadsheet()` subscriptions and `instance.store.getState().selection.extraRanges` expose the additional ranges to host panels.

For save flows and trusted updates, see [Host integration](/cell/host-integration).

## Command helpers

The root package exports focused helpers for applications that provide their own buttons or dialogs. Common groups include formatting, clipboard and CSV/TSV, find and replace, comments, hyperlinks, validation, filters, tables (including Table Design: `renameActiveTable()`, `toggleTableOption()`, `setTableColumnFunction()`), sheet views, page setup, charts (including Chart Design and chart copy, paste, and duplicate), shapes and pictures (including shape fill and outline), slicers, phonetic settings, Go To Special, and protection (including allowed edit ranges and password checks). Each helper works with the instance store or workbook state described by its type signature.

Use an instance method when the action opens one of the built-in dialogs, for example `openFormatDialog()` or `openPageSetup()`. Use a command helper when the host owns the surrounding control and wants to supply its own UI. On Mac, `openFunctionArguments(seedName?, { category })` opens the nonmodal picker; `category` is ignored when a seed function name is supplied.

```ts
instance.openFunctionArguments()
instance.openFunctionArguments(undefined, { category: 'math' })
instance.openFunctionArguments('SUM', { category: 'text' }) // category is ignored
```

Ribbon commands run through `ToolbarInstance.applyCommand(id)`, and `buildRibbonModel()` lists their IDs; see [Ribbon toolbar](/cell/toolbar#tabs-and-display).

Formatting commands include the selected range and every `selection.extraRanges`. Named styles apply their `includedGroups` across all selected areas. The Format Cells dialog exposes the underline style selector. Policy authorization checks every area before applying the formatting action; a denial aborts the whole action. Cell protection can separately limit which cells receive formatting.

Ribbon AutoFit commands use every selected area, including disjoint `selection.extraRanges`. Each area keeps its own cross-axis span. When a row or column appears in more than one area, the largest measured size wins, and the complete command is one undo step.

`formatA1Cell()` formats a zero-based row and column for host labels:

```ts
import { formatA1Cell } from '@libraz/formulon-cell'

const label = formatA1Cell(3, 1) // B4
```

`autofitColWidth()` and `autofitRowHeight()` measure one column or row in its rendered font and return pixel measurements without resizing the sheet. Column measurement also reserves width for filter and table-header controls. The instance measurement helpers use the positional arguments below; scan bounds are zero-based and inclusive.

```ts
import { autofitColWidth, autofitRowHeight } from '@libraz/formulon-cell'

const width = autofitColWidth(instance, 1, 0, 8, instance.i18n.locale)
const height = autofitRowHeight(instance, 3, 0, 3, instance.i18n.locale)
```

`autofitColsWidth()` and `autofitRowsHeight()` resize a range of columns or rows. They accept the public `AutofitOptions` type: `span` limits the inclusive rows scanned for columns, or columns scanned for rows; `locale` selects number-format display; `theme` supplies the default cell font. Pass the workbook to mirror sizes to the engine, and the instance history to make the change undoable. These low-level layout mutations require host authorization; see [Embedding](/cell/embedding#host-owned-updates-and-user-commands).

```ts
import { autofitColsWidth, type AutofitOptions } from '@libraz/formulon-cell'

const options: AutofitOptions = {
  span: { from: 0, to: 8 },
  locale: instance.i18n.locale,
}
autofitColsWidth(instance.store, instance.history, 1, 3, instance.workbook, options)
```

## Units for cell and sheet layout

`CellFormat.fontSize`, `WorkbookHandle.setRowHeight()`, `WorkbookHandle.setColumnWidth()`, and AutoFit results use CSS pixels. Native `FontRecord.size` values and ribbon font-size controls use typographic points. The conversion is `px = pt * 96 / 72`. Formulon stores row heights in points and column widths in characters; the cell layer converts those values at the engine boundary, using the workbook's `geometryPlatform` column-width model (`default` or `mac`). Pixels here are canonical sheet pixels. On screen they are multiplied by the sheet zoom (10% to 400%) and the platform's screen scale; see [Platform and Mac UI](/cell/platform#sheet-geometry). The ribbon's Row Height and Column Width commands take points and characters.

## CSV import and export

The package root exports `exportCSV()` and `importCSV()` with the `ExportOptions` and `ImportCSVOptions` types:

```ts
import {
  exportCSV,
  importCSV,
  type ExportOptions,
  type ImportCSVOptions,
} from '@libraz/formulon-cell'

const exportOptions: ExportOptions = { locale: 'de-DE', delimiter: ';' }
const csv = exportCSV(instance.store.getState(), exportOptions)
const importOptions: ImportCSVOptions = { locale: 'de-DE', delimiter: ';' }
importCSV(instance.store.getState(), instance.workbook, csv, undefined, instance.history, importOptions)
```

`delimiter` accepts `,` or `;` and defaults to `,`. When `locale` is omitted, import uses the workbook's active profile. Export keeps canonical text when `locale` is omitted; pass a locale to format editable numbers and booleans for a regional CSV file.

## Store access

`instance.store` is available for integrations that need a reactive view of selection, layout, or cell state. It is a per-instance store; there is no global spreadsheet store. Framework users normally prefer `useSelection()` or `useSpreadsheet()` from the adapter package so subscription cleanup follows component lifetime.

## i18n controller

```ts
if (!instance.setLocale('ja')) {
  showLanguageError()
}
instance.i18n.extend('ja', {
  contextMenu: { copy: 'コピー' },
})
```

`instance.locale` is the committed locale. `instance.setLocale()` is the host-facing runtime path: it synchronizes the workbook profile and returns whether the change was accepted. `i18n` exposes the lower-level dictionary operations `setLocale()`, `extend()`, `register()`, `subscribe()`, and the resolved `strings`; use it from dictionary or extension code when you do not need the profile result. See [Language switching](/cell/language-switching) for the selector, formula text, edit commit, and rollback behavior, and [Internationalization](/cell/i18n) for dictionary registration and subscriptions.

## Theme controller

```ts
instance.setTheme('paper')
instance.setTheme('ink')
instance.setTheme('contrast')
instance.setTheme('brand') // requires a full custom palette
```

Built-in themes are `paper`, `ink`, and `contrast`. A custom name selects host CSS rules scoped to `data-fc-theme`; it requires a complete custom palette and does not inherit a built-in theme. See [Theming](/cell/theming) for token overrides.

## Charts {#charts}

Formulon-cell reads chart series from workbook cells and renders supported chart families. The workbook stores chart settings and data references; formulon-cell provides the browser UI. For a hands-on example, open the [full spreadsheet demo](/cell/demo), select `A1:C9`, then choose a chart from the Insert ribbon. The [Charts guide](/cell/charts) covers the data layout, chart settings, and implementation limits.

## Read next

- [Hooks and composables](/cell/hooks) — selection, edit notifications, and shared language controls.
- [Language switching](/cell/language-switching) — the selector, runtime host API, workbook profiles, formulas, and rejection cases.
- [Embedding](/cell/embedding) — choose options for a full, minimal, or embedded surface.
- [Platform and Mac UI](/cell/platform) — platform resolution, Mac dialogs, and argument help.
- [Ribbon toolbar](/cell/toolbar) — the inline and separate ribbon, tab sets, and command dispatch.
- [Custom cells and host functions](/cell/custom-cells) — display formatters and the host function registry.
- [React and Vue adapters](/cell/frameworks) — component props, events, hooks, and composables.
- [Host integration](/cell/host-integration) — files, save state, printing, and native hooks.
- [Extensions](/cell/extensions) — add, replace, and remove optional UI.
- [Theming](/cell/theming) — built-in themes and CSS token overrides.
- [Internationalization](/cell/i18n) — locale dictionaries and label overrides.
- [Modals and dialogs](/cell/modals) — overlay placement and dialog entry points.
