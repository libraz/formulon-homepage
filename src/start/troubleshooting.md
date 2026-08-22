# Troubleshooting

This page covers common integration failures.

<DiagramLayers
  :layers="[
    {
      title: 'Symptom → fix',
      nodes: [
        { label: 'SharedArrayBuffer missing', note: 'Set COOP / COEP headers' },
        { label: 'Bundler warns about node:*', note: 'Mark node: external, exclude from optimizeDeps' },
        { label: 'loadBytes returns invalid', note: 'Check wb.isValid(), read lastErrorMessage()' },
        { label: 'Cell shows #DIV/0! / #VALUE!', note: 'Excel error is a value — inspect the value kind' },
        { label: 'Python cannot find WASM', note: 'Install the wheel, or run make python-package' },
        { label: 'CLI result differs from Excel', note: 'Check locale, volatile functions, preserved-but-not-evaluated' }
      ]
    }
  ]"
  label="Troubleshooting quick reference"
/>

## Browser says SharedArrayBuffer is unavailable

Serve the page with cross-origin isolation headers:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

::: tip Vite preview is not your production host
Check the headers in the actual deployed environment. A local dev server passing does not prove the CDN or app server is configured correctly.
:::

## Vite warns about `node:` imports

The WASM package contains a Node branch for Node runtime support. Browser bundlers may warn about `node:module` or `node:worker_threads`. In Vite, exclude the package from optimizeDeps and mark `node:` imports external.

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: { exclude: ['@libraz/formulon'] },
  build: {
    target: 'es2022',
    rollupOptions: { external: [/^node:/] }
  }
})
```

## Workbook load returns an invalid handle

In WASM, check `wb.isValid()` immediately after `loadBytes(bytes)` and read `Module.lastErrorMessage()`.

```ts
const wb = Module.Workbook.loadBytes(bytes)
if (!wb.isValid()) {
  throw new Error(Module.lastErrorMessage())
}
```

## Formula returns an Excel error

Excel errors are values. `#DIV/0!`, `#VALUE!`, and `#NAME?` do not mean the host API failed. Inspect the value kind and error payload.

The CLI follows the same rule for malformed `eval` syntax: `formulon eval '=SUM('` prints `#NAME?` to stdout and exits `0`. Check stdout when a script must reject malformed formula text; a non-zero exit is reserved for usage, IO, or engine failures.

## A validation unexpectedly rejects blank cells

`allowBlank` defaults to `false` when omitted on WASM and Native Node, matching Python. Set `allowBlank: true` (or Python's `allow_blank=True`) when the validation should accept an empty cell.

## Python cannot load the WASM runtime

Install the published wheel so pip can resolve a compatible `wasmtime` wheel, or
run the staging command from the repository root:

```sh
make python-package
```

The source-tree import expects the staged C-ABI WASM module under
`packages/python/formulon/_wasm/`.

## CLI result differs from Excel

Check these first:

- whether the function is an unavailable service stub — registered, but intentionally returning an Excel error, such as `PY` or CUBE connection functions,
- whether the workbook depends on locale behavior outside `win-365-ja_JP`,
- whether volatile functions are involved,
- whether the workbook structure is preserved but not evaluated.

Create a minimal formula case and compare it with [Formula coverage](/compatibility/formula-coverage) and [Oracle testing](/compatibility/oracle-testing).
