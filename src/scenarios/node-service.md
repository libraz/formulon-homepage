# Node Service Recalculation

Use this pattern when a server-side Node service accepts an uploaded or internally generated workbook, recalculates it, and returns either values, diagnostics, or a saved workbook. Choose Native Node when deployment can build or stage a platform binary from the source tree; choose WASM when portability matters more than native throughput.

::: tip Pick the runtime by deployment
Native Node avoids WASM heap-copy costs and browser isolation concerns, but it needs a matching `.node` binary from `packages/npm-native`. WASM is easier to deploy uniformly across Node environments. Formula semantics should be the same; if they differ, treat it as a bug or documented compatibility gap.
:::

## Flow

<DiagramFlow steps="HTTP upload / internal job → Validate file size and type → Load workbook bytes → Set inputs / profile → recalc → Read checks and values → Return JSON or saved workbook" />

## Runtime choice

| Constraint | Prefer |
| --- | --- |
| Large workbooks, high request volume, controlled deployment | Native Node |
| Serverless or portable Node deployment | WASM |
| Same code path as browser upload | WASM |
| Avoid building/staging a platform-specific native binary today | WASM |

<DiagramLayers
  :layers="[
    { nodes: ['Can you build or stage a platform-specific .node binary in this deployment today?'] },
    { nodes: [
      { label: 'Yes → Native Node', note: 'operational throughput, no browser isolation constraints' },
      { label: 'No → WASM', note: 'portable across Node environments, no native build step' }
    ] }
  ]"
  label="Decision: if the deployment can build or stage a platform-specific native binary today, choose Native Node for operational throughput; otherwise choose WASM for portability"
/>

Native Node and WASM share the core calculation flow, but their Workbook method sets differ. Check the [Surface matrix](/api/surfaces) before choosing a binding for table, AutoFilter XML, phonetic, or cell-style authoring. The choice above is otherwise operational: binary staging and deployment portability, not a difference in formula evaluation.

## Service boundary

At the API boundary, treat workbook recalculation as a deterministic transform:

- reject files that exceed your size or cell-count policy before loading;
- pin the compatibility profile, usually `win-365-ja_JP`;
- separate host failures from cell-level Excel errors;
- keep the original bytes until `save()` succeeds;
- decide how to handle unavailable service functions before accepting production traffic.

## Compatibility gate

Not every Microsoft 365 function can execute inside a Node service. Formulon has **507 real implementations among 522** recognized names, including state-dependent `CELL` and `INFO`. Functions that need external services or live connections, including `COPILOT`, `PY`, `IMAGE`, `WEBSERVICE`, `STOCKHISTORY`, `RTD`, and CUBE functions, are recognized but return deterministic unavailable errors.

For user-uploaded workbooks, surface this as a workbook compatibility issue. For internal templates, fail CI when those functions appear in the formula snapshot unless an explicit exception exists.

## Operational checks

- Put recalculation behind request timeouts and queue limits.
- Log the Formulon version, profile, workbook fingerprint, and failure class.
- Snapshot representative templates in CI before upgrading Formulon.
- Compare important templates against Excel-derived fixtures when patch releases mention formula or file-format behavior changes.

## Read next

- [Native Node integration](/runtimes/node-native) — native service deployment.
- [WASM integration](/runtimes/wasm) — portable Node and browser-compatible deployment.
- [Formula coverage](/compatibility/formula-coverage) — 507 / 522 real implementations and unavailable stubs.
- [CI workbook regression](/scenarios/ci-regression) — catching upgrade drift before deploy.
