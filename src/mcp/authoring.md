---
description: Build printable workbook documents from named blocks, then refine, inspect, preview, save, and close the session.
---

# Authoring documents

`formulon_build_document` writes a document into an open workbook from a stack of named blocks. It calculates the rows, merges, table borders, number formats, column widths, formulas, and print area from that stack. The response returns an A1 map so later tools can refine the exact ranges.

The tool provides layout mechanics. It does not decide what an invoice, receipt, application form, or tax calculation means. Labels, tax rates, rounding, and business rules belong in the values and formulas supplied by the caller.

## The authoring loop

Keep one session for the whole edit:

1. Open a new workbook with `formulon_open_workbook` and a stable `sessionId`.
2. Call `formulon_build_document` with the blocks and any print preset.
3. Read the returned names and formulas with `formulon_get_range` or `formulon_inspect_layout`.
4. Refine the returned ranges with `formulon_default_font`, `formulon_style_range`, `formulon_dimension_operation`, or `formulon_print_settings`.
5. Preview the final range with `formulon_preview_range`. The first response content is a PNG image; the following text content is JSON metadata.
6. Save to an explicit `.xlsx` path with `formulon_save_session`.
7. Close the session with `formulon_close_workbook`.

An explicit output path keeps a review artifact separate from its source. A new session has no source path, so saving without `outputPath` fails. A loaded session can fall back to its source path, which may overwrite the input.

## `formulon_build_document` input

The required fields are `sessionId` and a non-empty `blocks` array. The other top-level fields are:

| Field | Meaning |
| --- | --- |
| `sheet` | Sheet name or zero-based index used when `start` has no sheet prefix. It defaults to the first sheet. |
| `start` | Top-left A1 anchor, such as `Sheet1!B2`. It defaults to `B2`, leaving one blank row and column as a margin. |
| `width` | Document width in columns. Without it, the widest table determines the width; a document with no table is two columns wide. |
| `theme` | Base font and table presentation defaults described below. |
| `print` | One of the named print presets. The preset also sets the print area to the document range. |
| `repeatTableHeader` | Repeats the first table header on each printed page. It defaults to `true` when `print` is set. |

The blocks are placed top to bottom. `sameRow` reuses the current row group; it does not automatically move a block to the next free column. Set compatible spans and left/right placement yourself. Overlapping spans produce an error, but a build failure can leave earlier writes or writes from the overlapping block in the workbook. Inspect the affected range before retrying. The next block without `sameRow` starts below the tallest block in the current row group.

### Block options

Every block accepts `name` and `sameRow`:

| Block | Options |
| --- | --- |
| `title` | `text` is required. Optional `align` (`left`, `center`, `right`), positive `size`, and `bold`. It is merged across the document width. |
| `text` | `text` is required. Optional `align`, positive `size`, `bold`, positive `span`, `wrap`, and positive `rows`. `span` limits the merge to that many columns; `rows` reserves a multi-row wrapped area. |
| `fields` | `items` is required and non-empty. Optional `align` (`left` or `right`), positive `labelSpan`, positive `valueSpan`, and `rule`. `rule` adds a bottom border to each value area. |
| `table` | `columns` is required and non-empty. Optional `rows`, non-negative `rowCount`, and `bandColor`. `rowCount` creates blank ruled body rows when `rows` is omitted. |
| `summary` | `items` is required and non-empty. Optional `align` (`left` or `right`), positive `labelSpan`, positive `valueSpan`, and `border`. `border` defaults to `true`. |
| `spacer` | Optional non-negative `rows`. The default reserves one row; `rows: 0` reserves no rows. |

Field and summary items have `label`, optional literal `value`, optional `formula`, optional `format`, and optional `name`. A formula takes precedence when both `formula` and `value` are present. Item values are written in the value area, while the label area is merged across `labelSpan` columns. Summary items also accept `emphasis: true`, which makes the row bold and gives it an outline when summary borders are enabled.

The defaults are centered, 18-point, bold titles; left-aligned one-row text with no bold styling and a span equal to the document width; left-aligned fields with `labelSpan: 1` and `valueSpan: 1`; and right-aligned summaries with `valueSpan: 1` and a `labelSpan` of `min(2, width - 1)`.

Table columns have the following options:

| Option | Meaning |
| --- | --- |
| `header` | Displayed header text. It also becomes the default formula key. |
| `key` | Formula and row-object key. If omitted, the header is used. |
| `formula` | A per-row formula. Braced names such as `{qty}` bind to the current row's column cells. The formula is written when that row has no value for the column. |
| `width` | Column width in Excel character units. |
| `format` | Number-format alias or Excel format code. |
| `align` | `left`, `center`, or `right`. |

Table rows can be positional arrays or objects keyed by a column `key` or its `header`. A missing object property writes no value; on a new document area that leaves a blank cell, while an existing cell keeps its previous value. Positional values are matched by column order. `rowCount` is useful for a form that will be filled after the workbook is delivered.

## Names and placeholders

Formulas may use `{name}` placeholders. The builder replaces them with the A1 address produced by earlier blocks and rejects an unknown name rather than writing a formula that points at the wrong range. Excel array constants such as `{1,2;3,4}` pass through unchanged.

The response's `names` object includes these entries:

| Source | Registered names |
| --- | --- |
| Title | `title` by default, or the block's `name` when supplied. |
| Named text | The text block's `name`. |
| Fields | Each item label or item `name`; a named block also adds `<block>.<item>`. The block name maps to the whole block range. |
| Table | `<prefix>`, `<prefix>.header`, `<prefix>.body`, and `<prefix>.<header>`. The prefix is the block `name` or `table`. A column `key` also gets `<prefix>.<key>`. |
| Summary | Each item label or item `name`; a named block also adds `<block>.<item>`. The block name maps to the whole block range. |

For a table with body rows, `{qty}` and `{unit}` mean the cells in the same row, and the response includes `.body` and column ranges. For a form table with no body rows, only the table and header ranges are registered. For a formula outside the table, `{table.Amount}` means the entire amount body range. A later summary item can reference an earlier item such as `{Subtotal}`. This lets the builder bind `=SUM({table.Amount})` after it knows where the body landed.

The default names are convenient for one block of each kind. Give blocks and items explicit names when a document has multiple tables or repeated labels.

## Formats, dates, and print setup

`format` accepts an Excel format code or one of these aliases:

| Alias | Excel code |
| --- | --- |
| `date` | `yyyy/mm/dd` |
| `datetime` | `yyyy/mm/dd hh:mm` |
| `time` | `hh:mm` |
| `number` | `#,##0` |
| `decimal` | `#,##0.00` |
| `percent` | `0.0%` |

An ISO date string such as `2026-08-22` under a date format is converted to an Excel date serial. It remains a date value, rather than text that happens to look like a date. Use a literal format code for currency, for example `"¥"#,##0`.

The available `print` presets are `a4-portrait`, `a4-portrait-fit`, `a4-landscape`, `a4-landscape-fit`, `letter-portrait`, `letter-portrait-fit`, `letter-landscape`, and `letter-landscape-fit`. The `-fit` variants fit to one page wide and leave the height unbounded. A long line-item table flows to later pages, and the first table header repeats unless `repeatTableHeader` is `false`. The response includes `pageCount` when a print preset is used.

For settings that need to be changed after the build, `formulon_print_settings` accepts partial updates:

#### `formulon_print_settings`

```json
{
  "sessionId": "invoice",
  "sheet": "Sheet1",
  "pageSetup": {
    "orientation": "portrait",
    "paperSize": 9,
    "fitToPage": true,
    "fitToWidth": 1,
    "fitToHeight": 0
  },
  "margins": { "left": 0.6, "right": 0.6, "top": 0.5, "bottom": 0.5 },
  "printOptions": { "gridLines": false, "headings": false, "horizontalCentered": true },
  "printArea": "B2:E13",
  "printTitles": { "repeatRows": "7:7" },
  "headerFooter": { "oddFooter": "&CPage &P of &N" }
}
```

`paperSize: 9` is A4 and `paperSize: 1` is Letter. Header and footer text uses Excel codes: `&L`, `&C`, and `&R` select the section; `&P` and `&N` insert page numbers; `&D` inserts the date; `&&` inserts a literal ampersand. A read with no settings returns the stored settings and `pageCount`.

Margins (`left`, `right`, `top`, `bottom`, `header`, and `footer`) use inches; `0.5` is 12.7 mm.

## Fonts and style refinement

The `theme` object accepts `font`, `size`, `accent`, `headerText`, `border`, and `outline`. The theme font and size are applied to cells written by the builder. `accent` fills table header bands and changes header text to `headerText`; `border` defaults to `thin` and `outline` defaults to `medium`.

Set the workbook default font once when the document contains Japanese text or a controlled house font. Omitting `font` reads it; supplied properties are deltas:

#### `formulon_default_font`

```json
{
  "sessionId": "invoice",
  "font": { "name": "Yu Gothic", "size": 11 }
}
```

The default font reaches cells that have never received an explicit style. Giving a font `name` also removes the theme link for that font record, so Excel keeps the requested face when the theme changes.

Use `formulon_style_range` for targeted passes. Every property is a delta, so a header pass can add fill and bold text without removing the grid or number format already on the range. `baseOn` is `existing` by default; `default` starts from the workbook default for each cell.

#### `formulon_style_range`

```json
{
  "sessionId": "invoice",
  "range": "Sheet1!B7:E9",
  "style": {
    "border": {
      "all": "thin",
      "outline": { "style": "medium", "color": "#1F4E79" }
    },
    "align": { "vertical": "center" }
  },
  "baseOn": "existing"
}
```

The `style` object can contain `font` (`name`, `size`, `bold`, `italic`, `strike`, `underline`, `vertAlign`, `color`), `fill` (`color`, `bgColor`, `pattern`), `border` (`all`, `outline`, `left`, `right`, `top`, `bottom`), `numberFormat`, and `align` (`horizontal`, `vertical`, `wrapText`, `indent`, `textRotation`, `shrinkToFit`). Colors use `#RRGGBB` or `#AARRGGBB`. `border.all` rules every cell; `border.outline` draws only the outer box. Blank cells in a styled range are materialized so a ruled form renders.

## End-to-end example: a printable invoice

The following prompt gives an agent enough constraints to author a reviewable invoice:

```text
Create a new workbook session named "invoice-demo" and author a printable invoice starting at B2. Use a four-column line-item table with Item, Qty, Unit, and Amount. Calculate Amount per row, Subtotal, Tax at 10 percent, and Total. Treat those as the caller's formulas; do not infer a tax jurisdiction or tax policy. Set a Japanese-capable default font, read the computed range with formulas, preview B2:E13 to a PNG artifact, save the final workbook as /tmp/invoice-demo.xlsx, inspect the save result, and close the session.
```

Open a blank session:

#### `formulon_open_workbook`

```json
{
  "sessionId": "invoice-demo"
}
```

Set the workbook default font before building the document:

#### `formulon_default_font`

```json
{
  "sessionId": "invoice-demo",
  "font": { "name": "Yu Gothic", "size": 11 }
}
```

Build the document. The date is stored as a date serial because its format is `date`:

#### `formulon_build_document`

```json
{
  "sessionId": "invoice-demo",
  "start": "B2",
  "print": "a4-portrait-fit",
  "theme": { "font": "Yu Gothic", "size": 11, "accent": "#1F4E79", "headerText": "#FFFFFF" },
  "blocks": [
    { "type": "title", "text": "Invoice", "size": 18, "bold": true },
    { "type": "spacer" },
    { "type": "text", "name": "to", "text": "Sample Co.", "span": 2 },
    {
      "type": "fields",
      "name": "meta",
      "align": "right",
      "sameRow": true,
      "items": [
        { "label": "No.", "value": "INV-0001" },
        { "label": "Date", "value": "2026-08-22", "format": "date" }
      ]
    },
    { "type": "spacer" },
    {
      "type": "table",
      "columns": [
        { "header": "Item", "key": "name", "width": 30 },
        { "header": "Qty", "key": "qty", "format": "number", "align": "right" },
        { "header": "Unit", "key": "unit", "format": "number", "align": "right" },
        { "header": "Amount", "formula": "={qty}*{unit}", "format": "number", "align": "right" }
      ],
      "rows": [
        { "name": "Design", "qty": 3, "unit": 120000 },
        { "name": "Build", "qty": 5, "unit": 98000 }
      ],
      "bandColor": "#F3F6FA"
    },
    { "type": "spacer" },
    {
      "type": "summary",
      "items": [
        { "label": "Subtotal", "formula": "=SUM({table.Amount})", "format": "number" },
        { "label": "Tax", "formula": "=ROUND({Subtotal}*0.1,0)", "format": "number" },
        { "label": "Total", "formula": "={Subtotal}+{Tax}", "format": "number", "emphasis": true }
      ]
    }
  ]
}
```

The meaningful parts of the build response are:

```json
{
  "range": "B2:E13",
  "width": 4,
  "pageCount": 1,
  "names": {
    "title": "B2:E2",
    "to": "B4:C4",
    "meta": "D4:E5",
    "Date": "E5",
    "table.header": "B7:E7",
    "table.body": "B8:E9",
    "table.Amount": "E8:E9",
    "Subtotal": "E11",
    "Tax": "E12",
    "Total": "E13"
  }
}
```

Read the values and formula text before refining or saving:

#### `formulon_get_range`

```json
{
  "sessionId": "invoice-demo",
  "range": "Sheet1!B2:E13",
  "includeFormulas": true,
  "recalc": true,
  "maxCells": 100
}
```

The sparse response contains `E8` with formula `=C8*D8` and value `360000`, `E9` with `=C9*D9` and value `490000`, `E11` with `=SUM(E8:E9)` and value `850000`, `E12` with `=ROUND(E11*0.1,0)` and value `85000`, and `E13` with `=E11+E12` and value `935000`. The builder does not add or interpret tax rules beyond the formulas supplied here.

Preview the same range and write an explicit PNG artifact:

#### `formulon_preview_range`

```json
{
  "sessionId": "invoice-demo",
  "range": "Sheet1!B2:E13",
  "scale": 1,
  "showGridLines": false,
  "showPageBreaks": true,
  "recalc": false,
  "outputPath": "/tmp/invoice-demo.png"
}
```

The MCP result puts an `image/png` content item first. The second content item is JSON metadata containing the chosen range, logical and scaled dimensions, font list, page count, page breaks, warning list, and compact cell geometry. The metadata does not replace the image review.

Save and inspect the writer result:

#### `formulon_save_session`

```json
{
  "sessionId": "invoice-demo",
  "outputPath": "/tmp/invoice-demo.xlsx"
}
```

The result includes `outputPath`, `bytes`, `format: "xlsx"`, and optional `losses`. An authored document should be saved as XLSX so its print settings and styles remain available. Close the in-memory workbook after checking the result:

#### `formulon_close_workbook`

```json
{
  "sessionId": "invoice-demo"
}
```

## Choosing the next tool

Use `formulon_build_document` when the content is a new stacked document and formulas can be described by names. Use `formulon_style_range`, `formulon_dimension_operation`, and `formulon_print_settings` when an existing workbook already has the cells and only presentation needs changing. Use `formulon_table_operation` when the range must become an Excel Structured Table with filter and table metadata; the `table` block here creates a ruled visual table and does not create that native object.
