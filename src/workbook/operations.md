# Workbook Operations

Workbook APIs expose structural edits in addition to cell mutation and recalculation. WASM, Native Node, and Python expose broad Workbook APIs through the same C ABI; the CLI focuses on recalculation and inspection rather than fine-grained edits.

::: info Glossary: zero-based coordinates
Binding addresses are `(sheet, row, col)` with all indices starting at 0. `Sheet1!A1` is `(0, 0, 0)`. The numeric form avoids locale-specific address parsing and matches the C ABI. Use A1 text only where a CLI or formula explicitly expects it.
:::

## Sheets

::: code-group

```ts [WASM]
const wb = Module.Workbook.createDefault()
try {
  wb.addSheet('Inputs')
  wb.renameSheet(0, 'Model')
  wb.moveSheet(1, 0)
  wb.removeSheet(1)
} finally {
  wb.delete()
}
```

```python [Python]
with Workbook.create_default() as wb:
    wb.add_sheet("Inputs")
    wb.rename_sheet(0, "Model")
    wb.move_sheet(1, 0)
    wb.remove_sheet(1)
    print(wb.sheet_count(), wb.sheet_name(0))
```

:::

## Cells

Set values by kind, recalculate, and check the status before reading the
cached result. Each example owns its workbook for the duration of the block.

::: code-group

```ts [WASM]
import createFormulon, { ValueKind } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
try {
  wb.setNumber(0, 0, 0, 10)
  wb.setBool(0, 0, 1, true)
  wb.setText(0, 0, 2, 'sku-001')
  wb.setFormula(0, 0, 3, '=SUM(A1:A10)')
  wb.setBlank(0, 0, 4)
  const recalcStatus = wb.recalc()
  if (!recalcStatus.ok) throw new Error(recalcStatus.message)
  const result = wb.getValue(0, 0, 3)
  if (!result.status.ok) throw new Error(result.status.message)
  if (result.value.kind === ValueKind.Number) console.log(result.value.number)
} finally {
  wb.delete()
}
```

```ts [Native Node]
import { ValueKind, Workbook } from '@libraz/formulon-native'

const wb = Workbook.createDefault()
try {
  wb.setNumber(0, 0, 0, 10)
  wb.setBool(0, 0, 1, true)
  wb.setText(0, 0, 2, 'sku-001')
  wb.setFormula(0, 0, 3, '=SUM(A1:A10)')
  wb.setBlank(0, 0, 4)
  const recalcStatus = wb.recalc()
  if (!recalcStatus.ok) throw new Error(recalcStatus.message)
  const result = wb.getValue(0, 0, 3)
  if (!result.status.ok) throw new Error(result.status.message)
  if (result.value.kind === ValueKind.Number) console.log(result.value.number)
} finally {
  wb.dispose()
}
```

```python [Python]
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_number(0, 0, 0, 10)
    wb.set_bool(0, 0, 1, True)
    wb.set_text(0, 0, 2, "sku-001")
    wb.set_formula(0, 0, 3, "=SUM(A1:A10)")
    wb.set_blank(0, 0, 4)
    wb.recalc()
    print(wb.get_value(0, 0, 3).to_python())
```

:::

::: warning Setting a formula does not evaluate it
`setFormula()` only mutates the model. The result is `Blank` until `recalc()` (or `partialRecalc()`) is called. Hosts that read values after edits should always trigger a recalc.
:::

## Inspect a range

`getFormula(sheet, row, col)` returns the stored A1 text verbatim; a leading `=` is included only when it is present in the stored text. `getFormulaR1C1()` parses the stored formula and formats it relative to the cell without a leading `=`. Both JavaScript bindings return `{ status, formula }`, with `formula: null` when no formula is stored. Python uses `get_formula()` and `get_formula_r1c1()` and returns the string or `None`.

Public formula setters reject a malformed non-empty formula before mutating the workbook. Cell formulas, defined names, conditional-format formulas, and data-validation formulas report `kParserUnexpectedToken` (1000) through the C and JavaScript status result; Python raises its host-side error. A malformed formula that was already stored in an input file is preserved verbatim for round-trip, evaluates to `#NAME?`, and makes `getFormulaR1C1()` return `kParserUnexpectedToken`; formula setters never create that state.

`getCellsInRange(sheet, range, cursor, limit)` returns `{ status, cells, nextCursor }` in row-major order. Each entry has `row`, `col`, `formula`, and the current cached `value`. The inclusive `range` has `firstRow`, `firstCol`, `lastRow`, and `lastCol`. Omit the cursor for the first page, then pass back `nextCursor` until it is `null`. Omitted or zero `limit` means at most 65,536 entries. Populated cells include formulas, non-blank values, and spill phantoms; styled blanks are not included. Recalculate before enumeration when current formula values are needed.

Python's `get_cells_in_range(sheet, cell_range, cursor=None, limit=None)` takes a `MergeRange` and returns `(cells, next_cursor)`; completion is `None`. Treat cursors as continuation tokens, not page numbers. JavaScript cursors must be non-negative safe integers. `getMergesInRange()` / `get_merges_in_range()` lists merges intersecting a rectangle.

`getExternalLinks()` / `get_external_links()` enumerate the external-link records in document order; the C layer exposes `fm_workbook_external_link_count` and `fm_workbook_external_link_at`. Entering a bracket- or path-spelled reference to an unregistered external book from a cell, defined name, conditional-format rule, or data-validation rule appends a record without renumbering existing links. A book already present in any letter case is reused.

`cellCount(sheet)` and `cellAt(sheet, idx)` enumerate written coordinates, including cells written by value, formula, or format setters and `setBlank`, plus spill phantoms. Clearing a cell keeps its slot; unwritten gaps are not counted. Indices are dense in `[0, cellCount)` and ordered by `(row, col)`. Python's `iter_cells()` and the C functions `fm_workbook_cell_count` / `fm_workbook_cell_at` follow the same contract. Do not mutate the sheet during enumeration.

## Structure

Row and column insert / delete operations rewrite affected formulas automatically:

::: code-group

```ts [WASM / Native Node]
wb.insertRows(/*sheet*/ 0, /*startRow*/ 5, /*count*/ 2)
wb.deleteCols(/*sheet*/ 0, /*startCol*/ 3, /*count*/ 1)
```

```python [Python]
wb.insert_rows(0, 5, 2)  # sheet, start row, count
wb.delete_cols(0, 3, 1)  # sheet, start column, count
```

:::

References that move with the inserted or deleted range are shifted, including `$`-anchored references; this structural rewrite differs from copying a formula. Surviving ranges shrink or expand as appropriate. A reference that ends up inside deleted space cannot be shifted anywhere, and collapses to `#REF!` rather than quietly pointing at whatever moved up into its place. Inserted rows and columns hold no stored cells, so they do not increase `cellCount`.

The panel below runs these calls against a live sheet. Selecting a cell moves the target row or column with it, and both formula lists are read back out of the workbook either side of the call — so what you see is the formula text the engine holds, including the ones it rewrote and the ones it broke.

<StructureDemo />

Structural edits move every structure the engine models, plus the ranges kept verbatim for a lossless save: the `x14` conditional-format and validation blocks, sparkline groups, protected ranges, scenarios, sort state, cell watches, ignored-error ranges and web-publish ranges. Two things do not follow the edit. The anchor of an embedded OLE object or form control keeps its pre-edit cell, and nothing reports it. An insert also does not copy the formatting of the neighbouring row or column onto the new one, which Excel does.

## Names, merges, hyperlinks, and outlines

::: code-group

```ts [WASM / Native Node]
const check = (s: { ok: boolean; message: string }) => {
  if (!s.ok) throw new Error(s.message)
}
for (const [row, v] of [10, 20, 30].entries()) check(wb.setNumber(0, row, 0, v))
check(wb.setDefinedName('Sales', 'Sheet1!$A$1:$A$3')) // workbook scope
check(wb.setDefinedNameScoped('Rate', '0.1', 0))       // local to sheet 0
check(wb.setFormula(0, 0, 1, '=SUM(Sales)*(1+Rate)'))
check(wb.addMerge(0, { firstRow: 4, firstCol: 0, lastRow: 4, lastCol: 2 }))
check(wb.addHyperlink(0, 5, 0, 'https://formulon.libraz.net', 'Docs', '', ''))
check(wb.addHyperlink(0, 6, 0, '', 'Back to top', '', 'Sheet1!A1'))
check(wb.setRowHidden(0, 2, true))
check(wb.setColumnOutline(0, 3, 5, 1))
check(wb.recalc())
console.log(wb.getValue(0, 0, 1).value.number) // 66
```

```python [Python]
from formulon import MergeRange

for row, value in enumerate((10, 20, 30)):
    wb.set_number(0, row, 0, value)
wb.set_defined_name("Sales", "Sheet1!$A$1:$A$3")  # workbook scope
wb.set_defined_name_scoped("Rate", "0.1", 0)       # local to sheet 0
wb.set_formula(0, 0, 1, "=SUM(Sales)*(1+Rate)")
wb.add_merge(0, MergeRange(4, 0, 4, 2))
wb.add_hyperlink(0, 5, 0, "https://formulon.libraz.net", display="Docs")
wb.add_hyperlink(0, 6, 0, "", display="Back to top", location="Sheet1!A1")
wb.set_row_hidden(0, 2, True)
wb.set_column_outline(0, 3, 5, 1)
wb.recalc()
print(wb.get_value(0, 0, 1).to_python())  # 66.0
```

:::

- `setDefinedNameScoped()` takes `-1` for workbook scope or a zero-based sheet index. An empty formula removes the name. `definedNameCount()` / `definedNameAt(i)` enumerate names with their `localSheetId`; Python uses `iter_defined_names()`.
- `getMerges()` lists every merge on a sheet. `removeMerge(range)` removes each merge that overlaps the range, `removeMergeAt(i)` removes one by index, and `clearMerges()` removes all of them.
- A hyperlink takes a URL as `target`, or an empty `target` and an A1 `location` for a destination inside the workbook. `getHyperlinks()` reads them back; `removeHyperlink(sheet, row, col)`, `removeHyperlinkAt()`, and `clearHyperlinks()` remove them.
- `setRowHidden()` / `setColumnHidden()` and `setRowOutline()` / `setColumnOutline()` (level clamped to 0–255) change layout only. Ordinary formulas still read hidden rows, as `SUM` does above; `SUBTOTAL` 101–111 skips them.
- `getSheetProtection()` / `setSheetProtection()` read and replace the `<sheetProtection>` flags as a whole; `enabled: 0` removes protection on save. The engine stores the flags and does not enforce locks.

Python uses the snake_case form of each name.

## Layout, styles, and metadata

`Workbook.createDefault()` (and `fm_workbook_create`) starts with Excel's minimum style table: font, border, and cell-style index `0`, plus fill index `0` (`none`) and `1` (`gray125`). The first non-duplicate `addFont()` or `addBorder()` then returns `1`, and the first new `addFill()` returns `2`. `createForProfile()` may already have a phonetic font at index `1` for a CJK locale, so always use the returned index instead of assuming a new style table starts empty.

`setDefaultFont()` replaces font slot `0`. `setFont()` replaces any existing font slot in place. `FontRecord.scheme` preserves its theme-font link on load and save. A cell's effective formatting can also come from its row or column; an explicit cell style `0` overrides those defaults and is distinct from an unstyled cell.

`setColumnStyle()` / `set_column_style()` and `setRowStyle()` / `set_row_style()` replace the style XF over an inclusive span. Their `clear` counterparts remove only that style assignment and retain the span's width or height, hidden, and outline attributes. A later value in an unstyled cell can take the column or row style; a row style wins when both cover the cell.

`setCellXfIndex(..., 0)` is an explicit Normal style and still wins over row and column styles. `clearCellXfIndex()` / `clear_cell_xf_index()` removes that direct assignment so a blank cell can inherit its row or column style again; it keeps the value, formula, and comments, and an absent cell stays absent. A non-blank cell keeps owning the default XF. Use `getEffectiveStyle().source` / `get_effective_style().source` to distinguish an inherited style from a direct cell assignment.

`setCellStyle(record)` on WASM and Native Node takes `name`, `xfId`, `builtinId`, `iLevel`, `hidden`, and `customBuiltin`. Python uses `set_cell_style(CellStyle(...))` with snake-case fields. The XF identifies a named-style base, not a cell XF. `removeCellStyle(name)` / `remove_cell_style(name)` removes a named style. See [Presentation and geometry](/workbook/presentation) for themes, resolved colors, effective styles, and display text.

Phonetic guides can be read and written as an ordered set of UTF-16 text spans with `getCellPhoneticRuns()` / `setCellPhoneticRuns()`. `getCellPhoneticProperties()` / `setCellPhoneticProperties()` separately control the ruby font, kana form, and alignment. Writing a cell value clears both its readings and its properties.

### Tables and AutoFilter

WASM and Python can author worksheet tables. WASM uses `createTable()` / `updateTable()` / `removeTable()`; Python uses `table_create()` / `table_update()` / `table_remove()`. The table's `columns` list must have exactly one name per column in `ref`; when `headerRow` is enabled, the caller still writes those header cells. Partial updates preserve omitted metadata, and an existing table AutoFilter is retargeted by changing only its `ref`. Native Node exposes table enumeration but not table authoring.

Worksheet-level AutoFilter XML is available as an opaque, complete `<autoFilter>` fragment. WASM exposes `getSheetAutoFilterXml()` / `setSheetAutoFilterXml()` and Python exposes `get_auto_filter_xml()` / `set_auto_filter_xml()`. Filter criteria, sort state, and extension payloads are preserved verbatim. An empty fragment clears the AutoFilter; a non-empty replacement must be a complete `<autoFilter>` element.

WASM, Native Node, and Python also expose typed sheet and table AutoFilters. Setting criteria does not change row visibility; evaluate them to inspect the result or apply them to hide and unhide rows. See [Filters and validation](/workbook/filters-validation) for the distinction between setting, applying, clearing, and removing filters.

Row and column insert/delete operations move sheet and table AutoFilter ranges with their cells and remove a filter if an edit consumes its entire range. Filter-column offsets shift when columns are inserted or deleted inside the filtered range.

Sheet visibility is a three-state value. WASM and Native Node use `SheetVisibility.Visible`, `Hidden`, and `VeryHidden` with `setSheetVisibility(sheet, visibility)`; Python uses `set_sheet_visibility(sheet, visibility)`. `getSheetView()` / `get_sheet_view()` returns the authoritative `visibility` alongside the legacy two-state `tabHidden`. `setSheetTabHidden(true)` does not demote an already very-hidden sheet; use the three-state setter to make that transition explicit.

### Author worksheet print settings

WASM and Native Node expose typed setters for page setup, margins, print options, header/footer, print area, print titles, and manual row/column breaks (`setSheetPageSetup()`, `setSheetPageMargins()`, `setSheetPrintOptions()`, `setSheetHeaderFooter()`, `setSheetPrintArea()`, `setSheetPrintTitles()`, `addSheetRowBreak()`, and `addSheetColBreak()`). Python exposes the corresponding `set_page_setup()`, `set_page_margins()`, `set_print_options()`, `set_header_footer()`, `set_print_area()`, `set_print_titles()`, `add_row_break()`, and `add_col_break()` methods. Raw XML setters remain available for unmodeled fields, and malformed fragments are rejected. Header/footer section strings use Excel's decoded syntax; write a literal ampersand as `&&`.

`setRangeXfIndex()` (WASM / Native Node) and `set_range_xf_index()` (Python) apply a cell-style XF index across an inclusive rectangle in one call. Missing cells are materialized as styled blanks, which is useful for ruling an empty report area.

### Attribute-only range styles

`rangeStyleBases()` / `range_style_bases()` lists, in ascending order, every cell XF that some cell of the selection resolves to: the XF of each cell that carries its own, and the row, column, or default (`0`) style of the rest. A selection wholly covered by styled cells does not list `0`, and a column style shadowed everywhere by row styles is not listed. For an attribute-only change, read those bases, build the patched XFs with `addFont()` / `addXf()` (Python: `add_font()` / `add_cell_xf()`), then pass the pairs to `remapRangeStyle()` / `remap_range_style()`. Take a `snapshotRangeStyle()` / `snapshot_range_style()` first when the operation needs an undo path, and pass its bytes to `restoreRangeStyle()` / `restore_range_style()` to restore the style state.

The remap rewrites covered row and column styles and existing cell XFs while leaving values and formulas untouched. A plain finite range materializes every cell; a row, column, or whole-sheet selection materializes only cells whose row-over-column precedence would otherwise change and does not enumerate blank cells on a covered axis. The operation fails without mutation when the mapping arrays differ in length, a source XF repeats, a target is outside the cell-XF table, or more than `1,048,576` cells would be written.

### Data-validation defaults

When `addValidation()` / `add_validation()` omits `allowBlank`, it defaults to `false` on WASM and Native Node, matching Python. Set `allowBlank: true` (or `allow_blank=True`) when empty cells should be accepted. `showDropDown` (Python: `show_dropdown`) remains the one boolean option whose OOXML meaning is inverted; the host-facing field is normalized.

Use `validateValue()` / `validate_value()` to check a proposed value without storing it, and `listInvalidCells()` / `list_invalid_cells()` to inspect existing violations. The host decides whether to accept an edit; value setters do not enforce validation. See [Filters and validation](/workbook/filters-validation).

### Conditional formats

`addConditionalFormat()` / `add_conditional_format()` adds a rule, and `evaluateCfRange()` / `evaluate_cf_range()` reports which cells match. Rule types, differential formats, data bars, color scales, icon sets, and the `todaySerial` argument are covered in [Conditional formats](/workbook/conditional-formats).

### Hyperlink ranges

`addHyperlinkRange()` (WASM and Native Node) and `add_hyperlink_range()` (Python) add one hyperlink over the inclusive rectangle from `(row, col)` through `(lastRow, lastCol)` / `(last_row, last_col)`. Read-back hyperlinks include the rectangle end, and both OOXML and XLSB preserve the full span.

### Pivot cache sources

Newly authored PivotTables must set a worksheet source on their cache before saving. Use `pivotCacheSetWorksheetSource(cacheId, { present: true, ref: 'A1:C10', sheet: 'Data' })` on WASM or Native Node, or `set_pivot_cache_worksheet_source(cache_id, PivotWorksheetSource(ref='A1:C10', sheet='Data'))` in Python. A declared range is enough even when the sheet has no data. Saving a newly created cache without a worksheet source fails. A loaded cache retains its supported source metadata, which may describe a non-worksheet or external source; the requirement here applies to newly authored worksheet caches.

### Pagination

`paginate(sheet)` resolves the print area, automatic and manual page breaks, and the physical page count:

::: code-group

```ts [WASM]
const result = wb.paginate(0)
console.log(result.pageCount, result.printArea, result.horizontalBreaks, result.verticalBreaks)
```

```ts [Native Node]
const result = wb.paginate(0)
console.log(result.pageCount, result.printArea, result.horizontalBreaks, result.verticalBreaks)
```

```python [Python]
result = wb.paginate(0)
print(result.page_count, result.print_area, result.horizontal_breaks, result.vertical_breaks)
```

```sh [CLI]
formulon paginate --sheet 0 input.xlsx
```

:::

Coordinates in the result are zero-based, and print-area bounds are inclusive. The result also reports paper, margins, printable area, scale, page order, print titles, per-page layouts, and manual-break flags. See [Presentation and geometry](/workbook/presentation) for units and layout behavior.

## Ad-hoc formula evaluation {#ad-hoc-formula-evaluation}

Ad-hoc evaluation answers "what would this formula return at this cell?" without writing it anywhere:

::: code-group

```ts [WASM / Native Node]
const result = wb.evaluateFormulaText(/*sheet*/ 0, /*row*/ 0, /*col*/ 0, '=A1+B1')
if (result.status.ok && result.value.kind === ValueKind.Number) {
  console.log(result.value.number)
}
const array = wb.evaluateFormulaArray(0, 0, 0, '=SEQUENCE(2)')
if (array.status.ok) console.log(array.rows, array.cols, array.cells)
```

```python [Python]
rows = wb.evaluate_formula_array(0, 0, 0, "=SEQUENCE(2)")  # list of rows of Value
print([[v.to_python() for v in row] for row in rows])
```

:::

The call does not mutate the workbook or join the dependency graph, so nothing it evaluates becomes dirty on a later edit. `evaluateFormulaText()` reduces an array result to its top-left element: `=SEQUENCE(3)` returns `1`, not a 3-row spill. `evaluateFormulaArray()` / `evaluate_formula_array()` return the whole array. Written into a real cell, the same formula spills normally; see [Dynamic arrays](/workbook/dynamic-arrays).

Python has no workbook-context scalar evaluator. Take the top-left element of `evaluate_formula_array()`, or use the module-level `formulon.eval_formula()`, which evaluates against a fresh one-sheet workbook.

`evaluateConditionalFormula()` (WASM and Native Node) and `evaluate_cf_formula()` (Python) evaluate a conditional-format predicate under the same read-only rule. They also shift relative references from the rule's anchor and apply Excel's predicate coercion (error, blank, text, and numeric zero are `false`; any other number is `true`), so the result matches what a real rule would evaluate to at that cell.

The normal edit path and the ad-hoc path answer different questions — the first commits a value you can read again later, the second is a disposable "what if" query:

<DiagramFlow :steps="[
  { label: 'setFormula()' },
  { label: 'recalc()' },
  { label: 'getValue()', note: 'reads the cached result without mutating the model' }
]" label="Normal edit path: setFormula, recalc, getValue" />

<DiagramFlow :steps="[
  { label: 'evaluateFormulaText()', note: 'no mutation · no dependency-graph entry' },
  { label: 'Scalar result', note: 'array/spill results reduced to the top-left element' }
]" label="Ad-hoc path: evaluateFormulaText, read-only, scalar-only" />

::: tip Discovering what is implemented
`wb.functionNames()` (WASM / Native Node) and `formulon_function_lookup` (MCP) enumerate registered functions at runtime. Use them to verify a target Excel version's surface rather than reading the static docs. For a function picker, `mergeFunctionMetadata()` (exported by both npm packages) / `merge_function_metadata()` (Python) overlays host-supplied localized descriptions on the engine's metadata, in locale-override, entry-default, then engine-value precedence.
:::

## Read next

- [Recalculation](/workbook/recalculation) — when edits become visible values.
- [Comments and images](/workbook/comments-images) — threaded comments, persons, drawing objects, and picture anchors.
- [Surface matrix](/api/surfaces) — what each binding exposes.
- [Compatibility / Errors](/compatibility/errors) — what edits to expect on malformed input.
