<script setup>
import { MCP_TOOL_COUNT } from '@/data/facts'
</script>

# FAQ

## Engine and Compatibility

### Does Formulon require Excel?

Not at runtime. Formulon does not automate Excel, COM, or a Microsoft runtime when it loads workbooks, evaluates formulas, recalculates, or saves files.

Excel is used during development and verification to capture *oracle data*: reference values returned by the real product. Windows Excel bridge coverage for pivot tables and print pagination is a test track, not a production dependency.

### Which compatibility profile is the default?

The default profile is `win-365-en_US`, modelled on Excel 365 for Windows with the US English locale. There are 28 profiles across 14 locales on Mac and Windows. See [Locale profiles](/compatibility/locale-profiles) for the full list and the measured or estimated status of each.

### How many Excel functions can it run?

Formulon recognizes **526** Excel function names. **511** are real implementations, including 2 environment-bound functions (`CELL`, `INFO`), and 15 are unavailable service stubs.

The unavailable stubs include `COPILOT`, `PY`, `IMAGE`, `RTD`, `STOCKHISTORY`, `WEBSERVICE`, `TRANSLATE`, `DETECTLANGUAGE`, and the CUBE functions. These names are recognized so failures are deterministic. See [Formula coverage](/compatibility/formula-coverage).

### Can it execute `COPILOT`, `PY`, `STOCKHISTORY`, or `WEBSERVICE`?

No. Those functions require Microsoft 365 cloud services, the hosted Python runtime, market data services, HTTP I/O, or OLAP connections outside Formulon.

Formulon recognizes the names so workbooks fail in a predictable, Excel-shaped way instead of falling through as unknown parser names. It does not embed or proxy those external services.

### Do results exactly match Excel?

Formulon checks behavior against Excel oracle data per profile, such as `win-365-ja_JP`. That is not a blanket guarantee for every workbook. Locale behavior, volatile functions, external-service dependencies, file structures, and undocumented Excel details can still produce differences.

<DiagramFlow steps="Excel (reference) → captured oracle data → profile (win-365-ja_JP) → divergence.yaml → Formulon output" label="How a compatibility profile is built and checked" />

Real Excel is the reference. Its observed behavior is captured as oracle data, organized under a named profile such as `win-365-ja_JP`, and any accepted difference from that reference is recorded in `divergence.yaml` with a reason and last-verified Excel build — rather than left as an unexplained mismatch in Formulon's output. See [Oracle testing](/compatibility/oracle-testing) for the full pipeline.

For business-critical workbooks, pin the Formulon version and profile, and keep representative workbook fixtures.

### Is this trying to clone all of Excel?

No. Formulon is a headless calculation and workbook-processing engine. It intentionally does not clone Excel's desktop UI, chart renderer, VBA runtime, Power Query engine, external-data refresh pipeline, or legacy `.xls` stack.

The goal is narrower: load modern workbook files, evaluate local spreadsheet formulas, preserve workbook structures where practical, and expose the same core through WASM, Python, CLI, Native Node, and MCP.

### Why not just use Excel, an office suite, a formula library, or a cloud spreadsheet API?

Use those when they fit. Excel is the right answer when you need the real application, VBA, Power Query, live connections, or final visual review. A desktop office suite can be a good batch conversion tool. A formula-only library is enough when you need formulas but not `.xlsx` round trips. Cloud spreadsheet APIs are useful when the workbook already lives in that product.

Formulon exists for a different slot: applications that need local, embeddable `.xlsx` calculation and workbook mutation without automating a desktop app or sending workbook data to a hosted spreadsheet service.

### Isn't Excel compatibility basically impossible?

Unqualified Excel compatibility is too broad to be useful. Formulon avoids that claim. It targets named profiles, records observed Excel results as oracle data, and documents accepted divergences.

That still leaves hard cases: volatile functions, undocumented coercions, locale-sensitive formatting, floating-point edges, external services, and file features that are preserved but not semantically evaluated. Compatibility should be validated against the actual workbook set you plan to run.

### Which locales are measured, and which are estimated?

The formula oracle is captured on Mac Excel 365 in all 14 supported locales, each gating CI; `mac-365-ja_JP` is the primary. `win-365-ja_JP` is measured on Windows and is the primary of the pivot/print workbook oracle captured through the Windows COM bridge. The other 13 Windows profiles are estimated from the Mac capture plus known host differences. Locale affects separators, boolean and error text, date parsing, text formatting, code pages, function-name display and [text comparison](/compatibility/text-collation).

## Files and Workbook Features

### Which file formats are supported?

WASM, Python, Native Node, CLI, and MCP can load `.xlsx` and `.xlsb`. Loaders detect the format from the file contents. Use `saveAs` / `save_as` to select the output format explicitly. CLI selects XLSB for a `.xlsb` output extension and XLSX otherwise. MCP accepts only `.xlsx` or `.xlsb` output paths and selects the corresponding format.

For `.xlsb` (MS-XLSB), the parts Formulon models and writes include styles, row/column layout, merges, `date1904`, view/zoom/frozen panes, dynamic-array metadata, supported tokenized formulas, conditional-format rules, data-validation rules, and hyperlinks. Conditional-format rules use the shared model and supported rules can be evaluated; `validateValue` / `validate_value` and `listInvalidCells` / `list_invalid_cells` perform explicit checks against modeled validation rules. Other worksheet tails such as print setup/breaks, drawing/table references, and relationships use their documented passthrough behavior. Typed AutoFilter edits, classic notes, threaded comments, OOXML drawings (loaded or inserted), page setup, margins, print options, header/footer, manual breaks, tables, and nondefault calculation settings remain deferred for XLSB writes; `saveWithDiagnostics` / `save_with_diagnostics` report deferred or dropped losses through `deferredFeatureCount` and related counters. Unsupported formulas may downgrade to cached literals. See [File format support](/compatibility/file-format-support).

XLSB pivot cache definitions, cache records, and PivotTable parts are evaluated when their record encoding is supported; unmeasured encodings are skipped rather than guessed. External references accept book names and paths, such as `[Book1.xlsx]Sheet1!A1`, and survive XLSX and XLSB saves with their link parts. Evaluation uses available cached external values; it does not fetch the linked file. Phonetic annotations preserve the span of each run.

Macro-enabled OOXML packages such as `.xlsm` / `.xltm` have tests for preserving `vbaProject.bin` byte-for-byte, but VBA is never executed. Legacy `.xls` / BIFF is out of scope.

### Does it execute VBA?

No. VBA projects can be preserved through a read / write round-trip, but macros are never executed. Workbooks that rely on macro-side state may differ from Excel.

### Does it support Power Query, DAX, or live external connections?

No. Power Query, DAX, live external connections, Web / OData / OLAP refresh, and similar data-refresh systems are outside Formulon. Refresh data upstream, then pass the resulting `.xlsx` to Formulon.

### What about pivot tables?

Pivot cache and PivotTable structure preservation, pivot operations, layout inspection, worksheet-source access, and cache-index item filtering are available across the C API, Node addon, WASM, and Python bindings. XLSB pivots are evaluated when the record encoding is supported. See [PivotTables](/workbook/pivots).

Formulon does not refresh a pivot cache from its source data or rerun external data connections; that remains Excel's job.

### Are print settings and page breaks preserved?

`.xlsx` page setup, margins, header/footer, print options, printer settings, and page-break metadata are part of the round-trip surface. WASM, Native Node, Python, and the C ABI can author the modeled print settings through typed setters as well as read them back. The `paginate` APIs resolve inclusive print areas and page breaks.

Formulon is not a print-preview UI or PDF renderer. Final page rendering belongs to Excel or another rendering layer.

### Does Formulon include a spreadsheet UI?

The Formulon engine is headless. Grid rendering and interactive spreadsheet UI are not part of the core engine.

[`@libraz/formulon-cell`](/cell/) is a browser spreadsheet UI kit with React and Vue adapters. See its guides for [embedding](/cell/embedding), [options](/cell/options), and [modals](/cell/modals).

### Can I change the language without rebuilding the sheet?

Yes. Cell provides seven built-in UI dictionaries and `instance.setLocale()` switches the mounted UI and its calculation profile together. The [language switching demo](/cell/language-switching) shows the stored and displayed formulas on the same workbook. Engine hosts can convert formula text for all supported profiles through [the formula language APIs](/workbook/language).

### Can I safely run arbitrary `.xlsx` files from users?

Do not treat arbitrary spreadsheet files as harmless. Formulon does not execute VBA, Power Query, external connections, or HTTP-backed formula functions, which removes several common execution paths. It still parses complex ZIP/XML workbook data and may read or write files depending on the surface you use.

For untrusted uploads, restrict process and filesystem permissions and set file-size and time limits. In browsers, a worker separates parsing and recalculation from the UI thread. Pin the package version and validate updates against representative files.

### Are charts, shapes, images, and formatting recalculated?

Formatting and many workbook structures can be read, written, or preserved, but preservation is not the same as rendering or semantic evaluation. Formulon does not render charts, draw shapes, produce print-perfect PDFs, or execute image-fetching behavior from `IMAGE`.

Use Excel or a rendering layer for visual review. Use Formulon for calculation and workbook mutation.

## Runtimes and Packages

### Why is the core C++17?

C++17 lets the project build the same calculation source for Emscripten / WASM, npm, PyPI, CLI, and native embedding. Building the core requires a C++17 toolchain.

The implementation uses a C ABI, explicit error values, controlled inlining, and WASM size budgets to manage the bindings and generated artifacts. Its conventions include C++17, `Expected<T, Error>`, exceptions and RTTI disabled in the core, and Google-style formatting.

### Why not Rust?

Rust would be a reasonable language for parts of this problem, and the memory-safety argument is real. Formulon is built around existing C / C++ infrastructure: OOXML parsing, ZIP handling, regular expressions, numeric conversion, C ABI packaging, Emscripten, and native embedding. Using C++ keeps that stack direct instead of adding FFI layers around libraries such as miniz, pugixml, PCRE2, and double-conversion.

The main compatibility risk is also not only memory safety. The hard part is Excel behavior: coercion rules, error propagation, locale handling, dates, dynamic arrays, OOXML round-trips, and oracle drift. Rust can help with many implementation risks, but it does not remove the spreadsheet-specification work. Formulon's C++17 conventions, C ABI boundary, formatter, and oracle / CTest gates are what the project is built around. This is not a recommendation that new spreadsheet engines be written in C++.

### Which runtime should I pick?

Pick by deployment target:

| Use case | Recommended surface |
| --- | --- |
| Browser calculation | `@libraz/formulon` (WASM) |
| Browser or no-native-addon Node.js | `@libraz/formulon` (WASM) |
| Native Node execution from a source checkout | `packages/npm-native` |
| Python batches or notebooks | `formulon` on PyPI |
| Shell or CI jobs | CLI from GitHub Releases |
| AI-agent workbook editing | `@libraz/formulon-mcp` |

See [Choose a surface](/start/choose-runtime).

### Does the Python wheel require Cython, NumPy, or pybind11?

No. The `formulon` wheel is `py3-none-any` and ships `formulon_capi.wasm` plus a pure-Python wrapper. `wasmtime` is the runtime dependency. Python 3.9 or newer is required.

### Does Native Node expose the full WASM API?

The shared Workbook methods are available, with some differences. The source-tree Native Node package under `packages/npm-native` exposes the four static factories (`createDefault` / `createEmpty` / `createForProfile` / `loadBytes`), phonetic guides, iterative settings, three-state sheet visibility, print settings, range XF assignment, cache-index pivot items, typed AutoFilters, geometry and theme access, validation checks, comments, images, and `setCellStyle`. Table authoring, AutoFilter XML, and `addCellStyleXf` remain WASM-only.

Native Node adds `dispose()` for explicit release and `memoryUsage()` for an estimated footprint covering cells, shared strings, passthrough parts, and workbook metadata; the estimate refreshes V8 external-memory reporting. Garbage collection remains a fallback. WASM uses `delete()` for its native handle.

Choose Native Node when you build or stage the source-tree package and can deploy a platform-specific `.node` binary. It is useful for native threads and fewer heap copies on `loadBytes` / `save`. Choose WASM for browsers or Node deployments that cannot ship native addons.

### How do WASM and Native Node report invalid JavaScript arguments?

Where the binding performs strict argument validation, a wrong primitive type or nested field type raises `TypeError`; a non-finite, fractional, or out-of-range integer raises `RangeError`. The checks cover positional and nested arguments and run before the workbook mutation. Positional 64-bit cursor and offset arguments are limited to `Number.MAX_SAFE_INTEGER`; omitted or nullish optional fields keep their declared defaults.

Byte inputs such as `loadBytes` and image APIs require a `Uint8Array`. A Node `Buffer` qualifies because it is a `Uint8Array`; a string does not. Nested string fields accept a JavaScript string or a one-byte buffer, including a `Buffer` on Native Node, but arbitrary coercible objects are not accepted. These binding-input failures are separate from status envelopes, host failures, and Excel cell-error values.

### Does it work offline?

Local calculation works offline. WASM, Python, Native Node, and CLI process the formula or workbook bytes locally.

Service-backed functions such as `WEBSERVICE`, `STOCKHISTORY`, `TRANSLATE`, and `COPILOT` do not execute in Formulon, online or offline.

### Is workbook data sent anywhere?

The core engine processes workbook bytes locally. The WASM, Python, Native Node, and CLI surfaces do not need a Formulon-hosted service for calculation.

Your host application can still send files elsewhere if you build it that way. MCP deployments also depend on the client and filesystem permissions you grant to the agent.

### Do browser deployments need COOP / COEP?

Only the pthread-backed WASM path needs these headers. The default `@libraz/formulon` entry uses ordinary memory and runs in a browser without cross-origin isolation. Import `@libraz/formulon/threads` for parallel worker execution; browsers require `SharedArrayBuffer`, which normally means serving that entry with:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without those headers, `@libraz/formulon/threads` cannot initialize its pthread pool and its factory rejects. The default `@libraz/formulon` factory does not need the headers. For the UI kit, follow the [formulon-cell bundler guide](/cell/bundler); engine initialization failures should be handled with `onError` or `try`/`catch`.

### Are Vite warnings about `node:module` or `node:worker_threads` a problem?

Usually no. The `@libraz/formulon` WASM factory contains a Node runtime branch, and the threads entry also contains a `node:worker_threads` branch, so browser bundlers can warn that Node modules were externalized. Those branches are dead code in browsers.

If the build fails rather than only warning, use ES module workers and an `es2022` or newer build target. See [Troubleshooting](/start/troubleshooting).

## Use Cases

### What is Formulon good for?

It fits systems that treat Excel workbooks as part of an application or workflow: browser quote tools, server-side report calculation, CI checks for workbook result drift, Python batch jobs, and AI-agent workbook editing.

It is not a desktop Excel replacement, a VBA runtime, a Power Query / DAX engine, or a live external-data refresh platform. See [Scenarios](/scenarios/).

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

`@libraz/formulon-mcp` is a stdio MCP server exposing Formulon workbook operations to AI agents. It provides {{ MCP_TOOL_COUNT }} tools for opening `.xlsx` or `.xlsb` files, inspecting workbook structure, editing cells and sheets, building and styling documents, configuring printing, recalculating, and saving. [Image operations](/mcp/layout-preview#images) retrieve, insert, and remove pictures; previews render supported pictures and report drawing and page metadata. Node.js 22 or newer is required.

```sh
npx -y @libraz/formulon-mcp
```

See [MCP](/mcp/).

### Can agents execute arbitrary code through it?

The tools do not expose a shell or a general-purpose code evaluator. The MCP server validates inputs and identifies each open workbook by `sessionId`. The low-level `formulon_workbook_call` tool only dispatches `Workbook` methods listed in `formulon-mcp`'s `src/session/workbook-call.ts`. A session ID identifies a workbook; it is not an authorization boundary.

The MCP server can still read and write files, so production use should control the client permissions, working directory, and allowed file scope.

## License

### How is Formulon licensed?

`formulon`, `formulon-cell`, and `formulon-mcp` are Apache-2.0. You may use, modify, and redistribute them under the license terms.
