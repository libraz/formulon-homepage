# Workbook Operations

Workbook APIs expose structural edits in addition to cell mutation and recalculation. WASM, Native Node, and Python expose broad Workbook APIs through the same C ABI; the CLI focuses on recalculation and inspection rather than fine-grained edits.

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

Python uses the same zero-based coordinate model:

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

WASM, Native Node, and Python expose workbook operations such as:

- row / column insert / delete with formula rewriting,
- defined names,
- tables,
- passthrough OOXML parts,
- pivot table report layout and pivot-cache worksheet-source access,
- conditional formatting read / evaluate / write subset, visual payloads (`ColorScale`, `DataBar`, `IconSet`), and DXFs,
- sheet view, freeze panes, hidden tabs,
- sheet protection metadata,
- row / column layout overrides,
- styles, number formats, fonts, fills, borders,
- merges, comments, hyperlinks, and data validations,
- precedent / dependent tracing,
- function metadata and function-name helpers,
- dynamic-array spill information.

Conditional-format rule creation (`addConditionalFormat()` / `fm_sheet_cf_add_rule`) also returns the new rule's flattened index, which makes host-side UI selection and follow-up edits easier.

WASM and Native Node expose comment *enumeration* with `getComments(sheet)`; Python uses `comment_count(sheet)` and `get_comments(sheet)`. Each list includes comments anchored on otherwise-empty cells. `getCommentResult(sheet, row, col)` distinguishes an absent comment from an invalid sheet on the JS surfaces.

Host applications can merge localized function metadata with `mergeFunctionMetadata()` (Node) / `merge_function_metadata()` (Python). It is pure and applies locale-override, entry-default, then engine-value precedence.

### Pagination

All binding coordinates and output ranges are zero-based. Print-area coordinates are inclusive.

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

### Ad-hoc formula evaluation

WASM and Native Node (C API) additionally expose read-only ad-hoc formula evaluation. `evaluateFormulaText()` answers "what would this general scalar formula return here?" without writing it into a cell first. `evaluateConditionalFormula()` evaluates conditional-format predicates. These JavaScript-facing methods are not exposed by Python; Python uses `evaluate_cf_formula()` for conditional-format predicates and `evaluate_formula_array()` for full array results:

```ts
const result = wb.evaluateFormulaText(/*sheet*/ 0, /*row*/ 0, /*col*/ 0, '=A1+B1')
if (result.status.ok && result.value.kind === ValueKind.Number) {
  console.log(result.value.number)
}
```

This is read-only: it does not mutate the workbook, write a value anywhere, or join the dependency graph — nothing here becomes dirty on a later edit. Array/spill results are also reduced to their top-left element: evaluating `=SEQUENCE(3)` this way returns a single number, not a 3-row spill. A real cell containing `=SEQUENCE(3)` still spills normally. See [Dynamic arrays](/workbook/dynamic-arrays) for how spilling works when the formula is actually written into a cell.

`evaluateFormulaArray()` (Node addon, WASM, and C API) and `evaluate_formula_array()` (Python) return the whole array result instead of reducing a dynamic-array formula to its top-left element. Python also exposes `evaluate_cf_formula()` for conditional-format predicates, but does not expose the general scalar `evaluate_formula_text()`; for a scalar evaluated in workbook context, write the formula to a cell and recalculate.

`evaluateConditionalFormula()` follows the same read-only rule, additionally shifting relative references from the rule's anchor and applying Excel's CF-predicate coercion (error / blank / text / numeric-zero are `false`; any other number is `true`), so the result matches what a real CF rule would evaluate to at that cell.

The normal edit path and the ad-hoc path answer different questions — the first commits a value you can read again later, the second is a disposable "what if" query:

<DiagramFlow :steps="[
  { label: 'setFormula()' },
  { label: 'recalc()' },
  { label: 'getValue()', note: 'mutates the model; result stays until the next edit' }
]" label="Normal edit path: setFormula, recalc, getValue" />

<DiagramFlow :steps="[
  { label: 'evaluateFormulaText()', note: 'no mutation · no dependency-graph entry' },
  { label: 'Scalar result', note: 'array/spill results reduced to the top-left element' }
]" label="Ad-hoc path: evaluateFormulaText, read-only, scalar-only" />

The CLI is intentionally narrower. It is a command surface for `eval`, `recalc`, and `dump`, not a fine-grained workbook-editing API. For application embedding, choose WASM, Native Node, or Python.

::: tip Discovering what is implemented
Both `Module.functionNames()` (WASM) and `formulon_function_lookup` (MCP) enumerate registered functions at runtime. Use them to verify a target Excel version's surface rather than reading the static docs.
:::

## Read next

- [Recalculation](/workbook/recalculation) — when edits become visible values.
- [Surface matrix](/api/surfaces) — what each binding exposes.
- [Compatibility / Errors](/compatibility/errors) — what edits to expect on malformed input.
