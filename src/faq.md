# FAQ

## Engine and Compatibility

### Does Formulon require Excel?

No at runtime. Formulon does not automate Excel, COM, or a Microsoft runtime when it loads workbooks, evaluates formulas, recalculates, or saves files.

Excel is used during development and verification to capture *oracle data*: reference values returned by the real product. v0.9.2 also added Windows Excel bridge coverage for pivot tables and print pagination, but that is a test track, not a production dependency.

### Which compatibility profile is the default?

The default profile is `win-365-ja_JP`, modelled on Excel 365 for Windows with the Japanese locale. Mac Excel 365 ja-JP is also tracked through oracle data. English-locale profiles are not exposed until matching oracle data exists. See [Locale profiles](/compatibility/locale-profiles).

### How many Excel functions can it run?

As of v0.9.2, Formulon recognizes **522** Excel function names. **505 / 522** are real local implementations in the calculation engine.

The remaining 17 are 2 environment-bound functions (`CELL`, `INFO`) and 15 unavailable service / connection stubs: `COPILOT`, `PY`, `IMAGE`, `RTD`, `STOCKHISTORY`, `WEBSERVICE`, `TRANSLATE`, `DETECTLANGUAGE`, and the CUBE functions. These names are recognized, but they are not local implementations. See [Formula coverage](/compatibility/formula-coverage).

### Can it execute `COPILOT`, `PY`, `STOCKHISTORY`, or `WEBSERVICE`?

No. Those functions require Microsoft 365 cloud services, the hosted Python runtime, market data services, HTTP I/O, or OLAP connections outside Formulon.

Formulon recognizes the names so workbooks fail in a predictable, Excel-shaped way instead of falling through as unknown parser names. It does not embed or proxy those external services.

### Do results exactly match Excel?

Formulon checks behavior against Excel oracle data per profile, such as `win-365-ja_JP`. That is not a blanket guarantee for every workbook. Locale behavior, volatile functions, external-service dependencies, file structures, and undocumented Excel details can still produce differences.

For business-critical workbooks, pin the Formulon version and profile, and keep representative workbook fixtures.

### Is this trying to clone all of Excel?

No. Formulon is a headless calculation and workbook-processing engine. It intentionally does not clone Excel's desktop UI, chart renderer, VBA runtime, PowerQuery engine, external-data refresh pipeline, or legacy `.xls` stack.

The goal is narrower: load modern workbook files, evaluate local spreadsheet formulas, preserve workbook structures where practical, and expose the same core through WASM, Python, CLI, Native Node, and MCP.

### Why not just use Excel, LibreOffice, HyperFormula, or a cloud spreadsheet API?

Use those when they fit. Excel is the right answer when you need the real application, VBA, PowerQuery, live connections, or final visual review. LibreOffice is a broad office suite and can be a good batch conversion tool. HyperFormula is useful when you want an embeddable formula engine without full `.xlsx` workbook round-trip semantics. Cloud spreadsheet APIs are useful when the workbook already lives in that product.

Formulon exists for a different slot: applications that need local, embeddable `.xlsx` calculation and workbook mutation without automating a desktop app or sending workbook data to a hosted spreadsheet service.

### Isn't Excel compatibility basically impossible?

Unqualified Excel compatibility is too broad to be useful. Formulon avoids that claim. It targets named profiles, records observed Excel results as oracle data, and documents accepted divergences.

That still leaves hard cases: volatile functions, undocumented coercions, locale-sensitive formatting, floating-point edges, external services, and file features that are preserved but not semantically evaluated. Compatibility should be validated against the actual workbook set you plan to run.

### Why is the default profile Japanese Excel?

The initial oracle coverage was built around `win-365-ja_JP`, so that is the first public profile. Locale affects real spreadsheet behavior: function names, separators, date parsing, text formatting, collation, and error surfaces can differ.

English-locale profiles are intentionally not exposed until matching oracle data exists. That is a coverage gap, not a claim that Japanese Excel is globally representative.

## Files and Workbook Features

### Which file formats are supported?

The normal public API path is `.xlsx` bytes. The WASM, Python, Native Node, CLI, and MCP surfaces are primarily designed to load `.xlsx`, recalculate, and save `.xlsx`.

Macro-enabled OOXML packages such as `.xlsm` / `.xltm` have tests for preserving `vbaProject.bin` byte-for-byte, but VBA is never executed. The core has MS-XLSB reader / writer code, but the FAQ treats `.xlsx` as the standard user-facing path. Legacy `.xls` / BIFF is out of scope.

### Does it execute VBA?

No. VBA projects can be preserved through a read / write round-trip, but macros are never executed. Workbooks that rely on macro-side state may differ from Excel.

### Does it support PowerQuery, DAX, or live external connections?

No. PowerQuery, DAX, live external connections, Web / OData / OLAP refresh, and similar data-refresh systems are outside Formulon. Refresh data upstream, then pass the resulting `.xlsx` to Formulon.

### What about pivot tables?

Pivot cache and PivotTable structure preservation, C ABI / WASM pivot operations, and pivot layout inspection are implemented. v0.9.2 added workbook oracle coverage for pivot tables through the Windows Excel bridge.

Formulon is not a replacement for Excel's external-data refresh and pivot-cache rebuild pipeline.

### Are print settings and page breaks preserved?

`.xlsx` page setup, margins, header/footer, print options, printer settings, and page-break metadata are part of the round-trip surface. v0.9.2 added print pagination oracle coverage and improved tracking for margins and Page Break Preview behavior.

Formulon is not a print-preview UI or PDF renderer. Final page rendering belongs to Excel or another rendering layer.

### Does Formulon include a spreadsheet UI?

The Formulon engine is headless. Grid rendering and interactive spreadsheet UI are not part of the core engine.

[`@libraz/formulon-cell`](/cell/) and its Vue wrapper are separate beta UI packages. Treat them as browser UI integration layers, not as a complete Excel UI replacement.

### Can I safely run arbitrary `.xlsx` files from users?

Do not treat arbitrary spreadsheet files as harmless. Formulon does not execute VBA, PowerQuery, external connections, or HTTP-backed formula functions, which removes several common execution paths. It still parses complex ZIP/XML workbook data and may read or write files depending on the surface you use.

For untrusted uploads, run Formulon in a sandboxed process or worker, set file-size and time limits, restrict filesystem access, and keep the package version pinned and updated.

### Are charts, shapes, images, and formatting recalculated?

Formatting and many workbook structures can be read, written, or preserved, but preservation is not the same as rendering or semantic evaluation. Formulon does not render charts, draw shapes, produce print-perfect PDFs, or execute image-fetching behavior from `IMAGE`.

Use Excel or a rendering layer for visual review. Use Formulon for calculation and workbook mutation.

## Runtimes and Packages

### Why is the core C++17?

C++17 is a conservative portability choice for this project. It runs predictably through Emscripten / WASM, can be packaged for npm, PyPI, CLI, and native embedding, and keeps the compiler baseline broad enough for GCC 9+ and Clang 10+ environments.

The implementation also uses a deliberately small C++ subset: C ABI boundaries, explicit error values, limited template use, controlled inlining, and translation-unit-level size tracking. That makes code size and generated artifacts easier to reason about across the supported distribution targets. It also reuses the author's existing C++ conventions: C++17, `Expected<T, Error>`, no exceptions / RTTI, and Google-style formatting.

### Why not Rust?

Aware of the trade-off. Rust would be a reasonable language for parts of this problem, and the memory-safety argument is real. Formulon is built around existing C / C++ infrastructure: OOXML parsing, ZIP handling, regular expressions, numeric conversion, C ABI packaging, Emscripten, and native embedding. Using C++ keeps that stack direct instead of adding FFI layers around libraries such as miniz, pugixml, PCRE2, and double-conversion.

The main compatibility risk is also not only memory safety. The hard part is Excel behavior: coercion rules, error propagation, locale handling, dates, dynamic arrays, OOXML round-trips, and oracle drift. Rust can help with many implementation risks, but it does not remove the spreadsheet-specification work. Formulon's current C++17 conventions, C ABI boundary, formatter, and oracle / CTest gates are the path the project is built around. Not a recommendation for everyone else to start new spreadsheet engines in C++.

### Which runtime should I pick?

Pick by deployment target:

| Use case | Recommended surface |
| --- | --- |
| Browser calculation | `@libraz/formulon` (WASM) |
| Broad Workbook API in Node.js | `@libraz/formulon` (WASM) |
| Native Node execution | `@libraz/formulon-native` (MVP subset) |
| Python batches or notebooks | `formulon` on PyPI |
| Shell or CI jobs | CLI from GitHub Releases |
| AI-agent workbook editing | `@libraz/formulon-mcp` |

See [Choose a surface](/start/choose-runtime).

### Does the Python wheel require Cython, NumPy, or pybind11?

No. The `formulon` wheel is `py3-none-any` and ships `formulon_capi.wasm` plus a pure-Python wrapper. `wasmtime` is the runtime dependency. Python 3.9 or newer is required.

### Does Native Node expose the full WASM API?

No. `@libraz/formulon-native` is an N-API addon, but in v0.9.2 it is an MVP subset: `Workbook.createDefault()`, `loadBytes()`, cell reads and writes, `recalc()`, `save()`, sheet add/remove/rename, `setDefinedName()`, and top-level `evalFormula()`.

Use the WASM package when you need the broader Workbook API today: styles, conditional formatting, layout, pivot tables, comments, hyperlinks, and similar workbook-management features.

### Does it work offline?

Local calculation works offline. WASM, Python, Native Node, and CLI process the formula or workbook bytes locally.

Service-backed functions such as `WEBSERVICE`, `STOCKHISTORY`, `TRANSLATE`, and `COPILOT` do not execute in Formulon, online or offline.

### Is workbook data sent anywhere?

The core engine processes workbook bytes locally. The WASM, Python, Native Node, and CLI surfaces do not need a Formulon-hosted service for calculation.

Your host application can still send files elsewhere if you build it that way. MCP deployments also depend on the client and filesystem permissions you grant to the agent.

### Do browser deployments need COOP / COEP?

Yes for the pthread-backed WASM path. Browsers require `SharedArrayBuffer`, which normally means serving with:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without those headers, `formulon-cell` may fall back to a minimal stub engine. The UI can keep responding, but formula evaluation, recalculation, and `.xlsx` round-trip are not running through the real engine.

### Are Vite warnings about `node:module` or `node:worker_threads` a problem?

Usually no. The `@libraz/formulon` WASM factory contains a Node runtime branch, so browser bundlers can warn that Node modules were externalized. That branch is dead code in browsers.

If the build fails rather than only warning, use ES module workers and an `es2022` or newer build target. See [Troubleshooting](/start/troubleshooting).

## Use Cases

### What is Formulon good for?

It fits systems that treat Excel workbooks as part of an application or workflow: browser quote tools, server-side report calculation, CI checks for workbook result drift, Python batch jobs, and AI-agent workbook editing.

It is not a desktop Excel replacement, a VBA runtime, a PowerQuery / DAX engine, or a live external-data refresh platform. See [Scenarios](/scenarios/).

### Is it fast?

There is no single honest benchmark number for spreadsheets. Runtime depends on workbook shape, formula mix, dynamic arrays, shared formulas, file size, and whether you are measuring parse time, recalculation, save time, or host-language overhead.

The practical claim is architectural: the runtimes share one native C++ core, and WASM / Python / CLI / Native Node are packaging surfaces around that core. Benchmark your representative workbooks before making latency or cost commitments.

### Is Formulon production-ready?

It is pre-1.0. The local formula engine is broad, but APIs and packaging may still change. For business-critical use, pin the Formulon version, pin the target profile, and keep representative workbook fixtures.

The strongest production fit is controlled workbooks in server jobs, CI, internal tools, and embedded calculation. Do not treat it as a universal drop-in replacement for arbitrary Excel files.

### What breaks most often in real integrations?

The common failures are not usually simple arithmetic. They are unsupported external data refresh, accidental reliance on macros, locale-specific parsing, volatile functions, hidden workbook state, unsupported file structures, and assuming that preserved visual objects were rendered or recomputed.

Start with a small set of representative workbooks, dump the formulas, compare outputs against the target Excel profile, and keep those files in CI.

### Is this legally tied to Microsoft Excel?

No Microsoft runtime, service, SDK, or product license is required by Formulon at runtime. Excel is used as a reference implementation during development to capture oracle data.

Excel is Microsoft's product and trademark. Formulon is an independent Apache-2.0 project and does not claim to be Microsoft Excel or a Microsoft-sponsored implementation.

## AI / MCP

### What is `formulon-mcp`?

`@libraz/formulon-mcp` is a stdio MCP server exposing Formulon workbook operations to AI agents. It provides 31 tools for opening `.xlsx` files, inspecting workbook structure, editing cells and sheets, recalculating, and saving. Node.js 22 or newer is required.

```sh
npx -y @libraz/formulon-mcp
```

See [MCP](/mcp/).

### Can agents execute arbitrary code through it?

No. The MCP server validates inputs and isolates sessions by `sessionId`. The low-level `formulon_workbook_call` tool only dispatches `Workbook` methods listed in the allowlist in `formulon-mcp`'s `src/sessions.ts`.

The MCP server can still read and write files, so production use should control the client permissions, working directory, and allowed file scope.

## 0.9.2

### What changed in v0.9.2 for users?

The main visible changes are the clear split between **522 recognized function names** and **505 local implementations**, workbook oracle coverage for pivot tables and print pagination through the Windows Excel bridge, and several Excel-alignment fixes.

Formula changes include Excel-style 15-significant-digit numeric literal parsing, `ARRAYTOTEXT` scalar error propagation, `PIVOTBY` layout fixes, and fixes around `MAP` / `MAKEARRAY`, `FREQUENCY`, `WRAPROWS` / `WRAPCOLS`, `TRIMRANGE`, and `PERCENTILE.EXC`.

File-format changes include stronger preservation for unknown workbook relationships, shared-formula references, print pagination metadata, margins, and Page Break Preview-derived information.

## License

### How is Formulon licensed?

`formulon`, `formulon-cell`, and `formulon-mcp` are Apache-2.0. You may use, modify, and redistribute them under the license terms.
