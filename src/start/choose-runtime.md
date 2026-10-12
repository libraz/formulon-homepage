# Choose a Surface

Formulon packages the same C++ core for several hosts. Each package is a *surface*: the API and distribution format one host sees.

::: info Same engine, different host contracts
The surface decides packaging, memory lifetime, deployment, and how host errors are reported. Formula results come from the shared core; where exact agreement matters, check it with the same engine version, profile and workbook on each surface you ship.
:::

| Surface | Best for | Package |
| --- | --- | --- |
| WebAssembly | Browser apps, workers, Node services | `@libraz/formulon` |
| Native Node | Node services that can build or stage a `.node` addon | `packages/npm-native` (source checkout) |
| Python | Notebooks, batch jobs, data pipelines | `formulon` |
| CLI | Shell scripts, CI checks, workbook inspection | GitHub Releases |
| MCP | AI agents that open, edit and save workbooks | `@libraz/formulon-mcp` |
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
| AI agent editing workbooks | MCP |
| New language binding | C ABI |
