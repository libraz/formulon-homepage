# File Format Support

## Summary

::: info Read, write, and preserve are separate concepts
Read means Formulon can parse the structure. Write means it can emit it. Preserve means it can carry it through a round-trip. Only evaluated features affect calculation.
:::

| Area | Status |
| --- | --- |
| `.xlsx` read | Implemented for workbook, sheets, cells, styles, shared strings, relationships, tables, names, comments, hyperlinks, merges, validations, conditional formatting, pivot structures |
| `.xlsx` write | Writes back everything the read row above lists — workbook, sheets, cells, styles, shared strings, relationships, tables, names, comments, hyperlinks, merges, validations, conditional formatting, and pivot structures — as part of recalculated workbook output |
| `.xlsb` read/write | Models/emits styles, row/column layout, merges, `date1904`, view/zoom/frozen panes, dynamic-array metadata, and supported tokenized formulas. Existing worksheet tails are preserved verbatim. |
| `.xlsm` macro bytes | Preserve, never execute |
| Legacy `.xls` | Out of scope |
| Charts/drawings rendering | Out of scope |
| Pivot cache recomputation | Out of scope; structure preservation is in scope |

<DiagramLayers :layers="[
  { title: 'Support spectrum', nodes: [
    { label: '.xlsx', note: 'full — read, write, and round-trip' },
    { label: '.xlsb', note: 'modeled core + verbatim worksheet tails' },
    { label: '.xlsm', note: 'macro bytes pass through, never executed' },
    { label: '.xls', note: 'out of scope' }
  ] }
]" />

Formulon picks the container format from the output file extension (`-o file.xlsb` on the CLI, or `saveAs` / `save_as` in the bindings) and sniffs content on read, so a `.xlsb`-named file with OOXML bytes (or vice versa) is still handled correctly.

## Preservation rule

If Formulon does not semantically own a workbook feature, the preferred behavior is to preserve the package structure where practical. This lets Formulon update values while another tool owns authoring, rendering, or review.

## Calculation rule

Only features represented in the calculation engine affect recalculation. Preserved structures are not automatically interpreted.
