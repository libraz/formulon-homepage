# Python Integration

The Python package is intended for scripts, notebooks, tests, and data pipelines that need Excel-compatible recalculation and workbook editing without launching Excel.

::: tip Best fit
Use Python when the spreadsheet is part of a batch job or analysis workflow. Use WASM when the workbook should stay in the browser.
:::

::: info Glossary: wasmtime
A standalone WebAssembly runtime maintained by the Bytecode Alliance. The Formulon Python package ships a portable `formulon_capi.wasm` and uses `wasmtime` to load it at import time — so the wheel is `py3-none-any` and works wherever a `wasmtime` wheel is available.
:::

::: info Glossary: C ABI
A flat C function interface exposed by the Formulon native library. Bindings call into it through a stable contract; the Python wrapper, the CLI, and the WASM build all sit on top of the same C ABI. See [C ABI](/development/bindings).
:::

Typical use cases:

- validating formulas in uploaded workbooks,
- recalculating reports in batch jobs,
- comparing workbook output against checked-in goldens,
- extracting calculated values for downstream systems,
- editing workbook structure, styles, comments, validations, conditional formats, and PivotTables from Python.

Keep workbook IO at the edges of your script and make the selected profile explicit in test fixtures.

## Packaging

The PyPI package does not ship a platform-native `libformulon`. It ships one `py3-none-any` wheel with `formulon_capi.wasm` and a pure-Python wrapper; `wasmtime` supplies the platform-specific runtime that loads the module. There is no Cython, pybind11, or NumPy dependency at runtime.

## API scope

`Workbook` mirrors the C ABI surface exposed by the npm bindings. In addition to `load -> mutate -> recalc -> save`, the wrapper exposes sheet and matrix edits, defined names, partial recalc, merges, comments, hyperlinks, validations, styles, conditional formatting, PivotTables, dependency tracing, spill inspection, function metadata, sheet view/protection, calc policy, and external links.

The main runtime difference is threading: Python drives the C ABI through `wasmtime`, so `recalc()` is serial under WASM. Result fidelity is the same as other surfaces.

::: warning Python does not yet expose the v0.9.4 additions
`evaluateFormulaText`, `evaluateConditionalFormula`, and comment enumeration (`getComments` on the Node addon; `fm_sheet_get_comment_count` / `fm_sheet_get_comment_at_index` on the C API) ship in v0.9.4 for the C API, Node addon, and WASM only. The Python wrapper has no equivalent yet — "mirrors the C ABI surface" describes the general shape of the binding, not full one-to-one method parity. Python's `add_conditional_format` also does not yet return the new rule's index the way the Node/C API `addConditionalFormat` does as of v0.9.4.
:::

<DiagramLayers :layers="[
  { title: 'v0.9.4 additions', nodes: ['evaluateFormulaText / evaluateConditionalFormula / getComments'] },
  { title: 'Exposed on', nodes: [
    { label: 'C API', note: 'source of truth' },
    { label: 'Node addon' },
    { label: 'WASM' }
  ] },
  { title: 'Not yet exposed on', nodes: [{ label: 'Python wrapper' }] }
]" />

## Error handling

`FormulonError` means the host operation failed: invalid bytes, a bad handle, IO trouble, or an internal engine failure. Excel cell errors are returned as `Value(kind=ValueKind.ERROR)`.

```python
import formulon
from formulon import ValueKind, FormulonError

try:
    value = formulon.eval_formula("=1/0")
    assert value.kind is ValueKind.ERROR  # cell error
except FormulonError as e:
    # host error: not a cell error
    raise
```

## Lifetime

Use `Workbook` as a context manager. The wrapper releases the native handle on exit, even if an exception is raised inside the block:

```python
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_formula(0, 0, 0, "=SUM(1,2,3)")
    wb.recalc()
    print(wb.get_value(0, 0, 0).to_python())
```

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

## Read next

- [Python API](/api/python) — top-level surface and method list.
- [Workbook lifecycle](/workbook/lifecycle) — the same flow in engine terms.
- [Python batch recalculation](/scenarios/python-batch) — end-to-end pipeline.
