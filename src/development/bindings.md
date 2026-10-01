# Bindings

Bindings expose workbook operations to host environments while keeping calculation in the core. Each binding adapts host types and operations, then calls the C ABI.

::: info Glossary: binding
A thin per-host layer that translates host types (`Uint8Array`, `bytes`, `bytearray`, byte pointer + length) into engine inputs and engine outputs back into host types. Bindings do not implement formula semantics — they shape data and manage lifetimes.
:::

<DiagramLayers :layers="[
  { title: 'Host types', nodes: ['Uint8Array / Buffer', 'bytes / bytearray', 'byte pointer + length', 'JSON inputs'] },
  { title: 'Bindings', nodes: ['WASM', 'Native Node', 'Python', 'CLI', 'MCP'] },
  { title: 'Boundary', nodes: ['C ABI (compatibility boundary)'] },
  { title: 'Core', nodes: ['C++17 core — parser / evaluator / calc graph / file IO'] }
]" />

## Responsibilities

- Convert host buffers to workbook bytes accepted by the C ABI.
- Manage workbook handles and lifetimes (`delete()` in WASM, context manager in Python, `dispose()` plus GC fallback in Native Node, CLI process lifetime, MCP session lifetime).
- Convert spreadsheet values to host values, preserving `ValueKind` so cell errors remain values rather than exceptions.
- Surface calculation and IO errors without losing spreadsheet error values.
- Expose the function and structural API documented under [API](/api/) per host.

## Non-responsibilities

Bindings should not:

- implement formula semantics (the parser / evaluator lives in the core),
- duplicate workbook parsing (the OOXML / XLSB readers live in the core),
- add profile-specific behavior (profiles are workbook state, set through the C ABI),
- introduce a separate dirty-set, dependency graph, or recalc scheduler (all of those belong to the core).

::: warning Don't reimplement Excel in the binding
If a binding is tempted to special-case a function result or coerce a value differently than the core, the right fix is in the core: add the case to the evaluator, add an oracle golden, and let every binding pick up the change at once. Per-binding patches drift fast.
:::

The npm WASM binding publishes a single-threaded `@libraz/formulon` entry and a pthread `@libraz/formulon/threads` entry. They share the C ABI, workbook API, and TypeScript declarations; only the pthread entry supports worker-based parallel recalculation.

## What this looks like in practice

| Binding | Host idioms it handles | What it never touches |
| --- | --- | --- |
| WASM | `Uint8Array`, status-bearing return values, `ValueKind` enum, async module factory, serial or pthread entry selection | Function semantics, file parsing, calculation graph |
| Native Node | N-API `Buffer`, sync API shape, `dispose()` and `memoryUsage()` | Function semantics, file parsing, calculation graph |
| Python | `bytes`, context manager, `FormulonError`, `Value.to_python()` | Function semantics, file parsing, calculation graph |
| CLI | `argv`, stdin / stdout / stderr, exit codes | Function semantics, file parsing, calculation graph |
| MCP | JSON inputs / outputs, session map, allowlist dispatch | Function semantics, file parsing, calculation graph |

## Read next

- [Architecture](/development/architecture) — the binding layer in context.
- [C++ core](/development/core) — what the bindings are calling into.
- [Surface matrix](/api/surfaces) — what each binding exposes today.
