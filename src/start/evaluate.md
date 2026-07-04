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
        { label: 'Fresh, disposable formula', note: 'evalFormula / eval_formula — no workbook context' },
        { label: 'Ad-hoc, against a loaded workbook', note: 'evaluateFormulaText (v0.9.4) — read-only, JS/WASM + Native Node only' },
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

## CLI

```sh
formulon eval '=SUM(1,2,3)'
formulon eval --json '=1/0'
```

Cell-level Excel errors are values. `=1/0` should return an error value such as `#DIV/0!`; it should not be treated as a process, Python, or JS exception. Host-side failures, such as invalid workbook bytes or a missing file, are reported through the surface-specific error path.

## Evaluating against a loaded workbook (v0.9.4)

The examples above always evaluate in a fresh, disposable formula context: there is no workbook, so cell references, defined names, and `ROW()` / `COLUMN()` have nothing to resolve against. Formulon 0.9.4 adds `evaluateFormulaText` (and its conditional-formatting counterpart, `evaluateConditionalFormula`) so you can evaluate formula text as if it were entered at a specific cell of an **already-loaded** workbook, without changing anything in it.

::: warning Read-only, and scalar-only
`evaluateFormulaText` / `evaluateConditionalFormula` never mutate the workbook and never join the dependency graph — a self-reference reads the target cell's cached value instead of raising `#REF!`. Array and spill results are reduced to their top-left element; this is a deliberate Phase 1 API shape, not Excel's implicit-intersection or spill behavior. See [Dynamic arrays](/workbook/dynamic-arrays) for how spilling actually works.
:::

::: tip Whole-array variant (v0.9.5)
When you want the entire spilled result rather than just the top-left element, v0.9.5 adds `evaluateFormulaArray(sheet, row, col, formula)` — same read-only, no-mutation, and self-reference caveats as `evaluateFormulaText`, but it returns the whole Array (`EvalArrayResult`) of a dynamic-array formula instead of reducing it. It is available on the Node addon, WASM, and C API, and — unlike the scalar variant — Python exposes it too as `evaluate_formula_array(...)`.
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

::: warning Python gap
`evaluateFormulaText` / `evaluateConditionalFormula` are available in the C API, the Node addon, and WASM only. The Python binding does not expose a scalar equivalent yet: evaluate a fresh formula with `formulon.eval_formula`, or write the formula into a cell with `set_formula` and call `recalc()` when you need workbook context in Python. Python does have the whole-array variant `evaluate_formula_array(...)` as of v0.9.5.
:::
