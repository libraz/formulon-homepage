# Workbook Lifecycle

Most Formulon integrations follow the same lifecycle: open bytes, mutate, recalculate, read or save. Knowing where each step happens helps separate calculation responsibilities from IO, UI, and persistence.

<DiagramFlow steps="Open workbook bytes → Parse workbook model → Apply edits → Build/update dependency graph → Recalculate → Read values or save bytes" />

::: info Glossary: workbook model
The in-memory representation of a workbook after parsing — sheets, cells, styles, defined names, tables, and the engine state that drives recalculation. Host APIs operate on this model rather than on raw file bytes.
:::

## Open

The file-format layer reads workbook parts, relationships, shared strings, styles, worksheets, defined names, tables, comments, hyperlinks, merges, validations, conditional formats, pivot caches, external-link tables, and supported extension structures. Unparsed but expected parts are kept as passthrough so the file round-trips cleanly.

Data validations now expose the dropdown-visibility flag (`show_dropdown`). OOXML stores that flag with inverted `showDropDown` semantics; Formulon normalizes it for host APIs and writes the correct package representation back out.

Loaded XLSB pivot cache definitions, cache records, and pivot-table parts enter the same model used by the OOXML reader when their record encoding is supported, so `recalc()` can evaluate the pivot instead of dropping it. Phonetic annotations retain the UTF-16 span of each `<rPh>` run, and external-link tables retain the supporting-book index used by formulas such as `[1]Sheet1!A1`. Those external references resolve from cached values; they are not refreshed by the lifecycle.

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

When edits have been applied, calling `recalc()` (or `partialRecalc()` for incremental work) brings cached values back in sync with formulas. See [Recalculation](/workbook/recalculation) for dirty-set behavior, volatile functions, and iterative calculation.

## Read or save

After recalculation, the host can either read calculated values directly:

```ts
const result = wb.getValue(0, 0, 0) // sheet 0, row 0, col 0
if (!result.status.ok) throw new Error(result.status.message)
const value = result.value
```

…or save the entire workbook back to bytes:

```ts
const saved = wb.save()
if (!saved.status.ok || saved.bytes === null) {
  throw new Error(saved.status.message)
}
```

Saved bytes contain coherent formula / cached-value pairs, so downstream consumers that do not run a calculation engine still see correct values.

## Threading and reuse

The recalculation engine itself uses pthread workers in the WASM build. A `Workbook` handle is **not safe to share across threads or workers**. If a host needs concurrent recalculation, give each worker its own `Workbook` instance — there is no shared state to synchronize because there is no sharing:

<DiagramLayers :layers="[
  { title: 'Workers', nodes: ['Worker 1', 'Worker 2', 'Worker N'] },
  { title: 'Handles', nodes: ['Workbook A', 'Workbook B', 'Workbook N'] }
]" label="Each worker owns an independent Workbook handle; no handle is shared across workers" />

## Read next

- [Workbook operations](/workbook/operations) — sheets, cells, structures.
- [Recalculation](/workbook/recalculation) — the inner work between edit and read.
- [Lifecycle errors](/start/troubleshooting) — common failure messages and fixes.
