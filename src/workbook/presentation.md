# Presentation, geometry, and pagination

Formulon exposes the workbook state that a renderer needs. It does not draw cells or pages. Coordinates are zero-based; physical geometry is returned in points.

## Display state

`getDisplayText(sheet, row, col)` renders one stored value with its effective number format. Its `displayStatus` is `DisplayStatus.Ok`, `Overflow`, or `InvalidFormat`; an overflow is reported as `########` by the renderer contract. `formatValue(value, formatCode)` applies a supplied format without reading a cell. Both calls return a status-bearing result.

`getSheetView(sheet)` reads zoom, frozen row and column counts, tab visibility, gridlines, row and column headers, zero display, right-to-left mode, tab selection, and view mode. The matching setters include `setSheetFreeze`, `setSheetVisibility`, `setSheetShowGridLines`, and `setSheetViewMode`. Sheet protection is metadata; the calculation engine does not enforce locks.

## Geometry

`getCellRectPt` covers an inclusive `MergeRange` from the top-left of A1. `getColumnWidthPt` and `getRowHeightPt` return effective dimensions; hidden rows and columns contribute zero. `GeometryMode.Display` uses the screen width model, while `GeometryMode.Print` uses the DPI-stable model used by pagination. `getWidthModel` reports the Normal-font calibration and the character-to-point conversion. `columnCharsToPt` and `columnPtToChars` convert the two units.

Sheet defaults come from `getSheetFormatDefaults`; per-column and per-row overrides come from `getSheetColumns` and `getSheetRowOverrides`. Use `setSheetFormatDefaults`, `setColumnWidth`, `clearColumnWidth`, `setRowHeight`, and `clearRowHeight` to edit them. `clearColumnWidth` removes only the explicit width for an inclusive span and keeps hidden and outline metadata; the columns then follow the sheet's current effective default, including after that default changes. Display text remains independent of column width: narrow columns never become `####`, and repeated fills do not add width.

## Theme and effective styles

`getTheme` returns the 12 theme colours, major and minor typefaces, and a `ThemeSource` telling whether the theme part, the default theme, or an unparseable theme supplied them. When no theme part is present, the current Office defaults resolve accent 1 to `#156082`, major Latin to `Aptos Display`, minor Latin to `Aptos Narrow`, major East Asian to `游ゴシック Light`, and minor East Asian to `游ゴシック`. `setThemeColors` and `setThemeFonts` update the workbook theme; `resetTheme` removes the custom theme part and its relationships so the source falls back to the default on the next read. Excel may add its own theme part when it saves the workbook. `resolveColor(spec, context)` resolves RGB, theme, indexed, and automatic colours to ARGB; `ColorContext` determines what automatic means for a font, fill, or border.

`getTheme()` also returns `majorScripts` and `minorScripts` (`major_scripts` and `minor_scripts` in Python), the per-script fallback faces. When the theme part is absent, each list contains the Office default's 47 scripts. `setThemeScriptFont(major, script, typeface)` / `set_theme_script_font()` changes one entry while preserving the others; an unknown four-letter script is appended. The reported East Asian face falls back to `Jpan` only when the theme has no explicit East Asian typeface; an explicit face keeps precedence. The first call on a workbook without a theme creates one with the full default set. The script must contain four ASCII letters and the typeface must be non-empty.

`getEffectiveStyle(sheet, row, col)` resolves the cell, row, column, or default style and reports `EffectiveStyleSource`, font/fill/border indices, resolved colours, protection flags, and the number-format code. Conditional formatting is not included in this result; evaluate it separately with the conditional-format API.

## Pagination

`paginate(sheet)` returns the declared print areas, physical page count, paper, margins, printable rectangle, scale, page order, print titles, each page layout, and whether each break is manual. If no print area is declared, `printArea` stays empty while pagination falls back to the used range. Configure the inputs with `setSheetPageSetup`, `setSheetPageMargins`, `setSheetPrintArea`, `setSheetPrintTitles`, and row or column break methods such as `addSheetRowBreak`.

The C layer exposes the same model through `fm_workbook_paginate` and the `fm_pagination_*` readers. Geometry, view, theme, and style calls are `fm_sheet_*`, `fm_workbook_get_theme_*`, `fm_workbook_reset_theme`, `fm_workbook_resolve_color`, and `fm_sheet_get_effective_style` in `src/c_api/formulon_c.h`.

::: code-group

```js [WASM]
import createFormulon, { GeometryMode } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
try {
  checked(wb.setNumber(0, 0, 0, 123.45), 'setNumber')
  const text = checked(wb.getDisplayText(0, 0, 0), 'display')
  const rect = checked(wb.getCellRectPt(0, { firstRow: 0, firstCol: 0, lastRow: 0, lastCol: 0 }, GeometryMode.Display), 'rect')
  const theme = checked(wb.getTheme(), 'theme')
  const pages = checked(wb.paginate(0), 'paginate')
  console.log(text.text, rect.width, theme.colors.length, pages.pageCount)
} finally { wb.delete() }
```

```js [Native Node]
import { GeometryMode, Workbook } from '@libraz/formulon-native'

const wb = Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
try {
  checked(wb.setNumber(0, 0, 0, 123.45), 'setNumber')
  const text = checked(wb.getDisplayText(0, 0, 0), 'display')
  const rect = checked(wb.getCellRectPt(0, { firstRow: 0, firstCol: 0, lastRow: 0, lastCol: 0 }, GeometryMode.Display), 'rect')
  const theme = checked(wb.getTheme(), 'theme')
  const pages = checked(wb.paginate(0), 'paginate')
  console.log(text.text, rect.width, theme.colors.length, pages.pageCount)
} finally { wb.dispose() }
```

```python [Python]
from formulon import FormulonError, GeometryMode, MergeRange, Workbook

try:
    with Workbook.create_default() as wb:
        wb.set_number(0, 0, 0, 123.45)
        text, display_status = wb.get_display_text(0, 0, 0)
        rect = wb.get_cell_rect_pt(0, MergeRange(0, 0, 0, 0), GeometryMode.DISPLAY)
        theme = wb.get_theme()
        pages = wb.paginate(0)
        print(text, rect.width, len(theme.colors), pages.page_count)
except FormulonError as exc:
    raise RuntimeError(str(exc)) from exc
```

:::

The Python `Workbook` context manager closes the handle and raises `FormulonError` for host-side failures. WASM uses `delete()`; Native Node uses `dispose()`. Image or chart rendering remains the caller's responsibility.
