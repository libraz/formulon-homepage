# C API

The C11 ABI is the integration surface for a custom language binding or a native host. It is a flat API over an opaque `fm_workbook_t` handle; the shipped Python, CLI, and WASM surfaces use the same model. Public record layouts are part of the contract and must match the header used to build the client.

The ABI is not shipped as a prebuilt package. Build from source ([Build from source](/development/build-from-source)), include `src/c_api/formulon_c.h`, and link the `formulon_static` archive, or the shared `formulon` library that `-DFM_BUILD_C_API_SHARED=ON` adds. The header is the exhaustive reference; this page covers the ownership and lifetime rules a binding must implement correctly, plus a map of the function families.

## Minimal workbook round trip

All workbook coordinates are zero-based: `(0, 0, 0)` is `Sheet1!A1`. Check the `fm_status_t` returned by every fallible call. A status of `0` means success.

```c
#include "formulon_c.h"
#include <stdint.h>
#include <stdio.h>

static void report_failure(const char *operation, fm_status_t status) {
  fprintf(stderr, "%s: %s: %s\n", operation, fm_status_string(status),
          fm_last_error_message());
}

int main(void) {
  fm_workbook_t *wb = NULL;
  uint8_t *bytes = NULL;
  size_t len = 0;
  fm_value_t value;

  fm_status_t status = fm_workbook_create(&wb);
  if (status != 0) { report_failure("create", status); return 1; }

  status = fm_workbook_set_formula(wb, 0, 0, 0, "=SUM(1,2,3)");
  if (status == 0) status = fm_workbook_recalc(wb);
  if (status == 0) status = fm_workbook_get_value(wb, 0, 0, 0, &value);
  if (status == 0 && value.kind == FM_VAL_NUMBER) printf("%.0f\n", value.u.number);
  if (status == 0) status = fm_workbook_save(wb, &bytes, &len);
  if (status != 0) report_failure("workbook operation", status);

  /* Write `bytes[0..len]` wherever the host stores the .xlsx file. */
  fm_buffer_free(bytes);
  fm_workbook_destroy(wb);
  return status == 0 ? 0 : 1;
}
```

To begin from an existing `.xlsx` or `.xlsb`, call `fm_workbook_load(input_bytes, input_len, &wb)` in place of `fm_workbook_create()`. The reader detects the container from its bytes.

`fm_workbook_create_for_profile(profile_id, &wb)` creates one sheet with the selected Excel profile's new-workbook defaults. It records the profile and seeds the locale-specific body and optional phonetic fonts, `Normal` style and first-sheet names, cell-xf alignment, phonetic settings, page margins, and measured Mac row and column defaults. `fm_workbook_create()` remains the ordinary Calibri 11 workbook; the profile factory writes no theme part, so Excel's default Office theme is used.

## Ownership and views

| Value | Owner | Rule |
| --- | --- | --- |
| `fm_workbook_t *` | caller | Release with `fm_workbook_destroy()`. `NULL` is allowed. |
| Byte buffers from `fm_workbook_save`, `fm_workbook_save_as`, `fm_workbook_save_with_diagnostics`, `fm_sheet_snapshot_range_style`, `fm_sheet_snapshot_image` | caller after success | Release only with `fm_buffer_free()`, never `free()` or `delete[]`. |
| `fm_value_t.u.text` and text getters | workbook | Copy before another successful scratch-backed read, any mutation, or handle destruction. |
| Error message and context | current thread | Copy before the next API call on that thread. |
| Formula text from `fm_formula_localize` / `fm_formula_canonicalize` | current thread | Valid until the next call to either function on that thread. |
| `fm_version_string()`, `fm_status_string()`, `fm_error_display_name()`, function names, locale facts | process | Static; never free. |
| `fm_cell_range_t *` | caller | Release with `fm_cell_range_destroy()`. Cell text and formulas in the snapshot remain valid until destruction. |
| `fm_pagination_t *` | caller | Release with `fm_pagination_destroy()`. All pagination getters read the owned result. |
| `fm_cf_results_t *` from `fm_workbook_cf_evaluate_range` | caller | Release with `fm_cf_results_destroy()`. |
| `fm_cell_nodes_t *` from `fm_workbook_precedents` / `fm_workbook_dependents` | caller | Release with `fm_cell_nodes_destroy()`. |
| `fm_pivot_cells_t *` from `fm_workbook_pivot_layout` | caller | Release with `fm_pivot_cells_destroy()`. |

Every call that returns an owned handle or buffer sets the output to `NULL` (and the length to `0`) before validation and leaves it there on failure, and `fm_buffer_free(NULL)` is safe. That makes the unconditional cleanup in the example valid.

`fm_sheet_cells_in_range()` returns an owned page snapshot through `fm_cell_range_t`. The page contains populated cells and spill phantoms in row-major order; `fm_cell_range_count()`, `fm_cell_range_at()`, and `fm_cell_range_next_cursor()` read it without touching workbook scratch storage. Later workbook mutations do not change the snapshot. Destroy every successful page with `fm_cell_range_destroy()` and pass its cursor to the next call.

## Errors and threads

Cell-level Excel errors such as `#DIV/0!` are values (`FM_VAL_ERROR`), not failed statuses. A non-zero `fm_status_t` reports a host-side failure such as invalid input, an invalid handle, or an I/O error. Read `fm_last_error_message()` and `fm_last_error_context()` before making another API call on the same thread; both views are thread-local and overwritten by that next call.

A workbook handle belongs to one external caller thread at a time. Do not concurrently read, mutate, or recalculate the same handle. `fm_workbook_recalc_parallel()` may create internal worker threads for one call, but it does not make independent calls on that handle safe. Separate handles can be driven concurrently.

## Selected contracts

`fm_workbook_get_iterative()` reads `enabled`, `max_iterations`, and `max_change`; `fm_workbook_set_iterative()` clamps the iteration cap to `32767` and the getter reports the clamped value. `fm_sheet_set_visibility()` accepts `FM_SHEET_VISIBLE`, `FM_SHEET_HIDDEN`, or `FM_SHEET_VERY_HIDDEN`, while `fm_sheet_get_view()` reports both the legacy `tab_hidden` flag and the authoritative three-state `visibility`.

Typed worksheet print setters cover page setup, margins, print options, header/footer, print area, print titles, and manual row/column breaks (`fm_sheet_set_page_setup`, `fm_sheet_set_page_margins`, `fm_sheet_set_print_options`, `fm_sheet_set_header_footer`, `fm_sheet_set_print_area`, `fm_sheet_set_print_titles`, `fm_sheet_add_row_break`, and `fm_sheet_add_col_break`). Raw XML setters validate well-formed, bounded fragments before storing them. `fm_sheet_set_range_xf_index()` applies one style XF index over an inclusive rectangle and materializes styled blank cells.

`fm_workbook_pivot_field_add_item_at()` addresses a manual-filter item by its cache shared-item index. It is the form that can express a blank pivot member; the label-based `fm_workbook_pivot_field_add_item()` cannot identify that member with an empty string.

External workbook references are metadata and cached-value inputs. The XLSX and XLSB readers accept both index-spelled references such as `[1]Sheet1!A1` and named/path-spelled references such as `[Book1.xlsx]Sheet1!A1`; the engine resolves the value already cached in the package and never opens the referenced workbook or performs network I/O. `fm_workbook_external_link_count()` and `fm_workbook_external_link_at()` expose the link records for a host-side compatibility check.

`fm_workbook_paginate()` returns an owned `fm_pagination_t` snapshot. In addition to page count, declared print-area rectangles, and horizontal / vertical break positions, the getters expose paper size and orientation, margins, printable rectangle, scale, page order, repeated print titles, each physical page layout, and whether each break was manual. A missing declared print area remains empty even when pagination falls back to the used range. Destroy the result with `fm_pagination_destroy()`.

The public records use fixed layouts. In the current header, `fm_cell_xf` is 128 bytes and `fm_row_layout_t` is 40 bytes. `fm_locale_facts_t` ends with the `collation_measured` field, which is part of the record layout and distinguishes measured text collation from other locale facts. The public `formulon_c.h` header is authoritative: rebuild C clients and regenerate any FFI layout whenever it changes; field order and padding are part of the ABI.

`fm_sheet_format_defaults` is a 48-byte public record with `default_col_width`, `default_row_height`, `base_col_width`, `has_default_col_width`, `has_default_row_height`, `effective_default_col_width`, and `effective_default_row_height`. Widths are character units and heights are points. `fm_sheet_get_format_defaults()` fills the effective fields using either the stored defaults or the built-in fallback (8.43 characters and `102/7` points); `fm_sheet_set_format_defaults()` ignores those two effective fields and rejects negative, NaN, or infinite stated values.

Function metadata is structural and locale-invariant. Use the profile-based helpers when a host needs Excel's display spelling:

```c
/* Status checks omitted. */
const char* localized = NULL;
const char* canonical = NULL;
const char* shown = NULL;
const char* stored = NULL;
char shown_copy[256];
fm_locale_facts_t facts = {0};

fm_function_localize("SUM", "mac-365-de_DE", &localized);        /* "SUMME" */
fm_function_canonicalize(localized, "mac-365-de_DE", &canonical); /* "SUM" */
fm_formula_localize("=SUM(1.5,TRUE)", "mac-365-de_DE", &shown);
/* The next call reuses the thread-local buffer `shown` points into. */
snprintf(shown_copy, sizeof shown_copy, "%s", shown);
fm_formula_canonicalize(shown_copy, "mac-365-de_DE", &stored);
fm_locale_facts("mac-365-de_DE", &facts);
```

All five functions take a profile id, not a numeric locale code. `fm_locale_facts_t` reports separators, Boolean names, date order, currency, `measured`, and the separate `collation_measured` flag; only `mac-*` profiles have measured text collation.

`fm_text_compare(a, b, profile_id, strength, &order)` writes `-1`, `0`, or `1` for two UTF-8 texts under `FM_COLLATION_COMPARE`, `FM_COLLATION_DYNAMIC`, or `FM_COLLATION_CLASSIC_EXACT`. `fm_collation_classes(values, count, profile_id, strength, class_ids, &class_count)` writes one dense class id per `fm_value_t`, ascending in SORT order and meaningful only within that call. The profile id comes before the strength here, unlike the JavaScript and Python argument order. [Text collation](/compatibility/text-collation) defines the folds and class rules.

`fm_workbook_set_formula()` validates formula text before changing the cell. A malformed formula returns the `kParserUnexpectedToken` status and leaves the previous formula and cached state unchanged. A malformed formula already present in an XLSX or XLSB file is loaded as stored text; recalculation exposes `#NAME?` as a cell error rather than failing the workbook load.

Named styles use `fm_cell_style_record_t` with `name`, `xf_id`, `builtin_id`, `i_level`, `hidden`, and `custom_builtin`. Read them with `fm_styles_get_cell_style()` and write them with `fm_styles_set_cell_style()`. `xf_id` indexes the named-style `cellStyleXfs` table; `builtin_id` is `0..53` or `FM_CELL_STYLE_BUILTIN_ID_NONE` for a custom style. `i_level` is `0..6` for the built-in `RowLevel_n` / `ColLevel_n` styles and `0` otherwise. The returned `name` is workbook-owned; the setter copies its input.

Row and column styles (`fm_sheet_set_column_style()`, `fm_sheet_set_row_style()` and their `clear` counterparts), `fm_cell_clear_xf_index()`, and the `fm_sheet_range_style_bases()` → `fm_sheet_remap_range_style()` edit with its `fm_sheet_snapshot_range_style()` / `fm_sheet_restore_range_style()` undo capture follow the rules in [Workbook operations](/workbook/operations). The snapshot is an opaque byte buffer released with `fm_buffer_free()`. Theme script fonts (`fm_workbook_theme_script_font_count()` / `_at()`, `fm_workbook_set_theme_script_font()`) follow [Presentation and geometry](/workbook/presentation).

## Function families

Every declaration in `formulon_c.h` states its pointer lifetime beside it. The tables below are generated from every `FM_API` declaration in `src/c_api/formulon_c.h`. A summary is the first sentence of the declaration's Doxygen comment; declarations grouped under one comment share its summary.

### Library, diagnostics and logging {#library}

<ApiReferenceTable surface="c" family="library" />

### Workbook lifecycle and I/O {#lifecycle}

<ApiReferenceTable surface="c" family="lifecycle" />

### Sheets and structure {#sheets}

<ApiReferenceTable surface="c" family="sheets" />

### Cells {#cells}

<ApiReferenceTable surface="c" family="cells" />

### Recalculation {#calculation}

<ApiReferenceTable surface="c" family="calculation" />

### Read-only evaluation {#evaluation}

<ApiReferenceTable surface="c" family="evaluation" />

### Profiles, locale and text {#profiles}

<ApiReferenceTable surface="c" family="profiles" />

### Defined names {#names}

<ApiReferenceTable surface="c" family="names" />

### Tables {#tables}

<ApiReferenceTable surface="c" family="tables" />

### Dependencies, spills and external links {#dependencies}

<ApiReferenceTable surface="c" family="dependencies" />

### Sheet view and protection {#view}

<ApiReferenceTable surface="c" family="view" />

### Rows, columns and geometry {#rows-columns}

<ApiReferenceTable surface="c" family="rows-columns" />

### Display text {#display}

<ApiReferenceTable surface="c" family="display" />

### Styles {#styles}

<ApiReferenceTable surface="c" family="styles" />

### Themes and colors {#themes}

<ApiReferenceTable surface="c" family="themes" />

### Merges {#merges}

<ApiReferenceTable surface="c" family="merges" />

### Comments and hyperlinks {#comments-links}

<ApiReferenceTable surface="c" family="comments-links" />

### Threaded comments and persons {#threaded-comments}

<ApiReferenceTable surface="c" family="threaded-comments" />

### AutoFilter {#filters}

<ApiReferenceTable surface="c" family="filters" />

### Data validation {#validation}

<ApiReferenceTable surface="c" family="validation" />

### Conditional formats {#conditional-formats}

<ApiReferenceTable surface="c" family="conditional-formats" />

### Images and drawings {#images}

<ApiReferenceTable surface="c" family="images" />

### Print settings and pagination {#print}

<ApiReferenceTable surface="c" family="print" />

### PivotTables {#pivots}

<ApiReferenceTable surface="c" family="pivots" />

### Pivot caches {#pivot-caches}

<ApiReferenceTable surface="c" family="pivot-caches" />

## Where to go next

- [Workbook operations](/workbook/operations) — coordinate model, edits, layout, and metadata.
- [Presentation and geometry](/workbook/presentation) — display text, themes, styles, dimensions, and pagination.
- [Filters and validation](/workbook/filters-validation) — AutoFilter state and proposed-value checks.
- [Comments and images](/workbook/comments-images) — threaded comments, persons, drawing objects, and pictures.
- [Recalculation](/workbook/recalculation) — dirty cells, iterative calculation, and clock-dependent functions.
- [File formats](/workbook/file-formats) — XLSX/XLSB choice and preservation boundaries.
- [Build from source](/development/build-from-source) — build the native library and tools.
