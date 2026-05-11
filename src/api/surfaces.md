# Package Surfaces

| Surface | Package | Runtime |
| --- | --- | --- |
| JavaScript / WASM | `@libraz/formulon` | Browser, worker, Node |
| Native Node | `@libraz/formulon-native` | Node.js N-API addon |
| Python | `formulon` | py3 wheel using wasmtime |
| CLI | `formulon-cli-<os>-<arch>` | Standalone binary |
| C ABI | headers and native library | Custom hosts |
| MCP | `@libraz/formulon-mcp` | stdio MCP server for agents |
| UI shell | `@libraz/formulon-cell` | Browser spreadsheet UI (beta) |

All surfaces should expose the same calculation core. Differences should be packaging differences, not semantic differences.

```mermaid
flowchart TB
  CORE[C++17 calculation core]
  ABI[C ABI<br/>headers + native library]
  CORE --> ABI
  ABI --> WASM[WASM<br/>@libraz/formulon]
  ABI --> NN[Native Node<br/>@libraz/formulon-native]
  ABI --> PY[Python<br/>formulon]
  ABI --> CLI[CLI<br/>formulon-cli-os-arch]
  WASM --> CELL[formulon-cell<br/>UI shell, beta]
  WASM --> MCP[formulon-mcp<br/>stdio agent server]
```

::: info Glossary: surface
A packaging boundary on top of the shared C++17 engine. Every surface speaks to the engine through the C ABI (directly or transitively). What changes between surfaces is host language, memory ownership, and IO style — never formula semantics.
:::

## Surface maturity

| Surface | Maturity | Notes |
| --- | --- | --- |
| WASM | broadest JS API | Full generated `formulon.d.ts`, browser and Node support |
| Python | stable subset | wasmtime-backed wrapper, context-manager workbook lifecycle |
| CLI | focused tools | `eval`, `recalc`, `dump` |
| Native Node | MVP subset | Faster native path, not yet full parity with WASM |
| C ABI | binding contract | Stable low-level contract for packaged surfaces |
| MCP | agent-facing surface | Built on top of WASM; allowlisted method dispatch |
| `formulon-cell` | beta UI | Demonstration host for the WASM engine |

## When surfaces disagree

If two surfaces produce different values for the same workbook and the same profile, treat it as a bug or a documented compatibility gap. The parity runner under `make parity-test` exercises shared fixtures across available channels and reports both *missing* and *mismatched* results.

## Read next

- [WASM API](/api/wasm) — JavaScript surface.
- [Python API](/api/python) — top-level wrapper.
- [CLI reference](/api/cli) — command surface.
- [Choose a surface](/start/choose-runtime) — decision guide.
