# Package Surfaces

| Surface | Package | Runtime |
| --- | --- | --- |
| JavaScript / WASM | `@libraz/formulon` | Browser, worker, Node |
| Native Node | `@libraz/formulon-native` | Node.js N-API addon. Not published to npm; build it from a source checkout ([Native Node](/runtimes/node-native)). Release CI builds darwin-arm64, linux-x64, and linux-arm64 |
| Python | `formulon` | `py3-none-any` wheel run by `wasmtime` |
| CLI | `formulon-<version>-<os>-<arch>.tar.gz` on GitHub Releases | Standalone `formulon` binary for darwin-arm64, linux-x64, linux-arm64 |
| C ABI | `src/c_api/formulon_c.h` + `formulon_static` (or shared `formulon`) | Custom hosts, built from source |
| MCP | `@libraz/formulon-mcp` | stdio MCP server for agents |
| Spreadsheet UI | `@libraz/formulon-cell` | Browser spreadsheet UI kit |

All surfaces use the same calculation core. They differ in packaging, host language, memory ownership, and the method differences listed [below](#method-differences).

<DiagramLayers label="C++17 calculation core -> C ABI -> WASM / Native Node / Python / CLI; WASM -> formulon-cell and formulon-mcp" :layers="[
  { title: 'Core', nodes: ['C++17 calculation core'] },
  { title: 'C ABI', nodes: ['formulon_c.h + core library'] },
  { title: 'Surfaces', nodes: [
      'WASM (@libraz/formulon)',
      'Native Node (packages/npm-native)',
      'Python (formulon)',
      'CLI (formulon)'
    ]
  },
  { title: 'Built on WASM', nodes: ['formulon-cell (UI kit)', 'formulon-mcp (stdio agent server)'] }
]" />

`formulon-cell` and `formulon-mcp` are built specifically on the WASM package, not directly on the C ABI — they reach the calculation core the same way any browser or Node consumer of `@libraz/formulon` does.

::: info Glossary: surface
A packaging boundary on top of the shared C++17 engine. Every surface speaks to the engine through the C ABI (directly or transitively). Host language, memory ownership, IO style, and documented compatibility boundaries can differ between surfaces; the shared core defines the common formula behavior.
:::

## Surface maturity

| Surface | Maturity | Notes |
| --- | --- | --- |
| WASM | broadest JS API | Generated `formulon.d.ts`; browser, worker, and Node |
| Python | broad workbook API | `wasmtime`-backed wrapper; `with` block releases the workbook |
| CLI | focused tools | `eval`, `recalc`, `dump`, `paginate` |
| Native Node | WASM method set, native binary | Same result envelopes and value semantics as WASM, minus the rows marked below |
| C ABI | binding contract | Every entry point the other surfaces wrap |
| MCP | agent-facing surface | Built on top of WASM; allowlisted method dispatch |
| `formulon-cell` | UI kit | Embeddable spreadsheet surface with TypeScript, React, and Vue entrypoints |

## Method differences

The three library bindings share the workbook model, geometry, themes and styles, typed AutoFilters, validation, comments, images, PivotTables, print settings, and profile helpers. These are the rows where they differ:

| Capability | WASM | Native Node | Python |
| --- | --- | --- | --- |
| Release a workbook | `delete()`; throws `TypeError` during an active method call | `dispose()` (GC finalizer as fallback); throws `TypeError` during an active method call | `close()` or a `with` block |
| Memory estimate | — | `memoryUsage()` | `memory_usage()` |
| Parallel recalc | `recalcParallel()`; workers only on `@libraz/formulon/threads` | `recalcParallel()` | — |
| Scalar read-only evaluation | `evaluateFormulaText()` | `evaluateFormulaText()` | — (use `evaluate_formula_array()`) |
| Iterative-progress callback | `setIterativeProgress()` | `setIterativeProgress()` | — |
| Log sink | `setLogSink()` | `setLogSink()` | — (`set_log_min_level()` only) |
| Table authoring | `createTable()` / `updateTable()` / `removeTable()` | — | `table_create()` / `table_update()` / `table_remove()` |
| Worksheet AutoFilter XML | `getSheetAutoFilterXml()` / `setSheetAutoFilterXml()` | — | `get_auto_filter_xml()` / `set_auto_filter_xml()` |
| Named-style XF records | `addCellStyleXf()` | — | `add_cell_style_xf()` |
| Bulk style registration, enable-only iterative toggle | — | — | `add_batch()`, `set_iterative_enabled()` |

Argument contracts are the same across the bindings. Both JS packages check every positional argument before any engine call: a missing argument, a wrong type, or a primitive or `null` where an object is declared throws `TypeError`, and neither package substitutes defaults. A malformed argument that a method reports through its status returns `kInvalidArgument` (2) on both. The `@libraz/formulon-native` TypeScript declarations use the same enum types as `@libraz/formulon` (`PivotAxis`, `PivotAggregation`, `PivotSortOrder`, and the rest), so code written against one package's types compiles against the other's. Python validates `Value` payloads (`ValueError` or `TypeError`) and range-checks integer arguments (`ValueError`). The C ABI rejects ill-formed UTF-8 with `kBindingUtf8EncodingError` (7002) and range-checks index, count, and outline-level arguments; every binding surfaces those statuses. Public C records have fixed layouts, so a native client must be recompiled against the header it links.

The CLI exposes a fixed subset: `--threads` for parallel recalc, `--iterative`, and the four subcommands.

## When surfaces disagree

If two surfaces produce different values for the same workbook and the same profile, treat it as a bug or a documented compatibility gap. The repository's `make parity-test` runner evaluates shared fixtures through the CLI, the npm WASM package, and the Python wheel, and reports channels that were not built separately from mismatched values. Other differences are operational, such as native threads, copy costs, and the WASM memory ceiling.

## Read next

- [WASM API](/api/wasm) — JavaScript surface.
- [Python API](/api/python) — top-level wrapper.
- [CLI reference](/api/cli) — command surface.
- [Choose a surface](/start/choose-runtime) — decision guide.
