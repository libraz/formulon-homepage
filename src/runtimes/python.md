# Python Integration

The Python package is intended for scripts, notebooks, tests, and data pipelines that need Excel-compatible recalculation and workbook editing without launching Excel.

::: tip Best fit
Use Python when the spreadsheet is part of a batch job or analysis workflow. Use WASM when the workbook should stay in the browser.
:::

::: info Glossary: wasmtime
A standalone WebAssembly runtime maintained by the Bytecode Alliance. The Formulon Python package ships a portable `formulon_capi.wasm` and uses `wasmtime` to load it at import time — so the wheel is `py3-none-any` and works wherever a `wasmtime` wheel is available.
:::

::: info Glossary: C ABI
A flat C function interface exposed by the Formulon native library. Bindings call into it through a shared contract; the Python wrapper, the CLI, and the WASM build all sit on top of the same C ABI. See [C ABI](/development/bindings).
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

`Workbook` mirrors the C ABI surface exposed by the npm bindings. In addition to `load -> mutate -> recalc -> save`, the wrapper exposes sheet and matrix edits, defined names, partial recalc, merges, comments, hyperlinks, validations, styles, visual conditional-format payloads (`ColorScale`, `DataBar`, `IconSet`), DXFs, PivotTables with report layout and pivot-cache worksheet-source access, dependency tracing, spill inspection, function metadata, sheet view/protection, calc policy, and external links.

Tables can be authored with `table_create()`, `table_update()`, and `table_remove()`. `column_names` must match the width of `ref`, and the caller still writes the header cells. `table_update()` preserves fields passed as `None`; an existing table AutoFilter keeps its criteria and extensions when its range is retargeted. Worksheet-level AutoFilter XML is available through `get_auto_filter_xml()` / `set_auto_filter_xml()` as a complete opaque `<autoFilter>` fragment; an empty string clears it. `add_hyperlink_range()` adds a hyperlink over an inclusive rectangle, and read-back `Hyperlink` values include `last_row` and `last_col`.

Python's `DataBar` exposes the full `x14` controls: `gradient`, `axis_position` (`0` automatic, `1` middle, `2` none), `negative_fill`, `border`, `negative_border`, and `axis_color`. Omitted values use the model defaults and the settings survive save and load. For a newly authored PivotTable, set `PivotWorksheetSource(ref="A1:C10", sheet="Data")` with `set_pivot_cache_worksheet_source()` before saving; a new cache without a worksheet source fails to save, while caches loaded from a file already have one.

Python can author worksheet presentation metadata as well as read it back. Use `set_sheet_visibility()` with `SheetVisibility.VISIBLE`, `HIDDEN`, or `VERY_HIDDEN`; `get_sheet_view()` returns the resolved three-state `visibility`. Use `set_page_setup()`, `set_page_margins()`, `set_print_options()`, `set_header_footer()`, `set_print_area()`, `set_print_titles()`, `add_row_break()`, and `add_col_break()` for typed print settings. `set_range_xf_index()` applies one cell-style XF index across an inclusive rectangle and materializes missing cells as styled blanks. `pivot_field_add_item_at()` addresses a cache shared-item index, including the blank pivot member; a label-based empty string cannot identify it.

When a data-validation input omits `allow_blank`, Python uses `False`. Pass `allow_blank=True` to allow empty cells. Row/column structural edits move an AutoFilter's `ref` range with its cells, but criteria offsets inside the range are not remapped.

The main runtime difference is threading: Python drives the C ABI through `wasmtime`, so `recalc()` is serial under WASM. Python exposes no `recalc_parallel()` or `recalcParallel()` API; use the WASM or native Node binding, or the CLI's `--threads`, when the parallel scheduler is required. Result fidelity is the same as other surfaces.

The PyPI WASM build parses worksheet XML with a DOM parser, one worksheet at a time. Peak parse memory therefore follows the largest worksheet XML part and must fit within the 32-bit WASM address space. Native CLI parsing switches to streaming above 256 KiB.

::: info Evaluator and workbook parity
Python exposes `evaluate_formula_array(sheet, row, col, formula)` for full array results and `evaluate_cf_formula(sheet, row, col, anchor_row, anchor_col, formula)` for conditional-format predicates. It does not expose general scalar `evaluate_formula_text`. Comments are enumerable with `comment_count(sheet)` and `get_comments(sheet)`, and `paginate(sheet)` returns page geometry. `error_display_name(error_code)` gives the Excel literal for an error ordinal.
Python has broad workbook parity, but does not mirror every C ABI entry point: the iterative-progress callback is not exposed. It exposes phonetic text through `set_phonetic()` and `get_phonetic()`, plus span-preserving `set_phonetic_runs()` / `get_phonetic_runs()` and `set_phonetic_properties()` / `get_phonetic_properties()` for the guide's rendering settings. Use mutation plus recalc for a general scalar evaluated in workbook context.
:::

<DiagramLayers :layers="[
  { title: 'Python workbook surface', nodes: ['array evaluation', 'CF evaluation', 'comment enumeration', 'pagination'] },
  { title: 'Exposed on', nodes: [
    { label: 'Shared C ABI', note: 'same workbook model' },
    { label: 'Python wrapper' }
  ] },
  { title: 'Scalar boundary', nodes: [{ label: 'evaluate_formula_text', note: 'not exposed on Python' }] }
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
