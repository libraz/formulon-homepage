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

The project optimizes for reproducible compatibility. The default behavior profile is `win-365-ja_JP`; goldens record observed Excel behavior, and accepted divergences are tracked explicitly instead of being hidden behind vague "Excel-like" claims.

## What it solves

- Run `.xlsx` and `.xlsb` workbooks in services, jobs, and notebooks.
- Evaluate Excel formulas inside a browser or worker.
- Keep browser, Python, CLI, Native Node, and MCP results aligned because they share one core.
- Preserve workbook structure while recalculating values.
- Audit formula behavior against versioned oracle data.
- Let AI agents edit workbooks safely through `@libraz/formulon-mcp`.

## What it does not try to solve

Formulon is not a spreadsheet UI, chart renderer, VBA runtime, PowerQuery/DAX engine, or legacy `.xls` implementation. Those boundaries keep the calculation engine small, testable, and embeddable.

## Current status

Formulon is under active development and is not yet production-ready. The formula engine has broad local coverage and explicitly marks service-backed functions such as `COPILOT`, `PY`, and `WEBSERVICE` as unavailable service stubs rather than pretending to implement the corresponding Microsoft 365 services. APIs and package layout may still change before the first stable release. Validate business-critical workbooks with fixtures against the Excel profile you target.
