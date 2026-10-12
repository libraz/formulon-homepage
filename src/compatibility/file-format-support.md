# File Format Support

## Summary

::: info Read, write, and preserve are separate concepts
Read means Formulon can parse the structure. Write means it can emit it. Preserve means it can carry it through a round-trip. Only evaluated features affect calculation.
:::

| Area | Status |
| --- | --- |
| `.xlsx` read | Implemented for workbook, sheets, cells, styles, shared strings, relationships, tables, names, comments, threaded comments and people, hyperlinks, merges, typed AutoFilters, validations, conditional formatting, pivot structures, drawing objects, and pictures |
| `.xlsx` write | Writes the modeled workbook features listed above, including typed AutoFilter and picture edits, and preserves package parts where supported; verify business-critical structures in the emitted package |
| Data-validation evaluation | `validateValue()` checks an explicit proposed value and `listInvalidCells()` checks stored cell values; neither mutates cells or enforces later edits |
| `.xlsb` read/write | Models/emits styles, row/column layout, merges, `date1904`, view/zoom/frozen panes, dynamic-array metadata, supported tokenized formulas, conditional formatting, data validation, and sheet/workbook protection metadata. AutoFilters loaded from XLSB remain opaque worksheet tails; typed edits are deferred and reported. Classic notes, threaded comments, and OOXML drawings are omitted on XLSB save and reported; see the [XLSB boundaries](/workbook/file-formats#xlsb). |
| `.xlsm` macro bytes | Preserve, never execute |
| Legacy `.xls` | Out of scope |
| Charts/drawings rendering | Out of scope. XLSX picture bytes and anchors can be probed, read, inserted, and removed; drawing objects can be listed, but charts, shapes, and groups are not rendered. |
| Pivot cache refresh from worksheet or external source data | Out of scope; supported cached structures can be preserved and projected |

<DiagramLayers :layers="[
  { title: 'Support spectrum', nodes: [
    { label: '.xlsx', note: 'modeled filters/validation/comments/pictures + preserved package parts' },
    { label: '.xlsb', note: 'modeled CF/validation/protection + opaque filter tails; OOXML drawings and comments omitted on save' },
    { label: '.xlsm', note: 'macro bytes pass through, never executed' },
    { label: '.xls', note: 'out of scope' }
  ] }
]" />

The CLI picks the output container from the `-o` file extension. Bindings pick it from the explicit `WorkbookFormat` passed to `saveAs(format)` / `save_as(fmt)`. Readers inspect package contents, so a file name does not select the input format.

## Preservation rule

For XLSX, Formulon semantically owns the typed AutoFilter and picture operations described above. Charts, shapes, and groups remain structural data; rendering belongs to another tool. For XLSB, an AutoFilter read from the package stays opaque and typed edits are deferred. Classic notes, threaded comments, and OOXML drawings are omitted on XLSB save. Page setup, margins, print options, header/footer, manual breaks, tables, and nondefault calculation settings are also deferred; see [File formats](/workbook/file-formats#xlsb). `saveWithDiagnostics()` / `save_with_diagnostics()` expose these deferred features through `deferredFeatureCount` / `deferred_feature_count`. Other features that Formulon does not semantically own are preserved as package structure where practical, so another tool can continue to own authoring or rendering.

## Calculation rule

Only features represented in the calculation engine affect recalculation. `evaluateAutoFilter()` and `validateValue()` are explicit checks; `applyAutoFilter()` changes row visibility and marks dependent `SUBTOTAL` / `AGGREGATE` formulas dirty, so call `recalc()` before reading updated values, while `validateValue()` never stores its proposed value. Preserved structures are not automatically interpreted.

See [Filters and validation](/workbook/filters-validation), [Comments and images](/workbook/comments-images), and [Presentation and geometry](/workbook/presentation) for the API boundaries behind this matrix.
