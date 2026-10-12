# Workbook Lifecycle

Most Formulon integrations follow the same lifecycle: open bytes, mutate, recalculate, read or save. Knowing where each step happens helps separate calculation responsibilities from IO, UI, and persistence.

<DiagramFlow steps="Open workbook bytes → Parse workbook model → Apply edits → Build/update dependency graph → Recalculate → Read values or save bytes" />

::: info Glossary: workbook model
The in-memory representation of a workbook after parsing — sheets, cells, styles, defined names, tables, and the engine state that drives recalculation. Host APIs operate on this model rather than on raw file bytes.
:::

## Create a profile-shaped workbook

`createDefault()` / `create_default()` creates one `Sheet1` with the default runtime profile `win-365-en_US`. To start with the locale-specific template Excel uses for a new workbook, call `createForProfile(profileId)` in WASM or Native Node, or `create_for_profile(profile_id)` in Python. The factory sets the profile, body font, localized Normal style and first sheet names, page margins, and Mac row and base-column metrics. CJK locales also receive a phonetic font and vertically centred Normal style. Mac defaults are measured; Windows defaults are estimates. No theme part is created, so the engine resolves the default Office theme.

::: code-group

```ts [WASM]
// Module is initialized with await createFormulon().
const wb = Module.Workbook.createForProfile('mac-365-ja_JP')
try {
  if (!wb.isValid()) throw new Error(Module.lastErrorMessage())
  console.log(wb.excelProfileId().value, wb.getFont(0).name)
} finally {
  wb.delete()
}
```

```ts [Native Node]
import { Workbook } from '@libraz/formulon-native'

const wb = Workbook.createForProfile('mac-365-ja_JP')
try {
  console.log(wb.excelProfileId().value, wb.getFont(0).name)
} finally {
  wb.dispose()
}
```

```python [Python]
from formulon import Workbook

with Workbook.create_for_profile("mac-365-ja_JP") as wb:
    print(wb.excel_profile_id(), wb.get_font(0).name)
```

:::

`setExcelProfileId()` / `set_excel_profile_id()` on a loaded workbook changes the runtime calculation profile and dirties dependent state. It does not apply the new-workbook fonts, sheet names, margins, or other template defaults.

## Open

The file-format layer reads workbook parts, relationships, shared strings, styles, worksheets, defined names, tables, comments, hyperlinks, merges, validations, conditional formats, pivot caches, external-link tables, and supported extension structures. Unparsed but expected parts are kept as passthrough so the file round-trips cleanly.

Data validations now expose the dropdown-visibility flag (`show_dropdown`). OOXML stores that flag with inverted `showDropDown` semantics; Formulon normalizes it for host APIs and writes the correct package representation back out.

Loaded XLSB pivot-cache definitions, cache records, and pivot-table parts enter the same model used by the OOXML reader when their record encoding is supported. `pivotLayout()` and `GETPIVOTDATA` can aggregate or read supported cached records on demand; `recalc()` does not rebuild a pivot cache from worksheet source data. Phonetic annotations retain the UTF-16 span of each `<rPh>` run, and external-link tables retain the supporting-book index used by formulas such as `[1]Sheet1!A1`. Entered book-name and path references create or reuse those link records. External references resolve from cached values; the lifecycle does not open the source workbook, fetch a network target, or refresh the cache.

Verify the load before using the workbook:

```ts
const wb = Module.Workbook.loadBytes(bytes)
if (!wb.isValid()) {
  throw new Error(Module.lastErrorMessage())
}
```

```python
with Workbook.load(blob) as wb:
    ...
```

::: warning WASM workbook handles wrap native memory
WASM `Workbook` instances are *not* ordinary garbage-collected JS objects. They own C++ memory allocated inside the WASM heap and must be released with `wb.delete()` once you are done. Python's context manager and CLI processes handle this for you.
:::

## Edit

Cells, formulas, sheet structure, defined names, tables, styles, and many other workbook properties can be updated through the binding's surface. WASM, Native Node, and Python expose broad workbook APIs; the CLI does not edit cells directly and instead focuses on recalculation and inspection commands.

## Recalculate

When edits have been applied, calling `recalc()` brings all dirty cached values back in sync with formulas. `partialRecalc(viewport)` updates only the dirty formula cells needed for the requested output viewport and leaves unrelated dirty cells pending. See [Recalculation](/workbook/recalculation) for the dependency closure, volatile functions, and iterative calculation.

## Read or save

After recalculation, the host can either read calculated values directly:

::: code-group

```ts [WASM / Native Node]
const result = wb.getValue(0, 0, 0) // sheet 0, row 0, col 0
if (!result.status.ok) throw new Error(result.status.message)
const value = result.value
```

```python [Python]
with Workbook.load(blob) as wb:
    wb.recalc()
    value = wb.get_value(0, 0, 0)
    saved = wb.save()
```

:::

…or save the entire workbook back to bytes:

```ts
const saved = wb.save()
if (!saved.status.ok || saved.bytes === null) {
  throw new Error(saved.status.message)
}
```

Saved bytes contain coherent formula / cached-value pairs, so downstream consumers that do not run a calculation engine still see correct values.

## Threading and reuse

The default `@libraz/formulon` WASM package is single-threaded and does not require cross-origin isolation. Its `recalc()` is serial, and `recalcParallel()` remains a valid serial fallback with `workerThreadsStarted: 0`. To enable pthread workers, import `@libraz/formulon/threads`; a browser deployment then needs COOP/COEP headers. Python uses the serial path, while the native CLI is serial by default and opts into threads with `--threads`. A `Workbook` handle is **not safe to share across threads or workers**. If a host needs concurrent recalculation, give each worker its own `Workbook` instance:

<DiagramLayers :layers="[
  { title: 'Workers', nodes: ['Worker 1', 'Worker 2', 'Worker N'] },
  { title: 'Handles', nodes: ['Workbook A', 'Workbook B', 'Workbook N'] }
]" label="Each worker owns an independent Workbook handle; no handle is shared across workers" />

## Read next

- [Workbook operations](/workbook/operations) — sheets, cells, structures.
- [Recalculation](/workbook/recalculation) — the inner work between edit and read.
- [Lifecycle errors](/start/troubleshooting) — common failure messages and fixes.
