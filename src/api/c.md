# C API

The stable C11 ABI is the integration surface for a custom language binding or a native host. It is a flat API over an opaque `fm_workbook_t` handle; the shipped Python, CLI, and WASM surfaces use the same model.

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

## Ownership and views

| Value | Owner | Rule |
| --- | --- | --- |
| `fm_workbook_t *` | caller | Release with `fm_workbook_destroy()`. `NULL` is allowed. |
| Save bytes | caller after a successful save | Release only with `fm_buffer_free()`, never `free()` or `delete[]`. |
| `fm_value_t.u.text` and text getters | workbook | Copy before another successful scratch-backed read, any mutation, or handle destruction. |
| Error message and context | current thread | Copy before the next API call on that thread. |

Save calls reset their output pointer and length on failure, and `fm_buffer_free(NULL)` is safe. That makes the unconditional cleanup in the example valid.

## Errors and threads

Cell-level Excel errors such as `#DIV/0!` are values (`FM_VAL_ERROR`), not failed statuses. A non-zero `fm_status_t` reports a host-side failure such as invalid input, an invalid handle, or an I/O error. Read `fm_last_error_message()` and `fm_last_error_context()` before making another API call on the same thread; both views are thread-local and overwritten by that next call.

A workbook handle belongs to one external caller thread at a time. Do not concurrently read, mutate, or recalculate the same handle. `fm_workbook_recalc_parallel()` may create internal worker threads for one call, but it does not make independent calls on that handle safe. Separate handles can be driven concurrently.

## Workbook additions

The C ABI exposes the new binding-parity operations directly. `fm_workbook_get_iterative()` reads `enabled`, `max_iterations`, and `max_change`; `fm_workbook_set_iterative()` clamps the iteration cap to `32767` and the getter reports the clamped value. `fm_sheet_set_visibility()` accepts `FM_SHEET_VISIBLE`, `FM_SHEET_HIDDEN`, or `FM_SHEET_VERY_HIDDEN`, while `fm_sheet_get_view()` reports both the legacy `tab_hidden` flag and the authoritative three-state `visibility`.

Typed worksheet print setters cover page setup, margins, print options, header/footer, print area, print titles, and manual row/column breaks (`fm_sheet_set_page_setup`, `fm_sheet_set_page_margins`, `fm_sheet_set_print_options`, `fm_sheet_set_header_footer`, `fm_sheet_set_print_area`, `fm_sheet_set_print_titles`, `fm_sheet_add_row_break`, and `fm_sheet_add_col_break`). Raw XML setters validate well-formed, bounded fragments before storing them. `fm_sheet_set_range_xf_index()` applies one style XF index over an inclusive rectangle and materializes styled blank cells.

`fm_workbook_pivot_field_add_item_at()` addresses a manual-filter item by its cache shared-item index. It is the form that can express a blank pivot member; the label-based `fm_workbook_pivot_field_add_item()` cannot identify that member with an empty string. The external-link reader resolves index-spelled references such as `[1]Sheet1!A1` from cached link values; path-spelled `[Book1.xlsx]Sheet1!A1` references remain unsupported.

## Where to go next

- [Workbook operations](/workbook/operations) — coordinate model, edits, layout, and metadata.
- [Recalculation](/workbook/recalculation) — dirty cells, iterative calculation, and clock-dependent functions.
- [File formats](/workbook/file-formats) — XLSX/XLSB choice and preservation boundaries.
- [Build from source](/development/build-from-source) — build the native library and tools.
