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
- typed sheet and table AutoFilters,
- hyperlinks,
- merges,
- data validations,
- conditional formatting,
- pivot tables and pivot caches,
- drawing objects and raster pictures,
- external links,
- phonetic (furigana) annotations, including per-run UTF-16 spans and their `phoneticPr` rendering properties,
- protection metadata,
- sheet views, freeze panes, hidden tabs,
- per-row / per-column overrides.

Worksheet print settings are editable through typed setters for page setup, margins, print options, print area, print titles, header/footer, and manual row/column breaks. Raw XML setters remain available for modeled gaps, and malformed fragments are rejected before they are stored. Cell, defined-name, conditional-format, and data-validation formulas can enter external references by book name or path; an unregistered book creates an external-link record, while repeated references reuse it case-insensitively. XLSX and XLSB writers preserve the link table and formula through save/reload. External formulas use cached cells and names only: Formulon does not open the source workbook or fetch a network target.

Sheet and table AutoFilters have typed read, write, evaluate, apply, clear, and remove operations. They cover value, date-group, custom, top-10, dynamic, colour, and icon criteria as well as sort state. Setting or replacing a filter leaves row visibility unchanged. `evaluateAutoFilter()` reports matches without changing the sheet, while `applyAutoFilter()` updates hidden rows and marks dependent `SUBTOTAL` / `AGGREGATE` formulas dirty; call `recalc()` before reading their updated values. `clearAutoFilter()` removes the criteria and shows the body rows. Data-validation rules can be checked with `validateValue()` for a proposed value, and `listInvalidCells()` scans populated cells using their stored values. `validateValue()` reports the outcome without storing the proposed value or enforcing later edits; custom formulas and rule bounds read the stored workbook.

Drawing objects can be listed with their anchors. PNG, JPEG, GIF, and BMP picture bytes can be probed, read, inserted, and removed in XLSX. Picture-byte and anchor manipulation does not render charts or other drawing objects.

Phonetic runs and rendering properties round-trip through XLSX and XLSB. Font theme `scheme` values also round-trip, so a theme-linked Normal font remains linked after save.

::: tip Caching behavior
On load, formula cells keep both the formula text and the cached value found in the file. After `recalc()`, the cached values are replaced with the engine's computed values; on save, the file contains coherent formula / value pairs.
:::

## XLSB

The binary workbook path models and emits styles (`BrtFmt`/`BrtXF`), row/column layout, merges, `date1904`, view/zoom/frozen panes, dynamic-array metadata, and supported tokenized formulas. XLSB pivot cache definitions, cache records, and pivot-table parts are decoded into the pivot model and evaluated when their record encoding is supported; unmeasured encodings are skipped rather than guessed.

Conditional-format rules, data validations, and sheet/workbook protection are decoded into the shared model and emitted on save. Conditional-format rules include the supported evaluation subset and visual payloads such as x14 data bars. Data-validation rules can be checked against an explicit proposed value with `validateValue()`; the call reports the outcome without storing the value or enforcing a mutation. Custom validation formulas and rule bounds read the stored workbook. Protection remains metadata, and the calculation engine does not enforce cell locks.

Typed AutoFilters apply to XLSX and in-memory workbooks. An AutoFilter loaded from XLSB remains an opaque worksheet-tail record and is unavailable through the typed API. Typed AutoFilter edits are deferred when saving as XLSB and are reported by `saveWithDiagnostics()` as `deferredFeatureCount` (`deferred_feature_count` in Python). Selected unmodeled worksheet tails remain verbatim, including AutoFilter records loaded from XLSB, print setup/breaks, drawing/table references, and their relationships. Hyperlinks are modeled and emitted by the XLSB writer. Classic notes, threaded comments, and OOXML drawings are omitted on XLSB save, whether loaded from XLSX or inserted. The page/print fields listed below and modeled tables are also deferred; compatible retained XLSB tails and drawing parts may pass through. The table below lists the diagnosed omissions. Unsupported formulas may downgrade to cached literals; `saveWithDiagnostics(WorkbookFormat.Xlsb)` reports the count as `downgradedFormulaCount` (Python: `save_with_diagnostics(WorkbookFormat.XLSB)` and `downgraded_formula_count`).

| XLSB feature | Current behavior |
| --- | --- |
| Styles (`BrtFmt` / `BrtXF`) | modeled and emitted |
| Row/column layout, merges | modeled and emitted |
| `date1904`, view/zoom/frozen panes | modeled and emitted |
| Dynamic-array metadata and supported tokenized formulas | modeled and emitted |
| Pivot cache and PivotTable parts | evaluated when the record encoding is supported; unmeasured encodings are skipped |
| Conditional formatting | modeled and emitted; supported predicates are evaluated and visual payloads, including x14 data bars, are retained |
| Data validation | modeled and emitted; explicit proposed-value and stored-cell checks are available, without automatic mutation or enforcement |
| Sheet/workbook protection | modeled and emitted as metadata; the engine does not enforce cell locks |
| AutoFilter | XLSB-loaded definitions remain opaque and are not visible to the typed API; typed edits are deferred and reported |
| Hyperlinks | modeled and emitted from the workbook model |
| Print settings/breaks, drawing/table references, and relationships | preserved verbatim when unmodeled; modeled edits are deferred and reported; compatible retained tails may pass through |
| Classic notes / threaded comments | omitted and reported by `deferredFeatureCount` |
| OOXML drawings, including loaded and inserted pictures | omitted and reported once per sheet drawing target; compatible retained XLSB drawing parts may pass through |
| Modeled page setup, margins, print options, header/footer, manual breaks / tables | changes are not emitted and are reported; compatible retained XLSB tails may pass through |
| Nonautomatic calculation / enabled iterative calculation | not saved; reopen as automatic with iteration disabled; each setting is reported |
| Unrepresentable sheet defaults / workbook protection fields | reported when omitted, including `lockWindows`, `lockRevision`, and the revisions password |
| Unsupported formulas | may downgrade to cached literals; downgrade count is reported |

Print area and print titles are defined names and are emitted to XLSB; they are separate from the deferred page/print fields above. Do not infer comment or pivot preservation from the tail-preservation rule. Keep a source workbook and verify the emitted package when those features matter.

Saving is explicit about container format: `saveAs(format)` / `save_as(fmt)` take a `WorkbookFormat` to choose XLSB over XLSX. `saveWithDiagnostics(format)` / `save_with_diagnostics(fmt)` use the same selector and expose partial loss counters, while `readDiagnostics()` / `read_diagnostics()` expose counters captured during load. The CLI derives its output choice from the `-o` path's extension (`-o out.xlsb` writes MS-XLSB; anything else writes OOXML). Loading, in contrast, is content-sniffed: `loadBytes()` / `Workbook.load()` open both formats as ZIP packages and inspect their workbook parts and content types, normally `xl/workbook.xml` for XLSX and `xl/workbook.bin` for XLSB. The file name is not used for detection.

The panel below writes one workbook into both containers and hands each result straight back to `loadBytes()`, with no file name to go on. The counters are whatever `saveWithDiagnostics()` reported for that write; an all-zero panel means none of the reported loss categories occurred on it. The counters are partial diagnostics, so verify business-critical structures in the emitted package as well.

All ZIP entries in saved XLSX and XLSB files use the fixed timestamp `1980-01-01 00:00`. Saving the same unchanged workbook model in the same format produces identical bytes, allowing byte-for-byte comparisons in regression tests.

<FormatDemo />

## What is preserved vs. evaluated

<DiagramLayers :layers="[
  { title: 'Input', nodes: ['*.xlsx / *.xlsb bytes in'] },
  { title: 'Read', nodes: ['Reader'] },
  { nodes: [
      { label: 'Modeled parts', note: 'cells · formulas · names · tables · CF subset · validations · typed AutoFilters · picture anchors · protection metadata' },
      { label: 'Passthrough parts', note: 'charts · shapes · groups · form controls · VBA · opaque XLSB tails' }
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
| Defined names | yes | yes (resolved as references) | yes |
| Tables | yes | yes (resolved as references) | XLSX yes; XLSB modeled edits are deferred and reported; compatible retained parts may pass through |
| Conditional formatting | yes | partial (evaluate subset) | yes |
| Data validation | yes | explicit `validateValue()` / `listInvalidCells()` checks; no automatic mutation or enforcement | yes |
| Sheet/workbook protection | yes | no (metadata only; locks are not enforced) | yes |
| AutoFilter | typed when parsed; XLSB-loaded filters are opaque | explicit `evaluateAutoFilter()`; `applyAutoFilter()` updates row visibility and marks dependent `SUBTOTAL` / `AGGREGATE` formulas dirty; call `recalc()` before reading updated values | XLSX yes; XLSB typed edits deferred and reported |
| Hyperlinks | modeled | no | modeled hyperlinks are emitted in XLSX and XLSB |
| Print settings / breaks | typed in XLSX; opaque tails when loaded from XLSB | no | XLSX yes; XLSB modeled edits are deferred and reported; compatible retained tails may pass through |
| Drawing references | drawing objects can be listed; picture/chart support applies | no | preserved where supported; XLSB follows the picture and chart rules |
| Pivot tables | layout / supported cache | `pivotLayout()` / `GETPIVOTDATA` can aggregate or read supported cached records; no worksheet-source cache refresh | XLSX yes; XLSB unchanged compatible retained parts pass through, missing counterparts are deferred and reported, and changed retained parts fail the save |
| Pictures | XLSX picture bytes and anchors can be read and edited | no | XLSX yes; OOXML drawings omitted from XLSB and reported |
| Threaded comments | XLSX modeled | no | XLSX yes; omitted from XLSB and reported |
| Charts / shapes / groups | drawing objects can be listed; parts are preserved where supported | no rendering | parts are preserved where supported; no rendering |
| Form controls | passthrough | no | yes |
| VBA project | passthrough | never | yes |

::: warning VBA is preserved, not run
Workbooks containing VBA can round-trip through Formulon, but macros are never executed. Calculations that depend on macro-side state will diverge from Excel.
:::

## Non-goals

- Legacy `.xls` (BIFF) read / write.
- CSV read/write is not implemented. Parse CSV in the host and populate cells through the workbook API.
- Live external connections (Power Query, OLE DB, Web).

## Read next

- [Lifecycle](/workbook/lifecycle) — how bytes become the workbook model.
- [Operations](/workbook/operations) — sheet, cell, and structure edits.
- [Filters and validation](/workbook/filters-validation) — typed AutoFilters and explicit data-validation checks.
- [Comments and images](/workbook/comments-images) — threaded comments and anchored picture operations.
- [Presentation and geometry](/workbook/presentation) — drawing boundaries and workbook presentation metadata.
- [Compatibility / File format support](/compatibility/file-format-support) — read / write / preserve matrix.
