# Choose a Surface

Formulon exposes the same core through several packaging surfaces.

::: info Same engine, different host contracts
Surface choice affects packaging, memory lifetime, deployment, and error reporting. It should not change spreadsheet semantics.
:::

| Surface | Best for | Package |
| --- | --- | --- |
| WebAssembly | Browser apps, workers, Node services | `@libraz/formulon` |
| Native Node | Node services that can build or stage a `.node` addon | `packages/npm-native` |
| Python | Notebooks, batch jobs, data pipelines | `formulon` |
| CLI | Shell scripts, CI checks, workbook inspection | GitHub Releases |
| C ABI | Host applications and custom bindings | repository build |

Pick the highest-level surface that fits your deployment. Drop to the C ABI only when you need a binding that is not already packaged.

## Decision guide

<DiagramLayers
  :layers="[
    {
      title: 'Where does it run?',
      nodes: [
        { label: 'Browser', note: '→ WASM (@libraz/formulon)' },
        { label: 'Server / job', note: '→ next: which language?' },
        { label: 'Shell / CI', note: '→ CLI (GitHub Releases)' },
        { label: 'Agent / LLM', note: '→ MCP server (formulon-mcp)' }
      ]
    },
    {
      title: 'Server / job: which language?',
      nodes: [
        { label: 'Python', note: '→ Python (formulon)' },
        { label: 'Node', note: '→ next: native install OK?' },
        { label: 'Other', note: '→ C ABI (repository build)' }
      ]
    },
    {
      title: 'Node: native install OK?',
      nodes: [
        { label: 'Yes', note: '→ Native Node (packages/npm-native)' },
        { label: 'No', note: '→ WASM (@libraz/formulon)' }
      ]
    }
  ]"
  label="Decision guide: which surface to use"
/>

| Requirement | Recommended surface |
| --- | --- |
| Browser upload, local preview, worker-side recalculation | WASM |
| Node service with no native install assumptions | WASM |
| Node service with large workbooks and native deployment | Native Node |
| Batch job or notebook | Python |
| CI workbook snapshots | CLI |
| New language binding | C ABI |

All surfaces share the same engine. Differences should be about packaging, lifetime management, and host error reporting, not formula semantics.
