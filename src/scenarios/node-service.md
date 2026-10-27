# Node Service Recalculation

Use this pattern when a server-side Node service accepts an uploaded or internally generated workbook, recalculates it, and returns either values, diagnostics, or a saved workbook. Choose Native Node when deployment can build or stage a platform binary from the source tree; choose WASM when portability matters more than native throughput.

::: tip Pick the runtime by deployment
Native Node avoids copying workbook bytes into the WASM heap, but it needs a `.node` binary built from `packages/npm-native` for each target platform. WASM deploys the same way on every Node environment. Formula results should match; a difference is a bug or a documented compatibility gap.
:::

## Flow

<DiagramFlow
  :steps="[
    { label: 'HTTP upload / internal job', note: 'Uploaded or generated workbook' },
    { label: 'Validate', note: 'Byte-size policy before loading' },
    { label: 'Load bytes', note: 'Cell-count policy after loading' },
    { label: 'Set inputs and profile', note: 'Profile such as win-365-en_US' },
    { label: 'recalc()', note: 'Check the status before reading' },
    { label: 'Read checks and values', note: 'Values and diagnostics' },
    { label: 'Respond', note: 'JSON, or a saved workbook' }
  ]"
  label="Node service flow: accept an upload or internal job, validate the file, load the bytes, set inputs and profile, recalculate, read checks and values, then return JSON or a saved workbook"
  caption="The service boundary enforces size and cell-count limits and pins the profile, so a recalculation is reproducible."
/>

## Runtime choice

| Constraint | Prefer |
| --- | --- |
| Large workbooks, high request volume, controlled deployment | Native Node |
| Serverless or portable Node deployment | WASM |
| Same code path as browser upload | WASM |
| Avoid building/staging a platform-specific native binary today | WASM |

<DiagramLayers
  :layers="[
    {
      title: 'Can this deployment build or stage a .node binary today?',
      nodes: [
        { label: '@libraz/formulon-native', note: 'Yes. Built from source per platform' },
        { label: '@libraz/formulon', note: 'No. Same on every Node environment' }
      ]
    }
  ]"
  label="Decision: if the deployment can build or stage a platform-specific native binary today, choose Native Node for operational throughput; otherwise choose WASM for portability"
  caption="Choose Native Node only when the deployment can supply the binary; formula results should match either way."
/>

Native Node and WASM share the core calculation flow, but their Workbook method sets differ. Check the [Surface matrix](/api/surfaces) before choosing a binding for table authoring, AutoFilter XML, or `addCellStyleXf`; typed AutoFilters and `setCellStyle` are available on both. The [Native Node integration](/runtimes/node-native) page shows status checks and explicit disposal for the service path.

## Service boundary

At the API boundary, make the conditions for reproducible recalculation explicit:

- reject files that exceed the byte-size policy before loading, then enforce the cell-count policy after loading;
- pin the engine version and compatibility profile, for example `win-365-en_US` (the default);
- control volatile inputs such as the clock and random values when reproducible output is required;
- separate host failures from cell-level Excel errors;
- keep the original bytes until `save()` succeeds;
- decide how to handle unavailable service functions before accepting production traffic.

## Compatibility gate

Not every Microsoft 365 function can execute inside a Node service. Formulon has **511 real implementations among 526** recognized names, including state-dependent `CELL` and `INFO`. Functions that need external services or live connections, including `COPILOT`, `PY`, `IMAGE`, `WEBSERVICE`, `STOCKHISTORY`, `RTD`, and CUBE functions, are recognized but return deterministic unavailable errors.

For user-uploaded workbooks, surface this as a workbook compatibility issue. For internal templates, fail CI when those functions appear in the formula snapshot unless an explicit exception exists.

## Operational checks

- Put recalculation behind request timeouts and queue limits.
- Log the Formulon version, profile, workbook fingerprint, and failure class.
- Snapshot representative templates in CI before upgrading Formulon.
- Compare important templates against Excel-derived fixtures when patch releases mention formula or file-format behavior changes.

## Read next

- [Native Node integration](/runtimes/node-native) — native service deployment.
- [WASM integration](/runtimes/wasm) — portable Node and browser-compatible deployment.
- [Formula coverage](/compatibility/formula-coverage) — 511 / 526 real implementations and unavailable stubs.
- [CI workbook regression](/scenarios/ci-regression) — catching upgrade drift before deploy.
