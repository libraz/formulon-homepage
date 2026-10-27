# Glossary

These terms describe workbook data, calculation, and the layers that expose the engine. For a first walkthrough, read [Basic concepts](/start/concepts).

## Packages and settings

| Term | Meaning | Details |
| --- | --- | --- |
| Headless | Runs without a spreadsheet application's user interface | [Why Formulon](/why) |
| Runtime | The environment running the application, such as a browser or Node process | [Runtimes](/runtimes/) |
| Surface | A host-facing API and distribution format, such as WASM, Python, or CLI | [Choose a surface](/start/choose-runtime) |
| Binding | Code that exposes the shared core to a host language | [Bindings](/development/bindings) |
| Excel compatibility profile | Runtime rules for the Excel platform and locale being modeled, such as `mac-365-ja_JP`; not saved in the workbook | [Locale profiles](/compatibility/locale-profiles) |
| UI locale | The language of Cell's controls; a mounted locale change also coordinates its workbook profile | [Language switching](/cell/language-switching) |
| UI profile | A Cell configuration such as `embedded` or `full` that chooses controls and features | [Options](/cell/options) |
| Invariant formula | Stored formula text using common English function names and separators, independent of displayed locale | [Formula language](/workbook/language) |

## Cells and calculation

| Term | Meaning | Details |
| --- | --- | --- |
| Workbook model | The in-memory sheets, cells, formulas, styles, and calculation state loaded from a file or created by the host | [Lifecycle](/workbook/lifecycle) |
| A1 address | A cell or range name such as `Summary!B2`; numeric API indexes start at zero instead | [Basic concepts](/start/concepts) |
| Cached value | A formula's stored result; it may be stale until recalculation | [Recalculation](/workbook/recalculation) |
| Display text | The string obtained by formatting a value, distinct from the raw value and formula text | [Presentation](/workbook/presentation) |
| Dirty cell | A cell whose calculated value needs refreshing | [Recalculation](/workbook/recalculation) |
| Precedents | Cells a formula reads: A1 is a precedent of B1 when B1 contains `=A1*2` | [Dependency tracing](/workbook/recalculation) |
| Dependents | Formula cells that read a cell: B1 is a dependent of A1 in that example | [Dependency tracing](/workbook/recalculation) |
| Dependency graph | The relationships used to determine which formulas need recalculation and in which order | [Recalculation](/workbook/recalculation) |
| Volatile function | A function reevaluated on recalculation even without an input edit, such as `NOW` or `RAND` | [Recalculation](/workbook/recalculation) |
| Spill / anchor | An array formula's output area / the cell containing that formula | [Dynamic arrays](/workbook/dynamic-arrays) |
| Partial recalculation | Refreshes requested output cells and the formulas they need; other dirty cells may remain pending | [Recalculation](/workbook/recalculation) |

## Files and tools

| Term | Meaning | Details |
| --- | --- | --- |
| Round trip | Load a workbook and save it again; preservation does not imply rendering or evaluation of every feature | [File formats](/workbook/file-formats) |
| Passthrough | File parts retained as bytes rather than interpreted by the workbook model | [File formats](/workbook/file-formats) |
| Loss diagnostics | Reports of file features skipped, deferred, or dropped during reading or writing | [File format support](/compatibility/file-format-support) |
| Pivot cache | The stored source records and items a PivotTable summarizes; recalculation does not refresh the cache from its source | [PivotTables](/workbook/pivots) |
| Oracle data | Reference results captured from real Excel for compatibility checks | [Oracle testing](/compatibility/oracle-testing) |
| MCP session | One open workbook held by the local MCP server and addressed by `sessionId`; saving writes it to a file | [MCP workflow](/mcp/workflow) |
| Session dirty flag | Indicates that a session may differ from its last successful lossless save; distinct from calculation dirtiness | [MCP workflow](/mcp/workflow) |
