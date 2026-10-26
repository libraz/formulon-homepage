# Native Node Integration

`@libraz/formulon-native` (`packages/npm-native` in the engine repository) is a Node.js [N-API](https://nodejs.org/api/n-api.html) addon with the same Workbook API as the WASM package. It runs as a native binary, so it has no WASM heap copies, no 32-bit address-space ceiling, and no cross-origin isolation requirement.

::: info Glossary: N-API
Node's stable C interface for native addons. An addon built against one N-API version loads on every later Node release that supports it, so one `.node` binary per OS and CPU serves several Node versions.
:::

## Build and first call

The addon is not published to npm. Build and stage it from a source checkout (a C++17 toolchain, CMake, and Node 22 or newer are required):

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
git checkout v0.18.0
make NODE_NATIVE_BUILD_DIR=build-node-native node-package
```

`node-package` builds `formulon.node` and stages it with the JavaScript entry under `packages/npm-native/dist/`; `make node-test` does the same and then runs the addon's tests. Import the staged entry directly, or publish it through your own package flow.

```js
import { Workbook, ValueKind, evalFormula } from './packages/npm-native/dist/index.mjs'

console.log(evalFormula('=SUM(1,2,3)').value.number) // 6

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

Call `dispose()` when the workbook leaves scope. JavaScript garbage collection also finalizes a handle the caller missed, but only as a fallback.

Choose Native Node when:

- your deployment can install a platform-specific `.node` binary,
- large workbooks make WASM heap copies or the 32-bit address space a constraint,
- you want the parallel scheduler without browser isolation constraints.

Choose WASM when you need a browser, no native addon, or one of the WASM-only methods below.

## API surface

Native Node has the Workbook methods and enums documented in [WASM API](/api/wasm#main-workbook-methods), with the same result envelopes and value semantics. Instead of a factory-returned `Module`, the package exports `Workbook` and the module functions by name: `evalFormula`, `version`, `versionString`, `errorDisplayName`, `statusString`, `lastErrorMessage`, `lastErrorContext`, `setLogMinLevel`, `setLogSink`, and `mergeFunctionMetadata`. The staged `index.d.ts` is the authoritative declaration file.

| Difference | WASM | Native Node |
| --- | --- | --- |
| Release a workbook | `delete()` | `dispose()`; GC finalizes as a fallback |
| Memory estimate | — | `memoryUsage()` |
| Table authoring | `createTable`, `updateTable`, `removeTable` | — (`tableCount` / `tableAt` only) |
| Worksheet AutoFilter XML | `getSheetAutoFilterXml`, `setSheetAutoFilterXml` | — (typed AutoFilter methods only) |
| Named-style XF records | `addCellStyleXf` | — (`setCellStyle` is available) |
| Failed `loadBytes()` | `isValid()` is `false` | `isValid()` is `false`; later calls return `kBindingInvalidHandle` |

`memoryUsage()` estimates the bytes held by cells, shared strings, passthrough parts, and workbook metadata; it is not an allocation ledger. Each call also refreshes the external-memory figure reported to V8, so the garbage collector sees large native workbooks; after `dispose()` it returns `0`.

## Read next

- [Surface matrix](/api/surfaces) — what each binding currently exposes.
- [Workbook operations](/workbook/operations) — what the shared workbook API can do.
