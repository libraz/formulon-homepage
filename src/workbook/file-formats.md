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
- phonetic (furigana) annotations, including per-run UTF-16 spans and their `phoneticPr` rendering properties,
- protection metadata,
- sheet views, freeze panes, hidden tabs,
- per-row / per-column overrides.

Worksheet print settings are editable through typed setters for page setup, margins, print options, print area, print titles, header/footer, and manual row/column breaks. Raw XML setters remain available for modeled gaps, and malformed fragments are rejected before they are stored. External-link formulas use the index-spelled forms bound to the package's external-link table; path-spelled `[Book1.xlsx]Sheet1!A1` references are not resolved.

Phonetic runs and rendering properties round-trip through XLSX and XLSB. Font theme `scheme` values also round-trip, so a theme-linked Normal font remains linked after save.

::: tip Caching behavior
On load, formula cells keep both the formula text and the cached value found in the file. After `recalc()`, the cached values are replaced with the engine's computed values; on save, the file contains coherent formula / value pairs.
:::

## XLSB

The binary workbook path models and emits styles (`BrtFmt`/`BrtXF`), row/column layout, merges, `date1904`, view/zoom/frozen panes, dynamic-array metadata, and supported tokenized formulas. XLSB pivot cache definitions, cache records, and pivot-table parts are decoded into the pivot model and evaluated when their record encoding is supported; unmeasured encodings are skipped rather than guessed. Conditional-format rules, data validations, and sheet/workbook protection are also decoded into the shared model and emitted on save. Conditional-format rules include the supported evaluation subset and visual payloads such as x14 data bars; validation rules and protection are modeled metadata and are not evaluated or enforced by the calculation engine. Selected unmodeled worksheet tails remain verbatim, including hyperlinks, auto-filter, print setup/breaks, drawing/table references, and their relationships. Unsupported formulas may downgrade to cached literals; `saveWithDiagnostics(WorkbookFormat.Xlsb)` reports the count as `downgradedFormulaCount` (Python: `save_with_diagnostics(WorkbookFormat.XLSB)` and `downgraded_formula_count`).

| XLSB feature | Current behavior |
| --- | --- |
| Styles (`BrtFmt` / `BrtXF`) | modeled and emitted |
| Row/column layout, merges | modeled and emitted |
| `date1904`, view/zoom/frozen panes | modeled and emitted |
| Dynamic-array metadata and supported tokenized formulas | modeled and emitted |
| Pivot cache and PivotTable parts | evaluated when the record encoding is supported; unmeasured encodings are skipped |
| Conditional formatting | modeled and emitted; supported predicates are evaluated and visual payloads, including x14 data bars, are retained |
| Data validation | modeled and emitted; rule payload is preserved but not engine-evaluated |
| Sheet/workbook protection | modeled and emitted as metadata; the engine does not enforce cell locks |
| Hyperlinks, AutoFilter, print settings/breaks, drawing/table references, and relationships | preserved verbatim when unmodeled; not generally editable/evaluated |
| Unsupported formulas | may downgrade to cached literals; downgrade count is reported |

Do not infer comment or pivot preservation from this tail-preservation rule. Keep a source workbook and verify the emitted package when those features matter.

Saving is explicit about container format: `saveAs(format)` / `save_as(fmt)` take a `WorkbookFormat` to choose XLSB over XLSX. `saveWithDiagnostics(format)` / `save_with_diagnostics(fmt)` use the same selector and expose partial loss counters, while `readDiagnostics()` / `read_diagnostics()` expose counters captured during load. The CLI derives its output choice from the `-o` path's extension (`-o out.xlsb` writes MS-XLSB; anything else writes OOXML). Loading, in contrast, is content-sniffed: `loadBytes()` / `Workbook.load()` open both formats as ZIP packages and inspect their workbook parts and content types, normally `xl/workbook.xml` for XLSX and `xl/workbook.bin` for XLSB. The file name is not used for detection.

The panel below writes one workbook into both containers and hands each result straight back to `loadBytes()`, with no file name to go on. The counters are whatever `saveWithDiagnostics()` reported for that write; an all-zero panel means none of the reported loss categories occurred on it. The counters are partial diagnostics, so verify business-critical structures in the emitted package as well.

<FormatDemo />

## What is preserved vs. evaluated

<DiagramLayers :layers="[
  { title: 'Input', nodes: ['*.xlsx / *.xlsb bytes in'] },
  { title: 'Read', nodes: ['Reader'] },
  { nodes: [
      { label: 'Modeled parts', note: 'cells · formulas · names · tables · CF subset · validations · protection metadata' },
      { label: 'Passthrough parts', note: 'charts · drawings · form controls · VBA' }
    ] },
  { nodes: [
      { label: 'Engine recalc', note: 'formula values and supported CF predicates' },
      { label: 'Preserved as bytes' }
    ] },
  { title: 'Write', nodes: ['Writer'] },
  { title: 'Output', nodes: ['*.xlsx / *.xlsb bytes out'] }
]" label="Read splits into modeled parts (recalculated where supported) and passthrough parts (preserved as bytes), both converging at the writer" />

| Feature | Read | Recalculate | Write |
| --- | --- | --- | --- |
| Formulas in cells | yes | yes | yes |
| Styles / number formats | yes | n/a | yes |
| Defined names / tables | yes | yes (resolved as references) | yes |
| Conditional formatting | yes | partial (evaluate subset) | yes |
| Data validation | yes | no (rule payload only) | yes |
| Sheet/workbook protection | yes | no (metadata only; locks are not enforced) | yes |
| Hyperlinks / AutoFilter / print settings / drawing references | unmodeled parts passthrough | no | yes |
| Pivot tables | layout / supported cache | `pivotLayout()` / `GETPIVOTDATA` can aggregate or read supported cached records; no worksheet-source cache refresh | yes |
| Charts | parts preserved | no | yes |
| Form controls / drawings | passthrough | no | yes |
| VBA project | passthrough | never | yes |

::: warning VBA is preserved, not run
Workbooks containing VBA can round-trip through Formulon, but macros are never executed. Calculations that depend on macro-side state will diverge from Excel.
:::

## Non-goals

- Legacy `.xls` (BIFF) read / write.
- CSV is supported only via simple ingestion; rich Excel CSV quoting edge cases are not the target.
- Live external connections (Power Query, OLE DB, Web).

## Read next

- [Lifecycle](/workbook/lifecycle) — how bytes become the workbook model.
- [Operations](/workbook/operations) — sheet, cell, and structure edits.
- [Compatibility / File format support](/compatibility/file-format-support) — read / write / preserve matrix.
