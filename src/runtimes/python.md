# Python Integration

The `formulon` package recalculates and edits Excel workbooks from scripts, notebooks, tests, and data pipelines without launching Excel.

## Install and first call

```sh
python -m pip install formulon==0.15.2
```

```python
import formulon
from formulon import Workbook

print(formulon.eval_formula("=SUM(1,2,3)").to_python())  # 6.0

with Workbook.create_default() as wb:
    wb.set_number(0, 1, 0, 21)          # Sheet1!A2
    wb.set_formula(0, 0, 0, "=A2*2")    # Sheet1!A1
    wb.recalc()
    print(wb.get_value(0, 0, 0).to_python())  # 42.0
```

Coordinates are zero-based `(sheet, row, col)`. The `with` block releases the workbook on exit, including when an exception is raised; call `close()` yourself where a context manager does not fit.

::: tip Best fit
Use Python when the spreadsheet is part of a batch job or analysis workflow. Use WASM when the workbook should stay in the browser.
:::

## Packaging

The PyPI package is one `py3-none-any` wheel for Python 3.9 and later. It contains `formulon_capi.wasm`, the [C ABI](/api/c) compiled to WebAssembly, and a pure-Python wrapper. `pip` also installs `wasmtime`, which supplies the platform-specific runtime. There is no Cython, pybind11, or NumPy dependency.

::: info Glossary: wasmtime
A standalone WebAssembly runtime maintained by the Bytecode Alliance. `formulon` loads its module through `wasmtime` at import time, so the one wheel works on every platform that has a `wasmtime` wheel.
:::

## Batch recalculation pattern

```python
from formulon import Workbook

with open("input.xlsx", "rb") as f:
    blob = f.read()

with Workbook.load(blob) as wb:
    wb.set_number(0, 3, 1, 125_000.0)
    wb.recalc()
    output = wb.save()

with open("output.xlsx", "wb") as f:
    f.write(output)
```

This is the canonical pattern: `load → mutate → recalc → save`. See [Python batch recalculation](/scenarios/python-batch) for a fuller example.

## Differences from the other runtimes

- `recalc()` is serial. Python has no `recalc_parallel()`; use `@libraz/formulon/threads`, Native Node, or the CLI's `--threads` when the parallel scheduler is required.
- There is no scalar `evaluate_formula_text()`. `eval_formula()` evaluates against a fresh workbook, and `Workbook.evaluate_formula_array()` evaluates read-only against a loaded one.
- Worksheet parsing has the same memory ceiling as the npm WASM build; see [Memory limits](/runtimes/wasm#memory-limits).

[Method differences](/api/surfaces#method-differences) lists the remaining per-binding gaps.

## Errors

A host-side failure such as invalid bytes, an out-of-range sheet, or malformed formula text in `set_formula()` raises `FormulonError`. An Excel cell error is a value: `get_value()` returns `Value(kind=ValueKind.ERROR)`. [Python API](/api/python#error-handling) lists the exception attributes.

## Read next

- [Python API](/api/python) — top-level surface and method list.
- [Workbook lifecycle](/workbook/lifecycle) — the same flow in engine terms.
- [Python batch recalculation](/scenarios/python-batch) — end-to-end pipeline.
