# Formula Coverage

This page explains which Excel function names Formulon recognizes and which of them execute locally. Internally, it reflects the runtime registry report from `RegistryCatalog.CoverageReport` and the availability annotations in `tools/catalog/function_status.tsv`.

::: warning Recognized does not mean locally executable
The 522-function number is the count of Excel function names Formulon recognizes. It includes names that Excel routes to external services or host-specific state, such as `COPILOT`, `PY`, `IMAGE`, `RTD`, `STOCKHISTORY`, `WEBSERVICE`, translation functions, and CUBE connection functions. Those are recognized deliberately, but they are not local implementations.
:::

## Summary

Formulon recognizes **522** Excel function names: **507 real implementations, including 2 environment-bound (`CELL`, `INFO`), plus 15 unavailable stubs**.

| Status | Count | Meaning |
| --- | ---: | --- |
| Real implementation | 507 | Evaluated locally; 2 (`CELL`, `INFO`) depend on workbook or host state |
| Unavailable service stub | 15 | Recognized by name and arity, but returns a deterministic Excel error because the required external service is outside Formulon |
| **Total recognized** | **522** | |

<DiagramLayers :layers="[
  { title: '522 recognized function names', nodes: [
    { label: '507 real implementations', note: 'includes CELL, INFO' },
    { label: '15 unavailable service stubs', note: 'service/connection dependent' }
  ] }
]" />

This is the honest compatibility claim: Formulon has broad local formula coverage, but it does not embed Microsoft 365 cloud services, a Python cloud runtime, an HTTP client, an OLAP cube connection, an RTD COM provider, or Copilot.

The panel below reads that same registry at runtime — `functionNames()` for the index, `functionMetadata(name, locale)` for arity, availability class, and signature — and tallies the availability classes from the engine rather than from this page, so it answers per function what the tables here answer in aggregate. Its try-it field evaluates a call, which is the shortest way to see what a recognized-but-unavailable name actually returns instead of inferring it from the table below.

<FunctionLookupDemo />

## Recognized Functions By Category

| Category | Recognized | Notes |
| --- | ---: | ---: |
| Math & Trig | 81 | Local implementation |
| Statistical | 149 | Local implementation |
| Logical | 20 | Local implementation |
| Text | 50 | Local implementation |
| Date & Time | 25 | Local implementation |
| Lookup & Reference | 39 | Local implementation, including dynamic-array lookup behavior; `IMAGE` and `RTD` are unavailable service stubs |
| Financial | 56 | Includes `STOCKHISTORY` as an unavailable service stub |
| Engineering | 54 | Local implementation |
| Information | 19 | Includes environment-bound `CELL` and `INFO`; no unavailable service stubs in this category |
| Database | 12 | Local implementation |
| Web | 4 | `ENCODEURL` and `FILTERXML` are implemented; `WEBSERVICE` and `PY` are unavailable service stubs |
| Cube | 7 | Recognized as unavailable service stubs; live OLAP connections are outside Formulon |
| 2024 / 2025 additions | 6 | Includes unavailable service stubs such as `COPILOT`, `TRANSLATE`, and `DETECTLANGUAGE` |

## Workbook oracle track

Formula oracle cases check cell values. Pivot tables and print layout need a workbook-level oracle because their behavior is stored in workbook structures, not just formula results.

That track uses `win-365-ja_JP` as its primary profile because reliable PivotTable automation depends on Windows Excel COM. Pivot suites close at `28/28`. The `print_basic`, `print_pagination`, `print_fit`, and `print_matrix` suites pass `35/41` cases through `formulon_workbook_oracle_tests`; the remaining `6` are documented `win-365-ja_JP` divergence skips for a known Excel PageBreakPreview COM quirk at `PageSetup.Zoom <= 50`.

Both figures are results against the **checked-in historical golden**, which is Office 2019 or unknown-version and retained as reference-only. Re-capturing them on a product-verified Windows Microsoft 365 host is still outstanding, so neither number counts as Microsoft 365 verification — see [Locale Profiles](./locale-profiles.md) for what `wanted` means for this profile.

## Unavailable service stubs

These names are intentionally recognized so workbooks fail in a predictable, Excel-shaped way instead of producing `#NAME?` from an unknown parser path. They are outside Formulon's local calculation boundary.

| Function(s) | Why it is not locally implemented | Formulon behavior |
| --- | --- | --- |
| `COPILOT` | Requires the Microsoft 365 Copilot / LLM service | Fixed unavailable error surface |
| `PY` | Requires Microsoft 365's hosted Python runtime | Fixed unavailable error surface |
| `IMAGE` | Requires image fetching and rendering host support | Fixed unavailable error surface |
| `RTD` | Requires an external Real-Time-Data provider | Fixed unavailable error surface |
| `STOCKHISTORY` | Requires Microsoft market-data service / network I/O | Fixed unavailable error surface |
| `WEBSERVICE` | Requires HTTP/network I/O | Fixed unavailable error surface |
| `TRANSLATE`, `DETECTLANGUAGE` | Require cloud translation / language services | Fixed unavailable error surface |
| `CUBEKPIMEMBER`, `CUBEMEMBER`, `CUBEMEMBERPROPERTY`, `CUBERANKEDMEMBER`, `CUBESET`, `CUBESETCOUNT`, `CUBEVALUE` | Require a live OLAP cube connection | Fixed unavailable error surface |

## Practical guidance

For an existing workbook, treat formula coverage as the first gate, not the final proof. Create a small fixture for every business-critical formula family and compare results against your target Excel profile.

Use the CLI to inspect a workbook:

```sh
formulon dump --formulas workbook.xlsx > formulas.txt
```

Then create a small fixture for every business-critical formula family and run it through both Formulon and your target Excel profile.

## Source of truth

The recognized-name list lives in `tools/catalog/functions.txt`. Availability annotations live in `tools/catalog/function_status.tsv`; omitted entries default to real local implementations. The runtime registry test verifies that recognized names resolve at runtime, while the status file prevents that recognition count from being mistaken for a local implementation count.
