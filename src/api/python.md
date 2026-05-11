# Python API

The Python package exposes a small, Pythonic wrapper over the Formulon C ABI compiled to `formulon_capi.wasm`. The published wheel is `py3-none-any`; `pip` installs `wasmtime` as the platform runtime.

::: info Glossary: py3-none-any wheel
A Python wheel with no Python ABI tag, no platform tag, and no native code. It works on any CPython 3 implementation as long as its dependencies are available. The platform-specific runtime is supplied by `wasmtime`, not by `formulon`.
:::

## Top-level API

| API | Purpose |
| --- | --- |
| `formulon.eval_formula(formula)` | One-shot formula evaluation |
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

Methods:

- `sheet_count()`, `sheet_name(index)`, `add_sheet(name)`
- `set_number`, `set_bool`, `set_text`, `set_blank`, `set_formula`
- `get_value`
- `recalc`, `set_iterative`
- `save`
- `iter_cells`, `iter_defined_names`, `iter_tables`, `iter_passthrough`

::: tip Lifetime is a context manager
The `with` block releases the native handle on exit, including when an exception is raised. Avoid keeping a `Workbook` reference past its `with` block.
:::

## Values

`Value.to_python()` converts blank, number, boolean, and text values into natural Python types (`None`, `float`, `bool`, `str`). Error, array, ref, and lambda values return the `Value` wrapper so callers can inspect `kind` and payload fields.

```python
value = wb.get_value(0, 0, 0)
if value.kind is ValueKind.NUMBER:
    print(value.number)
elif value.kind is ValueKind.ERROR:
    print(value.error_code, value.error_text)
```

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
