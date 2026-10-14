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
| Generate chart data and drawing elements without a spreadsheet | `@libraz/formulon-cell/charts` → `chartDataFromTable`, `layoutChart`; see [Charts](#charts) |
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

Use `createDefault()` for a new workbook and `loadBytes()` for `.xlsx` bytes obtained from a file or an API. Pass the handle to `Spreadsheet.mount()` when the host must prepare or load data first. `save()` returns `.xlsx` bytes for the host to download or upload. Wrap a multi-cell write in `workbook.withBatchedRecalc(() => { … })` to recalculate once at the end instead of after every cell. [Install](/cell/install#host-sizing) explains which handles the instance disposes.

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

The root package exports focused helpers for applications that provide their own buttons or dialogs. Common groups include formatting, clipboard and CSV/TSV, find and replace, comments, hyperlinks, validation, filters, tables, sheet views, page setup, charts, slicers, and protection. Each helper works with the instance store or workbook state described by its type signature.

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

`CellFormat.fontSize`, `WorkbookHandle.setRowHeight()`, `WorkbookHandle.setColumnWidth()`, and AutoFit results use CSS pixels. Native `FontRecord.size` values and ribbon font-size controls use typographic points. The conversion is `px = pt * 96 / 72`. Formulon stores row heights in points and column widths in characters; the cell layer converts those values at the engine boundary.

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

## Charts

Select cells and choose a chart from the Insert ribbon. Column, bar, line, area, pie, doughnut, and scatter charts update when their source cells change. Elements includes a Chart type selector; use it to change an existing chart or select Doughnut. Recommended charts creates a chart using the selection's shape. Charts can be moved, resized, and removed; authoring commands support undo and redo.

Charts belong to the current spreadsheet session. They are not written into XLSX files. Existing workbook chart parts can pass through the engine, but the engine does not expose chart authoring.

### Changing chart type and doughnut charts

Changing the type or series direction reinterprets the source data for the draft's series, point, and filter controls. Apply commits the type and settings together as one undoable operation; Cancel leaves the chart unchanged. Settings that do not apply to the chosen type remain stored, including axes, grouping, filters, point styles, and doughnut hole size. Implicit palette and legend defaults follow the chosen type without becoming explicit overrides.

Doughnut charts draw one concentric ring per visible series, with the first series on the inside. Each ring uses its own total for slice proportions and percentage labels. Series filters remove rings; category filters remove slices from every ring. `holeSize` accepts 10–90 percent, with a module default of 50. `firstSliceAngle` rotates all rings together. The center remains transparent, including single-slice rings. Doughnut labels use automatic placement at each slice's radial midpoint. Pie and doughnut charts have no axes. Automatic label placement reduces overlap, but small inner rings and large fonts can still overlap; increase the chart size or reduce the label font size.

```ts
createSessionChart(store, range, {
  kind: 'doughnut',
  seriesDirection: 'columns',
  holeSize: 65,
  firstSliceAngle: 90,
  dataLabels: { visible: true, showPercentage: true },
}, history);
```

The hole-size range follows Excel's [DoughnutHoleSize](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.doughnutholesize) definition.

### Data and series

The `sessionChartData` adapter preserves categories and multiple series. Text headers supply series names or category labels. Use `headerRow` and `headerColumn` to explicitly include or exclude headers; this supports numeric year headers without treating ordinary numeric data as names. Numeric values remain numeric; empty cells, errors, booleans, text in value positions, and non-finite numbers become missing values. The adapter accepts at most 10,000 source cells and reads the active sheet's cell cache.

Use `seriesDirection: 'columns'` for a table with categories down the first column and series across the remaining columns. Use `'rows'` for the transposed layout. The default `'auto'` chooses columns for taller tables and rows for wider tables, with columns on a tie. Single rows and columns produce one series by default. Explicit direction avoids ambiguity when a table's shape does not match its intended layout.

For example, with direction set to columns, this table produces the categories January and February, and the series Sales and Costs:

| Month | Sales | Costs |
| --- | --- | --- |
| January | 10 | 6 |
| February | 15 | 8 |

Scatter charts use the first column containing numeric data as X values and each subsequent numeric column as a Y series. An explicit `seriesDirection: 'rows'` reads the transposed arrangement; the default reads columns. `headerRow` controls series headers in column orientation, and `headerColumn` controls them in row orientation. X values of 1, 10, and 100 have proportional spacing. A text category axis is not substituted for X. Pie charts use the first series and size slices by absolute magnitudes.

The older `sessionChartSeries` helper retains its original column-summing behavior for compatibility. Use `sessionChartData` for new integrations.

### Chart options

Pass chart options to `createSessionChart` or `updateSessionChart`. `kind` selects the family. `grouping` selects `'clustered'`, `'stacked'`, or `'percent-stacked'` for column, bar, line, and area charts. Pie, doughnut, and scatter ignore grouping. Positive and negative values stack independently; percent stacks normalize each sign separately.

`scatterStyle` selects `'marker'` (the default), `'line'`, or `'lineMarker'`. Elements exposes these as Markers, Straight lines, and Straight lines with markers. Connecting lines follow source order after filtering; X values are not sorted. Each segment is clipped to the plot, including a crossing segment whose endpoints are both outside the axis bounds. Series line settings control color, width, transparency, and dash; width 0 hides the connector. Explicit series and point marker visibility overrides the subtype default. Point line settings still style marker borders. The three modes follow Microsoft's [scatter style definitions](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/eb0dca58-7fcf-45be-88cd-b3b50aa91020); smooth-line variants are not yet supported.

Ordinary stacked totals outside JavaScript's finite numeric range are clipped at `±Number.MAX_VALUE`. Percent stacks normalize before summing to preserve ratios for large finite inputs.

`emptyCells` selects `'gap'`, `'zero'`, or `'span'`. Standard line charts support all three modes: gaps break lines, zero plots missing cells at zero, and span connects available points. Stacked and percent-stacked line and area charts always use zero, as specified by Office's blank-cell rules. Standard area, bar, column, pie, and doughnut charts fall back to gap when span is requested. Scatter charts map missing coordinates to zero in zero mode. With connecting lines, gap breaks at an incomplete point and span connects the surrounding valid points. Marker-only scatter charts treat span as gap. Non-finite coordinates are always omitted and break connecting lines.

`gapWidth` sets the gap between bar or column clusters as a percentage of one bar's width, from 0 to 500 (default 150). `overlap` sets the overlap between clustered series, from -100 (one bar-width gap) through 0 (touching bars) to 100 (coincident bars). Stacked series share one slot. `firstSliceAngle` rotates the starting boundary of pie and doughnut charts clockwise from 12 o'clock, from 0 to 360 degrees. Finite values outside these ranges are clamped; non-finite options use the defaults.

Pie slice sizes use the absolute magnitudes of finite values from the first series; zero and missing values have no slice. Magnitudes are normalized before summing so large finite values retain their proportions.

`palette` supplies series colors. `color` remains available on session charts as the legacy color override. `legend` controls visibility and position. `xAxis` and `yAxis` accept titles and numeric bounds; categorical axes use category labels. The renderer supplies tick marks and gridlines.

### Axes and chart options

Elements lets you change grouping, series direction, and empty-cell handling. Styles also exposes bar gap width, clustered-series overlap, the starting angle for pie and doughnut charts, and doughnut hole size. Controls are enabled for the chart families that use them.

Each axis has visibility, title, and Reverse order settings. Numeric axes also accept minimum and maximum bounds, a positive `majorUnit`, a `numberFormat`, and `majorGridlines`. The numeric axis is X for bar charts, Y for column, line, and area charts, and both X and Y for scatter charts. Pie and doughnut charts have no axes. Clear a bound or major unit in the form to restore automatic scaling. Category axes retain their category labels and ignore numeric scale settings.

`visible: false` hides an axis line, labels, and title. Gridline visibility is independent. Explicit major units start at the effective minimum: a domain of 3–13 with a unit of 5 produces 3, 8, and 13. Very small intervals are thinned to bound the number of rendered ticks. Crowded numeric labels are thinned independently of gridlines. Without an explicit number format, existing automatic tick formatting is retained, including percentages for 100% stacks. With a format code, axis labels use the same locale and formatter callback as data labels. See Excel's [major unit](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.majorunit) and [tick-label number format](https://learn.microsoft.com/en-us/office/vba/api/excel.ticklabels.numberformat) definitions.

`reverseOrder: true` reverses one physical axis: `xAxis` is horizontal and `yAxis` is vertical, including on bar charts. Category reversal changes the category bands while retaining the series order within each cluster. Values, source IDs, filters, and point styles retain their original associations. Numeric bounds and tick values remain ascending in the model. Pie and doughnut charts retain the setting without using it. The module keeps its existing bar default, with the first category at the top; reversing Y places it at the bottom. By default, tick labels and titles keep their bottom/left gutters, and category reversal does not move the perpendicular axis automatically. The option corresponds to Excel's [ReversePlotOrder](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.reverseplotorder) setting.

`crossing` specifies where the perpendicular axis crosses this axis. Set `xAxis.crossing` to move the vertical axis, or `yAxis.crossing` to move the horizontal axis. The form offers Auto, Minimum, Maximum, and Custom. Numeric axes accept `'min'`, `'max'`, or a finite value clamped to the resolved domain; axis reversal also reverses these positions. Undefined and `'auto'` keep the existing automatic position. Invalid runtime values use automatic positioning.

Category axes use the module's between-category layout: `'min'` is before the first visible category, `'max'` is after the last, and a custom number selects the leading edge of a visible category. Custom numbers are rounded and clamped to the visible 1-based category count. Explicit positions follow category reversal; automatic positions retain the left edge for column, line, and area charts and the bottom edge for bar charts. Crossing moves axis lines; labels using `labelPosition: 'nextTo'` follow those lines. Other label positions, titles, gridlines, plot margins, and the zero baselines used by data marks stay in place. Pie and doughnut charts retain crossing settings without using them. The property combines Excel's [Crosses](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.crosses) and [CrossesAt](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.crossesat) concepts.

`labelPosition` controls numeric tick labels and category labels on each physical axis. `'low'` places X labels below the plot and Y labels to its left; `'high'` places them above and to the right. These sides stay fixed when values or categories are reversed. `'nextTo'` follows that axis's actual line, including a crossing set on the perpendicular axis. In this module, adjacent labels sit below a horizontal line or left of a vertical line. `'none'` hides labels while retaining the axis line, title, and gridlines. Omitted or invalid values keep the existing low placement; the form's Automatic option removes the override. Pie and doughnut charts retain the setting without using it.

High labels reserve space beside a top title or legend and before a right legend. Axis titles retain their bottom/left positions. Other label modes retain the existing plot gutters, including None. Long numeric labels and high-side category labels may be shortened, with their full text in `aria-label`. Adjacent labels can overlap data inside the plot. The choices correspond to Excel's [tick-label positions](https://learn.microsoft.com/en-us/office/vba/api/excel.xlticklabelposition).

A finite `logBase` from 2 through 1000 enables a logarithmic numeric axis. The form's Logarithmic scale checkbox starts at base 10; Log base changes the base, and clearing the checkbox removes the override. Bar charts use X, column/line/area charts use Y, and scatter charts accept both axes independently. This implementation applies log scales to clustered category charts and scatter charts. Category axes, pie/doughnut, stacked charts, and 100% stacks retain the option without using it.

Log axes plot finite positive values. Zero and negative values do not produce marks or data labels; they break line runs even when empty-cell handling is Span. Positive scatter pairs must be valid on both axes. Connectors are clipped after converting the eligible coordinates and bounds to logarithmic space. Source IDs, filters, point styles, and displayed data values keep their original associations.

Automatic bounds expand positive data to powers of the base; empty positive data uses 1–base. Finite positive explicit bounds override automatic bounds when they form a usable interval; equal or unusable extreme bounds are widened to a finite positive range. Nonpositive bounds are ignored. Major ticks use powers of the base and are thinned for extreme ranges. `majorUnit` remains stored for linear mode and is disabled in the log form. Automatic crossing uses 1 clamped to the domain; nonpositive custom crossings also use that automatic position. Bars and area fills use the positive domain minimum as their baseline. Invalid log bases fall back to linear rendering. See Excel's [LogBase property](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.logbase) and [value-axis scale settings](https://support.microsoft.com/en-us/office/change-the-scale-of-the-vertical-value-axis-in-a-chart).

### Filters, labels, and colors

The chart header opens Elements, Styles, or Filters. Changes stay in a draft until Apply; Cancel or Escape discards them. Apply records one undoable operation. The form keeps its draft during chart redraws and language changes, and becomes read-only when the sheet or host policy prevents chart editing.

Filters show or hide series and categories without editing the source cells. `filter.hiddenSeriesIds` contains series IDs; `filter.hiddenCategoryIds` contains category or XY point IDs. The table adapter uses `series-0`, `series-1`, and so on. Category identities default to `category-0`, `category-1`, and XY point identities to `point-0`, `point-1`. Direct chart data can supply `categoryIds` or point `id` values. Hidden data is excluded from axes, legends, stacks, and percentage totals. Remaining points retain their original IDs, indexes, and palette colors.

`dataLabels` controls visibility, series/category names, values, percentages, legend keys, separators, position, number format, text color, and font size. Percentage labels are available for pie, doughnut, and percent-stacked charts. Scatter category labels display the X value; value labels display Y. Supported positions and defaults depend on the chart family and grouping, following [Office's data-label position rules](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/e2b1697c-7adc-463d-9081-3daef72f656f). Area and doughnut labels use their automatic center position. Labels preserve their complete text in `aria-label` when displayed text is shortened.

Styles supplies palette presets and custom colors. `varyColors` assigns palette colors to individual points; pie and doughnut charts enable it by default. `seriesStyles` targets a `seriesId`, with optional `points` overrides keyed by `pointId`. Fill and line settings include color and transparency (0–100%). Lines also accept width and dash style; markers accept visibility, shape, size, fill, and line settings. Point overrides take precedence over inherited series settings. Series legend swatches use series styles; pie and doughnut legend swatches use point styles from the first visible series.

```ts
createSessionChart(store, range, {
  kind: 'column',
  filter: { hiddenSeriesIds: ['series-1'] },
  yAxis: { min: 0, max: 100, majorUnit: 20, numberFormat: '0.0', majorGridlines: true },
  dataLabels: { visible: true, showValue: true, numberFormat: '#,##0.00' },
  seriesStyles: [{
    seriesId: 'series-0',
    fill: { color: '#4472c4' },
    points: [{ pointId: 'category-2', fill: { color: '#ed7d31' } }],
  }],
}, history);
```

These settings remain part of session charts; they are not written to XLSX. Both framework adapters use the same commands and settings UI.

### Using the chart module separately

Import `chartDataFromTable`, `layoutChart`, and their types from `@libraz/formulon-cell/charts`. This entry point has no spreadsheet store, calculation engine, React, Vue, or browser dependency.

`chartDataFromTable` converts a rectangular table of numbers, strings, booleans, and nulls into chart data. `layoutChart` takes that data, a `ChartSpec`, and a width and height. It returns a scene of SVG-compatible elements with attributes, text, and series/point identifiers. Consumers can also supply category or XY data directly to the layout function.

`layoutChart` also accepts `locale` and a `formatValue(value, formatCode, locale)` callback. The standalone formatter supports General and common decimal, grouped, and percent codes; null or undefined callback results fall back to it. The session UI uses the spreadsheet number formatter for custom Excel format codes. Keeping the formatter outside `ChartSpec` makes settings JSON-compatible and keeps the chart module independent of the engine.

The spreadsheet layer owns source ranges, protection, history, and object placement. The DOM layer maps the scene elements to SVG and owns interactions. These boundaries allow the chart module to move into a separate package without moving spreadsheet code.

### Excel compatibility

The implemented scope is the seven 2D families listed above, category and series interpretation, numeric scatter axes, grouping, missing-value modes, series and category filters, data labels, and series and point styles. It does not include XLSX chart creation, 3D charts, secondary axes, date axes, trendlines, or the additional Excel families such as stock, surface, radar, and statistical charts. Pixel-identical Excel rendering is not guaranteed.

Data arrangement follows [Microsoft's chart creation guide](https://support.microsoft.com/en-us/excel/get-started/create-a-chart-from-start-to-finish?ad=us&rs=en-us&ui=en-us). Blank-cell rules follow [Display Blanks As](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/b5c5c694-21d9-437c-9a4a-21e0e843eed8). Geometry options follow Excel's definitions of [GapWidth](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.gapwidth), [Overlap](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.overlap), and [FirstSliceAngle](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.firstsliceangle).

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
