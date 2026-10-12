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

Important module methods:

| API | Purpose |
| --- | --- |
| `Module.evalFormula(formula)` | One-shot formula evaluation in a fresh workbook |
| `Module.Workbook.createDefault()` | Workbook with `Sheet1` |
| `Module.Workbook.createForProfile(profileId)` | One-sheet workbook seeded with the selected Excel profile's locale defaults |
| `Module.Workbook.createEmpty()` | Workbook with no sheets |
| `Module.Workbook.loadBytes(bytes)` | Load in-memory workbook bytes (auto-detects `.xlsx` / `.xlsb` container) |
| `Module.versionString()` | Engine version string |
| `Module.errorDisplayName(errorCode)` | Excel display literal for an error ordinal |
| `Module.statusString(status)` | Symbolic status description |
| `Module.lastErrorMessage()` | Last thread-local diagnostic |
| `Module.lastErrorContext()` | Last thread-local diagnostic context |

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

The JavaScript binding validates argument types and integer narrowing before calling the C ABI. Wrong primitive types, symbols, `BigInt` values, non-finite or fractional integers, unsafe cursors, and malformed nested records can raise `TypeError` or `RangeError` before a result is returned. Validly shaped calls that the engine rejects return `Status.ok === false`; argument checks leave the workbook unchanged.

Conditional-format data exposes the rule direction and icon-set floor directly. `dataBar.direction` uses `0` for context, `1` for left-to-right, and `2` for right-to-left; `iconSet.floor` is the lower-bound `CfValueObjectInput` (optional when adding a rule and returned for every icon-set rule read back). Resolved data-bar matches report the same direction in `CfMatch.barDirection`.

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

`getValue()` returns a `CellResult` (`{ status, value }`), while `evalFormula()`, `evaluateFormulaText()`, and `evaluateConditionalFormula()` return `EvalResult` envelopes with the same `status` / `value` shape. In each case, the `value` field is a `Value` whose `kind` discriminates the payload. Number values use `value.number`, Booleans use `value.boolean` (`0` or `1`), text uses `value.text`, and errors use `value.errorCode` — a `formulon::ErrorCode` ordinal; there is no `errorText` field (see [Error model](/compatibility/errors) for what each code means). `Array`, `Ref`, and `Lambda` currently carry no extra payload on `Value` — those fields are reserved in the C ABI for a later bundle. To read a lambda's formula text, call `getLambdaText(sheet, row, col)` on the workbook instead.

The declarations also export these enum groups:

| Area | Enums |
| --- | --- |
| Geometry and display | `GeometryMode` (`Display = 0`, `Print = 1`), `DisplayStatus` (`Ok = 0`, `Overflow = 1`, `InvalidFormat = 2`) |
| AutoFilter | `FilterKind`, `FilterOperator`, `DynamicFilterType`, `SortBy`, `SortMethod`, `DateTimeGrouping` |
| Validation | `ValidationErrorStyle` (`Stop = 0`, `Warning = 1`, `Information = 2`) |
| Themes and styles | `ColorContext`, `ColorResolution`, `ThemeSource`, `EffectiveStyleSource` |
| Images and drawings | `ImageFormat`, `DrawingObjectKind`, `AnchorKind`, `AnchorEditAs` |
| Text collation | `CollationStrength` (`Compare = 0`, `Dynamic = 1`, `ClassicExact = 2`) |
| Workbook state | `CalcMode`, `SheetVisibility`, `WorkbookFormat` |

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

Always call `delete()`.

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

New workbooks use the `win-365-en_US` profile. A profile is workbook state: it controls locale-sensitive evaluation, number and date rendering, text comparison, and localized Excel names. Formula input remains the English canonical spelling; use the text helpers to convert a displayed formula before storing it. The profile id is not written into the file, so apply it again after loading. The catalog contains 28 ids, `{mac,win}-365-{ja_JP,en_US,de_DE,fr_FR,zh_CN,ko_KR,th_TH,es_ES,es_MX,pt_BR,ru_RU,zh_TW,it_IT,nl_NL}`. Locale facts for every `mac-*` profile and `win-365-ja_JP` are measured against Excel; the other 13 Windows profiles use estimated locale data. Text collation measurement is separate and is available only for `mac-*` profiles.

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

`compareText(a, b, strength, profileId)` returns the sign of the text order in `order` (`-1`, `0`, or `1`). `CollationStrength` selects the text fold used by comparison, dynamic-array lookups, or classic exact lookups; it does not merge different value kinds. `collationClasses(values, strength, profileId)` returns one dense `classIds` entry per `Value` and a `classCount`. Within that call, equal values share an id only when their kinds also match, and ids ascend in SORT order: numbers, text, booleans, errors, then blanks. Text uses the selected strength, `-0` equals `0`, and all blanks share one class. The ids are meaningful only for that call, so classify saved values together with the current values when matching a selection. `localeFacts(profileId).facts.collationMeasured` reports whether text collation was measured; it is true for `mac-*` and false for Windows profiles, including `win-365-ja_JP`.

`functionMetadata()` returns only locale-invariant structure: the canonical name, arity, availability, and currently empty human-readable signature and description fields. A host can merge its own display catalog with `mergeFunctionMetadata()`; that helper's BCP-47 UI locale is independent of the engine profile id. `localeFacts()` returns separators, Boolean names, date order, currency, and localized error names for the selected profile.

## Main workbook methods

`cellCount()` / `cellAt()` enumerate written coordinates, including styled blanks, `setBlank` writes, and spill phantoms. Unwritten gaps are omitted; indices are dense and ordered by `(row, col)`. Do not mutate the sheet during enumeration. This differs from populated-range enumeration; see [Inspect a range](/workbook/operations#inspect-a-range).

| Group | Methods |
| --- | --- |
| Sheets | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, `sheetCount`, `sheetName` |
| Cells | `setNumber`, `setBool`, `setError`, `setText`, `setBlank`, `setFormula`, `getValue`, `getFormula`, `getFormulaR1C1`, `cellCount`, `cellAt`, `getLambdaText`, phonetic getters/setters |
| Ranges | `getCellsInRange`, `getMergesInRange`, `setRangeXfIndex`, `listInvalidCells` |
| Calculation | `recalc`, `recalcParallel`, `partialRecalc`, `evaluateFormulaText`, `evaluateFormulaArray`, `evaluateConditionalFormula`, `setIterative`, `getIterative`, `setIterativeProgress`, `calcMode`, `setCalcMode`, `pinnedNow`, `setPinnedNow`, `clearPinnedNow`, `paginate` |
| Serialization | `save`, `saveAs`, `saveWithDiagnostics`, `readDiagnostics` |
| Profiles and formula text | `excelProfileId`, `setExcelProfileId`, `localizeFunctionName`, `canonicalizeFunctionName`, `localizeFormula`, `canonicalizeFormula`, `localeFacts`, `compareText`, `collationClasses` |
| Names/tables | `definedNameCount`, `definedNameAt`, `setDefinedName`, `tableCount`, `tableAt` |
| Structure | `insertRows`, `deleteRows`, `insertCols`, `deleteCols` |
| Geometry and layout | `getCellRectPt`, `getColumnWidthPt`, `getRowHeightPt`, `getWidthModel`, `columnCharsToPt`, `columnPtToChars`, sheet view, protection, row/column layout, typed print settings |
| Display | `getDisplayText`, `formatValue` |
| Themes and styles | `getTheme`, `setThemeColors`, `setThemeFonts`, `setThemeScriptFont`, `resolveColor`, `getEffectiveStyle`, row/column style setters and clearers, `getCellXfIndex`, `setCellXfIndex`, `clearCellXfIndex`, `setRangeXfIndex`, `rangeStyleBases`, `remapRangeStyle`, `snapshotRangeStyle`, `restoreRangeStyle`, `getFont` / `addFont`, `setFont`, `setDefaultFont`, `setCellStyle`, `removeCellStyle` |
| Filters | `getAutoFilter` / `setAutoFilter` / `removeAutoFilter`, `applyAutoFilter`, `clearAutoFilter`, `evaluateAutoFilter`, plus table AutoFilter counterparts |
| Validation | `getValidations`, `addValidation`, `removeValidationAt`, `clearValidations`, `validateValue`, `listInvalidCells` |
| Threaded comments | `getThreadedComments`, `addThreadedComment`, `editThreadedComment`, `setThreadResolved`, `removeThreadedComment`, `getPersons`, `addPerson`, `removePerson` |
| Images and drawings | `probeImage`, `listDrawingObjects`, `getImage`, `insertImage`, `removeImage` |
| Rich workbook data | comments (`getCommentResult`), hyperlinks, conditional formats, pivot layout and cache-item filters, external links |
| Introspection | `precedents`, `dependents`, `functionMetadata`, `functionNames`, `spillInfo` |

`setCellPhoneticRuns()` accepts an ordered, non-overlapping UTF-16 partition of the annotated cell text. `setCellPhoneticProperties()` changes its font, kana form, and alignment independently of those readings; writing a cell value clears both the runs and their properties.

`recalcParallel(threadCount)` is synchronous and returns `{ status, stats }`. The default `@libraz/formulon` entry evaluates this call serially and reports `stats.workerThreadsStarted === 0`. The `@libraz/formulon/threads` entry starts workers: a count of `0` selects automatic detection capped at 8 workers, `1` stays on the caller thread, and `2..8` sets the worker upper bound. Missing, fractional, non-finite, negative, or above-8 values fail with `kInvalidArgument`.

`setIterative(enabled, maxIterations, maxChange)` stores iterative-calculation settings. `getIterative()` reads them back as `{ status, enabled, maxIterations, maxChange }`; `maxIterations` is capped at `32767`, and the getter reports that capped value.

`SheetVisibility` has `Visible = 0`, `Hidden = 1`, and `VeryHidden = 2`. `setSheetVisibility(sheet, visibility)` writes the whole tab state, while `getSheetView(sheet).view.visibility` distinguishes the two hidden states. The legacy `tabHidden` flag remains `1` for both hidden states. `setSheetTabHidden(true)` does not demote a very-hidden sheet; use `setSheetVisibility()` for that transition.

Worksheet print settings are authored with `setSheetPageSetup()`, `setSheetPageMargins()`, `setSheetPrintOptions()`, `setSheetHeaderFooter()`, `setSheetPrintArea()`, `setSheetPrintTitles()`, `addSheetRowBreak()`, and `addSheetColBreak()`; raw XML setters are available for unmodeled fragments and validate input before storing it. Header/footer inputs use decoded Excel section strings, so a literal ampersand is written as `&&`.

`setRangeXfIndex(sheet, firstRow, firstCol, lastRow, lastCol, xfIndex)` applies one cell-style XF index across an inclusive rectangle and materializes missing cells as styled blanks.

`setColumnStyle()` and `setRowStyle()` assign a cell-style XF to an inclusive axis span while retaining the other row or column attributes; `clearColumnStyle()` and `clearRowStyle()` remove only that assignment. Index `0` is the default XF. `clearCellXfIndex()` removes a cell's explicit assignment so a blank cell can inherit its row, column, or workbook default. Calling `setCellXfIndex(..., 0)` keeps an explicit Normal XF and therefore remains distinct from clearing it; inspect `getEffectiveStyle().source` to tell `Cell` from `Row`, `Column`, or `Default`.

`rangeStyleBases()` lists the ascending cell-XF indices that some cell of a selection resolves to. Build a patched XF for each base and pass the pairs to `remapRangeStyle()` for an attribute-only change; values and formulas stay untouched. `snapshotRangeStyle()` captures the covered row/column styles and stored cell assignments, and `restoreRangeStyle()` restores them without changing values, formulas, phonetic runs, or comments. The selection rules and canonical workbook operation flow are documented in [Workbook operations](/workbook/operations).

`setFormula()` validates the complete formula before changing a cell. A malformed formula returns a failed status corresponding to `kParserUnexpectedToken` and leaves an existing formula, cached value, and dependency edges unchanged. A malformed formula already stored in an XLSX or XLSB file is kept as file text; after recalculation the cell yields the `#NAME?` error value. The ad-hoc `evalFormula()` path has different input semantics: malformed text still returns `#NAME?` as a cell value with a successful status.

`getCellsInRange(sheet, range, cursor, limit)` returns `{ status, cells, nextCursor }` in row-major order. Each `RangeCell` has `row`, `col`, `formula`, and `value`. Omit `cursor` for the first page and pass back `nextCursor` until it is `null`; an omitted or zero `limit` uses the 65,536-cell maximum. Formula cells, non-blank values, and spill phantoms are included, while styled blanks are not. `listInvalidCells()` uses the same cursor and limit contract.

Geometry methods use `GeometryMode.Display` for the 96-DPI screen model and `GeometryMode.Print` for the DPI-stable pagination model. Display methods return `DisplayStatus.Overflow` with `########` when the value is outside the format's representable range, such as an invalid date serial, and `DisplayStatus.InvalidFormat` when the format code is malformed; the latter falls back to General rendering.

`setCellStyle(record)` adds or replaces a named cell style. The JavaScript record is `{ name, xfId?, builtinId?, iLevel?, hidden?, customBuiltin? }`; omitted fields default to `xfId: 0`, a custom `builtinId`, level `0`, and both flags `false`. The `xfId` points into the named-style `cellStyleXfs` table, not the per-cell `cellXfs` table. `getEffectiveStyle()` reports whether the resolved style came from the cell, row, column, or workbook default and includes resolved theme colours.

`getTheme()` returns `majorScripts` and `minorScripts` alongside the four theme typefaces. Each list preserves theme-part order and has the 47 default Office script entries when the theme part is absent. `setThemeScriptFont(major, script, typeface)` changes one script or appends it. On readback, a `Jpan` entry supplies the corresponding East Asian face only when that font set's `<a:ea typeface>` is empty; an explicit `<a:ea typeface>` takes precedence. A workbook without a theme part receives the full default set before the change, and `script` must be four ASCII letters with a non-empty `typeface`.

`pivotFieldAddItemAt(sheet, pivotIdx, fieldIdx, cacheIndex, visible)` addresses a manual-filter item by its bound cache field's shared-item index. It is the only form that can identify a blank pivot member; an empty name passed to `pivotFieldAddItem()` is text matching and cannot do so. An unresolved index is accepted but filters nothing.

Data-validation input defaults `allowBlank` to `false` when omitted. Pass `allowBlank: true` to allow empty cells; `showDropDown` remains the OOXML-inverted exception.

AutoFilter criteria are stored separately from row visibility. Use `evaluateAutoFilter()` to inspect matches and `applyAutoFilter()` to update hidden rows; `clearAutoFilter()` removes criteria while retaining the AutoFilter range. Validation methods check proposed values without storing them, and `listInvalidCells()` enumerates existing violations.

`probeImage()` reads PNG, JPEG, GIF, or BMP dimensions without touching the workbook. `listDrawingObjects()` returns anchored objects in document order; `getImage()` copies picture bytes, `insertImage()` preserves existing drawing content, and `removeImage()` removes the picture and releases its media when no other object references it. Threaded-comment methods include replies and person records; removing a person fails while a comment or mention still refers to that person.

`paginate(sheet)` returns the resolved print layout in one result: `printArea`, `horizontalBreaks`, `verticalBreaks`, `pageCount`, `paper`, `margins`, `printable`, `scale`, `pageOrder`, `printTitles`, `pages`, `horizontalBreakManual`, and `verticalBreakManual`, together with `status`. `paper` reports point dimensions, orientation, and whether the stored paper code was known. `pages` lists physical pages in print order with `areaIndex`, inclusive cell bounds, origin, and scaled size. A missing declared print area leaves `printArea` empty while pagination falls back to the used range; the manual-break arrays parallel their break arrays.

`evaluateFormulaText` and `evaluateConditionalFormula` evaluate formula text against an existing workbook **without mutating it or joining the dependency graph**. They resolve local and cross-sheet references, defined names, and `ROW()` / `COLUMN()` anchoring; conditional-format evaluation also shifts relative references from the rule anchor and applies Excel-style predicate coercion. An array/spill result from the scalar call is reduced to its top-left element (not Excel implicit intersection). A formula that references its own anchor cell reads that cell's cached value rather than raising `#REF!`.

`evaluateFormulaArray` is the whole-array companion to `evaluateFormulaText`. It shares the same read-only resolution and never joins the dependency graph, but returns the entire result as an `EvalArrayResult` (`status`, `rows`, `cols`, and row-major `cells: Value[][]`; a scalar is a 1×1 array). Range-shaped defined names evaluate as `Array` values and spill-phantom cells are enumerated by `cellCount` / `cellAt`.

`INDIRECT(ref_text, FALSE)` selects the R1C1 grammar. Absolute references use forms such as `R5C2`; relative axes use forms such as `R[-1]C`, resolved from the cell containing the formula. A bare `R` or `C` means the current row or column, and an endpoint naming only one axis is unbounded along the other (`R5` is the whole of row 5, just as `5:5` is). The `a1` argument selects a grammar rather than adding a fallback: A1 text with `FALSE`, and R1C1 text with `TRUE`, return `#REF!`. A relative R1C1 reference also returns `#REF!` when evaluated through an ad-hoc entry point that has no formula cell to anchor it.

The diagram below contrasts three paths through the same workbook:

<DiagramFlow label="Mutate path: setFormula then recalc" :steps="[
  { label: 'setFormula(sheet, row, col, formula)' },
  { label: 'recalc()', note: 'joins the dependency graph; dependents recompute' }
]" />

<DiagramFlow label="Read-only path: evaluateFormulaText" :steps="[
  { label: 'evaluateFormulaText(sheet, row, col, formula)', note: 'resolves refs, defined names, ROW()/COLUMN() anchoring' },
  { label: 'Scalar EvalResult', note: 'array/spill -> top-left; self-ref -> cached value; no dep-graph join' }
]" />

<DiagramFlow label="Whole-array path: evaluateFormulaArray" :steps="[
  { label: 'evaluateFormulaArray(sheet, row, col, formula)', note: 'same read-only resolution as evaluateFormulaText' },
  { label: 'EvalArrayResult', note: 'full rows x cols cells[][]; no top-left reduction; no dep-graph join' }
]" />

## Read next

- [Workbook lifecycle](/workbook/lifecycle) — engine-side flow.
- [Workbook operations](/workbook/operations) — sheets, cells, structures.
- [Presentation and geometry](/workbook/presentation) — display text, themes, styles, dimensions, and pagination.
- [Filters and validation](/workbook/filters-validation) — AutoFilter state and proposed-value checks.
- [Comments and images](/workbook/comments-images) — threaded comments, persons, drawing objects, and pictures.
- [Dynamic arrays](/workbook/dynamic-arrays) — spill semantics referenced above.
- [Compatibility / Error model](/compatibility/errors) — what each error code means.
- [File format support](/compatibility/file-format-support) — what XLSB currently round-trips.
