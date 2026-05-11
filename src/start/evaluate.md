# Evaluate a Formula

Formula evaluation is useful when your application needs spreadsheet semantics without loading a whole workbook UI.

::: info Excel errors are values
`#DIV/0!`, `#VALUE!`, and `#NAME?` travel as spreadsheet values. Host API failures use status envelopes, exceptions, or non-zero CLI exits depending on runtime.
:::

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
