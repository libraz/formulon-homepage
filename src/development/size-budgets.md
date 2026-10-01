# Size Budgets

Browser transfer size and load time increase with each byte, so the WASM package has explicit size limits. Native Node, Python, and CLI builds are not subject to these WASM size gates. The WASM build still dictates the dependency policy for the whole core.

::: info Glossary: size budget
A per-target byte ceiling for the built artifact. Builds that exceed the ceiling fail; builds that exceed the target are warnings to investigate. Budgets are checked in CI through `make size-check`.
:::

::: info Glossary: Brotli vs uncompressed
*Uncompressed* is the WASM file size on disk. *Brotli* is the compressed size served by a CDN configured for Brotli. Uncompressed size remains relevant for hosts that cannot serve Brotli.
:::

<SizeBudgetTable
  target="Target"
  budget="Budget"
  uncompressed="Uncompressed"
  brotli="Brotli"
  pattern="{soft} soft target, {hard} hard ceiling"
/>

The uncompressed limit is checked for both the serial and pthread binaries. The Brotli limit is checked when the `brotli` command is available; otherwise the report marks that measure as skipped. `make size-check` uses the same ceilings for both builds.

## What "budgeted" means in practice

Treat size-limit failures as product failures. Before adding an engine dependency, measure the resulting build size and decide whether the feature justifies the increase. Fixing it after the binary ships leaves the extra transfer and load cost in every release until the next change.

## Reducing size

When the WASM build approaches the ceiling, look in order at:

1. **Linker-retained code** — measure what the linker keeps. Formula families referenced by the dispatch table remain in the binary even when a workbook does not use them.
2. **Dependency review** — remove unused dependencies and consolidate duplicated implementations. Prefer in-tree implementations for the small set of spreadsheet-specific helpers.
3. **Build flag tuning** — Emscripten optimization passes, link-time optimization, dead-code elimination.
4. **Public surface** — every exported symbol forces the engine to keep its dependencies; consider whether an API can be internal.

## Reading the build output

```sh
make wasm wasm-threads
make size-check
```

`size-check` prints the current uncompressed and Brotli sizes and compares them against the budget. Install `brotli` to check both measures; the report marks Brotli as skipped when compression is unavailable. Use the pinned Emscripten toolchain before comparing local sizes with CI. Run the check locally before sending a PR and resolve failures.

## Read next

- [Build from source](/development/build-from-source) — how the WASM artifact is produced.
- [C++ core](/development/core) — why the dependency set stays small.
- [Architecture](/development/architecture) — what the engine has to fit in the budget.
