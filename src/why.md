# Why Formulon

Formulon is for products that need spreadsheet calculation without embedding Excel. It gives you one C++17 engine and packages that same engine for WebAssembly, Python, native command-line workflows, direct native embedding, and AI agents through [`@libraz/formulon-mcp`](/mcp/).

<DiagramLayers :layers="[
  { title: 'Core', nodes: ['One C++17 calculation engine'] },
  { title: 'Surfaces', nodes: [
    { label: '@libraz/formulon', note: 'WASM · browser & Node' },
    { label: 'packages/npm-native', note: 'Native Node addon' },
    { label: 'formulon (PyPI)', note: 'Python' },
    { label: 'CLI', note: 'shell & CI' },
    { label: '@libraz/formulon-mcp', note: 'AI agents' }
  ] }
]" label="One C++17 core packaged as WASM, Native Node, Python, CLI, and MCP" />

Compatibility is measured, not claimed. Results are checked against values captured from real Excel 365 (oracle data), and each known difference is listed in `tests/divergence.yaml` with its reason and the Excel build it was last verified on. New workbooks use the `win-365-en_US` behavior profile unless you select another. [How far compatibility goes](/compatibility/edge-cases) shows concrete cases, from floating-point residue to Japanese era dates, run live against the captured Excel values.

## What it solves

- Run `.xlsx` and `.xlsb` workbooks in services, jobs, and notebooks.
- Evaluate Excel formulas inside a browser or worker.
- Get the result Excel gives in a specific locale: 28 profiles cover fourteen locales on Mac and Windows hosts.
- Keep browser, Python, CLI, Native Node, and MCP results aligned because they share one core.
- Preserve supported workbook structures while recalculating values.
- Audit formula behavior against versioned oracle data.
- Let AI agents edit workbooks through validated MCP tools, with filesystem permissions controlled by the host.

## What it does not try to solve

Formulon is not a spreadsheet UI, chart renderer, VBA runtime, Power Query/DAX engine, or legacy `.xls` implementation. Those boundaries keep the calculation engine small, testable, and embeddable.

## Current status

Formulon is pre-1.0, and APIs and package layout may still change before the first stable release. Of 526 recognized function names, 511 run locally; service-backed functions such as `COPILOT`, `PY`, and `WEBSERVICE` are recognized but return a fixed error instead of calling Microsoft 365 services. Validate business-critical workbooks with fixtures against the Excel profile you target.
