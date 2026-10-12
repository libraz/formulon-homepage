# Native Node Integration

The Native Node package in `packages/npm-native` is a Node.js [N-API](https://nodejs.org/api/n-api.html) addon. It exposes the shared calculation and workbook methods of the WASM package while running as a native binary, so it avoids both the WASM heap-copy overhead and the browser-only cross-origin isolation requirements. The binding method sets are not identical: table authoring, AutoFilter XML, and `addCellStyleXf` remain WASM-only; `setCellStyle` is available on Native Node.

::: info Glossary: N-API
A C ABI Node provides for native addons. Modules built against N-API run on any Node version that ships the same API level, so the same prebuilt `.node` binary works across multiple Node minor versions.
:::

Choose it when:

- your deployment can install a platform-specific `.node` binary,
- large workbooks make WASM heap copies expensive,
- you want native scheduler behavior without browser isolation constraints.

::: info Surface parity and lifecycle
Native Node and WASM share the common Workbook methods and the four static factories (`createDefault`, `createForProfile`, `createEmpty`, `loadBytes`). The following six Workbook methods are WASM-only: `createTable`, `updateTable`, `removeTable`, `getSheetAutoFilterXml`, `setSheetAutoFilterXml`, and `addCellStyleXf`. Native Node adds `dispose()` for deterministic release and `memoryUsage()` for an estimated native footprint. The estimate covers cells, shared strings, passthrough parts, and workbook metadata; it refreshes V8 external-memory reporting and returns `0` after disposal. Garbage collection remains a fallback. WASM uses `delete()` because its native handles live in the WASM heap.
:::

## Availability

The native Node addon exists in the source tree as `packages/npm-native`, but it is not currently published to the public npm registry. Use this path when you build from a Formulon checkout or stage the package for your own deployment.

From a source checkout:

```sh
make NODE_NATIVE_BUILD_DIR=build-node-native node-test
```

Then import the staged package from `packages/npm-native/dist/index.mjs`, or publish/stage it through your own internal package flow.

## Usage

```js
import { Workbook, ValueKind, evalFormula } from './packages/npm-native/dist/index.mjs'

console.log(evalFormula('=SUM(1,2,3)'))

const wb = Workbook.createDefault()
try {
  const set = wb.setFormula(0, 0, 0, '=1+2')
  if (!set.ok) throw new Error(`${set.message}: ${set.context}`)
  const recalculated = wb.recalc()
  if (!recalculated.ok) throw new Error(`${recalculated.message}: ${recalculated.context}`)

  const result = wb.getValue(0, 0, 0)
  if (!result.status.ok) throw new Error(`${result.status.message}: ${result.status.context}`)
  if (result.value.kind === ValueKind.Number) {
    console.log(result.value.number)
  }
} finally {
  wb.dispose()
}
```

Call `dispose()` when the workbook leaves scope. The addon also finalizes handles through JavaScript garbage collection if callers miss it.

## API surface

| Group | Methods |
| --- | --- |
| Factories | `Workbook.createDefault()`, `createForProfile(profileId)`, `createEmpty()`, `loadBytes(bytes)` |
| Cell mutation | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula` |
| Recalc and readback | `getValue`, `recalc`, `recalcParallel`, `partialRecalc`, `setIterative`, `getIterative`, `evaluateFormulaText`, `evaluateConditionalFormula`, `evaluateFormulaArray`, `paginate`, `save`, `saveAs`, `saveWithDiagnostics`, `readDiagnostics`, `spillInfo`, `precedents`, `dependents` |
| Sheets and structure | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, row/column insert/delete, names, table enumeration (`tableCount`, `tableAt`), passthrough parts |
| Rich workbook data | styles including row/column style overrides, `setCellStyle`, `clearCellXfIndex`, range style remapping and snapshots, geometry and theme/effective-style access, typed sheet/table AutoFilters, validation checks, phonetic guides and properties, merges, comments, `getComments`, images and drawing objects, hyperlinks, validations, conditional formatting, sheet view/layout/protection, three-state visibility, typed print settings, range XF assignment |
| PivotTables | pivot cache and pivot table creation, cache-index item filters, mutation, and layout projection |
| WASM-only methods | `createTable`, `updateTable`, `removeTable`, `getSheetAutoFilterXml`, `setSheetAutoFilterXml`, `addCellStyleXf` |
| Policy and catalog | calc mode, Excel profile id, locale facts, function metadata, localized names and formulas, external links |
| Top-level | `evalFormula`, `version`, `lastErrorMessage`, `lastErrorContext`, `statusString`, `mergeFunctionMetadata` |

The authoritative method list is the package TypeScript declaration file. Treat Native Node as the performance-oriented Node path when you can ship a platform-specific binary; choose WASM when you need a browser, AutoFilter XML access, table authoring, `addCellStyleXf`, or no native addon. Typed AutoFilters, geometry and theme access, validation checks, comments, and image/drawing APIs are available on both JavaScript bindings. See [presentation](/workbook/presentation), [filters and validation](/workbook/filters-validation), and [comments and images](/workbook/comments-images).

Native Node now shares WASM's iterative-settings read-back, three-state sheet visibility, print-setting authoring, `setRangeXfIndex()`, and `pivotFieldAddItemAt()` methods. `getIterative()` reports the stored `maxIterations` after the common `32767` cap. `SheetVisibility.VeryHidden` is distinct from `Hidden`; `pivotFieldAddItemAt()` addresses a cache shared-item index so the blank pivot member can be filtered.

`createDefault()` keeps the ordinary one-sheet defaults, including Calibri 11. `createForProfile(profileId)` records the selected profile and applies its body and optional phonetic fonts, localized `Normal` style and first-sheet names, cell-xf alignment, phonetic settings, page margins, and Mac row-height and base-column-width values. It writes no theme part, so a fresh workbook reads as using the default Office theme; Windows row and column metrics use the engine defaults.

`localizeFunctionName()`, `canonicalizeFunctionName()`, `localizeFormula()`, `canonicalizeFormula()`, and `localeFacts()` take the full Excel profile id. Formula text stays in the invariant stored spelling; the helpers produce or consume the spelling shown for a selected profile. `functionMetadata()` is locale-invariant and contains structural fields only; a host-owned display catalog can be merged separately. The default is `win-365-en_US`; all 28 profile ids are accepted. Locale facts are measured for Mac profiles and `win-365-ja_JP`, while `localeFacts().facts.collationMeasured` is true only for Mac profiles.

`compareText(a, b, strength, profileId)` returns the text-order sign in `order`; `CollationStrength` selects the comparison, dynamic-array lookup, or classic exact fold. `collationClasses(values, strength, profileId)` returns dense ids in ascending SORT order (numbers, text, booleans, errors, blanks). Equal ids require the same value kind, text uses the selected fold, `-0` equals `0`, and blanks share one class. Ids are meaningful only within one call, so classify saved and current values together when matching a selection.

`setColumnStyle()` / `clearColumnStyle()` and `setRowStyle()` / `clearRowStyle()` preserve the other axis attributes. `clearCellXfIndex()` removes the direct assignment from a blank cell so row/column inheritance applies; `setCellXfIndex(..., 0)` keeps an explicit Normal XF and is different from clearing it. `rangeStyleBases()`, `remapRangeStyle()`, `snapshotRangeStyle()`, and `restoreRangeStyle()` support attribute-only style changes and undo while preserving values and formulas. `getTheme()` includes `majorScripts` and `minorScripts`; `setThemeScriptFont()` changes or appends a script. On readback, a `Jpan` entry supplies the corresponding East Asian face only when that font set's `<a:ea typeface>` is empty; an explicit `<a:ea typeface>` takes precedence. See [Workbook operations](/workbook/operations) for the canonical style-selection rules.

`getValue` returns a `CellResult` (`{ status, value }`); its `value` field is the cached `Value`. Top-level `evalFormula` and workbook `evaluateFormulaText` return `EvalResult` envelopes with the same `status` / `value` shape.

::: tip Ad-hoc evaluation is read-only
`evaluateFormulaText` and `evaluateConditionalFormula` evaluate against the current workbook without mutating it or joining the dependency graph. Array and spill results from the scalar call are reduced to their top-left element; use `evaluateFormulaArray` for the full result.

`setFormula()` rejects malformed text with the `kParserUnexpectedToken` status and leaves the cell unchanged. A malformed formula already carried by an XLSX or XLSB file remains loadable and evaluates to `#NAME?` on recalc; ad-hoc `evalFormula()` returns `#NAME?` as a value for malformed text.
:::

::: tip Memory accounting
`memoryUsage()` is an estimate rather than an allocation ledger. Calling it after a long run of cell writes refreshes the external-memory hint supplied to V8, so large native workbooks are visible to the runtime's memory policy.
:::

## Read next

- [Surface matrix](/api/surfaces) — what each binding currently exposes.
- [Workbook operations](/workbook/operations) — what the shared workbook API can do.
