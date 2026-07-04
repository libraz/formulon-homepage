# File Format Support

## Summary

::: info Read, write, and preserve are separate concepts
Read means Formulon can parse the structure. Write means it can emit it. Preserve means it can carry it through a round-trip. Only evaluated features affect calculation.
:::

| Area | Status |
| --- | --- |
| `.xlsx` read | Implemented for workbook, sheets, cells, styles, shared strings, relationships, tables, names, comments, hyperlinks, merges, validations, conditional formatting, pivot structures |
| `.xlsx` write | Writes back everything the read row above lists — workbook, sheets, cells, styles, shared strings, relationships, tables, names, comments, hyperlinks, merges, validations, conditional formatting, and pivot structures — as part of recalculated workbook output |
| `.xlsb` read/write | Cell values, formulas (including cross-sheet 3-D references, `LET` and other future-function names, and dynamic-array spill formulas), and styles round-trip. Conditional formatting, pivot tables, comments, and data validation are still OOXML-only; array-constant literals are limited to numeric elements |
| `.xlsm` macro bytes | Preserve, never execute |
| Legacy `.xls` | Out of scope |
| Charts/drawings rendering | Out of scope |
| Pivot cache recomputation | Out of scope; structure preservation is in scope |

<DiagramLayers :layers="[
  { title: 'Support spectrum', nodes: [
    { label: '.xlsx', note: 'full — read, write, and round-trip' },
    { label: '.xlsb', note: 'partial — values/formulas/styles yes, CF/pivot/comments/validation no' },
    { label: '.xlsm', note: 'macro bytes pass through, never executed' },
    { label: '.xls', note: 'out of scope' }
  ] }
]" />

Formulon picks the container format from the output file extension (`-o file.xlsb` on the CLI, or `saveEx` / `save_ex` in the bindings) and sniffs content on read, so a `.xlsb`-named file with OOXML bytes (or vice versa) is still handled correctly.

## Recent round-trip updates

The v0.9.1 and v0.9.2 releases jointly tightened preservation for workbook relationships, shared-formula reference shifts, and print pagination metadata: v0.9.1 introduced round-tripping for page setup, margins, header/footer, print options, and opaque printer settings, and v0.9.2 closed residual cases and added oracle-side pagination-margin capture. That round-trip path remains part of the supported surface for modern `.xlsx` workflows.

The v0.9.3 release closed the major `.xlsb` protocol gaps reflected in the table above: style records, workbook-scope names (including `LET` and other future functions), cross-sheet 3-D references, and dynamic-array spill formulas. Several of these previously produced `.xlsb` files that real Excel could not open.

The v0.9.4 release round-trips data-validation dropdown visibility (`show_dropdown`) through OOXML. Excel stores this as an inverted `showDropDown` attribute, so Formulon exposes the host-facing `show_dropdown` meaning while preserving the file-format semantics on read/write.

## Preservation rule

If Formulon does not semantically own a workbook feature, the preferred behavior is to preserve the package structure where practical. This lets Formulon update values while another tool owns authoring, rendering, or review.

## Calculation rule

Only features represented in the calculation engine affect recalculation. Preserved structures are not automatically interpreted.
