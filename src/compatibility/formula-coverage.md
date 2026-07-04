# Formula Coverage

This page explains which Excel function names Formulon recognizes and which of them execute locally. Internally, it reflects the runtime registry report from `RegistryCatalog.CoverageReport` and the availability annotations in `tools/catalog/function_status.tsv`.

::: warning Recognized does not mean locally executable
The 522-function number is the count of Excel function names Formulon recognizes. It includes names that Excel routes to external services or host-specific state, such as `COPILOT`, `PY`, `IMAGE`, `RTD`, `STOCKHISTORY`, `WEBSERVICE`, translation functions, and CUBE connection functions. Those are recognized deliberately, but they are not local implementations.
:::

## Summary

Formulon currently recognizes **522** Excel function names. **505 / 522** are unconditionally real local engine implementations. The full availability split, which sums to 522, is:

| Status | Count | Meaning |
| --- | ---: | --- |
| Fully local implementation | 505 | Evaluated locally with no workbook/host-state dependency, covered by unit and/or oracle tests |
| Environment-bound | 2 | Also evaluated locally, but some results depend on workbook or host state (`CELL`, `INFO`) |
| Unavailable service stub | 15 | Recognized by name and arity, but returns a deterministic Excel error because the required external service is outside Formulon |
| **Total recognized** | **522** | |

<DiagramLayers :layers="[
  { title: '522 recognized function names', nodes: [
    { label: '505 fully local', note: 'no workbook/host state needed' },
    { label: '2 environment-bound', note: 'CELL, INFO — also local, but state-dependent' },
    { label: '15 unavailable service stubs', note: 'service/connection dependent' }
  ] }
]" />

::: info Why not 507?
Formulon's own README and `tools/catalog/status.py` report **507** real implementations. That figure is `done - unavailable` (522 − 15) and does not subtract the 2 environment-bound names, so it counts `CELL`/`INFO` twice — once as real, once as environment-bound. This page uses the strict, non-overlapping partition (505 + 2 + 15 = 522) instead.
:::

This is the honest compatibility claim: Formulon has broad local formula coverage, but it does not embed Microsoft 365 cloud services, a Python cloud runtime, an HTTP client, an OLAP cube connection, an RTD COM provider, or Copilot.

Current local verification is `14342/14342` fast tests passing and `4026/4026` primary formula-oracle cases passing with `166` documented skips. Those skips are explicit divergence, host-service, volatile/environment-bound, or driver-limitation cases; they are not silent unimplemented paths.

Of the 522 catalogued functions, `515` satisfy all six closure checks (`behaviors_declared`, `cases_cover_behaviors`, `golden_present`, `divergence_documented`, `not_in_pilot`, and `behavior_drift`). The remaining `7` (`FILTERXML`, `ARRAYTOTEXT`, `CONCAT`, `CHAR`, `TRUE`, `GETPIVOTDATA`, `PHONETIC`) are blocked on oracle metadata gaps, not known implementation mismatches.

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
