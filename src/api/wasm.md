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
| `Module.Workbook.loadBytes(bytes)` | Load an in-memory `.xlsx` |
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

`getValue()` and `evalFormula()` return a `Value` whose `kind` discriminates the payload. Number values use `value.number`, Booleans use `value.bool`, text uses `value.text`, errors use `value.errorCode` / `value.errorText`, arrays use `value.array`, refs use `value.ref`, and lambdas use `value.lambda`.

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

## Main workbook methods

| Group | Methods |
| --- | --- |
| Sheets | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, `sheetCount`, `sheetName` |
| Cells | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula`, `getValue`, `cellCount`, `cellAt` |
| Calculation | `recalc`, `partialRecalc`, `setIterative`, `setIterativeProgress`, `calcMode`, `setCalcMode` |
| Profiles | `excelProfileId`, `setExcelProfileId` |
| Names/tables | `definedNameCount`, `definedNameAt`, `setDefinedName`, `tableCount`, `tableAt` |
| Structure | `insertRows`, `deleteRows`, `insertCols`, `deleteCols` |
| Layout | sheet view, protection, row/column layout, styles, merges |
| Rich workbook data | comments, hyperlinks, data validations, conditional formats, pivot layout, external links |
| Introspection | `precedents`, `dependents`, `functionMetadata`, `functionNames`, `spillInfo` |

## Read next

- [Workbook lifecycle](/workbook/lifecycle) — engine-side flow.
- [Workbook operations](/workbook/operations) — sheets, cells, structures.
- [Compatibility / Error model](/compatibility/errors) — what each error code means.
