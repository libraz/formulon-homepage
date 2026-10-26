# Advanced Workbook API

The dedicated MCP tools cover common workbook work. The server declares `@libraz/formulon` with the `^0.18.0` dependency range; confirm the installed engine version in each catalog response. `formulon_workbook_api` and `formulon_workbook_call` expose a controlled route to additional methods in the installed Formulon `Workbook` class. The API catalog is read from the package that the server actually loaded, including its signatures, documentation, access mode, and referenced TypeScript declarations. Discover the method first, then call the exact installed signature.

## Function lookup and Excel profiles

Use `formulon_function_lookup` for function names, metadata, and locale conversion. `operation` is one of `names`, `metadata`, `localize`, `canonicalize`, `localizeFormula`, `canonicalizeFormula`, or `localeFacts`. `profile` is an [Excel profile](/mcp/workflow#excel-profile) id such as `win-365-de_DE` and selects the target; it defaults to the session's profile. `metadata` is locale-invariant, and `names` lists the canonical function names.

| Operation | Input | Result |
| --- | --- | --- |
| `localize`, `canonicalize` | `name` | A single function name translated to or from the profile's spelling. Excel localizes function names for de_DE, fr_FR, es_ES, es_MX, pt_BR, ru_RU, it_IT, and nl_NL; other profiles keep English names. |
| `localizeFormula`, `canonicalizeFormula` | `formula` | A whole formula rewritten between the stored English form and the profile's spelling, including separators and decimal literals. |
| `localeFacts` | none | Separators, boolean names, date order, currency layout, localized error names, `measured`, and `collationMeasured`. |

```json
{
  "name": "formulon_function_lookup",
  "arguments": {
    "sessionId": "work",
    "operation": "localizeFormula",
    "formula": "=SUM(A1,1.5)",
    "profile": "win-365-de_DE"
  }
}
```

With `de_DE`, `=SUM(A1,1.5)` becomes `=SUMME(A1;1,5)`, and `canonicalizeFormula` reverses it.

## Discover, describe, then call

Search the live catalog by method name, signature text, or source documentation:

```json
{
  "name": "formulon_workbook_api",
  "arguments": {
    "operation": "search",
    "query": "pivotLayout",
    "limit": 20,
    "offset": 0
  }
}
```

Search returns the loaded engine `version`, the operation, `total`, `count`, `truncated`, and a `methods` array. `limit` defaults to 20 and is capped at 100. `offset` is zero-based. The query is a case-insensitive substring match against method names, signatures, and documentation.

Describe one exact method before constructing positional arguments:

```json
{
  "name": "formulon_workbook_api",
  "arguments": {
    "operation": "describe",
    "method": "createTable"
  }
}
```

The response has one catalog method plus `declarations`. Declarations include the source description and TypeScript declaration for referenced records and enums. The server bounds declarations by count, reference depth, and character totals; `declarationsTruncated` and `truncation` state when the result is incomplete. Use the installed response as the authority for a method's argument order and enum values.

First open a session with `formulon_open_workbook` and `{ "sessionId": "work" }`. Call the method with that session and a positional JSON array:

```json
{
  "name": "formulon_workbook_call",
  "arguments": {
    "sessionId": "work",
    "method": "addMerge",
    "args": [
      0,
      { "firstRow": 0, "firstCol": 0, "lastRow": 0, "lastCol": 3 }
    ]
  }
}
```

`args` defaults to an empty array. The MCP tool does not translate argument order, fill defaults, or coerce an object into a record. A method that is not in the server allowlist, or is not callable on the loaded workbook, fails at dispatch. Discovery remains a separate step and the live catalog should be treated as the source for argument construction.

A practical agent prompt is:

> Find the installed `Workbook` method for reading the current sheet view. Describe it, call it for sheet index 0, and report the result without changing the workbook.

The agent should search for `getSheetView`, describe the returned method, then call it with the discovered arguments. This keeps a release that changes a TypeScript record or enum from silently receiving stale hand-written arguments.

## What is allowlisted {#what-is-allowlisted}

The server allowlist is explicit. It currently covers these method groups:

- sheet creation, removal, renaming, movement, values, formulas, cell metadata, defined names, row and column insertion, and worksheet dimensions;
- calculation, partial and parallel recalculation, calculation mode, iterative calculation, formula evaluation, dependency graph queries, spill information, function names and metadata;
- the workbook clock pin, Excel profile, read diagnostics, pagination, page setup, margins, print options, headers and footers, print areas, print titles, and manual page breaks;
- worksheet Tables, auto-filters, PivotCaches, PivotTables, field axes and ordering, data fields, filters, date grouping, and native PivotTable layout;
- sheet views, protection, gridline and display flags;
- fonts, fills, borders, number formats, cell styles, differential formats, cell XF records, and range XF assignments, including row and column styles (`setColumnStyle`, `clearColumnStyle`, `setRowStyle`, `clearRowStyle`), attribute-only range formatting (`rangeStyleBases`, `remapRangeStyle`), `clearCellXfIndex`, and `clearColumnWidth`;
- theme script fonts and reset (`setThemeScriptFont`, `resetTheme`), and picture and chart placement and stacking (`setDrawingAnchor`, `setDrawingZOrder`);
- [charts](/workbook/charts): the read-only `getChart`, `getChartData`, and `previewChartData`, and the authoring calls `insertChart`, `setChartType`, `setChartTitle`, `setChartLegend`, `setChartAxis`, `setChartDisplay`, `setChartSeries`, `setChartPoint`, `setChartPlot`, `setChartFilter`, `addChartSeries`, `removeChartSeries`, and `setChartSource`;
- locale and collation reads (`localizeFormula`, `canonicalizeFormula`, `localeFacts`, `compareText`, `collationClasses`), which are read-only and leave the session clean. Collation class ids come back as a plain JSON array;
- merges, comments (including `setCommentVisible`), hyperlinks, data validation, conditional formatting, phonetic runs, and external links;
- drawing shapes (`listShapes`, `insertShape`, `updateShape`, `removeShape`), slicers (`listSlicers`, `addSlicer`, `updateSlicer`, `removeSlicer`), What-If data tables (`getDataTable`, `addDataTable`, `removeDataTable`, `recalcDataTables`), and sparkline groups (`listSparklineGroups`, `addSparklineGroup`, `updateSparklineGroup`, `setSparklineGroupSparklines`, `removeSparklineGroup`);
- workbook protection and protected ranges (`getWorkbookProtection`, `setWorkbookProtection`, `getProtectedRanges`, `addProtectedRange`, `updateProtectedRange`, `removeProtectedRange`);
- table styles (`tableStyleCount`, `getTableStyle`, `getTableStyleDefaults`, `setTableStyle`, `removeTableStyle`, `setTableStyleDefaults`, `setTableColumnTotals`) and PivotTable read-back (`pivotCacheId`, `pivotName`, `pivotGetGrandTotals`, `pivotGetStyleInfo`, `pivotFieldAt`, `pivotFieldItemCount`, `pivotFieldItemAt`, `pivotDataFieldAt`, `pivotRowFieldOrder`, `pivotColFieldOrder`, `pivotSetStyleInfo`);
- calculation settings (`fullPrecision`, `calcOnSave`, `refMode`, `date1904` and their setters), sheet selection, split, top-left, and the active sheet (`getSheetSelection`, `setSheetSelection`, `setSheetSplit`, `setSheetTopLeft`, `setSheetPaneTopLeft`, `activeSheet`, `setActiveSheet`), outline collapse (`setRowCollapsed`, `setColumnCollapsed`), and defined-name attributes (`setDefinedNameAttrs`).

The allowlist also includes sparse cell and merge reads (`getCellsInRange`, `getMergesInRange`), A1/R1C1 formula reads, display text and value formatting, geometry and width-model queries, theme colors and fonts, effective styles, typed sheet/table AutoFilters, validation checks, threaded comments and persons, and drawing/image reads and removal (`removeDrawing`). Discover the exact method and record fields before calling them. Applying a filter changes row visibility and marks dependent formulas dirty; call `formulon_recalc_session` before reading updated `SUBTOTAL` or `AGGREGATE` values.

`probeImage` and `insertImage` take binary input and are excluded from low-level JSON dispatch. Use [image operations](/mcp/layout-preview#images) to insert a file or retrieve picture bytes through `formulon_image_operation`. `snapshotDrawing` / `restoreDrawing` and `snapshotRangeStyle` / `restoreRangeStyle` are withheld too: they round-trip opaque bytes that a JSON result reduces to a length and a JSON argument cannot carry.

The getters among these (`listShapes`, `getDataTable`, `date1904`, `pivotGetStyleInfo`, and the other readers) are classified read-only and leave the session clean. Prefer the dedicated tools where one exists: `formulon_shape_operation`, `formulon_sparkline_operation`, and `formulon_data_table_operation` validate their input and resolve A1 addresses, which the raw methods do not.

The allowlist intentionally excludes `save`, `saveAs`, and `saveWithDiagnostics`, because those bypass session bookkeeping. Use `formulon_save_session` with an explicit `outputPath`. It also excludes `delete`, `isValid`, and callback-based `setIterativeProgress`, because they are lifecycle or JavaScript-callback operations rather than JSON workbook calls. `formulon_workbook_call` checks the server allowlist and the installed object at dispatch time; use `formulon_workbook_api` to discover the installed catalog and signature before constructing `args`.

## Response envelopes

`formulon_workbook_call` returns `{session, method, result}`. The examples below show the inner `result` field, not the complete response. The engine status is retained; common accessor shapes are:

```json
{
  "status": { "ok": true, "status": 0, "message": "", "context": "" },
  "value": 3
}
```

```json
{
  "status": { "ok": true, "status": 0, "message": "", "context": "" },
  "items": [
    { "name": "Sheet1", "index": 0 }
  ]
}
```

The exact payload after `status` depends on the discovered method. A numeric or string accessor normally uses `value`; a list accessor uses `items`; methods such as `pinnedNow`, `readDiagnostics`, or PivotTable layout return their documented fields. Native `Value` records become `{kind, value}` or an error envelope. A method status that is not `ok` becomes an MCP error instead of a successful empty result.

Read-only classification is explicit in the server. A read-only call leaves the session's dirty state unchanged. Every other allowlisted method is treated as a mutation and marks the session dirty before invocation because the native engine can change state before reporting an error. Inspect the session and read the affected range after a failed mutation.

## Pin the workbook clock

Time-dependent formulas and relative-period PivotTable filters should use the same instant during a review. Pin the clock with the six positional values `[year, month, day, hour, minute, second]`:

```json
{
  "name": "formulon_workbook_call",
  "arguments": {
    "sessionId": "work",
    "method": "setPinnedNow",
    "args": [2026, 10, 1, 9, 30, 0]
  }
}
```

Future evaluations of `NOW()`, `TODAY()`, and PivotTable relative-period filters use the pinned instant. Existing cached formula values are not recomputed by `setPinnedNow`; call `formulon_recalc_session` before reading those cells. Recalculate again after clearing the pin when cached cells must reflect the host clock. `pinnedNow` reads it and `clearPinnedNow` returns to the host clock:

```json
{
  "name": "formulon_workbook_call",
  "arguments": {
    "sessionId": "work",
    "method": "pinnedNow",
    "args": []
  }
}
```

```json
{
  "name": "formulon_workbook_call",
  "arguments": {
    "sessionId": "work",
    "method": "clearPinnedNow",
    "args": []
  }
}
```

The pin lives in the in-memory workbook model. It is not persisted by a save. Set it again after opening a session when a later process must use the same clock.

## Recalculation and the WASM runtime

The server loads Formulon's default single-threaded WASM module. The allowlisted `recalcParallel` method is available for API parity, but this runtime evaluates serially and reports `result.stats.workerThreadsStarted: 0`. Use the dedicated `formulon_recalc_session` when a normal session recalculation is enough; use `recalcParallel` only when the discovered method's result or options are required.

```json
{
  "name": "formulon_workbook_call",
  "arguments": {
    "sessionId": "work",
    "method": "recalcParallel",
    "args": [0]
  }
}
```

The call marks the session dirty like every low-level mutating calculation method. The status under `result.status` confirms the engine call, not the correctness of the workbook's business rules.

## Low-level pitfalls

### PivotCaches and worksheet sources

A PivotCache created through the low-level API must be connected to its worksheet source with `pivotCacheSetWorksheetSource` before saving. A cache with no source declaration can produce an Excel repair prompt. `formulon_create_pivot` performs this step and validates the source range for you.

### Pivot field ordering

Assigning a field's axis does not populate grouped field order. Calls using `pivotFieldSetAxis` must also set the row and column order with `pivotSetRowFieldOrder` and `pivotSetColFieldOrder`. The high-level PivotTable tool performs both steps.

### Number formats on Pivot fields

Low-level Pivot field and data-field methods expect a decimal `numFmtId` string, not an Excel format code. Register a custom code with `addNumFmt`, then pass the returned id as a string. Built-in ids such as `"4"` can be used when the installed declaration accepts them. The high-level PivotTable tool accepts a format code and registers it.

### Raw print and display APIs

The low-level route exposes raw page-setting XML, worksheet display flags, protection, and pagination. Discover the exact declaration before passing an XML fragment or enum ordinal. `formulon_print_settings`, `formulon_apply_layout`, and `formulon_preview_range` provide safer typed paths for common layout work.

### Saving after an advanced call

The low-level call never writes a file. Check the returned status and any affected objects, then save through the session API. Create the `out` directory in the server's working directory first; save and preview tools do not create parent directories.

```json
{
  "name": "formulon_save_session",
  "arguments": {
    "sessionId": "work",
    "outputPath": "out/advanced-result.xlsx"
  }
}
```

Inspect `losses` and the session's `dirty` flag after the save. Use `.xlsx` when the workbook contains native tables, pivots, print settings, or comments that must survive the round trip.

Close the session after the artifact has been checked:

```json
{
  "name": "formulon_close_workbook",
  "arguments": { "sessionId": "work" }
}
```

For the complete high-level surface, see [Tools](/mcp/tools). For the session lifecycle and error behavior, see [Workflow](/mcp/workflow).
