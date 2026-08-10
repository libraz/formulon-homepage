# Size Budgets

The WASM package is budgeted because browser users pay for every byte. Native Node, Python, and CLI builds are not budgeted with the same rigor — they ship to environments where adding 200 KB is usually not user-visible — but the WASM build dictates the dependency policy for the whole core.

::: info Glossary: size budget
A per-target byte ceiling for the built artifact. Builds that exceed the ceiling fail; builds that exceed the target are warnings to investigate. Budgets are checked in CI through `make size-check`.
:::

::: info Glossary: Brotli vs uncompressed
*Uncompressed* is what the WASM file weighs on disk. *Brotli* is what a properly configured CDN serves to browsers. Brotli is the user-visible number; uncompressed bounds what the engine needs to keep loadable on hosts that cannot serve Brotli.
:::

| Target | Budget |
| --- | --- |
| Uncompressed | 2.5 MiB soft target, 3.0 MiB hard ceiling |
| Brotli | 640 KiB soft target, 768 KiB hard ceiling |

Both uncompressed and Brotli limits are gated equally. Brotli is not a reporting-only metric.

## What "budgeted" means in practice

Treat budget failures as product failures. Before adding a dependency to the engine, measure the resulting build size and decide whether the feature justifies the cost. "We can fix this later" is rarely true once the binary has shipped — users have already paid for the bytes.

## Reducing size

When the WASM build approaches the ceiling, look in order at:

1. **New unused code paths** — function families that the engine carries but most workbooks do not use can be lazy-dispatched.
2. **Dependency review** — generic libraries are tempting but rarely break even after deduplication. Prefer in-tree implementations for the small set of spreadsheet-specific helpers.
3. **Build flag tuning** — Emscripten optimization passes, link-time optimization, dead-code elimination.
4. **Public surface** — every exported symbol forces the engine to keep its dependencies; consider whether an API can be internal.

## Reading the build output

```sh
make wasm
make size-check
```

`size-check` prints the current uncompressed and Brotli sizes and compares them against the budget. Fail it locally before sending a PR; CI does the same check.

## Read next

- [Build from source](/development/build-from-source) — how the WASM artifact is produced.
- [C++ core](/development/core) — why the dependency set stays small.
- [Architecture](/development/architecture) — what the engine has to fit in the budget.
