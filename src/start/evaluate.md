# Evaluate a Formula

Formula evaluation is useful when your application needs spreadsheet semantics without loading a whole workbook UI.

::: info Excel errors are values
`#DIV/0!`, `#VALUE!`, and `#NAME?` travel as spreadsheet values. Host API failures use status envelopes, exceptions, or non-zero CLI exits depending on surface.
:::

<DiagramLayers
  :layers="[
    {
      title: 'Need to evaluate a formula?',
      nodes: [
        { label: 'Fresh, disposable formula', note: 'evalFormula / eval_formula — fresh Sheet1!A1 context' },
        { label: 'Ad-hoc, against a loaded workbook', note: 'evaluateFormulaText — read-only, JS/WASM + Native Node only' },
        { label: 'Persist into the workbook', note: 'setFormula + recalc() — joins the dependency graph' }
      ]
    }
  ]"
  label="Three ways to evaluate a formula"
/>

## JavaScript / WASM

```ts
import createFormulon, { ValueKind } from '@libraz/formulon'

const Module = await createFormulon()

const result = Module.evalFormula('=SUM(1,2,3)')
if (!result.status.ok) {
  throw new Error(result.status.message)
}

if (result.value.kind === ValueKind.Number) {
  console.log(result.value.number)
}
```

## Python

```python
import formulon

value = formulon.eval_formula("=SUM(1,2,3)")
print(value.to_python())
```

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

## CLI

```sh
formulon eval '=SUM(1,2,3)'
formulon eval --json '=1/0'
```

Cell-level Excel errors are values. `=1/0` should return an error value such as `#DIV/0!`; it should not be treated as a process, Python, or JS exception. Host-side failures, such as invalid workbook bytes or a missing file, are reported through the surface-specific error path.

The panel below is where to check that claim. Its `=1/0` preset comes back with value kind `Error` and the text `#DIV/0!` — a value you can inspect, not an exception you have to catch. Its second tab evaluates against a small seeded workbook, the `evaluateFormulaText` path described in the next section.

<FormulaEvalDemo />

## Evaluating against a loaded workbook

The one-shot helpers evaluate at `Sheet1!A1` in a new workbook. Blank cell references resolve against that workbook, and `ROW()` / `COLUMN()` return `1`. They cannot access cells or defined names from an existing workbook. To use those, load the workbook and call `evaluateFormulaText` (or its conditional-formatting counterpart, `evaluateConditionalFormula`), which evaluates formula text as if it were entered at a specific cell without changing the workbook.

::: warning Read-only, and scalar-only
`evaluateFormulaText` / `evaluateConditionalFormula` never mutate the workbook and never join the dependency graph — a self-reference reads the target cell's cached value instead of raising `#REF!`. Array and spill results are reduced to their top-left element; this is the direct scalar-result behavior, not Excel's implicit-intersection or spill behavior. See [Dynamic arrays](/workbook/dynamic-arrays) for how spilling actually works.
:::

::: tip Whole-array variant
When you want the entire spilled result rather than just the top-left element, use `evaluateFormulaArray(sheet, row, col, formula)` — it returns the whole Array (`EvalArrayResult`) of a dynamic-array formula. Python exposes the same operation as `evaluate_formula_array(...)`.
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

The Native Node package (`packages/npm-native`) exposes the identical `evaluateFormulaText` / `evaluateConditionalFormula` methods on the same `Workbook` shape; see [Native Node integration](/runtimes/node-native).

::: warning Python boundary
Python does not expose the general scalar `evaluate_formula_text` equivalent. It does expose `evaluate_cf_formula` for conditional-format predicates and `evaluate_formula_array` for full array results. For a general scalar evaluated in workbook context, write the formula into a cell with `set_formula` and call `recalc()`.
:::
