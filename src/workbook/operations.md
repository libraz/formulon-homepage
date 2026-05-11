# Workbook Operations

Workbook APIs expose structural edits in addition to cell mutation and recalculation. The WASM binding has the widest surface; Python exposes a smaller stable subset; the CLI focuses on recalculation and inspection rather than edits.

::: info Glossary: zero-based coordinates
Binding addresses are `(sheet, row, col)` with all indices starting at 0. `Sheet1!A1` is `(0, 0, 0)`. The numeric form avoids locale-specific address parsing and matches the C ABI. Use A1 text only where a CLI or formula explicitly expects it.
:::

## Sheets

```ts
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

Python exposes the stable subset:

```python
with Workbook.create_default() as wb:
    wb.add_sheet("Inputs")
    print(wb.sheet_count())
    print(wb.sheet_name(0))
```

## Cells

Set values by kind, then recalculate:

```ts
wb.setNumber(0, 0, 0, 10)
wb.setBool(0, 0, 1, true)
wb.setText(0, 0, 2, 'sku-001')
wb.setFormula(0, 0, 3, '=SUM(A1:A10)')
wb.setBlank(0, 0, 4)
wb.recalc()
```

Read calculated values back as kind-tagged structs:

```ts
const value = wb.getValue(0, 0, 3)
if (value.kind === ValueKind.Number) console.log(value.number)
```

::: warning Setting a formula does not evaluate it
`setFormula()` only mutates the model. The result is `Blank` until `recalc()` (or `partialRecalc()`) is called. Hosts that read values after edits should always trigger a recalc.
:::

## Structure

Row and column insert / delete operations rewrite affected formulas automatically:

```ts
wb.insertRows(/*sheet*/ 0, /*startRow*/ 5, /*count*/ 2)
wb.deleteCols(/*sheet*/ 0, /*startCol*/ 3, /*count*/ 1)
```

References inside formulas that move with the inserted / deleted range are shifted; references that anchor outside the range are preserved.

## Layout, styles, and metadata

The WASM binding currently exposes the broadest workbook surface:

- row / column insert / delete with formula rewriting,
- defined names,
- tables,
- passthrough OOXML parts,
- pivot table layout projection,
- conditional formatting read / evaluate / write subset,
- sheet view, freeze panes, hidden tabs,
- sheet protection metadata,
- row / column layout overrides,
- styles, number formats, fonts, fills, borders,
- merges, comments, hyperlinks, and data validations,
- precedent / dependent tracing,
- function metadata and function-name helpers,
- dynamic-array spill information.

The Python binding intentionally exposes a smaller stable surface: workbook construction / loading, cell mutation, recalc / save, and iteration helpers. Use WASM, Native Node, or the C ABI directly when your application needs the wider workbook-management API today.

::: tip Discovering what is implemented
Both `Module.functionNames()` (WASM) and `formulon function_lookup` (MCP) enumerate registered functions at runtime. Use them to verify a target Excel version's surface rather than reading the static docs.
:::

## Read next

- [Recalculation](/workbook/recalculation) — when edits become visible values.
- [Surface matrix](/api/surfaces) — what each binding exposes.
- [Compatibility / Errors](/compatibility/errors) — what edits to expect on malformed input.
