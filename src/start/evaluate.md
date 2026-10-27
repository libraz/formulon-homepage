# Evaluate a Formula

Evaluate a formula on its own when you need a spreadsheet result without loading a workbook file. To evaluate against cells in a workbook you already loaded, see [Evaluating against a loaded workbook](#evaluating-against-a-loaded-workbook).

::: info Excel errors are values
`#DIV/0!`, `#VALUE!`, and `#NAME?` travel as spreadsheet values. Host API failures use status envelopes, exceptions, or non-zero CLI exits depending on surface.
:::

<DiagramLayers
  :layers="[
    {
      title: 'Which evaluation do you need?',
      nodes: [
        { label: 'evalFormula / eval_formula', note: 'One-shot, at A1 of a blank workbook' },
        { label: 'evaluateFormulaText', note: 'Read-only; JS/WASM and Native Node' },
        { label: 'setFormula + recalc()', note: 'Persists; joins the dependency graph' }
      ]
    }
  ]"
  label="Three ways to evaluate a formula: a one-shot call in a blank workbook, a read-only call against a loaded workbook, and writing the formula into the workbook"
  caption="Only setFormula writes into the workbook; the other two leave it unchanged."
/>

## Run the same formula on each surface

The one-shot API evaluates the formula in a fresh workbook. This example uses the same input on WASM, Native Node, Python, and the CLI:

::: code-group

```ts [WASM]
import createFormulon, { ValueKind } from '@libraz/formulon'

const Module = await createFormulon()
const result = Module.evalFormula('=SUM(1,2,3)')
if (!result.status.ok) throw new Error(result.status.message)
if (result.value.kind === ValueKind.Number) console.log(result.value.number)
```

```ts [Native Node]
import { evalFormula, ValueKind } from '@libraz/formulon-native'

const result = evalFormula('=SUM(1,2,3)')
if (!result.status.ok) throw new Error(result.status.message)
if (result.value.kind === ValueKind.Number) console.log(result.value.number)
```

```python [Python]
import formulon

value = formulon.eval_formula("=SUM(1,2,3)")
print(value.to_python())
```

```sh [CLI]
formulon eval '=SUM(1,2,3)'
```

:::

## Try it in the browser

`formulon eval --json '=1/0'` prints `{"kind":"error","value":"#DIV/0!"}` and exits `0`. A non-zero exit is reserved for host-side failures such as a usage error or an unreadable file.

Try it in the panel below: the `=1/0` preset comes back with value kind `Error` and the text `#DIV/0!`, a value you inspect rather than an exception you catch. The second tab evaluates against a small sample workbook through [`evaluateFormulaText`](#evaluating-against-a-loaded-workbook).

<FormulaEvalDemo />

## Show a formula in a user's Excel locale

Stored formulas use the invariant English function names and separators. A UI can switch the displayed locale without rewriting the workbook by passing a full Excel profile id to `localizeFormula()`. Convert edited text back with `canonicalizeFormula()` before storing it, and select the same profile on the workbook when the formula is evaluated.

```ts
import createFormulon from '@libraz/formulon'

const LocaleModule = await createFormulon()
const profile = 'mac-365-de_DE'
const localeWorkbook = LocaleModule.Workbook.createDefault()
try {
  const displayed = localeWorkbook.localizeFormula('=SUM(1.5,TRUE)', profile)
  if (!displayed.status.ok) throw new Error(displayed.status.message)
  const canonical = localeWorkbook.canonicalizeFormula(displayed.value, profile)
  if (!canonical.status.ok) throw new Error(canonical.status.message)
} finally {
  localeWorkbook.delete()
}
```

`localizeFormula()` is a text transform. It changes function names, separators, decimal points, Boolean names, and error names while leaving strings, quoted sheet names, external qualifiers, and structured-reference brackets alone. `localeFacts(profile)` supplies the separators, names, date order, currency, and localized error names needed by a custom editor. The engine profile catalog has 28 ids; `mac-*` profiles and `win-365-ja_JP` are measured against Excel, and the other Windows profiles use estimated locale data.

## Evaluating against a loaded workbook

The one-shot helpers evaluate at `Sheet1!A1` in a new, empty workbook, so every cell reference reads a blank and `ROW()` / `COLUMN()` return `1`. To use the cells and defined names of an existing workbook, load it and call `evaluateFormulaText` (or its conditional-formatting counterpart, `evaluateConditionalFormula`). Both evaluate formula text as if it were entered at a given cell, without changing the workbook.

::: warning Read-only, and scalar-only
`evaluateFormulaText` / `evaluateConditionalFormula` never mutate the workbook and never join the dependency graph — a self-reference reads the target cell's cached value instead of raising `#REF!`. Array and spill results are reduced to their top-left element; this is the direct scalar-result behavior, not Excel's implicit-intersection or spill behavior. See [Dynamic arrays](/workbook/dynamic-arrays) for how spilling actually works.
:::

::: tip Whole-array variant
For the entire spilled result, use `evaluateFormulaArray(sheet, row, col, formula)`. It returns an `EvalArrayResult` of `{ status, rows, cols, cells }`, where `cells[r][c]` holds each value; a scalar result comes back as a 1×1 array. Python's `evaluate_formula_array(...)` returns the same grid as a list of rows of `Value`.
:::

### JavaScript / WASM and Native Node

```ts
import createFormulon, { ValueKind } from '@libraz/formulon'

const Module = await createFormulon()
const workbook = Module.Workbook.loadBytes(xlsxBytes)

try {
  if (!workbook.isValid()) {
    throw new Error(Module.lastErrorMessage())
  }

  // Evaluate as if `=B4*1.1` were entered at sheet 0, row 5, col 1 (B6) --
  // resolves against the workbook's live cells without writing anything.
  const preview = workbook.evaluateFormulaText(0, 5, 1, '=B4*1.1')
  if (!preview.status.ok) {
    throw new Error(preview.status.message)
  }

  if (preview.value.kind === ValueKind.Number) {
    console.log(preview.value.number)
  }
} finally {
  workbook.delete()
}
```

The Native Node package (`@libraz/formulon-native`, built from source) exposes the identical `evaluateFormulaText` / `evaluateConditionalFormula` methods on the same `Workbook` shape; see [Native Node integration](/runtimes/node-native).

::: warning Python boundary
Python does not expose the general scalar `evaluate_formula_text` equivalent. It does expose `evaluate_cf_formula` for conditional-format predicates and `evaluate_formula_array` for full array results. For a general scalar evaluated in workbook context, write the formula into a cell with `set_formula` and call `recalc()`.
:::
