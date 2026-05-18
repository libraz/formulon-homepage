# Native Node Integration

`@libraz/formulon-native` is a Node.js [N-API](https://nodejs.org/api/n-api.html) addon. It exposes a subset of the WASM package shape while running as a native binary, so it avoids both the WASM heap-copy overhead and the cross-origin isolation requirements that the browser path carries.

::: info Glossary: N-API
A C ABI Node provides for native addons. Modules built against N-API run on any Node version that ships the same API level, so the same prebuilt `.node` binary works across multiple Node minor versions.
:::

Choose it when:

- your deployment can install a platform-specific `.node` binary,
- large workbooks make WASM heap copies expensive,
- you want native scheduler behavior without browser isolation constraints.

::: warning MVP subset
The Native Node binding currently exposes a focused subset of the WASM surface. Use WASM when the application needs the broader workbook-management API today (styles, conditional formatting, layout, pivot tables, comments, hyperlinks, …).
:::

## Install

```sh
yarn add @libraz/formulon-native@0.9.2
```

Prebuilt binaries are published per `(os, arch)`. The installer picks the matching artifact at install time.

## Usage

```js
import { Workbook, ValueKind, evalFormula } from '@libraz/formulon-native'

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

## Current subset

| Group | Methods |
| --- | --- |
| Factories | `Workbook.createDefault()`, `createEmpty()`, `loadBytes(bytes)` |
| Cell mutation | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula` |
| Read | `getValue` |
| Engine | `recalc`, `save` |
| Sheets | `addSheet`, `removeSheet`, `renameSheet`, `sheetCount`, `sheetName` |
| Names | `setDefinedName` |
| Top-level | `evalFormula`, `version`, `lastErrorMessage`, `lastErrorContext`, `statusString` |

The full WASM surface is larger. Treat Native Node as the performance-oriented Node path, not as the most complete JavaScript API yet.

## Read next

- [Surface matrix](/api/surfaces) — what each binding currently exposes.
- [Workbook operations](/workbook/operations) — what the wider API can do (and what is missing here).
