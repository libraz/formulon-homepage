# File Format Support

## Summary

::: info Read, write, and preserve are separate concepts
Read means Formulon can parse the structure. Write means it can emit it. Preserve means it can carry it through a round-trip. Only evaluated features affect calculation.
:::

| Area | Status |
| --- | --- |
| `.xlsx` read | Implemented for workbook, sheets, cells, styles, shared strings, relationships, tables, names, comments, hyperlinks, merges, validations, conditional formatting, pivot structures |
| `.xlsx` write | Writes the modeled workbook features listed above and preserves package parts where supported; verify business-critical structures in the emitted package |
| `.xlsb` read/write | Models/emits styles, row/column layout, merges, `date1904`, view/zoom/frozen panes, dynamic-array metadata, supported tokenized formulas, conditional formatting, data validation, and sheet/workbook protection metadata. Selected unmodeled worksheet tails are preserved verbatim. |
| `.xlsm` macro bytes | Preserve, never execute |
| Legacy `.xls` | Out of scope |
| Charts/drawings rendering | Out of scope |
| Pivot cache refresh from worksheet or external source data | Out of scope; supported cached structures can be preserved and projected |

<DiagramLayers :layers="[
  { title: 'Support spectrum', nodes: [
    { label: '.xlsx', note: 'modeled workbook features + preserved package parts' },
    { label: '.xlsb', note: 'modeled CF/validation/protection + selected verbatim tails' },
    { label: '.xlsm', note: 'macro bytes pass through, never executed' },
    { label: '.xls', note: 'out of scope' }
  ] }
]" />

The CLI picks the output container from the `-o` file extension. Bindings pick it from the explicit `WorkbookFormat` passed to `saveAs(format)` / `save_as(fmt)`. Readers inspect package contents, so a file name does not select the input format.

## Preservation rule

If Formulon does not semantically own a workbook feature, the preferred behavior is to preserve the package structure where practical. This lets Formulon update values while another tool owns authoring, rendering, or review.

## Calculation rule

Only features represented in the calculation engine affect recalculation. Preserved structures are not automatically interpreted.
