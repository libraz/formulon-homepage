# Native Node Integration

The Native Node package in `packages/npm-native` is a Node.js [N-API](https://nodejs.org/api/n-api.html) addon. It exposes the same Workbook shape as the WASM package while running as a native binary, so it avoids both the WASM heap-copy overhead and the browser-only cross-origin isolation requirements.

::: info Glossary: N-API
A C ABI Node provides for native addons. Modules built against N-API run on any Node version that ships the same API level, so the same prebuilt `.node` binary works across multiple Node minor versions.
:::

Choose it when:

- your deployment can install a platform-specific `.node` binary,
- large workbooks make WASM heap copies expensive,
- you want native scheduler behavior without browser isolation constraints.

::: info Surface parity
The native package exposes the same 174 Workbook instance methods and the same three static factories (`createDefault`, `createEmpty`, `loadBytes`) as the WASM package, including the v0.9.4 `evaluateFormulaText` / `evaluateConditionalFormula` / `getComments` additions. WASM additionally exposes a `delete()` lifecycle method, since it has no host garbage collector to release native memory for it. Result envelopes and value shapes are otherwise byte-identical; the reasons to choose Native Node are operational, not API completeness.
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

Native handles do not need an explicit `delete()` call — the addon ties native memory to the JS object's GC. The pattern is otherwise identical to the WASM surface.

## API surface

| Group | Methods |
| --- | --- |
| Factories | `Workbook.createDefault()`, `createEmpty()`, `loadBytes(bytes)` |
| Cell mutation | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula` |
| Recalc and readback | `getValue`, `recalc`, `partialRecalc`, `evaluateFormulaText`, `evaluateConditionalFormula`, `evaluateFormulaArray`, `save`, `spillInfo`, `precedents`, `dependents` |
| Sheets and structure | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, row/column insert/delete, names, tables, passthrough parts |
| Rich workbook data | styles, merges, comments, `getComments`, hyperlinks, validations, conditional formatting, sheet view/layout/protection |
| PivotTables | pivot cache and pivot table creation, mutation, and layout projection |
| Policy and catalog | calc mode, Excel profile id, function metadata, localized names, external links |
| Top-level | `evalFormula`, `version`, `lastErrorMessage`, `lastErrorContext`, `statusString`, `mergeFunctionMetadata` |

The authoritative method list is the package TypeScript declaration file. Treat Native Node as the performance-oriented Node path when you can ship a platform-specific binary; choose WASM when you need a browser or no native addon.

::: tip evaluateFormulaText / evaluateConditionalFormula are read-only
Both v0.9.4 additions evaluate formula text against the current workbook state without mutating it or joining the dependency graph — nothing recalculates as a side effect. Array and spill results are reduced to their top-left element; this is a deliberate Phase 1 API shape, not a bug. See [Dynamic arrays](/workbook/dynamic-arrays) for how spill ranges normally work.
:::

::: tip evaluateFormulaArray returns the whole array (v0.9.5)
v0.9.5 adds `evaluateFormulaArray(sheet, row, col, formula)`, which returns the entire dynamic-array result (`EvalArrayResult`) instead of reducing to the top-left element. It carries the same read-only, no-mutation, and self-reference caveats as `evaluateFormulaText`. `mergeFunctionMetadata` — a pure helper that layers host-supplied localized function metadata (signature / description / localized name) over the engine's structural `functionMetadata()` catalog, with locale-override then entry-default then engine-value precedence — is also exported here.
:::

## Read next

- [Surface matrix](/api/surfaces) — what each binding currently exposes.
- [Workbook operations](/workbook/operations) — what the shared workbook API can do.
