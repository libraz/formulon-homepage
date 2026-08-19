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

Important module methods:

| API | Purpose |
| --- | --- |
| `Module.evalFormula(formula)` | One-shot formula evaluation in a fresh workbook |
| `Module.Workbook.createDefault()` | Workbook with `Sheet1` |
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

## Workbook lifecycle

```ts
const wb = Module.Workbook.loadBytes(bytes)
try {
  if (!wb.isValid()) throw new Error(Module.lastErrorMessage())
  wb.recalc()
  const saved = wb.save()
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
wb.setPinnedNow(2026, 8, 19, 12, 0, 0)
const pin = wb.pinnedNow() // { year, month, day, hour, minute, second }
wb.recalc()
wb.clearPinnedNow()
```

`pinnedNow()` returns a `CivilTime` object or `null` when the workbook follows the host clock. `setPinnedNow()` validates `year` 1900–9999, the real day range for `month` 1–12, `hour` 0–23, and `minute` / `second` 0–59; invalid fields return a failed `Status` rather than being normalised. The values are local civil fields, not a timestamp, so they have no timezone interpretation. Setting or clearing the pin does not recalculate cached formula values; call `recalc()` explicitly. The pin is workbook model state, not file state: saving does not record it, and a reloaded workbook is unpinned.

## Main workbook methods

| Group | Methods |
| --- | --- |
| Sheets | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, `sheetCount`, `sheetName` |
| Cells | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula`, `setCellPhonetic`, `getCellPhonetic`, `getValue`, `cellCount`, `cellAt`, `getLambdaText` |
| Calculation | `recalc`, `recalcParallel`, `partialRecalc`, `evaluateFormulaText`, `evaluateFormulaArray`, `evaluateConditionalFormula`, `setIterative`, `setIterativeProgress`, `calcMode`, `setCalcMode`, `pinnedNow`, `setPinnedNow`, `clearPinnedNow`, `paginate` |
| Serialization | `save`, `saveAs`, `saveWithDiagnostics`, `readDiagnostics` |
| Profiles | `excelProfileId`, `setExcelProfileId` |
| Names/tables | `definedNameCount`, `definedNameAt`, `setDefinedName`, `tableCount`, `tableAt` |
| Structure | `insertRows`, `deleteRows`, `insertCols`, `deleteCols` |
| Layout | sheet view, protection, row/column layout, styles, merges |
| Rich workbook data | comments (`getCommentResult`), hyperlinks, data validations, conditional formats, pivot layout, external links |
| Styles | `getFont` / `addFont` expose `FontRecord.vertAlign` (`0` baseline, `1` superscript, `2` subscript) |
| Introspection | `precedents`, `dependents`, `functionMetadata`, `functionNames`, `spillInfo` |

`recalcParallel(threadCount)` is synchronous and returns `{ status, stats }`. A count of `0` selects automatic detection capped at 8 workers, `1` stays on the caller thread, and `2..8` sets the worker upper bound; missing, fractional, non-finite, negative, or above-8 values fail with `kInvalidArgument`.

`evaluateFormulaText` and `evaluateConditionalFormula` evaluate formula text against an existing workbook **without mutating it or joining the dependency graph**. They resolve local and cross-sheet references, defined names, and `ROW()` / `COLUMN()` anchoring; conditional-format evaluation also shifts relative references from the rule anchor and applies Excel-style predicate coercion. An array/spill result from the scalar call is reduced to its top-left element (not Excel implicit intersection). A formula that references its own anchor cell reads that cell's cached value rather than raising `#REF!`.

`evaluateFormulaArray` is the whole-array companion to `evaluateFormulaText`. It shares the same read-only resolution and never joins the dependency graph, but returns the entire result as an `EvalArrayResult` (`status`, `rows`, `cols`, and row-major `cells: Value[][]`; a scalar is a 1×1 array). Range-shaped defined names evaluate as `Array` values and spill-phantom cells are enumerated by `cellCount` / `cellAt`.

`INDIRECT(ref_text, FALSE)` selects the R1C1 grammar. Absolute references use forms such as `R5C2`; relative axes use forms such as `R[-1]C`, resolved from the cell containing the formula. A bare `R` or `C` means the current row or column, and an endpoint naming only one axis is unbounded along the other (`R5` is the whole of row 5, just as `5:5` is). The `a1` argument selects a grammar rather than adding a fallback: A1 text with `FALSE`, and R1C1 text with `TRUE`, return `#REF!`. A relative R1C1 reference also returns `#REF!` when evaluated through an ad-hoc entry point that has no formula cell to anchor it.

The diagram below contrasts the two paths through the same workbook:

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
- [Dynamic arrays](/workbook/dynamic-arrays) — spill semantics referenced above.
- [Compatibility / Error model](/compatibility/errors) — what each error code means.
- [File format support](/compatibility/file-format-support) — what XLSB currently round-trips.
