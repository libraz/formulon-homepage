# File Formats

Formulon focuses on modern Office Open XML and binary spreadsheet formats. The same calculation core sits behind every reader and writer, so the format layer is responsible for shape preservation and feature mapping rather than calculation behavior.

::: info Glossary: OOXML
Office Open XML — the ISO/IEC 29500 family of zipped XML formats Microsoft Office uses, including `.xlsx`, `.xlsm`, and `.xltx`. Each `.xlsx` is a ZIP container whose parts (workbook, sheets, styles, shared strings, relationships, …) describe the document.
:::

::: info Glossary: passthrough part
A workbook part that Formulon parses just enough to preserve on save without claiming semantic ownership. The bytes survive a recalculation round-trip even when the engine does not evaluate the feature.
:::

## XLSX

The OOXML reader/writer handles:

- workbook parts and relationships,
- worksheets and their cells, formulas, and cached values,
- styles, number formats, fonts, fills, borders, themes,
- shared strings,
- tables and defined names,
- comments and threaded comments,
- hyperlinks,
- merges,
- data validations,
- conditional formatting,
- pivot tables and pivot caches,
- external links,
- protection metadata,
- sheet views, freeze panes, hidden tabs,
- per-row / per-column overrides.

::: tip Caching behavior
On load, formula cells keep both the formula text and the cached value found in the file. After `recalc()`, the cached values are replaced with the engine's computed values; on save, the file contains coherent formula / value pairs.
:::

## XLSB

The binary workbook path models and emits styles (`BrtFmt`/`BrtXF`), row/column layout, merges, `date1904`, view/zoom/frozen panes, dynamic-array metadata, and supported tokenized formulas. Existing XLSB worksheet tails are preserved verbatim: conditional formatting, data validation, hyperlinks, auto-filter, print setup/breaks, drawing/table references, and their relationships. Preservation is not the same as editable or evaluated support. Unsupported formulas may downgrade to cached literals; the low-level `fm_workbook_save_xlsb_with_result` API reports the downgrade count.

| XLSB feature | Current behavior |
| --- | --- | --- |
| Styles (`BrtFmt` / `BrtXF`) | modeled and emitted |
| Row/column layout, merges | modeled and emitted |
| `date1904`, view/zoom/frozen panes | modeled and emitted |
| Dynamic-array metadata and supported tokenized formulas | modeled and emitted |
| Worksheet tails and relationships | preserved verbatim, not editable/evaluated |
| Unsupported formulas | may downgrade to cached literals; downgrade count is reported |

Do not infer comment or pivot preservation from this tail-preservation rule. Keep a source workbook and verify the emitted package when those features matter.

Saving is explicit about container format: `saveEx()` / `save_ex()` take a `WorkbookFormat` to choose XLSB over XLSX, and the CLI derives the same choice from the `-o` path's extension (`-o out.xlsb` writes MS-XLSB; anything else writes OOXML). Loading, in contrast, is content-sniffed: `loadBytes()` / `Workbook.load()` detect XLSX vs XLSB from the bytes themselves (ZIP signature vs BIFF12 record stream), not from a file name, so a `.xlsb` payload loads correctly even without a matching extension.

## What is preserved vs. evaluated

<DiagramLayers :layers="[
  { title: 'Input', nodes: ['*.xlsx / *.xlsb bytes in'] },
  { title: 'Read', nodes: ['Reader'] },
  { nodes: [
      { label: 'Evaluated parts', note: 'cells · formulas · defined names · tables · CF subset' },
      { label: 'Passthrough parts', note: 'charts · drawings · form controls · VBA' }
    ] },
  { nodes: [
      { label: 'Engine recalc' },
      { label: 'Preserved as bytes' }
    ] },
  { title: 'Write', nodes: ['Writer'] },
  { title: 'Output', nodes: ['*.xlsx / *.xlsb bytes out'] }
]" label="Read splits into evaluated parts (recalculated) and passthrough parts (preserved as bytes), both converging at the writer" />

| Feature | Read | Recalculate | Write |
| --- | --- | --- | --- |
| Formulas in cells | yes | yes | yes |
| Styles / number formats | yes | n/a | yes |
| Defined names / tables | yes | yes (resolved as references) | yes |
| Conditional formatting | yes | partial (evaluate subset) | yes |
| Pivot tables | layout / cache | no | yes |
| Charts | parts preserved | no | yes |
| Form controls / drawings | passthrough | no | yes |
| VBA project | passthrough | never | yes |

::: warning VBA is preserved, not run
Workbooks containing VBA can round-trip through Formulon, but macros are never executed. Calculations that depend on macro-side state will diverge from Excel.
:::

## Non-goals

- Legacy `.xls` (BIFF) read / write.
- CSV is supported only via simple ingestion; rich Excel CSV quoting edge cases are not the target.
- Live external connections (PowerQuery, OLE DB, Web).

## Read next

- [Lifecycle](/workbook/lifecycle) — how bytes become the workbook model.
- [Operations](/workbook/operations) — sheet, cell, and structure edits.
- [Compatibility / File format support](/compatibility/file-format-support) — read / write / preserve matrix.
