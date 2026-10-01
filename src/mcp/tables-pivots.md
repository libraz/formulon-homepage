---
description: Create and inspect native Excel Tables and PivotTables, with source validation, global indices, and XLSX save guidance.
---

# Tables and PivotTables

`formulon_table_operation` creates native worksheet Tables. `formulon_create_pivot` creates a worksheet-backed PivotCache and native PivotTable. These objects remain workbook metadata that Excel can filter, refresh, and inspect.

The `table` block in [`formulon_build_document`](/mcp/authoring) creates a visual grid with headers, borders, formulas, and optional banding. It does not create a native Excel Table. Choose the native tools when the workbook needs Table metadata or a PivotTable; choose the document block when the goal is a printable layout.

## Native worksheet Tables

### Create and list

The create input requires `sessionId`, `operation: "create"`, a `range` (or its `ref` alias), and a non-empty native `name`. The range is an A1 rectangle on one sheet.

| Field | Meaning |
| --- | --- |
| `sheet` | Fallback sheet for an unqualified `range` or `ref`. A qualified range chooses its own sheet. |
| `columns` | One unique, non-empty name per range column. Omit it to derive names from the first row when `headerRow` is true. |
| `headerRow` | Whether the first range row is a header. It defaults to `true` on create. If it is `false`, `columns` is required. |
| `totalsRow` | Whether the table has a totals row. It defaults to `false` on create. |
| `style` / `styleName` | Excel TableStyle name. The aliases are equivalent; `styleName` takes precedence when both are supplied. |

When headers are derived, every first-row cell must be non-empty text, and the resulting names must be unique case-insensitively. Explicit `columns` are validated against the range width with the same uniqueness rule.

Use `operation: "list"` to return all tables. Pass `sheet` to filter the list by worksheet. Table `index` values are global across the workbook, even when the list is filtered by sheet. Keep the returned index for later update or removal; do not replace it with a per-sheet position.

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "create",
  "range": "Data!A1:C5",
  "name": "Sales",
  "style": "TableStyleMedium2",
  "headerRow": true,
  "totalsRow": false
}
```

The create result contains `session`, `table`, and `status`. The `table` entry includes the global `index`, `name`, `displayName`, A1 `ref`, numeric `sheet`, `sheetName`, and the engine's raw table representation. A typical created table therefore has `index: 0`, `ref: "A1:C5"`, and `sheetName: "Data"` when it is the first table in the workbook.

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "list",
  "sheet": "Data"
}
```

The list result contains `count` and `tables`. An empty list is a successful result with `count: 0`.

### Update and remove

Update and remove require the global `index`.

An update must state at least one of `range`/`ref`, `style`/`styleName`, `headerRow`, or `totalsRow`. A new range must stay on the existing table's sheet and keep the same number of columns. An empty style string clears the TableStyle. Update and remove return the changed or removed table in the same table representation.

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "update",
  "index": 0,
  "ref": "Data!A1:C6",
  "totalsRow": true
}
```

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "remove",
  "index": 0
}
```

Creating, updating, and removing Tables mark the session dirty before entering the engine. Listing Tables does not change dirty state. Inspect the session after a lower-level failure before deciding whether to save or reopen the source.

## Creating a PivotTable

`formulon_create_pivot` reads a worksheet range, builds a worksheet-backed cache, and attaches a PivotTable at a target cell. Its required fields are `sessionId`, `sourceRange`, `target`, `name`, and at least one `values` entry.

| Field | Meaning |
| --- | --- |
| `sourceRange` | A1 rectangle including the header row. It may include a sheet name. |
| `sourceSheet` | Fallback source sheet when `sourceRange` is unqualified. It defaults to the first sheet. |
| `target` | A1 anchor for the PivotTable. It may include a report sheet name. |
| `targetSheet` | Fallback target sheet for an unqualified target. It defaults to the source sheet. |
| `name` | Native PivotTable name. |
| `rows` | Source headers on the row axis. Defaults to `[]`. |
| `columns` | Source headers on the column axis. Defaults to `[]`. |
| `pages` | Source headers on the filter/page axis. Defaults to `[]`. |
| `values` | One or more value-field objects. Each has `field`, optional `aggregation`, `name`, and `numberFormat`. |
| `layout` | `compact` (default), `tabular`, or `outline`. |
| `grandTotals` | Optional `{ "rows": boolean, "columns": boolean }`. An omitted member defaults to `true`. |
| `sourceLimit` | Source cell cap from `2` through `10_000`; default `10_000`. |

The source must have at least one header row and one data row. Every header must be unique, non-empty text. The source cell count, including the header row, must be no greater than `sourceLimit`.

Assign every source header exactly once to `rows`, `columns`, `pages`, or a value field. Unknown fields, unused headers, duplicate axis assignments, and assigning a field to an axis and values are rejected during preflight. A source value field can appear more than once in `values` with different aggregations and unique displayed `name` values.

The supported aggregations are `sum`, `count`, `average`, `max`, `min`, `product`, `countNumbers`, `stddev`, `stddevp`, `var`, and `varp`. The default is `sum`. If `name` is omitted, it is generated as `<Aggregation> of <field>`, such as `Sum of Amount`. `numberFormat` is an Excel format code and is registered before the data field is attached.

If the source contains formulas, the server recalculates it before reading the cache records. On failure, the server attempts to remove the cache and PivotTable created by that call. Cleanup is best effort, and the session remains dirty after the attempted mutation. Inspect remaining objects before saving or retrying.

## End-to-end example: sales table and report PivotTable

This prompt keeps the source list, native Table, and report PivotTable separate:

```text
Create a workbook session named "sales-report". Rename the first sheet to Data and add a sheet named Report. Write the Region, Product, Amount sales list to Data!A1:C5. Create a native Table named Sales with a table style, list it to capture its global index, extend it through row 6 with a North sale, write a totals row at row 7, and enable its totals row. Create SalesByProduct on Report!A1 with Region on rows, Product on columns, and two value fields from Amount: sum named Revenue and average named Average amount. Assign every source header exactly once, use tabular layout, enable both grand-total bands, and set sourceLimit to 50. Read the source and native PivotTable layout, preview the source range to /tmp/sales-report.png, save as /tmp/sales-report.xlsx, inspect losses, and close the session.
```

Open the workbook, then make the source sheet and report sheet. The first sheet created by an empty session is renamed before writing the qualified `Data!` range.

#### `formulon_open_workbook`

```json
{
  "sessionId": "sales-report"
}
```

#### `formulon_sheet_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "rename",
  "index": 0,
  "newName": "Data"
}
```

#### `formulon_sheet_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "add",
  "name": "Report"
}
```

Write four initial data rows. The header row is included in the source range and the fifth data row is added before the Table is extended.

#### `formulon_set_range`

```json
{
  "sessionId": "sales-report",
  "start": "Data!A1",
  "values": [
    ["Region", "Product", "Amount"],
    ["East", "Pen", 20],
    ["East", "Book", 10],
    ["West", "Pen", 5],
    ["South", "Pen", 7]
  ],
  "recalc": true
}
```

Create the native Table. Because its headers are valid text, `columns` can be omitted and derived from row 1.

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "create",
  "range": "Data!A1:C5",
  "name": "Sales",
  "style": "TableStyleMedium2"
}
```

The expected meaningful result is `table.index: 0`, `table.ref: "A1:C5"`, and `table.sheetName: "Data"` when no earlier native table exists. Capture this index instead of assuming that every sheet starts at zero.

List the table, append a source row, write a totals row, and update the existing global index:

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "list"
}
```

#### `formulon_set_range`

```json
{
  "sessionId": "sales-report",
  "start": "Data!A6",
  "values": [["North", "Book", 12]],
  "recalc": false
}
```

Before that update, write the totals row outside the five source records:

#### `formulon_set_range`

```json
{
  "sessionId": "sales-report",
  "start": "Data!A7",
  "values": [["Total", null, { "f": "=SUM(C2:C6)" }]],
  "recalc": true
}
```

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "update",
  "index": 0,
  "ref": "Data!A1:C7",
  "totalsRow": true
}
```

The update keeps the same three-column width and returns `table.ref: "A1:C7"` with `totalsRow` represented in the raw table data. The Table metadata and the source cells are separate: adding a row to the worksheet does not extend a Table until its `ref` is updated.

Create a PivotTable on the report sheet. `Region` is assigned to `rows`, `Product` to `columns`, and `Amount` is assigned twice to `values`. Every source header is therefore assigned exactly once by role, while the one value field receives two aggregations.

#### `formulon_create_pivot`

```json
{
  "sessionId": "sales-report",
  "sourceRange": "Data!A1:C6",
  "target": "Report!A1",
  "name": "SalesByProduct",
  "rows": ["Region"],
  "columns": ["Product"],
  "pages": [],
  "values": [
    { "field": "Amount", "aggregation": "sum", "name": "Revenue", "numberFormat": "#,##0" },
    { "field": "Amount", "aggregation": "average", "name": "Average amount", "numberFormat": "#,##0.00" }
  ],
  "layout": "tabular",
  "grandTotals": { "rows": true, "columns": true },
  "sourceLimit": 50
}
```

The result includes `source` (`sheet`, `sheetName`, `ref`, `headers`, and data-row `rows`), the resolved `target`, numeric `cacheId`, numeric `pivotIndex`, engine `layout`, and `status`. For this data, the source reports `rows: 5` because `rows` counts data records and excludes the header. The returned `layout.cells` contains the native PivotTable report, with region rows for East, West, South, and North. Their Revenue values are 30, 5, 7, and 12; the row grand total is 54. The average value field is separate and uses its requested `#,##0.00` format.

Read the source before saving. The native PivotTable report is returned in `layout.cells` from `formulon_create_pivot`; it is not a normal stored-cell range for `formulon_get_range` to read.

#### `formulon_get_range`

```json
{
  "sessionId": "sales-report",
  "range": "Data!A1:C7",
  "includeFormulas": true,
  "recalc": false,
  "maxCells": 100
}
```

Use the returned `layout.cells` and `pivotIndex` rather than assuming a fixed report width. If a worksheet snapshot is required for preview, write a deliberate snapshot with `formulon_set_range` or `formulon_set_cells` after interpreting those returned cells. That snapshot is ordinary worksheet data and is separate from the native PivotTable.

Preview the source list with an explicit range and PNG artifact:

#### `formulon_preview_range`

```json
{
  "sessionId": "sales-report",
  "range": "Data!A1:C6",
  "scale": 1,
  "showGridLines": false,
  "showPageBreaks": true,
  "recalc": false,
  "outputPath": "/tmp/sales-report.png"
}
```

The first MCP content item is PNG image data and the next is preview metadata. This preview shows the source list. A preview of `Report!` is blank unless the agent has explicitly materialized a worksheet snapshot; native PivotTable values are read from the `layout.cells` result instead.

Save authored Table and PivotTable metadata as XLSX:

#### `formulon_save_session`

```json
{
  "sessionId": "sales-report",
  "outputPath": "/tmp/sales-report.xlsx"
}
```

Inspect `format`, `bytes`, and optional `losses` before distributing the workbook. XLSB output can defer or drop Tables, PivotTables, print settings, comments, and other features. A lossy save keeps the session dirty because the in-memory workbook is not fully represented by the artifact. Close after checking the save result:

#### `formulon_close_workbook`

```json
{
  "sessionId": "sales-report"
}
```

## Choosing between the two table surfaces

Use the document `table` block for a receipt or invoice whose visual rows, formulas, widths, and print area are part of one layout operation. Use `formulon_table_operation` for a native Table that should carry a name, filter metadata, a TableStyle, a header flag, or a totals-row flag. Use `formulon_create_pivot` when the workbook needs a report object backed by the source range, with named axes and aggregations. Save both native features as XLSX and check the writer losses before treating the file as complete.
