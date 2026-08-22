# Tools

This page lists all 37 MCP tools exposed by `formulon-mcp`, grouped by purpose. The model receives the same descriptions through MCP tool discovery; this page mirrors them so a human can scan the surface at a glance.

::: info A1 vs zero-based
Unless A1 notation is used, sheet / row / column indices are zero-based to match the Formulon API. Both styles are accepted on tools that take addresses.
:::

::: warning Only bounded, single-sheet ranges
The A1 parser accepts rectangular ranges within a single sheet (`Sheet1!A1:C10`). It rejects whole-row/column references (`A:A`, `1:1` — the pattern requires both a column letter and a row digit) and cross-sheet 3-D ranges (`Sheet1:Sheet3!A1:B2`). The Formulon core supports 3-D references, but the `formulon-mcp` A1 parser rejects them. Build the bounded range you need from the sheet's used range (`formulon_inspect_layout`) instead of a whole-row/column shorthand.
:::

<DiagramLayers :layers="[
  { nodes: ['formulon-mcp tools'] },
  { nodes: [
      { label: 'Engine', note: 'version / eval / lookup / trace' },
      { label: 'Sessions', note: 'open / list / close / recalc / save / metadata' },
      { label: 'Inspection', note: 'session / layout / regions / analyze' },
      { label: 'Cells & ranges', note: 'set / get / range / set-range / find / replace' },
      { label: 'Structure', note: 'sheets / defined names / insert-delete / view / dimension' },
      { label: 'Rich data', note: 'merge / comment / hyperlink / validation / cond-format' },
      { label: 'Advanced', note: 'workbook_call / one-shot inspect & update' }
    ]
  }
]" />

## Engine

| Tool | What it does |
| --- | --- |
| `formulon_version` | Returns the loaded Formulon engine version and the MCP server version. |
| `formulon_eval_formula` | Evaluates one Excel formula in a throwaway workbook, or read-only against an open session when given `sessionId`. |
| `formulon_function_lookup` | Lists registered functions and resolves metadata or localized names. |
| `formulon_trace` | Reads precedents, dependents, or spill info for a cell. |

## Sessions

| Tool | What it does |
| --- | --- |
| `formulon_open_workbook` | Loads an `.xlsx` or `.xlsb` path into a new session, or creates a default workbook. A loaded session's `loadLosses` reports anything the reader could not decode. |
| `formulon_list_sessions` | Lists open workbook sessions. |
| `formulon_close_workbook` | Releases a session. |
| `formulon_recalc_session` | Triggers a recalculation on an open session. |
| `formulon_save_session` | Writes a session to disk (`outputPath` → session's last saved path → its original source path), selects XLSB for `.xlsb` output paths and XLSX otherwise, and returns `bytes`, the selected `format`, and any writer `losses` (dropped or downgraded content). |
| `formulon_session_metadata` | Reads function names or external links from the session. |

## Inspection

| Tool | What it does |
| --- | --- |
| `formulon_inspect_session` | Returns sheets, defined names (including `localSheetId` when sheet-local), tables, and optionally sparse cell entries. |
| `formulon_inspect_layout` | Per-sheet layout: used ranges, merges, row / column overrides, protection, cells, calculated values, formulas, optional style details, and sheet view (zoom, frozen panes, hidden state). |
| `formulon_detect_regions` | Detects table-like regions, label-value pairs, and totals with rule-based confidence and evidence. |
| `formulon_analyze_workbook` | Classifies workbook shape (invoice, list, report, schedule, form, …) with deterministic evidence. |

## Cells and ranges

| Tool | What it does |
| --- | --- |
| `formulon_set_cells` | Applies mutations to a session. Cells use A1 (`Sheet1!B2`) or 0-based (`sheet` / `row` / `col`). |
| `formulon_set_range` | Writes a 2D block of values from an anchor cell; each element's JSON type picks the cell type, `{"f":"=…"}` writes a formula, and `null` skips a cell. More compact than `set_cells` for tables. |
| `formulon_get_cell` | Reads one cell, either from a session or directly from a path. |
| `formulon_get_range` | Reads an A1 rectangular range from a session. |
| `formulon_find_cells` | Searches text cell values and / or formula text. |
| `formulon_replace_cells` | Replaces matching text and / or formula text. |

## Workbook structure

| Tool | What it does |
| --- | --- |
| `formulon_sheet_operation` | Adds, removes, renames, or moves sheets. |
| `formulon_set_defined_name` | Adds, replaces, or removes defined names. Omit `sheet` for workbook scope; pass it for a sheet-local name. `_xlnm.Print_Area` and `_xlnm.Print_Titles` must be sheet-local for Excel to apply them. |
| `formulon_edit_structure` | Inserts or deletes rows and columns. |
| `formulon_dimension_operation` | Lists column-width / row-height overrides, or sets width / height, hidden, or outline level. Columns act on an inclusive `[first, last]` span; rows act on a single row index. |
| `formulon_set_sheet_view` | Sets zoom, frozen panes, or sheet-tab hidden state. |
| `formulon_default_font` | Reads the workbook default font, or replaces it in place. Unstyled cells resolve through font slot `0`. |
| `formulon_build_document` | Lays out a titled document from named blocks, resolving cells, formats, ruling, widths, merges, and print area in one operation. |
| `formulon_style_range` | Applies font, fill, border, number-format, and alignment deltas over an A1 range. |
| `formulon_print_settings` | Reads or sets page setup, margins, print options, header/footer, print area/titles, and manual page breaks. |

## Rich workbook data

| Tool | What it does |
| --- | --- |
| `formulon_merge_operation` | Lists, adds, removes, or clears merged ranges. |
| `formulon_comment_operation` | Gets, sets, or removes cell comments. |
| `formulon_hyperlink_operation` | Lists, adds, removes, or clears hyperlinks. An add can cover the inclusive rectangle through `lastRow` / `lastCol`; use `location` with an empty `target` for an in-workbook link. |
| `formulon_validation_operation` | Lists, adds, removes, or clears data validations. |
| `formulon_conditional_format_operation` | Lists, adds, removes, clears, or evaluates conditional formats. |

## Advanced

| Tool | What it does |
| --- | --- |
| `formulon_workbook_call` | Allowlisted low-level access to the Formulon `Workbook` API. |
| `formulon_inspect_workbook` | One-shot summary from path. |
| `formulon_update_workbook` | One-shot load / create, mutate, recalculate, save; returns the selected `format` and any writer `losses` alongside `bytes`. |

::: warning `workbook_call` is allowlisted, not arbitrary
`formulon_workbook_call` only dispatches methods on the server's allowlist (see [Security model](/mcp/security)). Calls to non-allowlisted methods are rejected. The tool exists for advanced access — PivotTables and PivotCaches, worksheet tables and AutoFilter, styles and differential formats, sheet display and page-layout view, phonetic guides, pagination, dependency graph queries, function metadata, spill info, and the workbook clock pin — that the higher-level tools do not cover yet.

`setPinnedNow` changes in-memory model state only; saving does not persist the pin. See [recalculation](/workbook/recalculation) for its effect on time-dependent formulas. A PivotCache created through the API also needs `pivotCacheSetWorksheetSource` before saving; see [PivotTables](/workbook/pivots).
:::

## Read next

- [Workflow](/mcp/workflow) — the canonical loop.
- [Security model](/mcp/security) — what the server will refuse.
