# Formula Coverage

This page explains which Excel function names Formulon recognizes and which of them execute locally. Internally, it reflects the runtime registry report from `RegistryCatalog.CoverageReport` and the availability annotations in `tools/catalog/function_status.tsv`.

::: warning Recognized does not mean locally executable
The 522-function number is the count of Excel function names Formulon recognizes. It includes names that Excel routes to external services or host-specific state, such as `COPILOT`, `PY`, `IMAGE`, `RTD`, `STOCKHISTORY`, `WEBSERVICE`, translation functions, and CUBE connection functions. Those are recognized deliberately, but they are not local implementations.
:::

## Summary

Formulon currently recognizes **522** Excel function names. In v0.9.2, **505 / 522** are real local engine implementations. The full availability split is:

| Status | Count | Meaning |
| --- | ---: | --- |
| Real engine implementation | 505 | Evaluated locally by Formulon's calculation engine |
| Environment-bound | 2 | Recognized and implemented where possible, but some results depend on workbook or host state (`CELL`, `INFO`) |
| Unavailable service / connection stub | 15 | Recognized by name and arity, but returns a deterministic Excel error because the required external service is outside Formulon |

This is the honest compatibility claim: Formulon has broad local formula coverage, but it does not embed Microsoft 365 cloud services, a Python cloud runtime, an HTTP client, an OLAP cube connection, an RTD COM provider, or Copilot.

As of v0.9.2, several implemented-function edge cases were aligned with Excel oracle data: numeric literals now follow Excel's 15-significant-digit parsing surface; `ARRAYTOTEXT` propagates scalar error arguments; `PIVOTBY` layout matches the Mac Excel oracle more closely; `MAP` / `MAKEARRAY`, `FREQUENCY`, `WRAPROWS` / `WRAPCOLS`, and `TRIMRANGE` had covered edge cases adjusted; and `PERCENTILE.EXC` returns `#NUM!` at the upper boundary instead of the largest sample value.

## Recognized Functions By Category

| Category | Recognized | Notes |
| --- | ---: | ---: |
| Math & Trig | 81 | Local implementation |
| Statistical | 149 | Local implementation |
| Logical | 20 | Local implementation |
| Text | 50 | Local implementation |
| Date & Time | 25 | Local implementation |
| Lookup & Reference | 39 | Local implementation, including dynamic-array lookup behavior |
| Financial | 56 | Includes `STOCKHISTORY` as an unavailable service stub |
| Engineering | 54 | Local implementation |
| Information | 19 | Includes environment-bound `CELL` and `INFO`, plus unavailable service stubs such as `IMAGE`, `PY`, and `RTD` |
| Database | 12 | Local implementation |
| Web | 4 | `ENCODEURL` and `FILTERXML` are implemented; `WEBSERVICE` and `PY` are unavailable stubs |
| Cube | 7 | Recognized as unavailable connection stubs; live OLAP connections are outside Formulon |
| 2024 / 2025 additions | 6 | Includes unavailable cloud-service stubs such as `COPILOT`, `TRANSLATE`, and `DETECTLANGUAGE` |

## Unavailable stubs

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
