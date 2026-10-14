# Python API

The Python package exposes a Pythonic wrapper over the Formulon C ABI compiled to `formulon_capi.wasm`. The published wheel is `py3-none-any`; `pip` installs `wasmtime` as the platform runtime.

::: info Glossary: py3-none-any wheel
A Python wheel with no Python ABI tag, no platform tag, and no native code. It supports CPython 3.9 and later where a compatible `wasmtime` wheel is available. The platform-specific runtime is supplied by `wasmtime`, not by `formulon`.
:::

## Top-level API

The module functions (`formulon.eval_formula`, `formulon.error_display_name`, `formulon.merge_function_metadata`, `formulon.library_version`, its alias `formulon.version_string`, and `formulon.set_log_min_level`) are listed with the workbook methods under [Functions and methods](#functions-and-methods). `formulon.__version__` is the installed package version. `set_log_min_level()` is process-wide: the default `LogLevel.OFF` is silent, `WARN` or below writes one JSON record per line to stderr, and Python has no log-sink callback. The main types are `Workbook`, the `Value` record with its `ValueKind` enum, and `FormulonError` for host-side failures.

The package also exports the binding enums and the dataclass records used by workbook methods (`Cell`, `Comment`, `ConditionalFormat`, `DataValidation`, `PaginationResult`, `PivotLayout`, `Theme`, and others; `formulon.__all__` lists them):

| Area | Enums |
| --- | --- |
| Values | `ErrorCode` (`NULL = 0`, `DIV0 = 1`, … `UNKNOWN = 16`) |
| Geometry and display | `GeometryMode` (`DISPLAY = 0`, `PRINT = 1`), `DisplayStatus` (`OK = 0`, `OVERFLOW = 1`, `INVALID_FORMAT = 2`) |
| AutoFilter | `FilterKind`, `FilterOperator`, `DynamicFilterType`, `SortBy`, `SortMethod`, `DateTimeGrouping` |
| Validation | `ValidationErrorStyle` (`STOP = 0`, `WARNING = 1`, `INFORMATION = 2`) |
| Themes and styles | `ColorContext`, `ColorResolution`, `ThemeSource`, `EffectiveStyleSource` |
| Images and drawings | `ImageFormat`, `DrawingObjectKind`, `AnchorKind`, `AnchorEditAs` |
| PivotTables | `PivotAxis`, `PivotAggregation`, `PivotShowValuesAs`, `PivotFilterType`, `PivotFilterValueKind`, `PivotDateGrouping`, `PivotCalendar`, `PivotReportLayout`, `PivotCellKind` |
| Text collation | `CollationStrength` (`COMPARE = 0`, `DYNAMIC = 1`, `CLASSIC_EXACT = 2`) |
| Workbook state | `CalcMode`, `SheetVisibility`, `WorkbookFormat`, `ExternalLinkKind` |
| Logging | `LogLevel` (`DEBUG = 0`, `INFO = 1`, `WARN = 2`, `ERROR = 3`, `OFF = 4`) |

The function catalog is split by responsibility. `Workbook.function_metadata(name)` returns structural fields only (canonical name, arity, availability); the human-readable signature and description are `None`. Use the profile-based helpers for Excel display names and formula text, and use `merge_function_metadata()` with a host-owned BCP-47 UI locale for translated descriptions.

## Workbook

```python
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_formula(0, 0, 0, "=SUM(1,2,3)")
    wb.recalc()
    print(wb.get_value(0, 0, 0).to_python())
```

`create_default()` builds the ordinary one-sheet workbook with Calibri 11. `create_for_profile(profile_id)` records the selected profile and applies its new-workbook defaults: body and optional phonetic fonts, the localized `Normal` style and first-sheet names, cell-xf alignment, phonetic settings, page margins, and the Mac row-height and base-column-width values. It writes no theme part, so a fresh workbook reads as using the default Office theme; Windows row and column metrics use the engine defaults.

Profile and formula-text helpers are workbook-independent static methods:

```python
from formulon import Workbook

profile = "mac-365-de_DE"
shown = Workbook.localize_formula("=SUM(1.5,TRUE)", profile)
stored = Workbook.canonicalize_formula(shown, profile)
facts = Workbook.locale_facts(profile)
print(shown, stored, facts.decimal_separator, facts.true_name)
```

`localize_function_name()` / `canonicalize_function_name()` map one function name. `localize_formula()` rewrites function names, list and array separators, decimal points, Boolean names, and error names while preserving strings, quoted sheet names, external qualifiers, and structured-reference brackets. `canonicalize_formula()` reverses that text rewrite. These helpers use the full profile id, not a numeric locale code, and they do not validate or install a formula. The profile catalog has 28 ids; locale facts are measured for every `mac-*` profile and `win-365-ja_JP`, while the other 13 Windows profiles use estimated locale data. `LocaleFacts.collation_measured` is separate and is true only for `mac-*` profiles.

`Workbook.compare_text(a, b, strength, profile_id)` returns `-1`, `0`, or `1`. `Workbook.collation_classes(values, strength, profile_id)` returns `CollationClasses(class_ids, class_count)`: one dense id per `Value`, ascending in SORT order and meaningful only within that call. [Text collation](/compatibility/text-collation) defines each `CollationStrength` fold and the class rules.

```python
from formulon import CollationStrength, Value, ValueKind, Workbook

profile = "mac-365-en_US"
order = Workbook.compare_text("a", "b", CollationStrength.COMPARE, profile)
values = [Value(kind=ValueKind.TEXT, text="A"), Value(kind=ValueKind.TEXT, text="a")]
classes = Workbook.collation_classes(values, CollationStrength.DYNAMIC, profile)
print(order, classes.class_ids, classes.class_count)
```

## Functions and methods

Generated from the package type stubs (`formulon/__init__.pyi`) and the docstrings of the formulon source tree. Names starting with `formulon.` are module functions, names starting with `Workbook.` are class or static methods, and every other name is a `Workbook` instance method; `is_valid` is a property. `= ...` marks a parameter with a default, as in the stubs. A summary is the first sentence of the docstring. `Workbook` is also a context manager: leaving the `with` block calls `close()`.

### Library, diagnostics and logging {#library}

<ApiReferenceTable surface="python" family="library" />

### Workbook lifecycle and I/O {#lifecycle}

<ApiReferenceTable surface="python" family="lifecycle" />

### Sheets and structure {#sheets}

<ApiReferenceTable surface="python" family="sheets" />

### Cells {#cells}

<ApiReferenceTable surface="python" family="cells" />

### Recalculation {#calculation}

<ApiReferenceTable surface="python" family="calculation" />

### Read-only evaluation {#evaluation}

<ApiReferenceTable surface="python" family="evaluation" />

### Profiles, locale and text {#profiles}

<ApiReferenceTable surface="python" family="profiles" />

### Defined names {#names}

<ApiReferenceTable surface="python" family="names" />

### Tables {#tables}

<ApiReferenceTable surface="python" family="tables" />

### Dependencies, spills and external links {#dependencies}

<ApiReferenceTable surface="python" family="dependencies" />

### Sheet view and protection {#view}

<ApiReferenceTable surface="python" family="view" />

### Rows, columns and geometry {#rows-columns}

<ApiReferenceTable surface="python" family="rows-columns" />

### Display text {#display}

<ApiReferenceTable surface="python" family="display" />

### Styles {#styles}

<ApiReferenceTable surface="python" family="styles" />

### Themes and colors {#themes}

<ApiReferenceTable surface="python" family="themes" />

### Merges {#merges}

<ApiReferenceTable surface="python" family="merges" />

### Comments and hyperlinks {#comments-links}

<ApiReferenceTable surface="python" family="comments-links" />

### Threaded comments and persons {#threaded-comments}

<ApiReferenceTable surface="python" family="threaded-comments" />

### AutoFilter {#filters}

<ApiReferenceTable surface="python" family="filters" />

### Data validation {#validation}

<ApiReferenceTable surface="python" family="validation" />

### Conditional formats {#conditional-formats}

<ApiReferenceTable surface="python" family="conditional-formats" />

### Images and drawings {#images}

<ApiReferenceTable surface="python" family="images" />

### Charts {#charts}

<ApiReferenceTable surface="python" family="charts" />

### Print settings and pagination {#print}

<ApiReferenceTable surface="python" family="print" />

### PivotTables {#pivots}

<ApiReferenceTable surface="python" family="pivots" />

### Pivot caches {#pivot-caches}

<ApiReferenceTable surface="python" family="pivot-caches" />

## Method notes

`CellStyle` is the named-style record used by `set_cell_style()` and `get_cell_style()`. Its fields are `name`, `xf_id`, `builtin_id`, `i_level`, `hidden`, and `custom_builtin`; `name` and `xf_id` are required, while the other fields use their dataclass defaults. Leave `builtin_id` at its default for a custom style. The `xf_id` points into the named-style XF table, not the per-cell XF table.

Row and column styles, `clear_cell_xf_index()` versus `set_cell_xf_index(..., 0)`, and the `range_style_bases()` → `remap_range_style()` edit with its `snapshot_range_style()` / `restore_range_style()` undo capture follow [Workbook operations](/workbook/operations). `get_theme()` returns `major_scripts` and `minor_scripts`; the script-font rules are in [Presentation and geometry](/workbook/presentation).

Python has no scalar `evaluate_formula_text()`. `evaluate_formula_array(sheet, row, col, formula)` returns the whole result read-only, and `evaluate_cf_formula(sheet, row, col, anchor_row, anchor_col, formula)` evaluates a conditional-format predicate.

`get_iterative()` returns `IterativeSettings(enabled, max_iterations, max_change)`; the engine caps `max_iterations` at `32767` and reports the capped value. `set_iterative_enabled(enabled)` toggles iterative calculation while keeping the stored cap and threshold, and `add_batch()` registers fonts, fills, borders, number formats, and XFs in one call.

`set_sheet_visibility()` accepts `SheetVisibility.VISIBLE`, `HIDDEN`, or `VERY_HIDDEN`, and `get_sheet_view()` returns the resolved three-state value in addition to `tab_hidden`. `set_range_xf_index()` applies one style XF index over an inclusive rectangle and materializes missing cells as styled blanks.

`table_create()` needs `column_names` matching the width of `ref`; the caller still writes the header cells. `table_update()` keeps fields passed as `None`, and an existing table AutoFilter keeps its criteria and extensions when its range is retargeted. `get_auto_filter_xml()` / `set_auto_filter_xml()` read and write the worksheet AutoFilter as a complete opaque `<autoFilter>` fragment; an empty string removes it. Row and column inserts and deletes move an AutoFilter's `ref` and its modeled criteria and sort offsets with the cells; worksheet XML that stays opaque is preserved byte-for-byte.

`add_hyperlink_range()` adds one hyperlink over an inclusive rectangle; read-back `Hyperlink` values include `last_row` and `last_col`. A `DataValidationInput` with omitted `allow_blank` defaults to `False`; pass `allow_blank=True` to accept empty cells.

Conditional formats carry visual payloads as `ColorScale`, `DataBar`, and `IconSet`. `DataBar` exposes the `x14` controls `gradient`, `axis_position` (`0` automatic, `1` middle, `2` none), `negative_fill`, `border`, `negative_border`, `axis_color`, and `direction` (`0` context, `1` left-to-right, `2` right-to-left); omitted values use the model defaults and survive save and load.

A newly created pivot cache must get a worksheet source before the workbook is saved, for example `set_pivot_cache_worksheet_source(cache_id, PivotWorksheetSource(ref="A1:C10", sheet="Data"))`; saving a new cache without one fails. Loaded caches keep their source metadata, which may describe a non-worksheet or external source. `pivot_field_add_item_at()` addresses a manual-filter item by cache shared-item index, which is the only way to name the blank member; an empty label passed to `pivot_field_add_item()` cannot.

`get_cells_in_range(sheet, cell_range, cursor=None, limit=None)` returns `(cells, next_cursor)` in row-major order. Each `Cell` has `row`, `col`, `formula`, and `value`. Pass `next_cursor` into the next call until it is `None`; an omitted or zero `limit` uses the 65,536-cell maximum. Formula cells, non-blank values, and spill phantoms are included, while styled blanks are not. `list_invalid_cells()` follows the same paging contract.

Geometry methods accept `GeometryMode.DISPLAY` for the 96-DPI screen model or `GeometryMode.PRINT` for the DPI-stable pagination model. `get_display_text()` and `format_value()` return `DisplayStatus.OVERFLOW` with `########` when a value is outside the format's representable range, and `DisplayStatus.INVALID_FORMAT` when the format code is malformed; malformed formats fall back to General rendering.

`probe_image()` reads PNG, JPEG, GIF, or BMP dimensions without changing the workbook. `list_drawing_objects()` returns anchored objects in document order; `get_image()` copies picture bytes, `insert_image()` preserves existing drawing content, and `remove_drawing()` removes a picture or chart and releases its media when no other object references it. Threaded-comment methods include replies and person records; removing a person fails while a comment or mention still refers to that person.

AutoFilter criteria are stored separately from row visibility. Use `evaluate_auto_filter()` to inspect matches and `apply_auto_filter()` to update hidden rows; `clear_auto_filter()` removes criteria while retaining the AutoFilter range. Validation methods check proposed values without storing them, and `list_invalid_cells()` enumerates existing violations.

`paginate(sheet)` returns `PaginationResult` with `page_count`, `print_area`, `horizontal_breaks`, `vertical_breaks`, `paper`, `margins`, `printable`, `scale`, `page_order`, `print_titles`, `pages`, `horizontal_break_manual`, and `vertical_break_manual`. `paper` reports point dimensions, orientation, and whether the stored paper code was known. Each `PageLayout` in `pages` gives `area_index`, inclusive cell bounds, origin, and scaled size. A missing declared print area leaves `print_area` empty while pagination falls back to the used range; the manual-break lists parallel their break lists.

`set_formula()` rejects malformed formula text with the `kParserUnexpectedToken` host status and leaves the previous formula and cached value unchanged. A malformed formula already stored in an XLSX or XLSB file remains loadable; after `recalc()` its cell value is `#NAME?`. The one-shot `eval_formula()` helper follows the ad-hoc path and returns `#NAME?` as a value for malformed input.

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

`FormulonError` is a host-side failure: invalid bytes, an out-of-range index, malformed text passed to `set_formula()`, use after `close()`, or an internal engine failure. It carries `status` (the numeric `fm_status_t`), `status_name` (for example `kParserUnexpectedToken`), `message`, and `context`. An integer argument that does not fit the C ABI's integer width, such as a negative sheet index, raises `ValueError` before the engine is called. Excel cell errors are values, not exceptions:

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
