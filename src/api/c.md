# C API

The C11 ABI is the integration surface for a custom language binding or a native host. It is a flat API over an opaque `fm_workbook_t` handle; the shipped Python, CLI, and WASM surfaces use the same model. Public record layouts are part of the contract and must match the header used to build the client.

Include `formulon_c.h` from a source build and link the Formulon core library. The public header is the exhaustive reference; this page covers the ownership and lifetime rules that a binding must implement correctly.

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
| Save bytes | caller after a successful save | Release only with `fm_buffer_free()`, never `free()` or `delete[]`. |
| `fm_value_t.u.text` and text getters | workbook | Copy before another successful scratch-backed read, any mutation, or handle destruction. |
| Error message and context | current thread | Copy before the next API call on that thread. |
| `fm_cell_range_t *` | caller | Release with `fm_cell_range_destroy()`. Cell text and formulas in the snapshot remain valid until destruction. |
| `fm_pagination_t *` | caller | Release with `fm_pagination_destroy()`. All pagination getters read the owned result. |

Save calls reset their output pointer and length on failure, and `fm_buffer_free(NULL)` is safe. That makes the unconditional cleanup in the example valid.

`fm_sheet_cells_in_range()` returns an owned page snapshot through `fm_cell_range_t`. The page contains populated cells and spill phantoms in row-major order; `fm_cell_range_count()`, `fm_cell_range_at()`, and `fm_cell_range_next_cursor()` read it without touching workbook scratch storage. Later workbook mutations do not change the snapshot. Destroy every successful page with `fm_cell_range_destroy()` and pass its cursor to the next call.

## Errors and threads

Cell-level Excel errors such as `#DIV/0!` are values (`FM_VAL_ERROR`), not failed statuses. A non-zero `fm_status_t` reports a host-side failure such as invalid input, an invalid handle, or an I/O error. Read `fm_last_error_message()` and `fm_last_error_context()` before making another API call on the same thread; both views are thread-local and overwritten by that next call.

A workbook handle belongs to one external caller thread at a time. Do not concurrently read, mutate, or recalculate the same handle. `fm_workbook_recalc_parallel()` may create internal worker threads for one call, but it does not make independent calls on that handle safe. Separate handles can be driven concurrently.

## Workbook additions

The C ABI exposes the new binding-parity operations directly. `fm_workbook_get_iterative()` reads `enabled`, `max_iterations`, and `max_change`; `fm_workbook_set_iterative()` clamps the iteration cap to `32767` and the getter reports the clamped value. `fm_sheet_set_visibility()` accepts `FM_SHEET_VISIBLE`, `FM_SHEET_HIDDEN`, or `FM_SHEET_VERY_HIDDEN`, while `fm_sheet_get_view()` reports both the legacy `tab_hidden` flag and the authoritative three-state `visibility`.

Typed worksheet print setters cover page setup, margins, print options, header/footer, print area, print titles, and manual row/column breaks (`fm_sheet_set_page_setup`, `fm_sheet_set_page_margins`, `fm_sheet_set_print_options`, `fm_sheet_set_header_footer`, `fm_sheet_set_print_area`, `fm_sheet_set_print_titles`, `fm_sheet_add_row_break`, and `fm_sheet_add_col_break`). Raw XML setters validate well-formed, bounded fragments before storing them. `fm_sheet_set_range_xf_index()` applies one style XF index over an inclusive rectangle and materializes styled blank cells.

`fm_workbook_pivot_field_add_item_at()` addresses a manual-filter item by its cache shared-item index. It is the form that can express a blank pivot member; the label-based `fm_workbook_pivot_field_add_item()` cannot identify that member with an empty string.

External workbook references are metadata and cached-value inputs. The XLSX and XLSB readers accept both index-spelled references such as `[1]Sheet1!A1` and named/path-spelled references such as `[Book1.xlsx]Sheet1!A1`; the engine resolves the value already cached in the package and never opens the referenced workbook or performs network I/O. `fm_workbook_external_link_count()` and `fm_workbook_external_link_at()` expose the link records for a host-side compatibility check.

`fm_workbook_paginate()` returns an owned `fm_pagination_t` snapshot. In addition to page count, declared print-area rectangles, and horizontal / vertical break positions, the getters expose paper size and orientation, margins, printable rectangle, scale, page order, repeated print titles, each physical page layout, and whether each break was manual. A missing declared print area remains empty even when pagination falls back to the used range. Destroy the result with `fm_pagination_destroy()`.

The public records use fixed layouts. In the current header, `fm_cell_xf` is 128 bytes and `fm_row_layout_t` is 40 bytes. `fm_locale_facts_t` ends with the `collation_measured` field, which is part of the record layout and distinguishes measured text collation from other locale facts. The public `formulon_c.h` header is authoritative: rebuild C clients and regenerate any FFI layout whenever it changes; field order and padding are part of the ABI.

`fm_sheet_format_defaults` is a 48-byte public record with `default_col_width`, `default_row_height`, `base_col_width`, `has_default_col_width`, `has_default_row_height`, `effective_default_col_width`, and `effective_default_row_height`. Widths are character units and heights are points. `fm_sheet_get_format_defaults()` fills the effective fields using either the stored defaults or the built-in fallback (8.43 characters and `102/7` points); `fm_sheet_set_format_defaults()` ignores those two effective fields and rejects negative, NaN, or infinite stated values.

Function metadata is structural and locale-invariant. Use the profile-based helpers when a host needs Excel's display spelling:

```c
const char* localized = NULL;
const char* localized_name = "SUM";
const char* canonical = NULL;
const char* localized_formula = NULL;
const char* canonical_formula = NULL;
fm_locale_facts_t facts = {0};

fm_function_localize("SUM", "mac-365-de_DE", &localized);
fm_function_canonicalize(localized_name, "mac-365-de_DE", &canonical);
fm_formula_localize("=SUM(1.5,TRUE)", "mac-365-de_DE", &localized_formula);
fm_formula_canonicalize(localized_formula, "mac-365-de_DE", &canonical_formula);
fm_locale_facts("mac-365-de_DE", &facts);
```

Function-name and locale-fact strings are process-static views described in `formulon_c.h`; callers do not free them. Formula-text results point into a thread-local buffer and remain valid until the next formula-localization call on that thread, so copy them when retaining them. All five functions take a profile id, not a numeric locale code. `fm_locale_facts_t` reports separators, Boolean names, date order, currency, `measured`, and the separate `collation_measured` flag; only `mac-*` profiles have measured text collation.

`fm_text_compare()` compares two UTF-8 texts and writes an order sign (`-1`, `0`, or `1`) using `fm_collation_strength_t`: `FM_COLLATION_COMPARE`, `FM_COLLATION_DYNAMIC`, or `FM_COLLATION_CLASSIC_EXACT`. `fm_collation_classes()` writes one dense class id per `fm_value_t` and the class count. Within one call, equal ids require the same value kind; text uses the selected fold, numbers treat `-0` as `0`, and blanks share one class. Ids ascend in SORT order (numbers, text, booleans, errors, blanks) and are meaningful only for that call, so classify saved and current values together when matching a selection.

`fm_workbook_set_formula()` validates formula text before changing the cell. A malformed formula returns the `kParserUnexpectedToken` status and leaves the previous formula and cached state unchanged. A malformed formula already present in an XLSX or XLSB file is loaded as stored text; recalculation exposes `#NAME?` as a cell error rather than failing the workbook load.

Named styles use `fm_cell_style_record_t` with `name`, `xf_id`, `builtin_id`, `i_level`, `hidden`, and `custom_builtin`. Read them with `fm_styles_get_cell_style()` and write them with `fm_styles_set_cell_style()`. `xf_id` indexes the named-style `cellStyleXfs` table; `builtin_id` is `0..53` or `FM_CELL_STYLE_BUILTIN_ID_NONE` for a custom style. `i_level` is `0..6` for the built-in `RowLevel_n` / `ColLevel_n` styles and `0` otherwise. The returned `name` is workbook-owned; the setter copies its input.

`fm_sheet_set_column_style()` / `fm_sheet_clear_column_style()` and `fm_sheet_set_row_style()` / `fm_sheet_clear_row_style()` assign or remove cell-style XFs on axis spans while retaining width, height, hidden, and outline attributes. Index `0` is the default XF. `fm_cell_clear_xf_index()` removes the explicit cell assignment so a blank cell inherits row, column, or workbook defaults; setting the cell XF to `0` keeps an explicit Normal assignment and is different from clearing it. `fm_sheet_range_style_bases()` lists the XFs that some cell of a selection resolves to; build patched records and pass them to `fm_sheet_remap_range_style()` for an attribute-only change. `fm_sheet_snapshot_range_style()` and `fm_sheet_restore_range_style()` provide an opaque undo capture without changing values or formulas. See [Workbook operations](/workbook/operations) for the canonical selection rules.

`fm_workbook_theme_script_font_count()` and `fm_workbook_theme_script_font_at()` expose the major and minor theme font sets, including the 47 default Office script entries when no theme part exists. `fm_workbook_set_theme_script_font()` changes or appends one script. On theme readback, a `Jpan` entry supplies the corresponding East Asian face only when that font set's `<a:ea typeface>` is empty; an explicit `<a:ea typeface>` takes precedence. A missing theme part receives the full default set first. The script must be four ASCII letters and the typeface must be non-empty.

The same header groups range snapshots, display text (`fm_workbook_get_display_text`, `fm_workbook_format_value`), geometry, AutoFilter and validation operations, threaded comments and persons, and image / drawing operations. Their pointer lifetimes are stated beside each declaration; copy scratch-backed strings before another successful read or mutation.

## Where to go next

- [Workbook operations](/workbook/operations) — coordinate model, edits, layout, and metadata.
- [Presentation and geometry](/workbook/presentation) — display text, themes, styles, dimensions, and pagination.
- [Filters and validation](/workbook/filters-validation) — AutoFilter state and proposed-value checks.
- [Comments and images](/workbook/comments-images) — threaded comments, persons, drawing objects, and pictures.
- [Recalculation](/workbook/recalculation) — dirty cells, iterative calculation, and clock-dependent functions.
- [File formats](/workbook/file-formats) — XLSX/XLSB choice and preservation boundaries.
- [Build from source](/development/build-from-source) — build the native library and tools.
