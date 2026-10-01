---
description: Turn a visual worksheet reference into an editable grid with bounded layout batches and PNG or SVG previews.
---

# Layout and previews

Use `formulon_apply_layout` to apply a screenshot-derived layout to a worksheet, then use `formulon_preview_range` to check the result. The layout batch changes worksheet structure and styles. The preview produces a rendered snapshot and geometry metadata; it does not insert an image into the workbook.

The useful workflow for a form is:

1. Open a new or existing workbook session.
2. Write the labels, values, and formulas with `formulon_set_range` or `formulon_set_cells`.
3. Apply ordered column, row, merge, style, and print operations with `formulon_apply_layout`.
4. Read the edited range with `formulon_get_range` or `formulon_inspect_layout`.
5. Preview the range with `formulon_preview_range`, optionally writing an explicit `.png` or `.svg` artifact.
6. Save to an explicit `.xlsx` path and inspect `losses`.
7. Close the session.

## Apply an ordered layout batch

`formulon_apply_layout` accepts `sessionId`, an optional `sheet` (zero-based index or name), and one to 200 `operations`. Operations are validated completely before the first mutation. The operation list is then applied in the order supplied, so a later style can refine an earlier grid and a later merge can follow earlier sizing.

The five operation shapes are:

| `type` | Input |
| --- | --- |
| `column` | `first`, optional `last`, non-negative `size`, optional `unit` (`chars`, `pt`, `px`, `mm`). `last` defaults to `first`. |
| `row` | `first`, optional `last`, non-negative `size`, optional `unit` (`pt`, `px`, `mm`). `last` defaults to `first`. |
| `merge` | `operation` (`add` or `remove`) and an A1 `range` on the selected sheet. |
| `style` | A1 `range`, a `style` object, and optional `base` (`existing` or `default`). |
| `print` | A non-empty `settings` object accepted by `formulon_print_settings`. |

Column sizes default to Excel character units. Row sizes default to points. `px` and `mm` convert through the 96-DPI display calibration and are stored in Excel's native character or point units. The result reports both stored values and `displayGeometry` with `points`, `pixels`, and `mm`.

The `style` object has `font` (`name`, `size`, `bold`, `italic`, `strike`, `underline`, `vertAlign`, `color`), `fill` (`color`, `bgColor`, `pattern`), `border` (`all`, `outline`, `left`, `right`, `top`, `bottom`), `numberFormat`, and `align` (`horizontal`, `vertical`, `wrapText`, `indent`, `textRotation`, `shrinkToFit`). Colors use `#RRGGBB` or `#AARRGGBB`. `border.all` rules every cell; `border.outline` draws only the outer edge.

The `base` field belongs to a layout `style` operation. `base: "existing"` applies the style delta to each cell's current style. `base: "default"` starts each cell from the workbook default. The standalone `formulon_style_range` tool calls the corresponding option `baseOn`, so its payload uses `baseOn`, not `base`.

#### `formulon_apply_layout`

```json
{
  "sessionId": "form-layout",
  "sheet": "Sheet1",
  "operations": [
    { "type": "column", "first": 0, "last": 0, "size": 180, "unit": "px" },
    { "type": "column", "first": 1, "last": 3, "size": 96, "unit": "px" },
    { "type": "row", "first": 0, "size": 36, "unit": "px" },
    { "type": "row", "first": 1, "last": 4, "size": 24, "unit": "px" },
    { "type": "merge", "operation": "add", "range": "A1:D1" },
    {
      "type": "style",
      "range": "A1:D1",
      "base": "default",
      "style": {
        "font": { "name": "Yu Gothic", "size": 16, "bold": true, "color": "#FFFFFF" },
        "fill": { "color": "#1F4E79" },
        "align": { "horizontal": "center", "vertical": "center" },
        "border": { "outline": "medium" }
      }
    },
    {
      "type": "style",
      "range": "A2:D5",
      "base": "existing",
      "style": { "border": { "all": "thin" }, "align": { "vertical": "center" } }
    },
    { "type": "print", "settings": { "printArea": "A1:D5", "printOptions": { "gridLines": false } } }
  ]
}
```

The response contains one entry per operation. A column entry reports `storedUnits: "chars"`; a row entry reports `storedUnits: "pt"`; a style entry reports the resolved range, base, and affected style regions. A preflight error leaves the session unchanged and leaves the operations in that batch unapplied.

### Bounds and failure behavior

The layout limits are part of the input contract:

| Limit | Value |
| --- | ---: |
| Operations in one batch | 200 |
| Stored column width | 255 Excel character units |
| Stored row height | 409 points |
| Expanded row writes across row operations | 10,000 rows |
| Cells covered by style operations in one batch | 100,000 cells |
| Column index | 0 through 16,383 (`XFD`) |
| Row index | 0 through 1,048,575 (Excel row 1,048,576) |

Preflight validates ranges, units, dimensions, print areas, print-title spans, and these caps before applying anything. It is not a transaction after preflight. If the engine fails while applying a valid operation, earlier operations can remain in the workbook and the session remains dirty. Read the session after such a failure and reopen the source in a new session when the partial result should be discarded.

## Preview a range

`formulon_preview_range` accepts:

| Field | Default and meaning |
| --- | --- |
| `sessionId` | Required open session. |
| `sheet` | First sheet when omitted. A sheet name or zero-based index. |
| `range` | Optional bounded A1 range. |
| `scale` | `1`, constrained to `0.25` through `2`. |
| `showGridLines` | `false`. |
| `showPageBreaks` | `true`. |
| `recalc` | `false`. If true, recalculation occurs before rendering and marks the session dirty. |
| `outputPath` | Optional artifact path ending in `.png` or `.svg`. |

The MCP response always puts the PNG image content first, with MIME type `image/png`. The second content item is JSON metadata. When `outputPath` is present, the server also writes the generated PNG or SVG to that path. An `.svg` output does not change the first response item: the response still begins with PNG image content. Use an explicit artifact path when another process needs a file.

If `range` is omitted, the server chooses one print area, or the used cells expanded to include merges. A sheet with multiple print areas requires an explicit range. An empty sheet also requires an explicit range. An explicit range that cuts through a merged cell is rejected; choose the complete merged range instead. A qualified range and a conflicting `sheet` argument are rejected.

The metadata shape is stable enough for an agent to compare renders:

For the form payload in the example below, the 180 px first column and three 96 px columns produce `logicalWidth: 351` points. The 36 px title row and four 24 px body rows produce `logicalHeight: 99` points. At `scale: 1`, the PNG metadata reports `scaledWidth: 468`, `scaledHeight: 132`, and `pageCount: 1`. The response also contains `sheet`, `sheetName`, `range`, `scale`, `fontList`, `rowBreaks`, `colBreaks`, `warnings`, `cells`, `cellGeometryUnit: "pt"`, `metadataTruncated`, `omittedCellCount`, and `warningsTruncated`.

The actual dimensions and cells depend on the workbook. `cells` contains at most 500 non-empty or formula cells; text and formula strings are truncated at 256 characters, and the flags report truncation. `logicalWidth` and `logicalHeight` are points. Cell `x`, `y`, `width`, and `height` also use points.

### Preview limits

Preview requests are bounded before rendering:

| Limit | Value |
| --- | ---: |
| Requested range area | 10,000 cells |
| Raster width or height after scale | 4,096 pixels |
| Raster area after scale | 8,000,000 pixels |
| Generated SVG | 4 MiB |
| Stored-cell inventory for used bounds and formula scan | 1,000,000 cells |
| Merged ranges read from a sheet | 10,000 |
| Metadata cells | 500 |
| Metadata text per cell field | 256 characters |
| Distinct warning messages | 100 |

The inventory limit applies even when an explicit range is small, because the server enumerates stored cells to find formulas or used bounds. For a large sparse workbook, inspect or extract a smaller workbook before previewing.

## Rendering approximation

The preview is a worksheet-range render, not a print renderer. It uses installed system fonts and a calibrated display geometry. Unknown font families or sizes fall back to Calibri 11 metrics and add an approximation warning. Excel can substitute a different font on another machine.

The renderer does not apply conditional formatting. It does not render charts, images, drawings, headers, footers, or page margins. It renders cell values, formulas' current values, merges, fills, borders, text alignment, and page-break lines from the paginator. Some number formats, theme or indexed colors, pattern fills, rotated text, shrink-to-fit, diagonal borders, and scientific formats can be approximated and appear in `warnings`. Existing drawing parts may survive a load/save round trip, but this preview tool cannot insert a new logo or other image.

`recalc: true` obtains current formula values before rendering. Recalculation changes cached values and marks the session dirty, even though the preview itself is read-only afterward. Use `recalc: false` when the cached values are the intended comparison target.

## End-to-end example: reproduce a form from a screenshot

This prompt tells an agent how to make the visual result editable and reviewable:

```text
Recreate the supplied application-form screenshot as an editable Sheet1 grid. Put the title in A1:D1, use 180 px for column A and 96 px for columns B:D, use 36 px for row 1 and 24 px for rows 2:5, and keep the labels and values as worksheet cells. Apply the layout in one ordered batch, preview A1:D5 to /tmp/form-layout.png, read the cells and metadata, save as /tmp/form-layout.xlsx, and close the session. Treat the preview as an approximation and report its warnings.
```

Open a blank workbook with a stable session ID:

#### `formulon_open_workbook`

```json
{
  "sessionId": "form-layout"
}
```

Write editable labels and values. `null` leaves a cell untouched; `{ "f": "..." }` writes a formula.

#### `formulon_set_range`

```json
{
  "sessionId": "form-layout",
  "start": "Sheet1!A1",
  "values": [
    ["Application form", null, null, null],
    ["Name", "Aki Sato", null, null],
    ["Department", "Design", null, null],
    ["Quantity", 3, null, null],
    ["Amount", 120000, null, null]
  ],
  "recalc": false
}
```

Apply the layout. The style operation for the title uses `base: "default"`; the body style uses `base: "existing"`, and the body operation follows the title operation in the batch.

#### `formulon_apply_layout`

```json
{
  "sessionId": "form-layout",
  "sheet": "Sheet1",
  "operations": [
    { "type": "column", "first": 0, "size": 180, "unit": "px" },
    { "type": "column", "first": 1, "last": 3, "size": 96, "unit": "px" },
    { "type": "row", "first": 0, "size": 36, "unit": "px" },
    { "type": "row", "first": 1, "last": 4, "size": 24, "unit": "px" },
    { "type": "merge", "operation": "add", "range": "A1:D1" },
    {
      "type": "style",
      "range": "A1:D1",
      "base": "default",
      "style": {
        "font": { "name": "Yu Gothic", "size": 16, "bold": true, "color": "#FFFFFF" },
        "fill": { "color": "#1F4E79" },
        "align": { "horizontal": "center", "vertical": "center" },
        "border": { "outline": "medium" }
      }
    },
    {
      "type": "style",
      "range": "A2:D5",
      "base": "existing",
      "style": { "border": { "all": "thin" }, "align": { "vertical": "center" } }
    },
    { "type": "print", "settings": { "printArea": "A1:D5", "printOptions": { "gridLines": false } } }
  ]
}
```

The meaningful response values are the stored column and row units plus `displayGeometry`, an added `A1:D1` merge, two style regions, and the applied print area. If a later operation had an invalid range, preflight would report the error before any of these operations changed the session.

Read the cells after the layout operation:

#### `formulon_get_range`

```json
{
  "sessionId": "form-layout",
  "range": "Sheet1!A1:D5",
  "includeFormulas": true,
  "recalc": false,
  "maxCells": 100
}
```

Preview with an explicit range and PNG artifact:

#### `formulon_preview_range`

```json
{
  "sessionId": "form-layout",
  "range": "Sheet1!A1:D5",
  "scale": 1,
  "showGridLines": false,
  "showPageBreaks": true,
  "recalc": false,
  "outputPath": "/tmp/form-layout.png"
}
```

The result starts with a PNG image. Its following JSON metadata identifies `Sheet1!A1:D5`, lists the chosen font and cell geometry, reports the page count and any approximation warnings, and records whether metadata was truncated. To request a vector artifact for another consumer, repeat the call with `outputPath: "/tmp/form-layout.svg"`; the MCP response still begins with PNG content.

Save to a separate workbook path and inspect the result:

#### `formulon_save_session`

```json
{
  "sessionId": "form-layout",
  "outputPath": "/tmp/form-layout.xlsx"
}
```

The save response includes the byte count, selected format, and `losses`. Close the session after the artifact and metadata have been checked:

#### `formulon_close_workbook`

```json
{
  "sessionId": "form-layout"
}
```
