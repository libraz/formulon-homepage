# Choose a Surface

Formulon packages the same C++ core for several hosts. Each package is a *surface*: the API and distribution format one host sees.

::: info Same engine, different host contracts
The surface decides packaging, memory lifetime, deployment, and how host errors are reported. Formula results come from the shared core; where exact agreement matters, check it with the same engine version, profile and workbook on each surface you ship.
:::

| Surface | Best for | Package |
| --- | --- | --- |
| WebAssembly | Browser apps, workers, Node services | `@libraz/formulon` |
| Native Node | Node services that can build or stage a `.node` addon | `@libraz/formulon-native` (built from a source checkout, not on npm) |
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
        { label: 'Browser', note: 'WASM, @libraz/formulon' },
        { label: 'Server / job', note: 'Choose by language, below' },
        { label: 'Shell / CI', note: 'CLI, from GitHub Releases' },
        { label: 'Agent / LLM', note: 'MCP, @libraz/formulon-mcp' }
      ]
    },
    {
      title: 'Server / job: which language?',
      nodes: [
        { label: 'Python', note: 'Python package: formulon' },
        { label: 'Node', note: 'Native Node or WASM, below' },
        { label: 'Other', note: 'C ABI, built from the repository' }
      ]
    },
    {
      title: 'Node: can you build or stage a .node addon?',
      nodes: [
        { label: '@libraz/formulon-native', note: 'Yes. Not on npm; built from source' },
        { label: '@libraz/formulon', note: 'No. WASM, no native build step' }
      ]
    }
  ]"
  label="Decision guide: browsers use WASM, shells and CI use the CLI, agents use MCP; server jobs choose by language, and Node chooses Native Node or WASM depending on whether a native addon can be built"
  caption="A Node service uses Native Node only when a .node addon can be built or staged; otherwise WASM covers it."
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
