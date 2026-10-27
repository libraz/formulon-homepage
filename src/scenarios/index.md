# Scenarios

These pages show how Formulon fits into concrete workflows. Each scenario uses a different runtime or product — pick the one closest to your deployment, then read the matching [Runtime](/runtimes/) page for setup details.

::: info Start with a real workbook
After the one-formula quick start, test one representative workbook as early as possible. Spreadsheet engines fail or succeed on workbook details, not only on isolated formulas.
:::

<DiagramLayers
  :layers="[
    { title: 'Where the workbook arrives', nodes: [
      { label: 'Browser upload', note: 'WASM, file stays on the device' },
      { label: 'Upload API / service', note: 'Native Node or WASM' },
      { label: 'Scheduled job / notebook', note: 'Python' },
      { label: 'Pull request', note: 'CLI snapshots in CI' },
      { label: 'AI agent', note: 'formulon-mcp tools', tone: 'alt' },
      { label: 'Spreadsheet UI in a web app', note: 'formulon-cell (beta)', tone: 'alt' }
    ] },
    { title: 'Shared engine', nodes: [{ label: 'One C++17 core', note: 'load → mutate → recalc → save' }] }
  ]"
  label="Six ways a workbook reaches Formulon: browser upload on WASM, an upload API or service on Native Node or WASM, a scheduled job or notebook on Python, a pull request through CLI snapshots, an AI agent through formulon-mcp, and a spreadsheet UI through formulon-cell. All six run the same C++17 core."
  caption="Each scenario differs in where the bytes come from and go; the calculation is the same core."
/>

| Scenario | Runtime | Goal |
| --- | --- | --- |
| [Browser workbook upload](/scenarios/browser-upload) | WASM | Recalculate a user-uploaded `.xlsx` without sending it to a server |
| [Node service recalculation](/scenarios/node-service) | Native Node / WASM | Recalculate uploaded or internally generated workbooks behind an API |
| [Python batch recalculation](/scenarios/python-batch) | Python | Recalculate reports or models in jobs and notebooks |
| [CI workbook regression](/scenarios/ci-regression) | CLI | Detect formula and value drift in automated checks |
| [Agent workbook editing](/mcp/) | MCP | Let AI agents open, edit, recalculate, and save `.xlsx` or `.xlsb` through `formulon-mcp` |
| [Spreadsheet UI in a web app](/cell/) | formulon-cell (WASM) | Show and edit a workbook inside your own page; beta, evaluate before shipping to end users |

## What the scenarios share

Every scenario follows the same `load → mutate → recalc → save` lifecycle described in [Workbook lifecycle](/workbook/lifecycle). What changes between them is:

- where the bytes come from (`File`, file system, IO stream, MCP tool input),
- where the bytes go (`save()` result, written file, returned `bytes` field),
- which runtime owns memory and IO,
- how errors cross the host boundary.

## Compatibility gate

Before adopting any scenario, inspect the workbook's formulas and decide how to handle external-service functions. Formulon has **511 real implementations among 526 recognized names**, including the environment-bound `CELL` and `INFO`; the remaining 15 are deliberate unavailable service stubs such as `COPILOT`, `PY`, `IMAGE`, `WEBSERVICE`, `STOCKHISTORY`, `RTD`, and CUBE connection functions. Treat those as product decisions: reject the workbook, show a compatibility warning, or route it to an Excel-backed workflow.

For runtime-specific setup, see [Runtimes](/runtimes/). For the engine-side flow, see [Workbook lifecycle](/workbook/lifecycle).
