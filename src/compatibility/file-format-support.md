# File Format Support

## Summary

::: info Read / write / preserve are different claims
Read means Formulon can parse the structure. Write means it can emit it. Preserve means it can carry it through a round-trip. Only evaluated features affect calculation.
:::

| Area | Status |
| --- | --- |
| `.xlsx` read | Implemented for workbook, sheets, cells, styles, shared strings, relationships, tables, names, comments, hyperlinks, merges, validations, conditional formatting, pivot structures |
| `.xlsx` write | Implemented for recalculated workbook output and supported structures |
| `.xlsb` read/write | In place for modern binary workbook workflows |
| `.xlsm` macro bytes | Preserve, never execute |
| Legacy `.xls` | Out of scope |
| Charts/drawings rendering | Out of scope |
| Pivot cache recomputation | Out of scope; structure preservation is in scope |

## Preservation rule

If Formulon does not semantically own a workbook feature, the preferred behavior is to preserve the package structure where practical. This lets Formulon update values while another tool owns authoring, rendering, or review.

## Calculation rule

Only features represented in the calculation engine affect recalculation. Preserved structures are not automatically interpreted.
