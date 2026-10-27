# Workbook Lifecycle

Most Formulon integrations follow the same lifecycle: open bytes, mutate, recalculate, read or save. Knowing where each step happens helps separate calculation responsibilities from IO, UI, and persistence.

<DiagramFlow :steps="[
  { label: 'Open workbook bytes', note: 'XLSX or XLSB, sniffed from content' },
  { label: 'Parse workbook model', note: 'sheets · cells · styles · names' },
  { label: 'Apply edits', note: 'values, formulas, structure' },
  { label: 'Update dependency graph', note: 'forward and reverse edges' },
  { label: 'Recalculate', note: 'evaluates the dirty cells' },
  { label: 'Read or save', note: 'cached values, or bytes' }
]" label="Workbook lifecycle: open bytes, parse the model, apply edits, update the dependency graph, recalculate, then read values or save bytes" caption="Edits only mark cells dirty; values are current again only after the host recalculates." />

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

Load `.xlsx` or `.xlsb` bytes and check the handle before using it. The format is detected from the package contents, not from a file name:

::: code-group

```ts [WASM]
const wb = Module.Workbook.loadBytes(bytes)
if (!wb.isValid()) throw new Error(Module.lastErrorMessage())
```

```ts [Native Node]
import { lastErrorMessage, Workbook } from '@libraz/formulon-native'

const wb = Workbook.loadBytes(bytes)
if (!wb.isValid()) throw new Error(lastErrorMessage())
```

```python [Python]
with Workbook.load(blob) as wb:  # raises FormulonError on failure
    ...
```

:::

The reader builds the model from cells, formulas, styles, defined names, tables, comments, hyperlinks, merges, validations, conditional formats, pivot caches, and external-link tables. Parts it does not model are kept as passthrough bytes so the file round-trips. Loading computes nothing: a pivot cache is not rebuilt from its source range, and an external reference such as `[1]Sheet1!A1` reads the values cached in the file. Formulon never opens the source workbook or fetches a network target. See [File formats](/workbook/file-formats) for what each format preserves.

::: warning WASM workbook handles wrap native memory
WASM `Workbook` instances are *not* ordinary garbage-collected JS objects. They own C++ memory allocated inside the WASM heap and must be released with `wb.delete()` once you are done. Native Node releases its handle with `dispose()` or on garbage collection. Python's context manager and CLI processes handle this for you.
:::

## Edit

Cells, formulas, sheet structure, defined names, tables, styles, and many other workbook properties can be updated through the binding's surface. WASM, Native Node, and Python expose broad workbook APIs; the CLI does not edit cells directly and instead focuses on recalculation and inspection commands.

## Recalculate

When edits have been applied, calling `recalc()` brings all dirty cached values back in sync with formulas. `partialRecalc(viewport)` updates only the dirty formula cells needed for the requested output viewport and leaves unrelated dirty cells pending. See [Recalculation](/workbook/recalculation) for the dependency closure, volatile functions, and iterative calculation.

## Read or save

When every formula cache must be current, run a successful full `recalc()` before reading or saving. `save()` writes the current workbook state; it does not recalculate on its own, and a partial recalculation can leave unrelated formula caches stale. After a successful full recalculation, the host can read calculated values directly:

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

After a successful full recalculation, the saved bytes contain formula / cached-value pairs for downstream consumers that do not run a calculation engine.

## Threading and reuse

`recalc()` is serial on every surface. `recalcParallel(threadCount)` (WASM and Native Node) runs the same calculation on worker threads where the build has them: `threadCount` is `0` for automatic detection capped at 8, `1` for the caller thread only, or `2`–`8` for an explicit cap. Results match `recalc()` either way.

- The default `@libraz/formulon` WASM package is single-threaded and needs no cross-origin isolation. `recalcParallel()` still works there and reports `workerThreadsStarted: 0`. Import `@libraz/formulon/threads` for pthread workers; a browser deployment then needs COOP/COEP headers.
- `@libraz/formulon-native` is built with pthreads.
- Python recalculates serially.
- The CLI is serial unless `recalc` is given `--threads`.

A `Workbook` handle is **not safe to share across threads or workers**. If a host needs concurrent recalculation, give each worker its own `Workbook` instance:

<DiagramLayers :layers="[
  { title: 'Workers', nodes: [
      { label: 'Worker 1', note: 'owns one Workbook handle' },
      { label: 'Worker 2', note: 'owns one Workbook handle' },
      { label: 'Worker N', note: 'owns one Workbook handle' }
    ] },
  { title: 'Handles', nodes: [
      { label: 'Workbook A', note: 'used by one worker only' },
      { label: 'Workbook B', note: 'used by one worker only' },
      { label: 'Workbook N', note: 'used by one worker only' }
    ] }
]" label="Each worker owns an independent Workbook handle; no handle is shared across workers" caption="A Workbook handle is not safe to share across threads or workers, so concurrent recalculation needs one instance per worker." />

## Read next

- [Workbook operations](/workbook/operations) — sheets, cells, structures.
- [Recalculation](/workbook/recalculation) — the inner work between edit and read.
- [Lifecycle errors](/start/troubleshooting) — common failure messages and fixes.
