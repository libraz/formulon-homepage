# Node Service Recalculation

Use this pattern when a server-side Node service accepts an uploaded or internally generated workbook, recalculates it, and returns either values, diagnostics, or a saved workbook. Choose Native Node when deployment can install a platform binary; choose WASM when portability matters more than native throughput.

::: tip Pick the runtime by deployment
Native Node avoids WASM heap-copy costs and browser isolation concerns, but it needs a matching `.node` binary. WASM is easier to deploy uniformly across Node environments. Formula semantics should be the same; if they differ, treat it as a bug or documented compatibility gap.
:::

## Flow

```mermaid
flowchart LR
  A[HTTP upload / internal job] --> B[Validate file size and type]
  B --> C[Load workbook bytes]
  C --> D[Set inputs / profile]
  D --> E[recalc]
  E --> F[Read checks and values]
  F --> G[Return JSON or saved workbook]
```

## Runtime choice

| Constraint | Prefer |
| --- | --- |
| Large workbooks, high request volume, controlled deployment | Native Node |
| Serverless or portable Node deployment | WASM |
| Same code path as browser upload | WASM |
| Need the broadest JavaScript workbook API today | WASM |

## Service boundary

At the API boundary, treat workbook recalculation as a deterministic transform:

- reject files that exceed your size or cell-count policy before loading;
- pin the compatibility profile, usually `win-365-ja_JP`;
- separate host failures from cell-level Excel errors;
- keep the original bytes until `save()` succeeds;
- decide how to handle unavailable service functions before accepting production traffic.

## Compatibility gate

Not every Microsoft 365 function can execute inside a Node service. Formulon locally implements **505 / 522** recognized function names. Functions that need external services or live connections, including `COPILOT`, `PY`, `IMAGE`, `WEBSERVICE`, `STOCKHISTORY`, `RTD`, and CUBE functions, are recognized but return deterministic unavailable errors.

For user-uploaded workbooks, surface this as a workbook compatibility issue. For internal templates, fail CI when those functions appear in the formula snapshot unless an explicit exception exists.

## Operational checks

- Put recalculation behind request timeouts and queue limits.
- Log the Formulon version, profile, workbook fingerprint, and failure class.
- Snapshot representative templates in CI before upgrading Formulon.
- Compare important templates against Excel-derived fixtures when patch releases mention formula or file-format behavior changes.

## Read next

- [Native Node integration](/runtimes/node-native) — native service deployment.
- [WASM integration](/runtimes/wasm) — portable Node and browser-compatible deployment.
- [Formula coverage](/compatibility/formula-coverage) — 505 / 522 local implementation and unavailable stubs.
- [CI workbook regression](/scenarios/ci-regression) — catching upgrade drift before deploy.
