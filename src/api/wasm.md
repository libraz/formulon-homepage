<script setup>
import reference from '@/data/api-reference.json'
</script>

# WASM API

The authoritative TypeScript declarations are shipped as `dist/formulon.d.ts`. This page summarizes the public shape.

::: tip Use the declaration file
When this page and your installed package differ, the `dist/formulon.d.ts` file in your exact package version is authoritative.
:::

::: info Glossary: status envelope
The `Status` object returned (directly or as a field) by every fallible WASM call. It carries `ok`, a numeric `status`, a human `message`, and a `context` field for diagnostics. Cell-level Excel errors are *not* failed statuses — they are `Value` objects with `kind = Error`.
:::

## Module

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
```

`@libraz/formulon` is the single-threaded entry point. It uses ordinary memory and loads in a browser without cross-origin isolation. Import `@libraz/formulon/threads` when `recalcParallel` must use workers; that entry uses the companion `@libraz/formulon/formulon_threads.wasm` binary and requires cross-origin isolation in browsers. Both entries expose this API and the same declaration file.

`createFormulon(opts?)` accepts the Emscripten overrides `locateFile(path, prefix)`, `print(msg)`, `printErr(msg)`, `noInitialRun`, and `noExitRuntime`. Use `locateFile` when a bundler serves the `.wasm` file from a different URL.

The resolved `Module` carries the library functions and the static `Workbook` factories; every one of them is listed under [Functions and methods](#main-workbook-methods). `Module.evalFormula(formula)` evaluates read-only at `Sheet1!A1` of a fresh workbook and reduces an array result to its top-left element. `Workbook.createForProfile(profileId)` with an unknown id returns a workbook whose `isValid()` is `false`, and `Workbook.loadBytes(bytes)` detects the `.xlsx` or `.xlsb` container from the bytes. `setLogMinLevel(level)` and `setLogSink(sink)` change process-wide state: the default `LogLevel.Off` writes nothing, `sink(record: Uint8Array)` receives one JSON record that is valid only during the call, and `null` restores the stderr fallback.

The package also exports `mergeFunctionMetadata(base, entry, locale)` as a named export. It is a pure JavaScript helper that touches no WASM state; see [Profiles and formula text](#profiles-and-formula-text).

## Result envelopes

Fallible calls return `Status` or an object containing `status`.

```ts
interface Status {
  ok: boolean
  status: number
  message: string
  context: string
}
```

Excel cell errors are returned as `ValueKind.Error`. They are not failed `Status` values.

Numeric accessors such as `sheetCount()`, every `*Count()` method, and `calcMode()` return `NumberResult` objects with `{ status, value }`. String accessors such as `sheetName()`, `excelProfileId()`, `localizeFunctionName()`, `canonicalizeFunctionName()`, `localizeFormula()`, and `canonicalizeFormula()` return `StringResult` objects with the same shape. Check `status.ok` before using `value`; a zero count or empty string can also be the failure default.

List getters return `ListResult<T>`, which is the result array itself with a `.status` property. Read items as `result[0]`; there is no `items` or `value` envelope. `spillInfo()` returns a `SpillInfo` object whose `status` must be checked before its region fields are used.

Every positional argument is checked before any engine call, identically on `@libraz/formulon` and `@libraz/formulon-native`. A missing required argument, a value of the wrong type, and a primitive or `null` where an object is declared throw `TypeError`; a non-finite, fractional, or out-of-range integer throws `RangeError`. Neither package substitutes `0`, `""`, `false`, or an empty object for a missing argument, so `setNumber(0, 0, 0)`, `setIterative(true)`, and `addFont(null)` throw. A malformed argument that a method reports through its status, such as an array of the wrong length or a callback that is not a function, returns `kInvalidArgument` (2) on both packages. A validly shaped call that the engine rejects returns `Status.ok === false`; argument checks leave the workbook unchanged. A string field that holds a lone UTF-16 surrogate is stored with U+FFFD in its place, so the engine never receives ill-formed UTF-8.

## Value kinds

```ts
enum ValueKind {
  Blank,
  Number,
  Bool,
  Text,
  Error,
  Array,
  Ref,
  Lambda
}
```

`getValue()` returns a `CellResult` (`{ status, value }`), while `evalFormula()`, `evaluateFormulaText()`, and `evaluateConditionalFormula()` return `EvalResult` envelopes with the same `status` / `value` shape. In each case, the `value` field is a `Value` whose `kind` discriminates the payload. Number values use `value.number`, Booleans use `value.boolean` (`0` or `1`), text uses `value.text`, and errors use `value.errorCode` — a `formulon::ErrorCode` ordinal; there is no `errorText` field (see [Error model](/compatibility/errors) for what each code means). `Array`, `Ref`, and `Lambda` values carry no payload on `Value`. To read a lambda's formula text, call `getLambdaText(sheet, row, col)` on the workbook; use `evaluateFormulaArray()` for array contents.

The declarations also export these enum groups:

| Area | Enums |
| --- | --- |
| Values | `ValueKind`, `ErrorCode` (`Null = 0`, `Div0 = 1`, … `Python = 15`, `Unknown = 16`; the ordinal in `Value.errorCode` and the argument of `setError`) |
| Geometry and display | `GeometryMode` (`Display = 0`, `Print = 1`), `DisplayStatus` (`Ok = 0`, `Overflow = 1`, `InvalidFormat = 2`) |
| AutoFilter | `FilterKind`, `FilterOperator`, `DynamicFilterType`, `SortBy`, `SortMethod`, `DateTimeGrouping` |
| Validation | `ValidationErrorStyle` (`Stop = 0`, `Warning = 1`, `Information = 2`) |
| Conditional formats | `CfMatchKind` (`DifferentialFormat = 0`, `ColorScale = 1`, `DataBar = 2`, `IconSet = 3`) |
| Themes and styles | `ColorContext`, `ColorResolution`, `ThemeSource`, `EffectiveStyleSource` |
| Images and drawings | `ImageFormat`, `DrawingObjectKind`, `AnchorKind`, `AnchorEditAs` |
| PivotTables | `PivotAxis`, `PivotAggregation`, `PivotShowValuesAs`, `PivotFilterType`, `PivotFilterValueKind`, `PivotDateGrouping`, `PivotCalendar`, `PivotReportLayout`, `PivotCellKind`, plus the constants `PIVOT_SHOW_AS_BASE_PREVIOUS` / `PIVOT_SHOW_AS_BASE_NEXT` |
| Text collation | `CollationStrength` (`Compare = 0`, `Dynamic = 1`, `ClassicExact = 2`) |
| Workbook state | `CalcMode` (round-trip metadata only; the engine recalculates dirty cells in every mode), `SheetVisibility`, `WorkbookFormat`, `ExternalLinkKind` |
| Logging | `LogLevel` (`Debug = 0`, `Info = 1`, `Warn = 2`, `Error = 3`, `Off = 4`) |

The filter enums follow the corresponding OOXML ordinals, and `ImageFormat` identifies `Png`, `Jpeg`, `Gif`, and `Bmp` in addition to `Unknown`. See the declaration file for the complete enum members.

## Workbook lifecycle

```ts
const wb = Module.Workbook.loadBytes(bytes)
try {
  if (!wb.isValid()) throw new Error(Module.lastErrorMessage())
  const recalculated = wb.recalc()
  if (!recalculated.ok) throw new Error(recalculated.message)
  const saved = wb.save()
  if (!saved.status.ok || saved.bytes === null) throw new Error(saved.status.message)
} finally {
  wb.delete()
}
```

Always call `delete()`. It throws `TypeError` when it is called while a method of the same workbook is running, for example from a spec getter or a callback, and the handle stays valid. The native package's `dispose()` follows the same rule.

## Container format

`save()` always writes OOXML `.xlsx`. `saveAs(format)` writes an explicit container:

```ts
enum WorkbookFormat {
  Unknown = 0,
  Xlsx = 1,
  Xlsb = 2
}

const result = wb.saveAs(WorkbookFormat.Xlsb) // SaveResult { status, bytes }
```

`loadBytes(bytes)` accepts either container without a separate flag: the loader detects `.xlsb` vs. `.xlsx` from the package bytes themselves, not from a file name, so the same call handles both. See [File format support](/compatibility/file-format-support) for what round-trips through each container.

`saveWithDiagnostics(format)` returns the saved bytes together with counters for losses and deferred features observed by the writer. `readDiagnostics()` returns the counters captured when the workbook was loaded. The counters have partial coverage: an all-zero result means that none of the documented losses occurred, not that the package was compared byte-for-byte or that no diagnostic event was logged.

| Result | Fields | Meaning |
| --- | --- | --- |
| `saveWithDiagnostics` | `downgradedFormulaCount` | Formula cells emitted as cached literals; always zero for XLSX. |
|  | `deferredFeatureCount` | Sheet features not lowered to records; always zero for XLSX. |
|  | `droppedPartCount` | Passthrough parts dropped by either writer. |
|  | `droppedRelationshipCount` | Relationships dropped because their target part was dropped; this can describe the same loss as `droppedPartCount`. |
|  | `renumberedPartCount` | Tables emitted under a writer-assigned part id; always zero for XLSB. |
| `readDiagnostics` | `undecodedFormulaCount` | Stored formulas that could not be decoded; XLSB only. |
|  | `undecodedDefinedNameCount` | Defined names skipped because they could not be decoded; XLSB only. |
|  | `undecodedPartCount` | XLSB package parts whose content type could not be resolved. |
|  | `skippedFeatureCount` | OOXML presentation-overlay entries skipped because their references were unusable. |
|  | `unknownContentTypeCount` | OOXML workbook parts with an unrecognised content type. |

## Pinned clock

`NOW()`, `TODAY()`, and pivot relative-period filters read the host clock when the workbook is unpinned. Pin the workbook to one local civil-time reading when those results must agree within a recalculation or be reproducible across hosts:

```ts
const check = (status: Status) => {
  if (!status.ok) throw new Error(`${status.message}: ${status.context}`)
}

check(wb.setPinnedNow(2026, 8, 19, 12, 0, 0))
const pin = wb.pinnedNow()
if (!pin.status.ok) throw new Error(pin.status.message)
const now = pin.now // CivilTime | null
check(wb.recalc())
check(wb.clearPinnedNow())
```

`pinnedNow()` returns `{ status, now }`. `now` is a `CivilTime` object when the workbook is pinned, or `null` when it follows the host clock or the call fails. `setPinnedNow()` validates `year` 1900–9999, the real day range for `month` 1–12, `hour` 0–23, and `minute` / `second` 0–59; invalid fields return a failed `Status` rather than being normalised. The values are local civil fields, not a timestamp, so they have no timezone interpretation. Setting or clearing the pin does not recalculate cached formula values; call `recalc()` explicitly. The pin is workbook model state, not file state: saving does not record it, and a reloaded workbook is unpinned.

## Profiles and formula text

New workbooks use the `win-365-en_US` profile. A profile is workbook state: it controls locale-sensitive evaluation, number and date rendering, text comparison, and localized Excel names. Formula input remains the English canonical spelling; use the text helpers to convert a displayed formula before storing it. The profile id is not written into the file, so apply it again after loading. The catalog contains 28 ids, `{mac,win}-365-{ja_JP,en_US,de_DE,fr_FR,zh_CN,ko_KR,th_TH,es_ES,es_MX,pt_BR,ru_RU,zh_TW,it_IT,nl_NL}`. Locale facts for every `mac-*` profile and `win-365-ja_JP` are measured against Excel; the other 13 Windows profiles use estimated locale data.

`createDefault()` keeps the ordinary one-sheet defaults, including Calibri 11. `createForProfile(profileId)` also records the selected profile and applies its new-workbook defaults: body and optional phonetic fonts, the `Normal` style and first-sheet names, cell-xf alignment, phonetic settings, page margins, and the Mac row-height and base-column-width values. It writes no theme part, so a fresh workbook reads as using the default Office theme. The `win-*` row and column metrics use the engine defaults.

```ts
import createFormulon from '@libraz/formulon'

const LocaleModule = await createFormulon()
const profile = 'mac-365-de_DE'
const localeWorkbook = LocaleModule.Workbook.createForProfile(profile)
try {
  // Formula storage remains invariant; these helpers format text for a UI.
  const shown = localeWorkbook.localizeFormula('=SUM(1.5,TRUE)', profile)
  if (!shown.status.ok) throw new Error(shown.status.message)
  const stored = localeWorkbook.canonicalizeFormula(shown.value, profile)
  if (!stored.status.ok) throw new Error(stored.status.message)
  const facts = localeWorkbook.localeFacts(profile)
  if (!facts.status.ok || facts.facts === null) throw new Error(facts.status.message)
} finally {
  localeWorkbook.delete()
}
```

`localizeFormula()` rewrites function names, list and array separators, decimal points, Boolean names, and error names. It preserves strings, quoted sheet names, external qualifiers, and structured-reference brackets. `canonicalizeFormula()` performs the inverse rewrite. Both are pure text transforms and do not validate or install the formula. Use `setExcelProfileId()` for evaluation behavior and pass stored, en-invariant text to `setFormula()`.

`localeFacts()` returns separators, Boolean names, date order, currency, and localized error names for the selected profile. Its `facts.collationMeasured` is true for `mac-*` profiles and false for every Windows profile, including `win-365-ja_JP`.

`compareText(a, b, strength, profileId)` returns `{ status, order }` with `order` equal to `-1`, `0`, or `1`. `collationClasses(values, strength, profileId)` returns `{ status, classIds, classCount }`: one dense id per input `Value`, ascending in SORT order and meaningful only within that call. [Text collation](/compatibility/text-collation) defines each `CollationStrength` fold and the class rules.

`functionMetadata(name)` returns only locale-invariant structure: the canonical name, arity, and availability; the human-readable signature and description fields are empty. `functionNames()` lists the catalog. A host merges its own display catalog with `mergeFunctionMetadata(base, entry, locale)`, whose BCP-47 UI locale is independent of the engine profile id.

## Functions and methods {#main-workbook-methods}

Generated from `src/wasm/formulon.d.ts` at the reference source revision. Names starting with `Module.` are on the object `createFormulon()` resolves to, names starting with `Workbook.` are static factories, `createFormulon` and `mergeFunctionMetadata` are package exports, and every other name is a `Workbook` instance method. A summary is the first sentence of the declaration's doc comment and is blank where the declaration has none.

::: info Reference source
These tables are generated from the core source for documentation target {{ reference.version }}. The <a :href="`https://github.com/libraz/formulon/commit/${reference.source.commit}`">source commit</a> is pinned so WASM, Python, and C declarations describe the same revision. Demos use published packages and display their runtime version separately.
:::

### Library, diagnostics and logging {#library}

<ApiReferenceTable surface="wasm" family="library" />

### Workbook lifecycle and I/O {#lifecycle}

<ApiReferenceTable surface="wasm" family="lifecycle" />

### Sheets and structure {#sheets}

<ApiReferenceTable surface="wasm" family="sheets" />

### Cells {#cells}

<ApiReferenceTable surface="wasm" family="cells" />

### Recalculation {#calculation}

<ApiReferenceTable surface="wasm" family="calculation" />

### Read-only evaluation {#evaluation}

<ApiReferenceTable surface="wasm" family="evaluation" />

### Profiles, locale and text {#profiles}

<ApiReferenceTable surface="wasm" family="profiles" />

### Defined names {#names}

<ApiReferenceTable surface="wasm" family="names" />

### Tables {#tables}

<ApiReferenceTable surface="wasm" family="tables" />

### Dependencies, spills and external links {#dependencies}

<ApiReferenceTable surface="wasm" family="dependencies" />

### Sheet view and protection {#view}

<ApiReferenceTable surface="wasm" family="view" />

### Rows, columns and geometry {#rows-columns}

<ApiReferenceTable surface="wasm" family="rows-columns" />

### Display text {#display}

<ApiReferenceTable surface="wasm" family="display" />

### Styles {#styles}

<ApiReferenceTable surface="wasm" family="styles" />

### Themes and colors {#themes}

<ApiReferenceTable surface="wasm" family="themes" />

### Merges {#merges}

<ApiReferenceTable surface="wasm" family="merges" />

### Comments and hyperlinks {#comments-links}

<ApiReferenceTable surface="wasm" family="comments-links" />

### Threaded comments and persons {#threaded-comments}

<ApiReferenceTable surface="wasm" family="threaded-comments" />

### AutoFilter {#filters}

<ApiReferenceTable surface="wasm" family="filters" />

### Data validation {#validation}

<ApiReferenceTable surface="wasm" family="validation" />

### Conditional formats {#conditional-formats}

<ApiReferenceTable surface="wasm" family="conditional-formats" />

### Images and drawings {#images}

<ApiReferenceTable surface="wasm" family="images" />

### Charts {#charts}

<ApiReferenceTable surface="wasm" family="charts" />

### Print settings and pagination {#print}

<ApiReferenceTable surface="wasm" family="print" />

### PivotTables {#pivots}

<ApiReferenceTable surface="wasm" family="pivots" />

### Pivot caches {#pivot-caches}

<ApiReferenceTable surface="wasm" family="pivot-caches" />

## Method notes

`cellCount()` / `cellAt()` enumerate written coordinates, including styled blanks, `setBlank` writes, and spill phantoms. Unwritten gaps are omitted; indices are dense and ordered by `(row, col)`. Do not mutate the sheet during enumeration. This differs from populated-range enumeration; see [Inspect a range](/workbook/operations#inspect-a-range).

`setCellPhoneticRuns()` accepts an ordered, non-overlapping UTF-16 partition of the annotated cell text. `setCellPhoneticProperties()` changes its font, kana form, and alignment independently of those readings; writing a cell value clears both the runs and their properties.

`recalcParallel(threadCount)` is synchronous and returns `{ status, stats }`. The default `@libraz/formulon` entry evaluates this call serially and reports `stats.workerThreadsStarted === 0`. The `@libraz/formulon/threads` entry starts workers: a count of `0` selects automatic detection capped at 8 workers, `1` stays on the caller thread, and `2..8` sets the worker upper bound. Missing, fractional, non-finite, negative, or above-8 values fail with `kInvalidArgument`.

`setIterative(enabled, maxIterations, maxChange)` stores iterative-calculation settings. `getIterative()` reads them back as `{ status, enabled, maxIterations, maxChange }`; `maxIterations` is capped at `32767`, and the getter reports that capped value.

`setIterativeProgress(callback)` and `setLogSink(sink)` accept a function or `null`; any other value returns `kInvalidArgument` (2) and keeps the installed callback. A `Workbook` method called from the iterative progress callback throws `TypeError` naming `kGraphRecalcReentrant` (4005) and changes nothing.

`setCalcMode(mode)` takes a `CalcMode`; with `AutoNoTable`, `recalc()` skips data-table results until `recalcDataTables()` runs. `fullPrecision()`, `calcOnSave()`, `refMode()`, and `date1904()` read the corresponding `<calcPr>` and `<workbookPr>` settings, and each has a setter. Other `<calcPr>` attributes are kept across a resave.

`activeSheet()` / `setActiveSheet(sheet)` read and write the active tab; setting it moves `tabSelected` and rejects a hidden sheet. Hiding or removing the active sheet activates the next visible sheet to the right, otherwise the nearest visible one on the left. `setSheetTopLeft()` and `setSheetPaneTopLeft()` set the scroll origin of the view and of the lower-right pane, and `getSheetSelection()` / `setSheetSelection()` address the selection of each pane. `setSheetSplit(sheet, xTwips, yTwips)` splits the view at a twips offset on either axis without freezing it; a split replaces a freeze and the other way round, and `0, 0` removes it. A selection in a pane the view lacks is dropped on save, and an active cell outside every selected range moves to the top-left of the first range. `getSheetView()` reports `showFormulas` and `showOutlineSymbols`, which have the setters `setSheetShowFormulas()` and `setSheetShowOutlineSymbols()`.

`setRowCollapsed()` and `setColumnCollapsed()` set the outline `collapsed` flag that the row and column override getters report. `outlineLevelRow` and `outlineLevelCol` are derived from the deepest levels on every save. An outline level above 7 fails with `kInvalidArgument`.

`addDataTable(sheet, spec)`, `getDataTable(sheet, row, col)`, and `removeDataTable(sheet, row, col)` manage What-If data tables (`<f t="dataTable">`). `recalc()` fills one-variable (column or row input) and two-variable tables by substituting each value into the input cells, recalculating the cells that read them, and restoring the inputs. Writing into a result cell fails with `kPreconditionFailed`, as does a row or column insert or delete that cuts through the table or its header row and column. Result cells report `=TABLE(row_input,col_input)` through the formula getters, `FORMULATEXT` returns `{=TABLE(...)}`, and `ISFORMULA` is TRUE. `addDataTable` returns `kDataTableInvalid` (8005) when no input cell is given, an input lies inside the result range, or the range overlaps another table.

`listShapes()`, `insertShape()`, `updateShape()`, and `removeShape()` cover the `xdr:sp` shapes and text boxes, `xdr:cxnSp` connectors, and `xdr:grpSp` groups of a sheet's drawing. An update rewrites only the fields it names and keeps the rest of the shape's XML. A shape the record cannot express is listed with `ShapePaint.Other` or empty fields and passes through a save unchanged. Shapes follow row and column edits like pictures do.

`listSparklineGroups()`, `addSparklineGroup()`, `updateSparklineGroup()`, `setSparklineGroupSparklines()`, and `removeSparklineGroup()` manage the `x14:sparklineGroups` of a sheet. An update keeps attributes and children outside the record, such as `rightToLeft`, `uid`, and unknown extensions.

`listSlicers()`, `addSlicer(sheet, table, column, spec)`, `updateSlicer()`, and `removeSlicer()` manage table slicers. Adding one creates the slicer part, its cache, the extension entries, the defined name, and the drawing frame. Removing a slicer also removes its cache once no other slicer uses it. Removing a table or a sheet, or deleting the rows or columns under a slicer's frame, removes the slicers bound to it. Slicers over a pivot cache pass through untouched and are not listed; the selection of a table slicer lives in the table's AutoFilter.

`getWorkbookProtection()` / `setWorkbookProtection()` read and write `<workbookProtection>`, and `getProtectedRanges()`, `addProtectedRange()`, `updateProtectedRange()`, and `removeProtectedRange()` manage a sheet's `<protectedRange>` entries; the ranges move with row and column edits. Password hashes are stored as the host computes them, and attributes the record does not model are kept. Neither protection is enforced on cell edits.

`tableAt(idx)` returns the table's style name and stripe toggles, its header and totals row counts, and each column's totals function. `setTableColumnTotals(idx, column, totals)` sets one column's totals function and label; while the totals row is shown, its cell is written to match. `getTableStyle()`, `setTableStyle()`, `removeTableStyle()`, `getTableStyleDefaults()`, and `setTableStyleDefaults()` manage custom `<tableStyles>` and the default table and PivotTable style names; `pivotGetStyleInfo()` / `pivotSetStyleInfo()` read and write a PivotTable's style. `setDefinedNameAttrs(name, localSheetId, { comment, hidden })` sets a name's comment and hidden flag; an omitted key leaves that attribute unchanged, and replacing the name's formula keeps both.

`getCommentVisible()` / `setCommentVisible()` read and write whether a legacy note is shown. A note's box, its visibility, and the authors table of its comments part are kept across a resave, and a box follows its note through row and column edits. `getCellShowPhonetic()` / `setCellShowPhonetic()` read and write the per-cell Show Phonetic flag; saved files carry it on constants and blanks only, not on formula cells.

`SheetVisibility` has `Visible = 0`, `Hidden = 1`, and `VeryHidden = 2`. `setSheetVisibility(sheet, visibility)` writes the whole tab state, while `getSheetView(sheet).view.visibility` distinguishes the two hidden states. The legacy `tabHidden` flag remains `1` for both hidden states. `setSheetTabHidden(true)` does not demote a very-hidden sheet; use `setSheetVisibility()` for that transition.

`addSheet()` and `renameSheet()` fail with `kInvalidSheetName` for an empty name, a name over 31 UTF-16 units, one with `: \ / ? * [ ]`, one that begins or ends with an apostrophe, and one that matches another sheet's name under case folding. Under the `win-*` profiles, the default included, `History` in any case is refused as well; `mac-*` profiles accept it. Hiding or removing the only visible sheet fails with `kInvalidArgument`. `insertRows()`, `deleteRows()`, `insertCols()`, and `deleteCols()` fail with `kPreconditionFailed` when they cut through a data table, a legacy array block, or a PivotTable, or would push one of them or a table past the grid edge.

Worksheet print settings are authored with `setSheetPageSetup()`, `setSheetPageMargins()`, `setSheetPrintOptions()`, `setSheetHeaderFooter()`, `setSheetPrintArea()`, `setSheetPrintTitles()`, `addSheetRowBreak()`, and `addSheetColBreak()`; raw XML setters are available for unmodeled fragments and validate input before storing it. Header/footer inputs use decoded Excel section strings, so a literal ampersand is written as `&&`.

`setRangeXfIndex(sheet, firstRow, firstCol, lastRow, lastCol, xfIndex)` applies one cell-style XF index across an inclusive rectangle and materializes missing cells as styled blanks.

Row and column styles, `clearCellXfIndex()` versus `setCellXfIndex(..., 0)`, and the `rangeStyleBases()` → `remapRangeStyle()` attribute-only edit with its `snapshotRangeStyle()` / `restoreRangeStyle()` undo capture are described in [Workbook operations](/workbook/operations). `getEffectiveStyle().source` reports whether a style came from the `Cell`, `Row`, `Column`, or `Default`.

`setFormula()` validates the complete formula before changing a cell. A malformed formula returns a failed status corresponding to `kParserUnexpectedToken` and leaves an existing formula, cached value, and dependency edges unchanged. A malformed formula already stored in an XLSX or XLSB file is kept as file text; after recalculation the cell yields the `#NAME?` error value. The ad-hoc `evalFormula()` path has different input semantics: malformed text still returns `#NAME?` as a cell value with a successful status.

`getCellsInRange(sheet, range, cursor, limit)` returns `{ status, cells, nextCursor }` in row-major order. Each `RangeCell` has `row`, `col`, `formula`, and `value`. Omit `cursor` for the first page and pass back `nextCursor` until it is `null`; an omitted or zero `limit` uses the 65,536-cell maximum. Formula cells, non-blank values, and spill phantoms are included, while styled blanks are not. `listInvalidCells()` uses the same cursor and limit contract.

Geometry methods use `GeometryMode.Display` for the 96-DPI screen model and `GeometryMode.Print` for the DPI-stable pagination model. Display methods return `DisplayStatus.Overflow` with `########` when the value is outside the format's representable range, such as an invalid date serial, and `DisplayStatus.InvalidFormat` when the format code is malformed; the latter falls back to General rendering.

`setCellStyle(record)` adds or replaces a named cell style. The JavaScript record is `{ name, xfId?, builtinId?, iLevel?, hidden?, customBuiltin? }`; omitted fields default to `xfId: 0`, a custom `builtinId`, level `0`, and both flags `false`. The `xfId` points into the named-style `cellStyleXfs` table, not the per-cell `cellXfs` table.

`getTheme()` returns the four theme typefaces plus `majorScripts` and `minorScripts`; `setThemeScriptFont(major, script, typeface)` changes or appends one script entry. The defaults and the `Jpan` fallback rule are in [Presentation and geometry](/workbook/presentation).

`dataBar.direction` in conditional-format records uses `0` for context, `1` for left-to-right, and `2` for right-to-left, and resolved matches report it as `CfMatch.barDirection`. `iconSet.floor` is the lower-bound `CfValueObjectInput`: optional when adding a rule and present on every icon-set rule read back.

`pivotFieldAddItemAt(sheet, pivotIdx, fieldIdx, cacheIndex, visible)` addresses a manual-filter item by its bound cache field's shared-item index. It is the only form that can identify a blank pivot member; an empty name passed to `pivotFieldAddItem()` is text matching and cannot do so. An unresolved index is accepted but filters nothing.

Data-validation input defaults `allowBlank` to `false` when omitted. Pass `allowBlank: true` to allow empty cells; `showDropDown` remains the OOXML-inverted exception.

AutoFilter criteria are stored separately from row visibility. Use `evaluateAutoFilter()` to inspect matches and `applyAutoFilter()` to update hidden rows; `clearAutoFilter()` removes criteria while retaining the AutoFilter range. Validation methods check proposed values without storing them, and `listInvalidCells()` enumerates existing violations.

`probeImage()` reads PNG, JPEG, GIF, or BMP dimensions without touching the workbook. `listDrawingObjects()` returns anchored objects in document order; `getImage()` copies picture bytes, `insertImage()` preserves existing drawing content, and `removeDrawing()` removes a picture or chart and releases its media when no other object references it. Chart methods are described in [Charts](/workbook/charts). Threaded-comment methods include replies and person records; removing a person fails while a comment or mention still refers to that person.

`paginate(sheet)` returns the resolved print layout in one result: `printArea`, `horizontalBreaks`, `verticalBreaks`, `pageCount`, `paper`, `margins`, `printable`, `scale`, `pageOrder`, `printTitles`, `pages`, `horizontalBreakManual`, and `verticalBreakManual`, together with `status`. `paper` reports point dimensions, orientation, and whether the stored paper code was known. `pages` lists physical pages in print order with `areaIndex`, inclusive cell bounds, origin, and scaled size. A missing declared print area leaves `printArea` empty while pagination falls back to the used range; the manual-break arrays parallel their break arrays.

`evaluateFormulaText` and `evaluateConditionalFormula` evaluate formula text against an existing workbook **without mutating it or joining the dependency graph**. They resolve local and cross-sheet references, defined names, and `ROW()` / `COLUMN()` anchoring; conditional-format evaluation also shifts relative references from the rule anchor and applies Excel-style predicate coercion. An array/spill result from the scalar call is reduced to its top-left element (not Excel implicit intersection). A formula that references its own anchor cell reads that cell's cached value rather than raising `#REF!`.

`evaluateFormulaArray` is the whole-array companion to `evaluateFormulaText`. It shares the same read-only resolution and never joins the dependency graph, but returns the entire result as an `EvalArrayResult` (`status`, `rows`, `cols`, and row-major `cells: Value[][]`; a scalar is a 1×1 array). Range-shaped defined names evaluate as `Array` values and spill-phantom cells are enumerated by `cellCount` / `cellAt`.

The diagram below contrasts three paths through the same workbook:

<DiagramFlow label="Mutate path: setFormula then recalc" :steps="[
  { label: 'setFormula()', note: 'writes the formula into the cell' },
  { label: 'recalc()', note: 'joins the graph; dependents recompute' }
]" caption="Only the mutate path writes to the workbook and joins the dependency graph." />

<DiagramFlow label="Read-only path: evaluateFormulaText" :steps="[
  { label: 'evaluateFormulaText()', note: 'read-only; refs, names, ROW()/COLUMN()' },
  { label: 'Scalar EvalResult', note: 'array → top-left · self-ref → cached' }
]" caption="The scalar call reduces an array to its top-left element: =SEQUENCE(3) returns 1, not three rows." />

<DiagramFlow label="Whole-array path: evaluateFormulaArray" :steps="[
  { label: 'evaluateFormulaArray()', note: 'same read-only resolution' },
  { label: 'EvalArrayResult', note: 'rows × cols cells[][]; scalar is 1×1' }
]" caption="The array call returns the whole result and never reduces it; a scalar comes back as a 1×1 array." />

## Read next

- [Workbook lifecycle](/workbook/lifecycle) — engine-side flow.
- [Workbook operations](/workbook/operations) — sheets, cells, structures.
- [Presentation and geometry](/workbook/presentation) — display text, themes, styles, dimensions, and pagination.
- [Filters and validation](/workbook/filters-validation) — AutoFilter state and proposed-value checks.
- [Comments and images](/workbook/comments-images) — threaded comments, persons, drawing objects, and pictures.
- [Dynamic arrays](/workbook/dynamic-arrays) — spill semantics referenced above.
- [Compatibility / Error model](/compatibility/errors) — what each error code means.
- [File format support](/compatibility/file-format-support) — what XLSB currently round-trips.
