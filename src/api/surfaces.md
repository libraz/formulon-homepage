# Package Surfaces

| Surface | Package | Runtime |
| --- | --- | --- |
| JavaScript / WASM | `@libraz/formulon` | Browser, worker, Node |
| Native Node | `packages/npm-native` | Node.js N-API addon from a source checkout |
| Python | `formulon` | py3 wheel using wasmtime |
| CLI | `formulon-cli-<os>-<arch>` | Standalone binary |
| C ABI | headers and native library | Custom hosts |
| MCP | `@libraz/formulon-mcp` | stdio MCP server for agents |
| Reference UI | `@libraz/formulon-cell` | Browser integration-test UI |

All surfaces should expose the same calculation core. Differences should be packaging differences, not semantic differences.

<DiagramLayers label="C++17 calculation core -> C ABI -> WASM / Native Node / Python / CLI; WASM -> formulon-cell and formulon-mcp" :layers="[
  { title: 'Core', nodes: ['C++17 calculation core'] },
  { title: 'C ABI', nodes: ['headers + native library'] },
  { title: 'Surfaces', nodes: [
      'WASM (@libraz/formulon)',
      'Native Node (packages/npm-native)',
      { label: 'Python (formulon)', note: 'no 0.9.4 ad-hoc eval / comment enumeration' },
      'CLI (formulon-cli-<os>-<arch>)'
    ]
  },
  { title: 'Built on WASM', nodes: ['formulon-cell (reference UI)', 'formulon-mcp (stdio agent server)'] }
]" />

`formulon-cell` and `formulon-mcp` are built specifically on the WASM package, not directly on the C ABI — they reach the calculation core the same way any browser or Node consumer of `@libraz/formulon` does.

::: info Glossary: surface
A packaging boundary on top of the shared C++17 engine. Every surface speaks to the engine through the C ABI (directly or transitively). What changes between surfaces is host language, memory ownership, and IO style — never formula semantics.
:::

## Surface maturity

| Surface | Maturity | Notes |
| --- | --- | --- |
| WASM | broadest JS API | Full generated `formulon.d.ts`, browser and Node support |
| Python | broad workbook API, but trailing WASM/Node on the newest additions | wasmtime-backed wrapper, context-manager workbook lifecycle |
| CLI | focused tools | `eval`, `recalc`, `dump` |
| Native Node | WASM-shaped API | Same Workbook surface as WASM, through a native N-API addon |
| C ABI | binding contract | Stable low-level contract for packaged surfaces |
| MCP | agent-facing surface | Built on top of WASM; allowlisted method dispatch |
| `formulon-cell` | reference UI | Public integration-test and example surface, not a complete Excel-compatible UI |

::: warning Python does not yet have the 0.9.4 additions
`evaluateFormulaText` / `evaluateConditionalFormula` (read-only ad-hoc evaluation) and sheet-wide comment enumeration exist on the C API, Native Node addon, and WASM only. Python's `Workbook` has no equivalent evaluation method, and only exposes singular `get_comment` / `set_comment` — there is no comment-enumeration call like Native Node's `getComments(sheet)` or the C API's `fm_sheet_get_comment_count` / `fm_sheet_get_comment_at_index`. Python's `add_conditional_format` also does not return the new rule index the other three surfaces gained in 0.9.4.
:::

## When surfaces disagree

If two surfaces produce different values for the same workbook and the same profile, treat it as a bug or a documented compatibility gap. The parity runner under `make parity-test` exercises shared fixtures across available channels and reports both *missing* and *mismatched* results. Native Node and WASM are expected to have the same result envelopes and Workbook method shape; their differences are operational, such as native threads, copy costs, and the WASM memory ceiling.

## Read next

- [WASM API](/api/wasm) — JavaScript surface.
- [Python API](/api/python) — top-level wrapper.
- [CLI reference](/api/cli) — command surface.
- [Choose a surface](/start/choose-runtime) — decision guide.
