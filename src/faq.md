# FAQ

## Engine and compatibility

### Does Formulon require Excel?

No. Formulon does not automate Excel, COM, or any Microsoft runtime at evaluation time. Excel is only used offline to capture *oracle data* (reference values) for the test suite — production calculations run entirely inside Formulon.

### Which compatibility profile is the default?

The default profile is `win-365-ja_JP`, modelled on Excel 365 for Windows with the Japanese locale. Other profiles are exposed only when matching oracle data exists. See [Locale profiles](/compatibility/locale-profiles).

### Can it render spreadsheets?

No. Formulon calculates and preserves workbook data; rendering is left to UI layers. The [`@libraz/formulon-cell`](/cell/) package is a separate, beta UI library that demonstrates how a UI can sit on top of the engine — Formulon itself remains headless.

### Does it execute VBA?

No. VBA projects can be preserved byte-for-byte through a save / load round-trip, but macros are never executed. Workbooks that depend on macro-side state will diverge from Excel.

### Does it support `.xls` (BIFF / Excel 97–2003)?

No. Formulon targets modern OOXML (`.xlsx`, `.xlsm`) and the binary `.xlsb`. Converting `.xls` to `.xlsx` first is the supported path.

### What about PowerQuery, DAX, slicers, or pivot calculation?

Pivot **layout** is preserved on a subset of workbooks, but PowerQuery, DAX expressions, and live data connections are out of scope. Slicer chrome is preserved structurally without behavior.

### Why one C++ core?

One core avoids drift between browser, server, Python, and CLI integrations. The bindings expose the same calculation behavior instead of re-implementing it per language. The same engine is exercised by oracle fixtures regardless of host.

## Runtimes and packaging

### Which runtime should I pick?

Pick by deployment, not by formula. Browser → WASM. Batch jobs / notebooks → Python. Node service with native deployment → Native Node. Shell / CI → CLI. New language → C ABI. See [Choose a surface](/start/choose-runtime).

### Does the Python wheel require Cython, NumPy, or pybind11?

No. The published wheel is `py3-none-any` and ships `formulon_capi.wasm` plus a pure-Python wrapper. `wasmtime` is the only runtime dependency.

### Does it work offline?

Yes. All runtimes evaluate locally. No network access is required for calculation; the WASM build does not phone home, and the CLI / Python paths only read the workbook bytes you hand them.

### macOS / Linux / Windows support?

- **WASM**: any browser supporting `SharedArrayBuffer`, plus Node 18+.
- **Python**: any platform where `wasmtime` ships a wheel (mainstream Linux / macOS / Windows).
- **Native Node**: prebuilt binaries published per `(os, arch)` target.
- **CLI**: prebuilt binaries per `(os, arch)` from GitHub Releases.

### How big is the engine?

The WASM build has a strict size budget. Browser-facing dependencies are added only when measured. See [Size budgets](/development/size-budgets) for current numbers.

## Browser hosting

### Why do I need COOP/COEP headers?

The WASM engine uses pthread workers, which require `SharedArrayBuffer`. Browsers expose `SharedArrayBuffer` only on cross-origin-isolated pages, which are signalled by serving:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without those headers, `formulon-cell` and `@libraz/formulon` fall back to a stub engine. See [Troubleshooting](/start/troubleshooting).

::: info Glossary: stub engine
A minimal in-memory replacement engine `formulon-cell` switches to when `SharedArrayBuffer` is unavailable. The UI keeps responding, but formula evaluation, recalculation, and `.xlsx` round-trip degrade to no-ops. Detect at runtime with `isUsingStub()`.
:::

### Why is my Vite preview broken in production?

Local Vite dev / preview can pass while the production host serves the page without COOP/COEP. Always verify the headers on the deployed origin, not only on `localhost`.

## Security and operations

### Does the engine run arbitrary code?

No. Formulas are evaluated by the engine; there is no user-supplied bytecode path. VBA is preserved but never executed. The MCP server's low-level `formulon_workbook_call` only dispatches an allowlisted set of `Workbook` methods.

### Is there a memory ceiling?

The WASM build allocates inside the WASM heap and the engine's recalculation scheduler. Large workbooks scale with cell count rather than worksheet count. There is no built-in cell-count limit; production hosts should impose their own upload size limits.

### How do I license Formulon?

Apache-2.0 across `formulon`, `formulon-cell`, and `formulon-mcp`. Use, modify, and distribute under the terms of the license.

## AI / MCP

### What is `formulon-mcp`?

A stdio MCP server that exposes Formulon's workbook surface to AI agents (Claude Code, Claude Desktop, Codex CLI, any stdio-MCP client). It runs as `npx -y @libraz/formulon-mcp`. See [MCP](/mcp/).

### Can agents send arbitrary code to be evaluated?

No. The MCP server validates inputs and dispatches only allowlisted methods. Sessions are isolated by `sessionId`, and the low-level `formulon_workbook_call` rejects methods not on the server's allowlist.

## Status

### Is Formulon production-ready?

It is pre-1.0. The 522-function catalog is fully registered and the file-format layer is substantial, but APIs and packaging may still change. Pin exact versions and keep representative workbook fixtures for business-critical use cases.
