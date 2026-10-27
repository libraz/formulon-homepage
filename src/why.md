# Why Formulon

Formulon is for products that need to calculate Excel workbooks without running Excel. It reads `.xlsx` and `.xlsb`, evaluates and recalculates formulas, edits cells and structure, and writes the file back, all in your own process. The same C++17 engine is packaged for the browser, Node, Python, the shell, and AI agents.

<DiagramLayers :layers="[
  { title: 'Your product', nodes: [
    { label: 'Browser app', note: 'files stay on the device', tone: 'alt' },
    { label: 'Service or job', note: 'Node, Python, CI', tone: 'alt' },
    { label: 'AI agent', note: 'over MCP', tone: 'alt' }
  ] },
  { title: 'Surfaces', nodes: [
    { label: '@libraz/formulon', note: 'WASM · browser and Node' },
    { label: '@libraz/formulon-native', note: 'Node addon · source build' },
    { label: 'formulon (PyPI)', note: 'Python wheel' },
    { label: 'formulon CLI', note: 'shell and CI' },
    { label: '@libraz/formulon-mcp', note: 'MCP server' }
  ] },
  { title: 'Core', nodes: [{ label: 'formulon', note: 'one C++17 engine, checked against Excel' }] }
]" label="Your browser app, service or job, and AI agent each reach the same C++17 core through one of five surfaces: the WASM package, the Native Node addon, the Python wheel, the CLI, or the MCP server" caption="Every surface calls the same core, so a workbook gives the same result wherever it runs." />

## What you get

- Excel results without Excel: no desktop application, Microsoft runtime, or COM automation. Of the 526 function names Formulon recognizes, 511 run locally; the other 15 depend on Microsoft 365 services and return a fixed error.
- Compatibility you can check. Results are compared with values captured from real Excel 365, and each known difference is listed in `tests/divergence.yaml` with its reason and the Excel build it was last verified on. [How far compatibility goes](/compatibility/edge-cases) runs concrete cases live, from floating-point residue to Japanese era dates.
- The answer Excel gives in your locale. 28 profiles cover fourteen locales on Mac and Windows hosts, including text comparison and localized formula names. All Mac profiles and `win-365-ja_JP` are measured against captured Excel values; the other Windows profiles are estimates for now. New workbooks use `win-365-en_US` unless you select another. See [Locale profiles](/compatibility/locale-profiles).
- Workbook data stays with you. Calculation runs in your process and no Formulon-hosted service sees the file; in a browser, an uploaded workbook never has to leave the device.
- The same value on every runtime. Browser, Python, CLI, Native Node, and MCP share the core, so a result you verified in one is the result you get in another.
- Whole-workbook round trips: supported workbook structures are preserved while values are recalculated, so a file can be loaded, edited, recalculated, and saved rather than only having its formulas evaluated.

## Compared with the alternatives

| Option | Use it when | Where Formulon differs |
| --- | --- | --- |
| Excel itself | You need the real application, VBA, Power Query, live connections, or a final visual review | Runs headless in a browser, service, or job; no desktop app to automate |
| A desktop office suite in batch mode | You convert files in bulk and can accept that suite's calculation behavior | Targets measured Excel behavior per locale profile |
| A formula-only library | You evaluate formulas but never open or save `.xlsx` | Reads, edits, and writes the workbook itself |
| A cloud spreadsheet API | The workbook already lives in that hosted product | Calculates locally; the file is not sent to a hosted service |

## What it does not try to solve

The engine has no user interface and does not draw charts. For a spreadsheet UI in the browser, [formulon-cell](/cell/) builds one on top of the engine and renders the common chart families; it is in beta. Formulon does not run VBA, Power Query, or DAX, refresh live external data, or read legacy `.xls` files. Keeping those out is what lets the engine stay small enough to embed and test.

## Current status

Formulon is pre-1.0, and APIs and package layout may still change before the first stable release. Speed depends on workbook shape and formula mix, so there is no single benchmark number; measure with your own workbooks. For business-critical use, pin the Formulon version and profile, and keep representative workbooks as fixtures. The best current fit is controlled workbooks in server jobs, CI, internal tools, and embedded calculation.

## Read next

- [Use cases](/scenarios/) — browser upload, Node service, Python batch, CI regression, and agents.
- [Formula coverage](/compatibility/formula-coverage) — which functions run, and why 15 do not.
- [FAQ](/faq) — licensing, runtimes, and safety questions.
