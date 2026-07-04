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
| Uncompressed | 2.5 MB target (soft ceiling), 3.0 MB hard ceiling |
| Brotli | 560 KB target, 600 KB ceiling |

The ceiling was raised in v0.9.3 to give deliberate headroom after the OOXML/XLSB/pivot fidelity work legitimately grew the binary. The current build sits at roughly 2.09 MiB uncompressed / 560 KiB Brotli — comfortably under target, with about 1 MB of hard-ceiling headroom left:

<svg viewBox="0 0 600 110" width="100%" role="img" aria-label="WASM uncompressed size gauge: current build about 2.09 MiB, soft ceiling 2.5 MiB, hard ceiling 3.0 MiB">
  <rect x="1" y="40" width="598" height="28" rx="6" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)" />
  <rect x="1" y="40" width="418" height="28" rx="6" fill="var(--vp-c-brand-1)" />
  <line x1="500" y1="32" x2="500" y2="76" stroke="var(--vp-c-text-2)" stroke-width="2" stroke-dasharray="4 3" />
  <line x1="597" y1="32" x2="597" y2="76" stroke="var(--vp-c-text-1)" stroke-width="2" />
  <text x="4" y="26" font-size="12" fill="var(--vp-c-text-3)">0 MiB</text>
  <text x="500" y="26" text-anchor="middle" font-size="12" fill="var(--vp-c-text-2)">soft 2.5 MiB</text>
  <text x="596" y="98" text-anchor="end" font-size="12" fill="var(--vp-c-text-1)">hard 3.0 MiB</text>
  <text x="209" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="var(--vp-c-text-1)">current ~2.09 MiB</text>
</svg>

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
