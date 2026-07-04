# Python API

The Python package exposes a Pythonic wrapper over the Formulon C ABI compiled to `formulon_capi.wasm`. The published wheel is `py3-none-any`; `pip` installs `wasmtime` as the platform runtime.

::: info Glossary: py3-none-any wheel
A Python wheel with no Python ABI tag, no platform tag, and no native code. It works on any CPython 3 implementation as long as its dependencies are available. The platform-specific runtime is supplied by `wasmtime`, not by `formulon`.
:::

## Top-level API

| API | Purpose |
| --- | --- |
| `formulon.eval_formula(formula)` | One-shot formula evaluation |
| `formulon.merge_function_metadata(base, entry, locale)` | Pure helper: merge host-supplied localized function metadata over the engine catalog |
| `formulon.library_version()` | Version of the loaded Formulon module |
| `formulon.version_string()` | Alias for `library_version()` |
| `ValueKind` | Enum matching C ABI value kinds |
| `FormulonError` | Host-side failure exception |

## Workbook

```python
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_formula(0, 0, 0, "=SUM(1,2,3)")
    wb.recalc()
    print(wb.get_value(0, 0, 0).to_python())
```

Factories:

- `Workbook.create_default()`
- `Workbook.create_empty()`
- `Workbook.load(data)`

Common methods:

- `sheet_count()`, `sheet_name(index)`, `add_sheet(name)`
- `set_number`, `set_bool`, `set_text`, `set_blank`, `set_formula`
- `get_value`, `evaluate_formula_array`, `lambda_text_at`
- `recalc`, `partial_recalc`, `set_iterative`
- `save`, `save_ex` (choose the XLSX/XLSB container format)
- `iter_cells`, `iter_defined_names`, `iter_tables`, `iter_passthrough`
- sheet structure edits, row/column edits, defined names
- merges, `get_comment`/`set_comment`, hyperlinks, data validations
- styles, conditional formats, sheet view/protection
- pivot cache/table APIs, dependency tracing, spill info, function metadata

::: tip Lifetime is a context manager
The `with` block releases the native handle on exit, including when an exception is raised. Avoid keeping a `Workbook` reference past its `with` block.
:::

::: warning Only the whole-array ad-hoc evaluator; no comment enumeration yet
Python still has no `evaluate_formula_text` / `evaluate_conditional_formula` equivalent to the WASM / Native Node / C API 0.9.4 scalar ad-hoc evaluators, and only exposes single-cell `get_comment` / `set_comment` — there is no sheet-wide comment enumeration call. As of 0.9.5 Python does expose the whole-array evaluator `evaluate_formula_array(sheet, row, col, formula)` — read-only and non-mutating, returning the full spilled `Array` result (as a nested `List[List[Value]]`) rather than reducing to the top-left element — plus the pure `merge_function_metadata` helper. See [Surface matrix](/api/surfaces) for the full parity picture.
:::

The authoritative Python method list lives in the package type stubs and docstrings.

## Values

`Value.to_python()` converts blank, number, boolean, and text values into natural Python types (`None`, `float`, `bool`, `str`). Error, array, ref, and lambda values return the `Value` wrapper so callers can inspect `kind` and payload fields.

```python
value = wb.get_value(0, 0, 0)
if value.kind is ValueKind.NUMBER:
    print(value.number)
elif value.kind is ValueKind.ERROR:
    print(value.error_code)  # int ordinal; see /compatibility/errors for the mapping
```

Python's `Value` only carries `error_code` — there is no `error_text` field. Map the ordinal to a symbolic error (`#DIV/0!`, `#VALUE!`, …) yourself using the [error model](/compatibility/errors) table.

## Error handling

`FormulonError` is a host-side failure — invalid bytes, bad handle, IO error, or internal engine failure. Excel cell errors are values, not exceptions:

```python
import formulon
from formulon import ValueKind, FormulonError

try:
    with Workbook.load(blob) as wb:
        wb.recalc()
        v = wb.get_value(0, 0, 0)
        if v.kind is ValueKind.ERROR:
            handle_cell_error(v)
except FormulonError as e:
    handle_host_failure(e)
```

## Read next

- [Workbook lifecycle](/workbook/lifecycle) — open / mutate / recalc / save.
- [Python batch recalculation](/scenarios/python-batch) — end-to-end pipeline.
