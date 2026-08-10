# Scenarios

These pages show how Formulon fits into concrete workflows. Each scenario chooses a different runtime — pick the one closest to your deployment, then read the matching [Runtime](/runtimes/) page for setup details.

::: info Start with a real workbook
After the one-formula quick start, test one representative workbook as early as possible. Spreadsheet engines fail or succeed on workbook details, not only on isolated formulas.
:::

<DiagramLayers
  :layers="[
    { nodes: ['What kind of work?'] },
    { nodes: [
      { label: 'User uploads .xlsx in browser', note: 'Browser workbook upload · WASM' },
      { label: 'Upload API / internal service', note: 'Node service recalculation · Native Node / WASM' },
      { label: 'Scheduled job / notebook', note: 'Python batch recalculation · Python' },
      { label: 'Detect drift in PRs', note: 'CI workbook regression · CLI' },
      { label: 'AI agent edits workbooks', note: 'Agent workbook editing · MCP' }
    ] }
  ]"
  label="Choose a scenario by the kind of work: browser upload leads to Browser workbook upload on WASM; upload API or internal service leads to Node service recalculation on Native Node or WASM; scheduled job or notebook leads to Python batch recalculation on Python; detecting drift in PRs leads to CI workbook regression on the CLI; AI agent edits lead to Agent workbook editing on MCP"
/>

| Scenario | Runtime | Goal |
| --- | --- | --- |
| [Browser workbook upload](/scenarios/browser-upload) | WASM | Recalculate a user-uploaded `.xlsx` without sending it to a server |
| [Node service recalculation](/scenarios/node-service) | Native Node / WASM | Recalculate uploaded or internally generated workbooks behind an API |
| [Python batch recalculation](/scenarios/python-batch) | Python | Recalculate reports or models in jobs and notebooks |
| [CI workbook regression](/scenarios/ci-regression) | CLI | Detect formula and value drift in automated checks |
| [Agent workbook editing](/mcp/) | MCP | Let AI agents open, edit, recalculate, and save `.xlsx` through `formulon-mcp` |

## What the scenarios share

Every scenario follows the same `load → mutate → recalc → save` lifecycle described in [Workbook lifecycle](/workbook/lifecycle). What changes between them is:

- where the bytes come from (`File`, file system, IO stream, MCP tool input),
- where the bytes go (`save()` result, written file, returned `bytes` field),
- which runtime owns memory and IO,
- how errors cross the host boundary.

## Compatibility gate

Before adopting any scenario, inspect the workbook's formulas and decide how to handle external-service functions. Formulon has **507 real implementations among 522 recognized names**, including the environment-bound `CELL` and `INFO`; the remaining 15 are deliberate unavailable service stubs such as `COPILOT`, `PY`, `IMAGE`, `WEBSERVICE`, `STOCKHISTORY`, `RTD`, and CUBE connection functions. Treat those as product decisions: reject the workbook, show a compatibility warning, or route it to an Excel-backed workflow.

For runtime-specific setup, see [Runtimes](/runtimes/). For the engine-side flow, see [Workbook lifecycle](/workbook/lifecycle).
