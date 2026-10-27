# Start

Formulon is a headless spreadsheet calculation engine. Choose where it will run, verify the installation with a small formula, then test a representative workbook.

::: tip New to spreadsheet engines?
[Basic concepts](/start/concepts) explains the three products, cell coordinates, and the difference between formulas, calculated values, and display text. Use the [glossary](/glossary) when a guide introduces an unfamiliar term.
:::

## Recommended path

<DiagramFlow
  :steps="[
    { label: 'Choose a surface', note: 'WASM, Python, CLI, MCP and more' },
    { label: 'Install', note: 'The package for that surface' },
    { label: 'Evaluate one formula', note: 'Confirms the package loads' },
    { label: 'Recalculate one workbook', note: 'A representative file' },
    { label: 'Compare with Excel', note: 'If it differs, check compatibility' },
    { label: 'Move to a use case', note: 'Pick the matching scenario page' }
  ]"
  label="Recommended path: choose a surface, install, evaluate one formula, recalculate one workbook, compare the result with Excel, then move to a use case"
  caption="Prove the install with one formula, then prove the fit with a real workbook, before building a use case on it."
/>

1. [Choose a surface](/start/choose-runtime) and install its package.
2. Run one formula through Formulon.
3. Recalculate one workbook.
4. If the result differs from Excel, check [Formula coverage](/compatibility/formula-coverage), [File format support](/compatibility/file-format-support), and [Error model](/compatibility/errors).
5. Move to a concrete [Use case](/scenarios/).

## First tasks

| Task | Page |
| --- | --- |
| Learn the workbook model and the roles of the three products | [Basic concepts](/start/concepts) |
| Pick WASM, Python, Native Node, CLI, MCP, or C ABI | [Choose a surface](/start/choose-runtime) |
| Install packages | [Install](/start/install) |
| Evaluate a single formula | [Evaluate a formula](/start/evaluate) |
| Recalculate a workbook | [Recalculate a workbook](/start/recalculate) |
| Fix common integration failures | [Troubleshooting](/start/troubleshooting) |
| Start from a concrete workflow | [Scenarios](/scenarios/) |

## Product-specific reading order

After the first run, read by concern:

- Runtime integration: [WASM](/runtimes/wasm), [Python](/runtimes/python), [Native Node](/runtimes/node-native), [CLI](/runtimes/cli)
- Workbook behavior: [Lifecycle](/workbook/lifecycle), [Formula engine](/workbook/formula-engine), [Recalculation](/workbook/recalculation)
- Compatibility: [Formula coverage](/compatibility/formula-coverage), [File format support](/compatibility/file-format-support), [Error model](/compatibility/errors)
- API details: [Surface matrix](/api/surfaces), [WASM API](/api/wasm), [Python API](/api/python), [CLI reference](/api/cli)
