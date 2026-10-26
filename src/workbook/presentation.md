# Presentation, geometry, and pagination

Formulon exposes the workbook state that a renderer needs. It does not draw cells or pages. Coordinates are zero-based; physical geometry is returned in points.

## Display state

`getDisplayText(sheet, row, col)` renders one stored value with its effective number format. Its `displayStatus` is `DisplayStatus.Ok`, `Overflow`, or `InvalidFormat`; an overflow is reported as `########` by the renderer contract. `formatValue(value, formatCode)` applies a supplied format without reading a cell. Both calls return a status-bearing result.

`getSheetView(sheet)` reads zoom, frozen row and column counts, tab visibility, gridlines, row and column headers, zero display, right-to-left mode, tab selection, view mode, scroll origin (`topLeftRow`, `topLeftCol`), pane origin (`paneTopLeftRow`, `paneTopLeftCol`), split offsets (`splitX`, `splitY`), `showFormulas`, and `showOutlineSymbols`. Each field has a setter: `setSheetZoom`, `setSheetFreeze`, `setSheetVisibility`, `setSheetShowGridLines`, `setSheetShowRowColHeaders`, `setSheetShowZeros`, `setSheetShowFormulas`, `setSheetShowOutlineSymbols`, `setSheetRightToLeft`, `setSheetTabSelected`, `setSheetViewMode`, `setSheetTopLeft`, `setSheetPaneTopLeft`, and `setSheetSplit`. Python spells them `set_sheet_zoom`, `set_sheet_split`, and so on. Sheet protection (`getSheetProtection` / `setSheetProtection`) is metadata; the calculation engine does not enforce locks.

`setSheetTopLeft(sheet, row, col)` sets the scroll origin. In a frozen or split view, `setSheetPaneTopLeft` sets the first visible cell of the lower-right pane; the cell must lie past the frozen rows and columns, and the call is rejected on a view without panes. Changing the freeze resets the pane origin to the first unfrozen cell.

`setSheetSplit(sheet, xTwips, yTwips)` divides the view at an offset in twips on either axis without freezing it; `0` leaves that axis unsplit and `0, 0` removes the split. A split replaces a freeze and a freeze replaces a split. Either change resets the pane origin and the active pane, and keeps the active selection. A negative or non-finite offset fails with `kInvalidArgument`. `splitX` and `splitY` read `0` while the view is frozen.

`getSheetSelection(sheet)` returns the active cell and the selected ranges of the active pane, and `setSheetSelection(sheet, { activeRow, activeCol, ranges })` replaces them; omitting `ranges` selects the active cell alone. In a frozen or split view the other panes keep their own selections, and a save writes one selection per pane. A selection in a pane the view lacks is dropped on save, and an active cell outside every selected range moves to the top-left cell of the first range. Python reads the selection as `get_sheet_selection(sheet)`, which returns `((row, col), ranges)`.

A resave keeps the view attributes the model does not expose: `windowProtection`, `showRuler`, `showWhiteSpace`, `defaultGridColor`, `colorId`, the three zoom scales for normal, page-layout, and sheet-layout views, `activeCellId`, pivot selections, and the view's extension list. Additional `<sheetView>` elements, which are extra workbook windows, are written verbatim after the modelled view.

## Geometry

`getCellRectPt(sheet, range, mode)` returns the rectangle covering an inclusive `MergeRange`, measured in points from the top-left corner of A1. `getColumnWidthPt` and `getRowHeightPt` return effective dimensions; hidden rows and columns contribute zero. `GeometryMode.Display` uses the screen width model, while `GeometryMode.Print` uses the DPI-stable model used by pagination. `getWidthModel` reports the Normal-font calibration and the character-to-point conversion. `columnCharsToPt` and `columnPtToChars` convert the two units.

Column widths are Excel's stored width, as `<col width>` holds it: characters with the column padding included. With Calibri 11 as the Normal font, the column Excel displays as 8.43 characters is stored as 9.140625. `setColumnWidth`, `getSheetColumns`, `columnCharsToPt`, `columnPtToChars`, and the default column width all use this unit. On screen, `columnCharsToPt` snaps the width to whole pixels of the Normal font's maximum digit width, and `columnPtToChars` returns the stored width for a given point size. Print layout on a workbook with an empty font table uses the Calibri 11 model.

Sheet defaults come from `getSheetFormatDefaults`, whose `effectiveDefaultColWidth` (stored width) and `effectiveDefaultRowHeight` (points, about 14.57 when unset, 0 while `zeroHeight` hides rows by default) are the values the sheet actually lays out with. Without an explicit `defaultColWidth`, the column width is derived from `baseColWidth` and the Normal font; Calibri 11 with the default base of 8 gives 9.140625. `customHeight` marks the default row height as an explicit override that Excel does not recompute from the Normal font. Per-column and per-row overrides come from `getSheetColumns` and `getSheetRowOverrides`, which also report each override's outline `collapsed` flag (see [Workbook operations](/workbook/operations)). Use `setSheetFormatDefaults`, `setColumnWidth`, `clearColumnWidth`, `setRowHeight`, and `clearRowHeight` to edit them. `clearColumnWidth` removes only the explicit width for an inclusive span and keeps hidden and outline metadata; the columns then follow the sheet's current effective default, including after that default changes. Display text remains independent of column width: narrow columns never become `####`, and repeated fills do not add width.

## Theme and effective styles

`getTheme` returns the 12 theme colours, major and minor typefaces, and a `ThemeSource` telling whether the theme part, the default theme, or an unparseable theme supplied them. When no theme part is present, the current Office defaults resolve accent 1 to `#156082`, major Latin to `Aptos Display`, minor Latin to `Aptos Narrow`, major East Asian to `游ゴシック Light`, and minor East Asian to `游ゴシック`. `setThemeColors` and `setThemeFonts` update the workbook theme; `resetTheme` removes the custom theme part and its relationships so the source falls back to the default on the next read. Excel may add its own theme part when it saves the workbook. `resolveColor(spec, context)` resolves RGB, theme, indexed, and automatic colours to ARGB; `ColorContext` determines what automatic means for a font, fill, or border.

`getTheme()` also returns `majorScripts` and `minorScripts` (`major_scripts` and `minor_scripts` in Python), the per-script fallback faces. When the theme part is absent, each list contains the Office default's 47 scripts. `setThemeScriptFont(major, script, typeface)` / `set_theme_script_font()` changes one entry while preserving the others; an unknown four-letter script is appended. The reported East Asian face falls back to `Jpan` only when the theme has no explicit East Asian typeface; an explicit face keeps precedence. The first call on a workbook without a theme creates one with the full default set. The script must contain four ASCII letters and the typeface must be non-empty.

Font records carry `outline`, `shadow`, `condense`, and `extend` toggles, each with a `has*` flag: an absent element on a differential font leaves the toggle unchanged, while `hasOutline` with `outline: false` switches it off. A fill record may carry a `gradient` (`GradientFill`): `type` is `0` for linear or `1` for path, `degree` is the linear angle, `left`, `right`, `top`, and `bottom` (0 to 1) place a path gradient's focus, and `stops` lists positions with colours. When `gradient` is present the pattern fields are ignored. Fill records and differential formats (`addFill`, `addDxf`) read and write both; the Python equivalents are `FontRecord` fields and `GradientFill`.

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
