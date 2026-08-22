# Package Surfaces

| Surface | Package | Runtime |
| --- | --- | --- |
| JavaScript / WASM | `@libraz/formulon` | Browser, worker, Node |
| Native Node | `@libraz/formulon-native` | Node.js N-API addon; prebuilt binaries ship for darwin-arm64/linux-x64/linux-arm64 (or build from a source checkout) |
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
      { label: 'Python (formulon)', note: 'array + CF evaluation, comments, pagination' },
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
| Python | broad workbook API | wasmtime-backed wrapper, context-manager workbook lifecycle |
| CLI | focused tools | `eval`, `recalc`, `dump`, `paginate` |
| Native Node | shared calculation API | Shared Workbook methods through a native N-API addon, including phonetic guides, iterative read-back, three-state visibility, print authoring, range XF assignment, and cache-index pivot items; table authoring, AutoFilter XML, and cell-style authoring remain WASM-only |
| C ABI | binding contract | Stable low-level contract for packaged surfaces |
| MCP | agent-facing surface | Built on top of WASM; allowlisted method dispatch |
| `formulon-cell` | reference UI | Public integration-test and example surface, not a complete Excel-compatible UI |

::: info Python parity boundary
Python has broad workbook parity, including whole-array `evaluate_formula_array()`, conditional-format `evaluate_cf_formula()`, phonetic text get/set, comment enumeration (`comment_count()` / `get_comments()`), `paginate()`, iterative-settings read-back, three-state sheet visibility, typed print-setting authoring, range XF assignment, and cache-index pivot items. Explicit omissions are the general scalar `evaluate_formula_text()` and the iterative-progress callback; Python does not mirror every C ABI entry point.
:::

Python also exposes visual conditional-format payloads, DXFs, pivot report layout, pivot-cache worksheet-source access, and the same `allow_blank=False` default for omitted data-validation input.

## When surfaces disagree

If two surfaces produce different values for the same workbook and the same profile, treat it as a bug or a documented compatibility gap. The parity runner under `make parity-test` exercises shared fixtures across available channels and reports both *missing* and *mismatched* results. Shared calculation methods use the same result envelopes and value semantics across Native Node and WASM; the remaining method differences are the explicit WASM-only authoring groups listed above. Other differences are operational, such as native threads, copy costs, and the WASM memory ceiling.

## Read next

- [WASM API](/api/wasm) — JavaScript surface.
- [Python API](/api/python) — top-level wrapper.
- [CLI reference](/api/cli) — command surface.
- [Choose a surface](/start/choose-runtime) — decision guide.
