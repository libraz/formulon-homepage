# Choose a Surface

Formulon exposes the same core through several packaging surfaces.

::: info Same engine, different host contracts
Runtime choice affects packaging, memory lifetime, deployment, and error reporting. It should not change spreadsheet semantics.
:::

| Surface | Best for | Package |
| --- | --- | --- |
| WebAssembly | Browser apps, workers, Node services | `@libraz/formulon` |
| Native Node | Node services that want a `.node` addon | `@libraz/formulon-native` |
| Python | Notebooks, batch jobs, data pipelines | `formulon` |
| CLI | Shell scripts, CI checks, workbook inspection | GitHub Releases |
| C ABI | Host applications and custom bindings | repository build |

Pick the highest-level surface that fits your deployment. Drop to the C ABI only when you need a binding that is not already packaged.

## Decision guide

```mermaid
flowchart TD
  Q1{Where does it run?}
  Q1 -->|Browser| WASM[WASM<br/>@libraz/formulon]
  Q1 -->|Server / job| Q2{Language?}
  Q1 -->|Shell / CI| CLI[CLI<br/>GitHub Releases]
  Q1 -->|Agent / LLM| MCP[MCP server<br/>formulon-mcp]
  Q2 -->|Python| PY[Python<br/>formulon]
  Q2 -->|Node| Q3{Native install OK?}
  Q2 -->|Other| ABI[C ABI<br/>repository build]
  Q3 -->|Yes| NN[Native Node<br/>formulon-native]
  Q3 -->|No| WASM
```

| Requirement | Recommended surface |
| --- | --- |
| Browser upload, local preview, worker-side recalculation | WASM |
| Node service with no native install assumptions | WASM |
| Node service with large workbooks and native deployment | Native Node |
| Batch job or notebook | Python |
| CI workbook snapshots | CLI |
| New language binding | C ABI |

All surfaces share the same engine. Differences should be about packaging, lifetime management, and host error reporting, not formula semantics.
