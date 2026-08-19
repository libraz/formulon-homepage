# Native Node Integration

The Native Node package in `packages/npm-native` is a Node.js [N-API](https://nodejs.org/api/n-api.html) addon. It exposes the shared calculation and workbook methods of the WASM package while running as a native binary, so it avoids both the WASM heap-copy overhead and the browser-only cross-origin isolation requirements. The binding method sets are not identical: table authoring, AutoFilter XML, phonetics, and cell-style authoring remain WASM-only.

::: info Glossary: N-API
A C ABI Node provides for native addons. Modules built against N-API run on any Node version that ships the same API level, so the same prebuilt `.node` binary works across multiple Node minor versions.
:::

Choose it when:

- your deployment can install a platform-specific `.node` binary,
- large workbooks make WASM heap copies expensive,
- you want native scheduler behavior without browser isolation constraints.

::: info Surface parity and lifecycle
Native Node and WASM share the common Workbook methods and the three static factories (`createDefault`, `createEmpty`, `loadBytes`). The following nine methods are WASM-only: `createTable`, `updateTable`, `removeTable`, `getSheetAutoFilterXml`, `setSheetAutoFilterXml`, `getCellPhonetic`, `setCellPhonetic`, `addCellStyleXf`, and `setCellStyle`. Native Node adds `dispose()` for deterministic release and `memoryUsage()` for an estimated native footprint. The estimate covers cells, shared strings, passthrough parts, and workbook metadata; it refreshes V8 external-memory reporting and returns `0` after disposal. Garbage collection remains a fallback. WASM uses `delete()` because its native handles live in the WASM heap.
:::

## Availability

The native Node addon exists in the source tree as `packages/npm-native`, but it is not currently published to the public npm registry. Use this path when you build from a Formulon checkout or stage the package for your own deployment.

From a source checkout:

```sh
make node-native
make node-package
make node-test
```

Then import the staged package from `packages/npm-native/dist/index.mjs`, or publish/stage it through your own internal package flow.

## Usage

```js
import { Workbook, ValueKind, evalFormula } from './packages/npm-native/dist/index.mjs'

console.log(evalFormula('=SUM(1,2,3)'))

const wb = Workbook.createDefault()
wb.setFormula(0, 0, 0, '=1+2')
wb.recalc()

const result = wb.getValue(0, 0, 0)
if (result.status.ok && result.value.kind === ValueKind.Number) {
  console.log(result.value.number)
}
```

Call `dispose()` when the workbook leaves scope. The addon also finalizes handles through JavaScript garbage collection if callers miss it.

## API surface

| Group | Methods |
| --- | --- |
| Factories | `Workbook.createDefault()`, `createEmpty()`, `loadBytes(bytes)` |
| Cell mutation | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula` |
| Recalc and readback | `getValue`, `recalc`, `recalcParallel`, `partialRecalc`, `evaluateFormulaText`, `evaluateConditionalFormula`, `evaluateFormulaArray`, `paginate`, `save`, `saveAs`, `saveWithDiagnostics`, `readDiagnostics`, `spillInfo`, `precedents`, `dependents` |
| Sheets and structure | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, row/column insert/delete, names, table enumeration (`tableCount`, `tableAt`), passthrough parts |
| Rich workbook data | styles (except cell-style authoring), merges, comments, `getComments`, hyperlinks, validations, conditional formatting, sheet view/layout/protection |
| PivotTables | pivot cache and pivot table creation, mutation, and layout projection |
| WASM-only methods | `createTable`, `updateTable`, `removeTable`, `getSheetAutoFilterXml`, `setSheetAutoFilterXml`, `getCellPhonetic`, `setCellPhonetic`, `addCellStyleXf`, `setCellStyle` |
| Policy and catalog | calc mode, Excel profile id, function metadata, localized names, external links |
| Top-level | `evalFormula`, `version`, `lastErrorMessage`, `lastErrorContext`, `statusString`, `mergeFunctionMetadata` |

The authoritative method list is the package TypeScript declaration file. Treat Native Node as the performance-oriented Node path when you can ship a platform-specific binary; choose WASM when you need a browser, phonetic or AutoFilter XML access, table or cell-style authoring, or no native addon.

`getValue` returns a `CellResult` (`{ status, value }`); its `value` field is the cached `Value`. Top-level `evalFormula` and workbook `evaluateFormulaText` return `EvalResult` envelopes with the same `status` / `value` shape.

::: tip Ad-hoc evaluation is read-only
`evaluateFormulaText` and `evaluateConditionalFormula` evaluate against the current workbook without mutating it or joining the dependency graph. Array and spill results from the scalar call are reduced to their top-left element; use `evaluateFormulaArray` for the full result.
:::

::: tip Memory accounting
`memoryUsage()` is an estimate rather than an allocation ledger. Calling it after a long run of cell writes refreshes the external-memory hint supplied to V8, so large native workbooks are visible to the runtime's memory policy.
:::

## Read next

- [Surface matrix](/api/surfaces) — what each binding currently exposes.
- [Workbook operations](/workbook/operations) — what the shared workbook API can do.
