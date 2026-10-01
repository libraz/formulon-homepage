# MCP workflow

`formulon-mcp` keeps an opened workbook in a named in-memory session. The usual workflow is:

<DiagramFlow steps="formulon_open_workbook → inspect / read → mutate → recalculate → preview → formulon_save_session → formulon_close_workbook" />

Open once, use the returned `session.id` for subsequent calls, and save to a new path with an explicit `outputPath`. A session is isolated from every other session. Its workbook, formula cache, dirty state, and dependency graph are not shared.

## Open and inspect

Open an existing workbook with a stable id when the agent will make several calls:

```json
{
  "path": "input.xlsx",
  "sessionId": "monthly-edit"
}
```

`formulon_open_workbook` returns `{ "session": ... }`. The session record contains:

| Field | Meaning |
| --- | --- |
| `id` | The id used in later calls |
| `sourcePath` | The input path, when a file was opened |
| `outputPath` | The most recent save destination, when one exists |
| `createdAt`, `updatedAt` | ISO timestamps maintained by the server |
| `dirty` | The in-memory workbook may differ from its last successful lossless save |
| `loadLosses` | Non-zero reader diagnostics, when part of the input could not be decoded |

Opening a file recalculates it once. This makes the first formula read use calculated values rather than a stale cached blank. A newly created session has a default `Sheet1` and no `sourcePath`.

Inspect structure before addressing cells:

```json
{
  "sessionId": "monthly-edit",
  "includeCells": false,
  "maxCellsPerSheet": 200
}
```

`formulon_inspect_session` returns `session` and a workbook summary containing `sheets`, `definedNames`, and native `tables`. Set `includeCells` to `true` to include sparse cell entries; `maxCellsPerSheet` defaults to 200 and is capped at 10,000.

Use `formulon_inspect_layout` when the task depends on used ranges, merges, dimensions, views, protection, formulas, or styles. Its default includes cells and allows 10,000 cells per selected sheet. Set `includeStyles: true` when the agent needs the resolved style records. `formulon_detect_regions` and `formulon_analyze_workbook` provide deterministic hints for unfamiliar sheets; they do not replace reading the source data.

## Read values and formulas

Use a bounded A1 range for a table or a single cell for a spot check:

```json
{
  "sessionId": "monthly-edit",
  "range": "Summary!A1:H24",
  "includeFormulas": true,
  "recalc": false
}
```

`formulon_get_range` returns a sparse list. Blank, formula-free cells are omitted, the requested rectangle is clipped to the sheet's used extent, and the result is capped by `maxCells` (default 10,000, maximum 50,000). The scan rectangle may span at most 100,000 cells after clipping to the used extent. Each returned cell has its A1 address, zero-based coordinates, and a `{kind, ...}` value envelope. `includeFormulas` adds a `formula` string, empty for constants. Numeric cells with a date, currency, or percent format can also carry `numberFormat`, `formatKind`, and a decoded `formatted` value.

`formulon_get_cell` accepts exactly one of `sessionId` or `path`. Pass `a1`, or pass `row` and `col`; `sheet` defaults to index `0`. Its default `recalc: true` recalculates a session before reading and therefore marks that session dirty. Set it to `false` for a read that must leave the cached calculation state untouched. A path read is one-shot and does not create a session.

`formulon_eval_formula` evaluates one formula without writing a cell. In session mode it resolves workbook references and defined names, and uses `row` and `col` (both default `0`) as the anchor for relative references and `ROW()` / `COLUMN()`. In global mode it evaluates against a fresh default workbook. A leading `=` is optional.

## Mutate cells and structure

`formulon_set_cells` is useful for a small set of unrelated addresses:

```json
{
  "sessionId": "monthly-edit",
  "mutations": [
    { "type": "text", "a1": "Summary!B2", "value": "2026-10" },
    { "type": "number", "a1": "Summary!B3", "value": 42 },
    { "type": "formula", "a1": "Summary!B4", "formula": "=B3*1.1" }
  ],
  "recalc": true
}
```

Each mutation is `number`, `bool`, `text`, `blank`, or `formula`. Address a cell with `a1`, or with `sheet` plus zero-based `row` and `col`. A batch accepts 1 to 10,000 mutations and defaults to `recalc: true`. The response contains `session`, an `applied` entry for each successful write, and `errorCells` for written formulas whose result is an Excel error.

For a rectangular table, `formulon_set_range` is more compact:

```json
{
  "sessionId": "monthly-edit",
  "start": "Summary!B8",
  "values": [
    ["Item", "Qty", "Amount"],
    ["Design", 2, { "f": "=C9*120000" }],
    ["Build", 1, { "f": "=C10*98000" }]
  ],
  "recalc": true
}
```

The row-major `values` array accepts numbers, booleans, strings, `{"f":"=..."}` formulas, `{"blank":true}` clears, and `null` skips the cell. `start` is an A1 anchor; `sheet` is the fallback when the anchor is unqualified. The response reports the start and end addresses, `cellsWritten`, and `errorCells`.

Cell mutations validate every address before the first write. If the native engine fails after a write has started, earlier writes remain in the session and the session stays dirty. Review `applied` and `errorCells` on a successful response; after an MCP tool error, inspect the affected range before retrying.

Use the structure tools for sheet order, defined names, rows, columns, and sheet view. `formulon_sheet_operation` supports `add`, `remove`, `rename`, and `move`; the corresponding fields are `name`, `index`, `newName`, `fromIndex`, and `toIndex`. `formulon_set_defined_name` uses workbook scope when `sheet` is omitted, sheet-local scope otherwise, and removes a name when `formula` is empty. `_xlnm.Print_Area` and `_xlnm.Print_Titles` must be sheet-local for Excel to apply them. `formulon_edit_structure` inserts or deletes rows or columns and lets the engine rewrite affected references. `formulon_set_sheet_view` accepts zoom from 10 to 400, freeze counts, and either two-state `hidden` or three-state `visibility` (`visible`, `hidden`, `veryHidden`). When changing frozen panes, pass both `freezeRows` and `freezeCols`: an omitted count becomes `0` instead of keeping its previous value.

## Recalculate deliberately

Open and mutation defaults already recalculate in common cases, but reads and inspection tools use different defaults. Recalculate explicitly when the next decision depends on current formula values:

```json
{
  "sessionId": "monthly-edit"
}
```

This call is `formulon_recalc_session`. It returns `{ "session": ..., "status": ... }` and marks the session dirty because formula caches are workbook state. The following calls can also recalculate when requested:

- `formulon_set_cells` and `formulon_set_range`: `recalc` defaults to `true`.
- `formulon_replace_cells`: `recalc` defaults to `true`.
- `formulon_get_cell`: `recalc` defaults to `true`.
- `formulon_get_range`, `formulon_preview_range`, and `formulon_audit_formulas`: `recalc` defaults to `false`.

An explicit `recalc: false` keeps a batch from doing repeated work. Apply several changes, call `formulon_recalc_session` once, then read the dependent range.

## Search and replace

Search text values, formula text, or both:

```json
{
  "sessionId": "monthly-edit",
  "query": "budget",
  "target": "both",
  "matchCase": false,
  "wholeCell": false,
  "regex": false,
  "maxResults": 1000
}
```

`formulon_find_cells` returns `results`, `count`, and `truncated`. Each result includes the sheet, A1 address, target kind (`text` or `formula`), and matched text. `target` defaults to `both`; `target: "texts"` also searches numeric and boolean constants as strings (for example `42`, `TRUE`, and `FALSE`), but does not search formula results. `maxResults` defaults to 1,000 and is capped at 10,000. Omit `sheet` to search all sheets.

`formulon_replace_cells` adds `replacement` and uses the same matching options. It changes only string cells and formula text; numeric and boolean constants are not replaced. `maxReplacements` defaults to the supplied `maxResults` (1,000 if both are omitted). When specified, `maxReplacements` is the replacement cap; `maxResults` does not impose an additional cap. A replacement writes the original text or formula back through the engine, returns `before`, `after`, and a status for each replacement, and recalculates by default. A regex is compiled as global, with case sensitivity controlled by `matchCase`. `wholeCell` applies only when `regex` is `false`; for a full-cell regex match, anchor the expression with `^` and `$`.

## Preview and save

Use a preview before saving when the change affects layout, styles, merges, or print settings:

Create `review` and `out` in the server's working directory before running this example. The save and preview tools do not create parent directories.

```json
{
  "sessionId": "monthly-edit",
  "range": "Summary!A1:H24",
  "scale": 1,
  "showGridLines": false,
  "showPageBreaks": true,
  "recalc": false,
  "outputPath": "review/summary.png"
}
```

`formulon_preview_range` returns an image content item first and a JSON metadata item second. The metadata includes the selected sheet and range, logical and scaled dimensions, fonts, page count, page breaks, bounded cell geometry, and warnings. `scale` defaults to `1` and accepts `0.25` through `2`. A preview covers at most 10,000 cells, each image edge is at most 4,096 pixels, the image is at most 8,000,000 pixels, and an SVG artifact is at most 4 MiB. `outputPath` may end in `.png` or `.svg`; a range that cuts across a merge is rejected.

Save to a new, explicit destination:

```json
{
  "sessionId": "monthly-edit",
  "outputPath": "out/next-month.xlsx"
}
```

`formulon_save_session` returns the updated `session`, `outputPath`, byte count, selected `format`, and optional `losses`. `.xlsx` selects the XML writer; `.xlsb` selects the binary writer. The save operation does not recalculate automatically. If the writer drops or downgrades content, the session remains dirty. Always inspect `losses` before handing the output to a downstream process.

The server can fall back to a previous output path or the original source path when `outputPath` is omitted, but a workflow that must preserve the source should always pass the destination explicitly. A new session has no fallback and an omitted path fails with `outputPath is required for a new workbook session`.

## Responses and errors

High-level success responses are JSON text in MCP `content`. The common `session` object carries the state needed for the next call. Cell values use these envelopes:

```json
[
  { "kind": "number", "value": 1200 },
  { "kind": "text", "value": "Approved" },
  { "kind": "error", "errorCode": 1, "errorName": "#DIV/0!" }
]
```

Blank, boolean, array, reference, and lambda values retain their `kind`. Status-bearing engine results use `{ "status": { "ok": true, "status": 0, "message": "", "context": "" }, "value": ... }` or the corresponding `items` field for list results. High-level tools add domain fields around that status.

When a tool fails, the server returns MCP `isError: true` with a text message. Typical causes are an unknown session, a missing required operation field, a sheet or range conflict, an unsupported extension, a failed engine status, or a path that cannot be read or written. The server validates before mutating where possible; native failures can still leave a partial mutation, so check the session's `dirty` flag and inspect the next range.

## End-to-end template edit

Prompt an agent with a concrete artifact and destination:

> Edit `input.xlsx` in session `monthly-edit`. Change `Summary!B2` to `2026-10`, keep the source untouched, recalculate `Summary!B4`, render `Summary!A1:H24` to `review/summary.png`, save the workbook to `out/next-month.xlsx`, inspect the save losses, and close the session.

The important MCP calls are:

```json
{
  "name": "formulon_open_workbook",
  "arguments": { "path": "input.xlsx", "sessionId": "monthly-edit" }
}
```

```json
{
  "name": "formulon_set_cells",
  "arguments": {
    "sessionId": "monthly-edit",
    "mutations": [
      { "type": "text", "a1": "Summary!B2", "value": "2026-10" }
    ],
    "recalc": false
  }
}
```

```json
{
  "name": "formulon_recalc_session",
  "arguments": { "sessionId": "monthly-edit" }
}
```

```json
{
  "name": "formulon_get_range",
  "arguments": {
    "sessionId": "monthly-edit",
    "range": "Summary!B2:B4",
    "includeFormulas": true,
    "recalc": false
  }
}
```

```json
{
  "name": "formulon_preview_range",
  "arguments": {
    "sessionId": "monthly-edit",
    "range": "Summary!A1:H24",
    "outputPath": "review/summary.png"
  }
}
```

```json
{
  "name": "formulon_save_session",
  "arguments": {
    "sessionId": "monthly-edit",
    "outputPath": "out/next-month.xlsx"
  }
}
```

```json
{
  "name": "formulon_close_workbook",
  "arguments": { "sessionId": "monthly-edit" }
}
```

If the agent needs only a single write and no follow-up read, `formulon_update_workbook` combines load or create, zero-based mutations, optional recalculation, and save. It still requires an explicit `outputPath`, accepts 1 to 10,000 mutations, and returns a summary plus save diagnostics. `formulon_inspect_workbook` is the corresponding one-shot read and defaults to no recalculation.
