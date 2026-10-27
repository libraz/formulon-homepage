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
| `style` | A1 `range` (a bounded range, whole columns such as `C:C`, or whole rows such as `1:1`), a `style` object, and optional `base` (`existing` or `default`). Whole columns and rows are styled as columns and rows without creating cells. |
| `print` | A non-empty `settings` object accepted by `formulon_print_settings`. |

Column sizes default to Excel's stored character width, padding included, as `<col width>` holds it; a default Calibri 11 column is `9.140625`, not `8.43`. Row sizes default to points. `px` and `mm` convert through the 96-DPI display calibration and are stored in Excel's native character or point units. The result reports both stored values and `displayGeometry` with `points`, `pixels`, and `mm`.

Column conversions use the engine's per-sheet display width model and Normal-font calibration. Row and column geometry comes from the engine, including sheet defaults and hidden dimensions.

The `style` object has `font` (`name`, `size`, `bold`, `italic`, `strike`, `underline`, `vertAlign`, `color`), `fill` (`color`, `bgColor`, `pattern`), `border` (`all`, `outline`, `left`, `right`, `top`, `bottom`), `numberFormat`, and `align` (`horizontal`, `vertical`, `wrapText`, `indent`, `textRotation`, `shrinkToFit`). Colors use `#RRGGBB` or `#AARRGGBB`. `border.all` rules every cell; `border.outline` draws only the outer edge.

The `base` field belongs to a layout `style` operation. `base: "existing"` applies the style delta to each cell's current style. `base: "default"` starts each cell from the workbook default. The standalone `formulon_style_range` tool calls the corresponding option `baseOn`, so its payload uses `baseOn`, not `base`.

A complete batch with all five operation types is in the [end-to-end example](#reproduce-a-form) below. The response contains one entry per operation. A column entry reports `storedUnits: "chars"`; a row entry reports `storedUnits: "pt"`; a style entry reports the resolved range, base, and affected style regions. A preflight error leaves the session unchanged and leaves the operations in that batch unapplied.

### Bounds and failure behavior

The layout limits are part of the input contract:

| Limit | Value |
| --- | ---: |
| Operations in one batch | 200 |
| Stored column width | 255 characters (padding included) |
| Stored row height | 409 points |
| Expanded row writes across row operations | 10,000 rows |
| Cells covered by style operations in one batch | 100,000 cells (whole columns or rows count as none) |
| Column index | 0 through 16,383 (`XFD`) |
| Row index | 0 through 1,048,575 (Excel row 1,048,576) |

Preflight validates ranges, units, dimensions, print areas, print-title spans, and these caps before applying anything. It is not a transaction after preflight. If the engine fails while applying a valid operation, earlier operations can remain in the workbook and the session remains dirty. Read the session after such a failure and reopen the source in a new session when the partial result should be discarded.

## Set the sheet view {#sheet-view}

`formulon_set_sheet_view` changes how a sheet opens in Excel, separately from its cells. Each stated setting returns its own engine status.

| Field | Meaning |
| --- | --- |
| `zoom` | 10 to 400. |
| `freezeRows`, `freezeCols` | Frozen panes. Pass both; an omitted count becomes `0`. |
| `splitX`, `splitY` | Unfrozen split position in points from the left or top edge; `0` removes the split on that axis. A view is frozen or split, not both. |
| `topLeft` | First visible cell of the scrolled view, such as `A100`. It takes no sheet name. |
| `showFormulas` | Show formula text instead of results. |
| `showOutlineSymbols` | Show the outline gutter's expand and collapse symbols. |
| `hidden`, `visibility` | Tab visibility. Excel refuses to hide the last visible sheet, and hiding the active sheet activates the next visible one. |
| `active` | `true` makes this the sheet Excel opens on; it must be visible. |

#### `formulon_set_sheet_view`

```json
{ "sessionId": "form-layout", "sheet": "Sheet1", "freezeRows": 1, "freezeCols": 0, "showOutlineSymbols": true, "topLeft": "A1", "active": true }
```

Outline groups use `formulon_dimension_operation`. `outline` sets the level, `hidden` hides the detail rows or columns, and `collapsed` marks the summary row or column of the group. Excel stores both flags, so a collapsed group needs both calls.

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

`pages` reports the whole sheet's pagination: `count`, print `scale`, `paperWidthPt`, `paperHeightPt`, `landscape`, up to 50 A1 `ranges`, and `rangesTruncated`. This print scale is separate from the top-level preview raster `scale`. `objects` lists intersecting drawings with `objectId`, `kind`, `name`, and `rendered`. Print-settings reads also include `settings.layout` with resolved paper, point margins, printable area, scale, page order, break indices and manual flags, and up to 50 page ranges with `pagesTruncated`.

### Preview limits

Preview requests are bounded before rendering:

| Limit | Value |
| --- | ---: |
| Requested range area | 10,000 cells |
| Raster width or height after scale | 4,096 pixels |
| Raster area after scale | 8,000,000 pixels |
| Generated SVG | 4 MiB |
| Stored-cell inventory when discovering used bounds | 1,000,000 cells |
| Merged ranges intersecting the requested range | 10,000 |
| Drawing objects intersecting the preview | 100 |
| Embedded picture payload (cumulative Base64 length) | 2 MiB |
| Page ranges in metadata | 50 |
| Metadata cells | 500 |
| Metadata text per cell field | 256 characters |
| Distinct warning messages | 100 |

The inventory limit applies only when `range` is omitted and no print area supplies the bounds. With an explicit range, formulas and merges are read inside that rectangle, so unrelated cells do not consume this inventory limit.

## Rendering approximation

The preview is a worksheet-range render, not a print renderer. It uses installed system fonts and engine display geometry. The engine resolves effective styles, theme/indexed colors, and number-format display text. Missing or unreadable themes use the default Office theme with a warning; Excel can substitute a different font on another machine.

| Result | What it can confirm | What still needs another check |
| --- | --- | --- |
| PNG preview | Cell display text, merges, fills, borders, alignment, and page-break lines. PNG, JPEG, and GIF pictures render within the payload limit. | Conditional formatting, headers, footers, page margins, print output, and exact font substitution in Excel. Charts, shapes, BMP pictures, and unsupported or oversized pictures appear as dashed placeholders. |
| Preview metadata | Cell geometry, chosen fonts, pagination, warning messages, and whether an object rendered. | Pattern fills, rotated text, shrink-to-fit, and diagonal borders are approximations. Check `warnings` and each object's `rendered` flag. |
| Saved workbook | The artifact written by Formulon, with serialization losses reported by the save tool. | Excel's final appearance. Open the saved file in its target application when exact rendering matters. |

To check conditional formatting, [evaluate the rules](/mcp/conditional-formats-validation#evaluate) instead. The preview does not apply those rules.

`recalc: true` obtains current formula values before rendering. Recalculation changes cached values and marks the session dirty, even though the preview itself is read-only afterward. Use `recalc: false` when the cached values are the intended comparison target.

## Insert and inspect pictures {#images}

Open a session first and provide an existing PNG, JPEG, GIF, or BMP file, at most 20 MiB. `formulon_image_operation` inserts it at an unqualified cell anchor on the selected sheet. Sizes and offsets (`width`, `height`, `offsetX`, `offsetY`) use `{size,unit?}`, where `unit` is `pt` by default or `px` / `mm`. Specifying one dimension preserves aspect ratio; omitting both uses the image's pixel size at 96 DPI. `anchorKind` is `oneCell` or `twoCell`, which stretches with row/column sizing; insert uses `oneCell` when it is omitted.

The insert result reports `objectId`, source dimensions, and placement. List includes pictures, charts, shapes, and other drawing kinds; get returns picture bytes, and move, reorder, and remove operate on pictures and charts. Shapes have their own tool, described [below](#shapes). Replace `2` below with the returned picture id. Get returns image content when the format is known, followed by JSON metadata; it can also write the bytes to `outputPath`.

#### `formulon_image_operation`: insert

```json
{
  "sessionId": "form-layout",
  "sheet": "Sheet1",
  "operation": "insert",
  "path": "/tmp/logo.png",
  "anchor": "B2",
  "width": { "size": 96, "unit": "px" },
  "name": "Logo",
  "description": "Company logo"
}
```

#### `formulon_image_operation`: list

```json
{ "sessionId": "form-layout", "operation": "list" }
```

#### `formulon_image_operation`: get

```json
{ "sessionId": "form-layout", "operation": "get", "objectId": 2, "outputPath": "/tmp/extracted-logo.png" }
```

#### `formulon_image_operation`: remove

```json
{ "sessionId": "form-layout", "operation": "remove", "objectId": 2 }
```

`move` changes only what it states among `anchor`, `offsetX`, `offsetY`, `width`, `height`, and `anchorKind`. Omitted fields keep their current values, a lone width or height keeps the object's aspect ratio, and the object keeps its id, name, and alt text. A picture also keeps its crop and rotation. The result is `{session,sheet,objectId,placed}`.

#### `formulon_image_operation`: move

```json
{
  "sessionId": "form-layout",
  "operation": "move",
  "objectId": 2,
  "anchor": "D4",
  "width": { "size": 120, "unit": "px" }
}
```

`reorder` takes `objectId` and `index`, the target position in list order. List order runs back to front, so `0` is the back. The result is `{session,sheet,objectId,index,order}`, where `order` holds the object ids in the new order.

#### `formulon_image_operation`: reorder

```json
{ "sessionId": "form-layout", "operation": "reorder", "objectId": 2, "index": 0 }
```

Insertion, movement, reordering, and removal mark the session dirty and preserve other drawing objects. Preview the affected range to check placement, then save explicitly as XLSX. OOXML drawings are omitted on XLSB save and reported in losses; see [File formats](/workbook/file-formats#xlsb). Preview itself does not insert or remove pictures.

## Draw shapes, text boxes, and connectors {#shapes}

`formulon_shape_operation` lists, inserts, updates, and removes shapes, text boxes, and connectors such as lines and arrows. Insert needs an unqualified cell `anchor`. With `width` and `height` the shape is a one-cell shape that keeps its size; with `to` (the bottom-right cell) it is a two-cell shape that stretches with rows and columns. `geometry` is a DrawingML preset (`rect` by default, or `roundRect`, `ellipse`, `rightArrow`, `line`, `straightConnector1`). Line and connector geometries hold no text. `fill` and `line` take an opaque `#RRGGBB` or `none`.

#### `formulon_shape_operation`: insert

```json
{
  "sessionId": "form-layout",
  "sheet": "Sheet1",
  "operation": "insert",
  "anchor": "F2",
  "width": { "size": 160, "unit": "px" },
  "height": { "size": 48, "unit": "px" },
  "geometry": "roundRect",
  "text": "Approved",
  "fill": "#DDEEDD",
  "line": "#336633"
}
```

The response carries the new `objectId` and the resolved `placed` anchor. An update changes only the fields it states and keeps the anchor kind; a placement field moves or resizes the shape.

#### `formulon_shape_operation`: update

```json
{ "sessionId": "form-layout", "sheet": "Sheet1", "operation": "update", "objectId": 3, "text": "Rejected", "fill": "#EEDDDD" }
```

Shapes have no stacking-order control. Pictures and charts keep using `formulon_image_operation` for ordering. Shape edits mark the session dirty, and OOXML drawings are omitted on XLSB save, as for pictures.

## End-to-end example: reproduce a form from a screenshot {#reproduce-a-form}

This prompt tells an agent how to make the visual result editable and reviewable:

```text
Recreate the supplied application-form screenshot as an editable Sheet1 grid. Put the title in A1:D1, use 180 px for column A and 96 px for columns B:D, use 36 px for row 1 and 24 px for rows 2:5, and keep the labels and values as worksheet cells. Apply the layout in one ordered batch, preview A1:D5 to /tmp/form-layout.png, read the cells and metadata, save as /tmp/form-layout.xlsx, and close the session. Treat the preview as an approximation and report its warnings.
```

Open a blank workbook with a stable session ID and the default Windows English profile so the later `Sheet1` ranges resolve to the intended first sheet. Use the returned sheet name when choosing another profile:

#### `formulon_open_workbook`

```json
{
  "sessionId": "form-layout",
  "profile": "win-365-en_US"
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
