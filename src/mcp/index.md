# formulon-mcp

`@libraz/formulon-mcp` is a stdio [MCP](https://modelcontextprotocol.io/) server for Formulon. It lets an AI agent inspect and edit `.xlsx` and `.xlsb` workbooks through typed tools. The server uses Formulon's WASM engine in a child process, keeps each open workbook in an isolated session, and writes workbook output when a save tool is called. Preview tools can also write PNG or SVG artifacts.

Use it when the workbook itself is the artifact to change: a template to fill, a report to format, a calculation sheet to review, or a table to summarize. A session can read values and formulas, mutate cells and structure, recalculate, render a bounded preview, and save the result without Excel.

::: info MCP and stdio
MCP (Model Context Protocol) gives an AI client typed tools over a JSON-RPC transport. With stdio, the client starts `formulon-mcp` as a child process and exchanges messages through stdin and stdout. The server does not open a listening port. The process boundary and the server's method allowlist are part of the control model.
:::

## Choose a guide

| Guide | Use it for |
| --- | --- |
| [Workflow](/mcp/workflow) | The open, inspect, mutate, recalculate, preview, save, and close loop; session state; dirty flags; losses; and errors |
| [Authoring](/mcp/authoring) | Creating an invoice, form, report, or other workbook from blocks and then refining named ranges |
| [Layout and preview](/mcp/layout-preview) | Matching a reference layout, setting dimensions and print settings, and checking a PNG or SVG preview |
| [Formula audit](/mcp/formula-audit) | Finding missing formulas, constants, outliers, and formula errors in a repeated calculation region |
| [Tables and pivots](/mcp/tables-pivots) | Creating native worksheet Tables and PivotTables from a bounded source range |
| [Advanced API](/mcp/advanced) | Discovering the installed `Workbook` API before making an allowlisted low-level call |
| [Tools](/mcp/tools) | The complete reference for all registered tools, with inputs, defaults, limits, and response shapes |
| [Install](/mcp/install) | Registering the stdio server with an MCP client |
| [Security model](/mcp/security) | Session isolation, path handling, and the low-level allowlist |

## Typical requests

An agent prompt should name the source workbook, the intended change, and the output path. For example:

> Open `input.xlsx`, change the billing month in `Summary!B2`, recalculate, render `Summary!A1:H24` for review, and save the edited workbook as `out/next-month.xlsx`. Keep the source file unchanged.

The agent normally chooses this route:

1. Open a session with `formulon_open_workbook`.
2. Inspect the sheet and read the target range.
3. Apply a bounded mutation with `formulon_set_cells` or `formulon_set_range`.
4. Recalculate when current formula values are needed.
5. Call `formulon_preview_range` when visual layout matters.
6. Save with an explicit `outputPath`, then close the session.

The same server also supports these concrete tasks:

| Task | First guide |
| --- | --- |
| Fill a recurring monthly template while preserving formulas and formatting | [Workflow](/mcp/workflow) |
| Build an invoice from line items, tax, and totals in a new workbook | [Authoring](/mcp/authoring) |
| Reproduce a form from a screenshot and check page breaks before saving | [Layout and preview](/mcp/layout-preview) |
| Review a calculation table for missing or inconsistent formulas | [Formula audit](/mcp/formula-audit) |
| Turn a data range into a native Table and summarize it by region | [Tables and pivots](/mcp/tables-pivots) |
| Use an installed engine method that has no dedicated high-level tool | [Advanced API](/mcp/advanced) |

## What the server operates on

The server loads `.xlsx` and `.xlsb` paths, or creates a default workbook with `Sheet1` when no input path is supplied. It delegates workbook calculation and file parsing to `@libraz/formulon`, which is loaded as WASM by the MCP server. The engine version is available through `formulon_version`; documentation does not assume a particular release number.

Sheet references accept a zero-based sheet index or an exact sheet name. Cell and range coordinates are zero-based when sent as numeric `row` and `col` values. A1 addresses such as `Summary!B2` are easier to read and are accepted by the high-level cell tools. Range readers and preview tools require a bounded rectangular range on one sheet; whole-column, whole-row, and 3-D references are rejected by the MCP A1 parser.

The tool surface has a high-level path for common work and an advanced path for the installed `Workbook` API. High-level calls validate their input, return domain-shaped JSON, and keep session bookkeeping. `formulon_workbook_call` is limited to an explicit allowlist and should be used after `formulon_workbook_api` has returned the installed signature and declarations.

## Files and saves

Paths are resolved relative to the MCP server process's working directory. Give every save an explicit `outputPath`, and choose the extension deliberately:

- `.xlsx` is the preferred output for authored Tables, PivotTables, comments, print settings, and other rich workbook features.
- `.xlsb` selects the binary writer. The response reports features that were deferred, downgraded, or dropped.
- `bytes` in a save response is a byte count, not file content.

Opening a file reports `session.loadLosses` when the reader could not decode part of it. Saving reports `losses` when the writer could not carry something forward. Inspect both before describing a round trip as lossless. A lossy save leaves the session marked dirty.

## Boundaries

- The server is a tool endpoint. For an interactive spreadsheet interface, use [formulon-cell](/cell/).
- It does not execute arbitrary JavaScript or arbitrary `Workbook` methods. Low-level methods must be in the server allowlist.
- A successful mutation does not prove that the workbook's business rules are correct. Formula audits report review candidates; they do not repair formulas or prove a calculation.
- A preview is a server-rendered approximation. It reports geometry, formulas, fonts, page breaks, and warnings, but Excel may render a different font or feature that the preview renderer does not implement.

Read [Workflow](/mcp/workflow) for the session contract, then [Tools](/mcp/tools) when the task needs an exact field or response shape.
