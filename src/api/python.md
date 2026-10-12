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
| `formulon.merge_function_metadata(base, entry, locale)` | Pure helper: merge host-supplied localized function metadata over the locale-invariant engine catalog; `locale` is a BCP-47 display tag |
| `formulon.library_version()` | Version of the loaded Formulon module |
| `formulon.version_string()` | Alias for `library_version()` |
| `formulon.set_log_min_level(level)` | Process-wide threshold for engine log records; the default `LogLevel.OFF` is silent, and `WARN` or below writes one JSON record per line to stderr; the custom log-sink callback is not bound |
| `ValueKind` | Enum matching C ABI value kinds |
| `FormulonError` | Host-side failure exception |

The package also exports the binding enums used by the workbook records:

| Area | Enums |
| --- | --- |
| Geometry and display | `GeometryMode` (`DISPLAY = 0`, `PRINT = 1`), `DisplayStatus` (`OK = 0`, `OVERFLOW = 1`, `INVALID_FORMAT = 2`) |
| AutoFilter | `FilterKind`, `FilterOperator`, `DynamicFilterType`, `SortBy`, `SortMethod`, `DateTimeGrouping` |
| Validation | `ValidationErrorStyle` (`STOP = 0`, `WARNING = 1`, `INFORMATION = 2`) |
| Themes and styles | `ColorContext`, `ColorResolution`, `ThemeSource`, `EffectiveStyleSource` |
| Images and drawings | `ImageFormat`, `DrawingObjectKind`, `AnchorKind`, `AnchorEditAs` |
| Text collation | `CollationStrength` (`COMPARE = 0`, `DYNAMIC = 1`, `CLASSIC_EXACT = 2`) |
| Workbook state | `CalcMode`, `SheetVisibility`, `WorkbookFormat` |

The function catalog is split by responsibility. `Workbook.function_metadata(name)` returns structural fields only (canonical name, arity, availability); the human-readable signature and description are `None`. Use the profile-based helpers for Excel display names and formula text, and use `merge_function_metadata()` with a host-owned BCP-47 UI locale for translated descriptions.

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
- `Workbook.create_for_profile(profile_id)`
- `Workbook.create_empty()`
- `Workbook.load(data)`

`create_default()` builds the ordinary one-sheet workbook with Calibri 11. `create_for_profile(profile_id)` records the selected profile and applies its new-workbook defaults: body and optional phonetic fonts, the localized `Normal` style and first-sheet names, cell-xf alignment, phonetic settings, page margins, and the Mac row-height and base-column-width values. It writes no theme part, so a fresh workbook reads as using the default Office theme; Windows row and column metrics use the engine defaults.

Common methods:

- `sheet_count()`, `sheet_name(index)`, `add_sheet(name)`
- `set_number`, `set_bool`, `set_text`, `set_blank`, `set_formula`
- `get_value`, `evaluate_formula_array`, `lambda_text_at`
- `recalc`, `partial_recalc`, `set_iterative`, `get_iterative`
- `pinned_now`, `set_pinned_now`, `clear_pinned_now`
- `save`, `save_as(fmt)` (choose the XLSX/XLSB container format)
- `save_with_diagnostics(fmt)`, `read_diagnostics()`
- `iter_cells`, `iter_defined_names`, `iter_tables`, `iter_passthrough`
- sheet structure edits, row/column edits, defined names
- merges, `get_comment`/`set_comment`, `comment_count`, `get_comments`, hyperlinks, data validations
- `evaluate_cf_formula`, visual conditional-format payloads (`ColorScale`, `DataBar`, `IconSet`), DXFs, `paginate`
- styles, row/column style overrides, range style remapping and snapshots, `set_range_xf_index`, conditional formats, sheet view/protection and three-state visibility
- typed print settings (`set_page_setup`, `set_page_margins`, `set_print_options`, `set_header_footer`, print area/titles, and row/column breaks)
- pivot cache/table APIs (including worksheet-source access, cache-index item filters, and pivot report layout), dependency tracing, spill info, function metadata, DXFs

Profile and formula-text helpers are also available as workbook-independent static methods:

```python
from formulon import Workbook

profile = "mac-365-de_DE"
shown = Workbook.localize_formula("=SUM(1.5,TRUE)", profile)
stored = Workbook.canonicalize_formula(shown, profile)
facts = Workbook.locale_facts(profile)
print(shown, stored, facts.decimal_separator, facts.true_name)
```

`localize_function_name()` / `canonicalize_function_name()` map one function name. `localize_formula()` rewrites function names, list and array separators, decimal points, Boolean names, and error names while preserving strings, quoted sheet names, external qualifiers, and structured-reference brackets. `canonicalize_formula()` reverses that text rewrite. These helpers use the full profile id, not a numeric locale code, and they do not validate or install a formula. The profile catalog has 28 ids; locale facts are measured for every `mac-*` profile and `win-365-ja_JP`, while the other 13 Windows profiles use estimated locale data. `LocaleFacts.collation_measured` is separate and is true only for `mac-*` profiles.

`Workbook.compare_text(a, b, strength, profile_id)` returns `-1`, `0`, or `1` for the selected text fold. `CollationStrength` distinguishes the comparison, dynamic-array lookup, and classic exact folds. `Workbook.collation_classes(values, strength, profile_id)` returns `CollationClasses` with dense ids in ascending SORT order: numbers, text, booleans, errors, then blanks. Equal ids require the same `ValueKind`; text uses the selected fold, `-0` equals `0`, and blanks share one class. The ids are meaningful only within one call, so classify saved values together with current values when matching a selection.

```python
from formulon import CollationStrength, Value, ValueKind, Workbook

profile = "mac-365-en_US"
order = Workbook.compare_text("a", "b", CollationStrength.COMPARE, profile)
values = [Value(kind=ValueKind.TEXT, text="A"), Value(kind=ValueKind.TEXT, text="a")]
classes = Workbook.collation_classes(values, CollationStrength.DYNAMIC, profile)
print(order, classes.class_ids, classes.class_count)
```

The newer workbook methods are grouped by the surface they serve:

| Group | Methods |
| --- | --- |
| Ranges | `get_formula`, `get_formula_r1c1`, `get_cells_in_range`, `get_merges_in_range`, `set_range_xf_index`, `list_invalid_cells` |
| Text collation | `compare_text`, `collation_classes` |
| Geometry and layout | `get_cell_rect_pt`, `get_column_width_pt`, `get_row_height_pt`, `get_width_model`, `column_chars_to_pt`, `column_pt_to_chars`, sheet view, protection, row/column layout, typed print settings |
| Display | `get_display_text`, `format_value` |
| Themes and styles | `get_theme`, `set_theme_colors`, `set_theme_fonts`, `set_theme_script_font`, `resolve_color`, `get_effective_style`, row/column style setters and clearers, `get_cell_xf_index`, `set_cell_xf_index`, `clear_cell_xf_index`, `set_range_xf_index`, `range_style_bases`, `remap_range_style`, `snapshot_range_style`, `restore_range_style`, `set_cell_style`, `remove_cell_style` |
| Filters | `get_auto_filter` / `set_auto_filter` / `remove_auto_filter`, `apply_auto_filter`, `clear_auto_filter`, `evaluate_auto_filter`, plus table AutoFilter counterparts |
| Validation | `get_validations`, `add_validation`, `remove_validation_at`, `clear_validations`, `validate_value`, `list_invalid_cells` |
| Threaded comments | `get_threaded_comments`, `add_threaded_comment`, `edit_threaded_comment`, `set_thread_resolved`, `remove_threaded_comment`, `get_persons`, `add_person`, `remove_person` |
| Images and drawings | `probe_image`, `list_drawing_objects`, `get_image`, `insert_image`, `remove_image` |

`CellStyle` is the named-style record used by `set_cell_style()` and `get_cell_style()`. Its fields are `name`, `xf_id`, `builtin_id`, `i_level`, `hidden`, and `custom_builtin`; `name` and `xf_id` are required, while the other fields use their dataclass defaults. Leave `builtin_id` at its default for a custom style. The `xf_id` points into the named-style XF table, not the per-cell XF table.

`set_column_style()` / `clear_column_style()` and `set_row_style()` / `clear_row_style()` change only the cell-style XF on the selected axis span. Index `0` is the default XF. `clear_cell_xf_index()` removes a direct cell assignment so a blank cell inherits its row, column, or workbook default; `set_cell_xf_index(..., 0)` keeps an explicit Normal XF and is therefore different from clearing it. Use `get_effective_style().source` to distinguish those cases. `range_style_bases()` returns the XFs that some cell of a selection resolves to; patch each base, pass the mapping to `remap_range_style()`, and use `snapshot_range_style()` / `restore_range_style()` for undo. Values and formulas are preserved. See [Workbook operations](/workbook/operations) for the canonical selection rules.

`get_theme()` returns `major_scripts` and `minor_scripts` in theme-part order, with the 47 default Office script entries when no theme part exists. `set_theme_script_font(major, script, typeface)` changes or appends one script. On readback, a `Jpan` entry supplies the matching East Asian face only when that font set's `<a:ea typeface>` is empty; an explicit `<a:ea typeface>` takes precedence. The script must contain four ASCII letters and the typeface cannot be empty.

::: tip Lifetime is a context manager
The `with` block releases the native handle on exit, including when an exception is raised. Avoid keeping a `Workbook` reference past its `with` block.
:::

::: info Python evaluator boundary
Python exposes `evaluate_formula_array(sheet, row, col, formula)` and `evaluate_cf_formula(sheet, row, col, anchor_row, anchor_col, formula)`. It does not expose the general scalar `evaluate_formula_text`; use `evaluate_formula_array` when a full array result is needed. `comment_count(sheet)` and `get_comments(sheet)` enumerate comments, and `paginate(sheet)` returns the full `PaginationResult` with page geometry and break metadata.
:::

`get_iterative()` reads `{ enabled, max_iterations, max_change }` after `set_iterative()`. The engine caps `max_iterations` at `32767` and reports the capped value. `set_sheet_visibility()` accepts `SheetVisibility.VISIBLE`, `HIDDEN`, or `VERY_HIDDEN`, and `get_sheet_view()` returns the resolved three-state value in addition to `tab_hidden`. `pivot_field_add_item_at()` addresses a manual-filter item by cache shared-item index, including the blank member; an empty label passed to `pivot_field_add_item()` cannot do that. Two bindings are Python-only: `set_iterative_enabled(enabled)` toggles iterative calculation while keeping the stored cap and threshold, and `add_batch()` registers fonts, fills, borders, number formats and XFs in one call.

Worksheet print settings are authored with `set_page_setup()`, `set_page_margins()`, `set_print_options()`, `set_header_footer()`, `set_print_area()`, `set_print_titles()`, `add_row_break()`, and `add_col_break()`. `set_range_xf_index()` applies one style XF index over an inclusive rectangle and materializes missing cells as styled blanks. A `DataValidationInput` with omitted `allow_blank` defaults to `False`; pass `allow_blank=True` to accept empty cells.

`get_cells_in_range(sheet, cell_range, cursor=None, limit=None)` returns `(cells, next_cursor)` in row-major order. Each `Cell` has `row`, `col`, `formula`, and `value`. Pass `next_cursor` into the next call until it is `None`; an omitted or zero `limit` uses the 65,536-cell maximum. Formula cells, non-blank values, and spill phantoms are included, while styled blanks are not. `list_invalid_cells()` follows the same paging contract.

Geometry methods accept `GeometryMode.DISPLAY` for the 96-DPI screen model or `GeometryMode.PRINT` for the DPI-stable pagination model. `get_display_text()` and `format_value()` return `DisplayStatus.OVERFLOW` with `########` when a value is outside the format's representable range, and `DisplayStatus.INVALID_FORMAT` when the format code is malformed; malformed formats fall back to General rendering.

`probe_image()` reads PNG, JPEG, GIF, or BMP dimensions without changing the workbook. `list_drawing_objects()` returns anchored objects in document order; `get_image()` copies picture bytes, `insert_image()` preserves existing drawing content, and `remove_image()` removes the picture and releases its media when no other object references it. Threaded-comment methods include replies and person records; removing a person fails while a comment or mention still refers to that person.

AutoFilter criteria are stored separately from row visibility. Use `evaluate_auto_filter()` to inspect matches and `apply_auto_filter()` to update hidden rows; `clear_auto_filter()` removes criteria while retaining the AutoFilter range. Validation methods check proposed values without storing them, and `list_invalid_cells()` enumerates existing violations.

`paginate(sheet)` returns `PaginationResult` with `page_count`, `print_area`, `horizontal_breaks`, `vertical_breaks`, `paper`, `margins`, `printable`, `scale`, `page_order`, `print_titles`, `pages`, `horizontal_break_manual`, and `vertical_break_manual`. `paper` reports point dimensions, orientation, and whether the stored paper code was known. Each `PageLayout` in `pages` gives `area_index`, inclusive cell bounds, origin, and scaled size. A missing declared print area leaves `print_area` empty while pagination falls back to the used range; the manual-break lists parallel their break lists.

`set_formula()` rejects malformed formula text with the `kParserUnexpectedToken` host status and leaves the previous formula and cached value unchanged. A malformed formula already stored in an XLSX or XLSB file remains loadable; after `recalc()` its cell value is `#NAME?`. The one-shot `eval_formula()` helper follows the ad-hoc path and returns `#NAME?` as a value for malformed input.

The authoritative Python method list lives in the package type stubs and docstrings.

`iter_cells(sheet)` enumerates written coordinates, including styled blanks, `set_blank` writes, and spill phantoms, in `(row, col)` order. Unwritten gaps are omitted. Do not mutate the sheet during iteration. Unlike `get_cells_in_range()`, this includes explicitly written blank cells; see [Inspect a range](/workbook/operations#inspect-a-range).

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
from formulon import Workbook, ValueKind, FormulonError

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
- [Presentation and geometry](/workbook/presentation) — display text, themes, styles, dimensions, and pagination.
- [Filters and validation](/workbook/filters-validation) — AutoFilter state and proposed-value checks.
- [Comments and images](/workbook/comments-images) — threaded comments, persons, drawing objects, and pictures.
- [Python batch recalculation](/scenarios/python-batch) — end-to-end pipeline.
