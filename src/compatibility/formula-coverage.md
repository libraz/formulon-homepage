# Formula Coverage

This page reflects the runtime registry report from `RegistryCatalog.CoverageReport`.

::: info Function coverage and workbook compatibility are different
All catalogued functions are registered today. That does not mean every workbook matches every Excel build: locale behavior, file structures, cached values, volatile functions, and edge-case coercion still need fixture-based validation.
:::

## Summary

Formulon currently implements **522 / 522** catalogued Excel functions (**100.0%**) in the runtime registry. The catalog covers math, statistical, logical, text, date/time, lookup, financial, engineering, information, database, web, cube, and recent Excel additions.

## Category status

| Category | Implemented | Coverage |
| --- | ---: | ---: |
| Math & Trig | 81 / 81 | 100.0% |
| Statistical | 149 / 149 | 100.0% |
| Logical | 20 / 20 | 100.0% |
| Text | 50 / 50 | 100.0% |
| Date & Time | 25 / 25 | 100.0% |
| Lookup & Reference | 39 / 39 | 100.0% |
| Financial | 56 / 56 | 100.0% |
| Engineering | 54 / 54 | 100.0% |
| Information | 19 / 19 | 100.0% |
| Database | 12 / 12 | 100.0% |
| Web | 4 / 4 | 100.0% |
| Cube | 7 / 7 | 100.0% |
| 2024 / 2025 additions | 6 / 6 | 100.0% |

## Practical guidance

For an existing workbook, treat formula coverage as the first gate, not the final proof. Create a small fixture for every business-critical formula family and compare results against your target Excel profile.

Use the CLI to inspect a workbook:

```sh
formulon dump --formulas workbook.xlsx > formulas.txt
```

Then create a small fixture for every business-critical formula family and run it through both Formulon and your target Excel profile.

## Source of truth

The function catalog lives in `tools/catalog/functions.txt`. The authoritative implementation count comes from the runtime registry test, which includes normal builtins, lazy-dispatched functions, and parser-integrated special forms.
