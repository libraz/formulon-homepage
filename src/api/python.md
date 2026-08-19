# Python API

The Python package exposes a Pythonic wrapper over the Formulon C ABI compiled to `formulon_capi.wasm`. The published wheel is `py3-none-any`; `pip` installs `wasmtime` as the platform runtime.

::: info Glossary: py3-none-any wheel
A Python wheel with no Python ABI tag, no platform tag, and no native code. It supports CPython 3.9 and later where a compatible `wasmtime` wheel is available. The platform-specific runtime is supplied by `wasmtime`, not by `formulon`.
:::

## Top-level API

| API | Purpose |
| --- | --- |
| `formulon.eval_formula(formula)` | One-shot formula evaluation |
| `formulon.error_display_name(error_code)` | Excel display literal for an error ordinal |
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
- `pinned_now`, `set_pinned_now`, `clear_pinned_now`
- `save`, `save_as(fmt)` (choose the XLSX/XLSB container format)
- `save_with_diagnostics(fmt)`, `read_diagnostics()`
- `iter_cells`, `iter_defined_names`, `iter_tables`, `iter_passthrough`
- sheet structure edits, row/column edits, defined names
- merges, `get_comment`/`set_comment`, `comment_count`, `get_comments`, hyperlinks, data validations
- `evaluate_cf_formula`, visual conditional-format payloads (`ColorScale`, `DataBar`, `IconSet`), DXFs, `paginate`
- styles, conditional formats, sheet view/protection
- pivot cache/table APIs (including worksheet-source access and pivot report layout), dependency tracing, spill info, function metadata, DXFs

::: tip Lifetime is a context manager
The `with` block releases the native handle on exit, including when an exception is raised. Avoid keeping a `Workbook` reference past its `with` block.
:::

::: info Python evaluator boundary
Python exposes `evaluate_formula_array(sheet, row, col, formula)` and `evaluate_cf_formula(sheet, row, col, anchor_row, anchor_col, formula)`. It does not expose the general scalar `evaluate_formula_text`; use `evaluate_formula_array` when a full array result is needed. `comment_count(sheet)` and `get_comments(sheet)` enumerate comments, and `paginate(sheet)` returns `PaginationResult(page_count, print_area, horizontal_breaks, vertical_breaks)`.
:::

The authoritative Python method list lives in the package type stubs and docstrings.

## Serialization diagnostics

`save_with_diagnostics(fmt)` returns a `SaveDiagnostics` object with the saved `bytes` and counters for losses and deferred features observed by the writer. `read_diagnostics()` returns a `ReadDiagnostics` object with the counters captured when the workbook was loaded. The counters have partial coverage: an all-zero result means that none of the documented losses occurred, not that the package was compared byte-for-byte or that no diagnostic event was logged.

| Result | Fields | Meaning |
| --- | --- | --- |
| `SaveDiagnostics` | `downgraded_formula_count` | Formula cells emitted as cached literals; always zero for XLSX. |
|  | `deferred_feature_count` | Sheet features not lowered to records; always zero for XLSX. |
|  | `dropped_part_count` | Passthrough parts dropped by either writer. |
|  | `dropped_relationship_count` | Relationships dropped because their target part was dropped; this can describe the same loss as `dropped_part_count`. |
|  | `renumbered_part_count` | Tables emitted under a writer-assigned part id; always zero for XLSB. |
| `ReadDiagnostics` | `undecoded_formula_count` | Stored formulas that could not be decoded; XLSB only. |
|  | `undecoded_defined_name_count` | Defined names skipped because they could not be decoded; XLSB only. |
|  | `undecoded_part_count` | XLSB package parts whose content type could not be resolved. |
|  | `skipped_feature_count` | OOXML presentation-overlay entries skipped because their references were unusable. |
|  | `unknown_content_type_count` | OOXML workbook parts with an unrecognised content type. |

```python
from formulon import Workbook, WorkbookFormat

with Workbook.create_default() as wb:
    saved = wb.save_with_diagnostics(WorkbookFormat.XLSB)
    print(saved.bytes, saved.downgraded_formula_count)
    loaded = Workbook.load(saved.bytes)
    try:
        print(loaded.read_diagnostics().undecoded_formula_count)
    finally:
        loaded.close()
```

`dropped_part_count` and `dropped_relationship_count` can both increase for one dropped part; do not add them as a total number of lost objects.

## Pinned clock

`NOW()`, `TODAY()`, and pivot relative-period filters read the host clock when the workbook is unpinned. Pin the workbook to one local civil-time reading when those results must agree within a recalculation or be reproducible across hosts:

```python
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_pinned_now(2026, 8, 19, 12, 0, 0)
    print(wb.pinned_now())  # CivilTime(year, month, day, hour, minute, second)
    wb.recalc()
    wb.clear_pinned_now()
```

`pinned_now()` returns a `CivilTime` object or `None` when the workbook follows the host clock. `set_pinned_now()` validates `year` 1900–9999, the real day range for `month` 1–12, `hour` 0–23, and `minute` / `second` 0–59; invalid fields raise `FormulonError` rather than being normalised. The values are local civil fields, not a timestamp, so they have no timezone interpretation. Setting or clearing the pin does not recalculate cached formula values; call `recalc()` explicitly. The pin is workbook model state, not file state: saving does not record it, and a reloaded workbook is unpinned.

## Values

`Value.to_python()` converts blank, number, boolean, and text values into natural Python types (`None`, `float`, `bool`, `str`). Error, array, ref, and lambda values return the `Value` wrapper so callers can inspect `kind` and payload fields.

```python
value = wb.get_value(0, 0, 0)
if value.kind is ValueKind.NUMBER:
    print(value.number)
elif value.kind is ValueKind.ERROR:
    print(formulon.error_display_name(value.error_code))
```

Python's `Value` only carries `error_code` — there is no `error_text` field. Call `formulon.error_display_name(value.error_code)` to get the Excel literal (`#DIV/0!`, `#VALUE!`, …).

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
