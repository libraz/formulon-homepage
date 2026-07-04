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

`getValue()`, `evalFormula()`, `evaluateFormulaText()`, and `evaluateConditionalFormula()` return a `Value` whose `kind` discriminates the payload. Number values use `value.number`, Booleans use `value.boolean` (`0` or `1`), text uses `value.text`, and errors use `value.errorCode` — a `formulon::ErrorCode` ordinal; there is no `errorText` field (see [Error model](/compatibility/errors) for what each code means). `Array`, `Ref`, and `Lambda` currently carry no extra payload on `Value` — those fields are reserved in the C ABI for a later bundle. To read a lambda's formula text, call `getLambdaText(sheet, row, col)` on the workbook instead.

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

`save()` always writes OOXML `.xlsx`. `saveEx(format)` (added in 0.9.3) writes an explicit container:

```ts
enum WorkbookFormat {
  Unknown = 0,
  Xlsx = 1,
  Xlsb = 2
}

const result = wb.saveEx(WorkbookFormat.Xlsb) // SaveResult { status, bytes }
```

`loadBytes(bytes)` accepts either container without a separate flag: the loader detects `.xlsb` vs. `.xlsx` from the package bytes themselves, not from a file name, so the same call handles both. See [File format support](/compatibility/file-format-support) for what round-trips through each container.

## Main workbook methods

| Group | Methods |
| --- | --- |
| Sheets | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, `sheetCount`, `sheetName` |
| Cells | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula`, `getValue`, `cellCount`, `cellAt`, `getLambdaText` |
| Calculation | `recalc`, `partialRecalc`, `evaluateFormulaText`, `evaluateConditionalFormula`, `setIterative`, `setIterativeProgress`, `calcMode`, `setCalcMode` |
| Serialization | `save`, `saveEx` |
| Profiles | `excelProfileId`, `setExcelProfileId` |
| Names/tables | `definedNameCount`, `definedNameAt`, `setDefinedName`, `tableCount`, `tableAt` |
| Structure | `insertRows`, `deleteRows`, `insertCols`, `deleteCols` |
| Layout | sheet view, protection, row/column layout, styles, merges |
| Rich workbook data | comments, hyperlinks, data validations, conditional formats, pivot layout, external links |
| Introspection | `precedents`, `dependents`, `functionMetadata`, `functionNames`, `spillInfo` |

::: info Added in 0.9.4
`evaluateFormulaText` and `evaluateConditionalFormula` evaluate formula text against an existing workbook **without mutating it or joining the dependency graph**. They resolve local and cross-sheet references, defined names, and `ROW()` / `COLUMN()` anchoring; conditional-format evaluation also shifts relative references from the rule anchor and applies Excel-style predicate coercion. An array/spill result is reduced to its top-left element — a deliberate Phase 1 API shape, not Excel implicit intersection (see [Dynamic arrays](/workbook/dynamic-arrays)). A formula that references its own anchor cell reads that cell's cached value rather than raising `#REF!`, since the ad-hoc formula never joins the dependency graph.
:::

The diagram below contrasts the two paths through the same workbook:

<DiagramFlow label="Mutate path: setFormula then recalc" :steps="[
  { label: 'setFormula(sheet, row, col, formula)' },
  { label: 'recalc()', note: 'joins the dependency graph; dependents recompute' }
]" />

<DiagramFlow label="Read-only path: evaluateFormulaText (0.9.4)" :steps="[
  { label: 'evaluateFormulaText(sheet, row, col, formula)', note: 'resolves refs, defined names, ROW()/COLUMN() anchoring' },
  { label: 'Scalar EvalResult', note: 'array/spill -> top-left; self-ref -> cached value; no dep-graph join' }
]" />

## Read next

- [Workbook lifecycle](/workbook/lifecycle) — engine-side flow.
- [Workbook operations](/workbook/operations) — sheets, cells, structures.
- [Dynamic arrays](/workbook/dynamic-arrays) — spill semantics referenced above.
- [Compatibility / Error model](/compatibility/errors) — what each error code means.
- [File format support](/compatibility/file-format-support) — what XLSB currently round-trips.
