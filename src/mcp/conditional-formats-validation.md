---
description: Add conditional formatting and data validation to a workbook through formulon-mcp, check which cells match, and save the rules to XLSX.
---

# Conditional formats and data validation

Ask the agent for rules in plain terms: "highlight amounts over 1,000 in red", "shade the whole row when the status is Draft", "put a Draft/Approved/Paid dropdown on column C", "allow only 0 to 2,000 in the amount column". The agent writes them with `formulon_conditional_format_operation` and `formulon_validation_operation`, checks the result in the session, and saves an `.xlsx` that Excel opens with the rules in place.

A prompt that names the range, the condition, the look, and the output file is enough:

> Open `sales.xlsx`. In `Sheet1!B2:B5`, give amounts over 1000 a light red fill with dark red text. Add a dropdown with Draft, Approved, and Paid to `C2:C21`. Check which cells match, then save as `out/sales-rules.xlsx`.

## Worked example

The sheet has a header row, amounts in `B2:B5`, and a status column `C`. Both tools address cells with zero-based numbers, so `B2:B5` is rows 1 to 4 of column 1.

### 1. Register the style

A rule such as "greater than 1000" applies a differential format (a *dxf*): only the properties the rule changes, such as fill and font color. Neither high-level tool creates one, so register it through `formulon_workbook_call` with the allowlisted `addDxf` method:

```json
{
  "sessionId": "sales",
  "method": "addDxf",
  "args": [
    {
      "font": { "colorArgb": 4288413702 },
      "fill": { "pattern": 1, "fgArgb": 4294952910, "bgArgb": 4294952910 }
    }
  ]
}
```

Colors are ARGB integers in decimal: `4294952910` is `0xFFFFC7CE` (light red) and `4288413702` is `0xFF9C0006` (dark red). `pattern: 1` is a solid fill. The response carries the style's position in `result.index`; the next step passes it as `dxfId`. Adding an identical record again returns the existing index instead of a new one.

### 2. Add the rule

`formulon_conditional_format_operation` with `operation: "add"`:

```json
{
  "sessionId": "sales",
  "operation": "add",
  "rule": {
    "sqref": [{ "firstRow": 1, "firstCol": 1, "lastRow": 4, "lastCol": 1 }],
    "type": 1,
    "op": 5,
    "formula1": "1000",
    "dxfId": 0
  }
}
```

`type: 1` is a cell-value rule and `op: 5` is greater than. The response's `result.index` is the rule's position in the sheet's rule list. A rule without `dxfId` is accepted and still matches, but it changes nothing on screen.

### 3. Add the dropdown

`formulon_validation_operation` with `operation: "add"`:

```json
{
  "sessionId": "sales",
  "operation": "add",
  "validation": {
    "ranges": [{ "firstRow": 1, "firstCol": 2, "lastRow": 20, "lastCol": 2 }],
    "type": 3,
    "formula1": "\"Draft,Approved,Paid\"",
    "allowBlank": true,
    "showErrorMessage": true,
    "errorTitle": "Unknown status",
    "errorMessage": "Pick Draft, Approved, or Paid."
  }
}
```

A literal list keeps Excel's double quotes inside the string. Omitted booleans are `false`, so `allowBlank` and `showErrorMessage` have to be stated; `showDropDown` is the one field that defaults to `true`.

### 4. Check and save

Evaluate the range to see which cells the rules hit, then save with `formulon_save_session` and an explicit `.xlsx` `outputPath`. Both steps are described below.

## Conditional formats {#conditional-formats}

### Rule types

`rule.type` is a number, and each type reads its own fields:

| `type` | Rule | Fields it reads |
| --- | --- | --- |
| 0 | Formula is true | `formula1` |
| 1 | Cell value compares | `op`, `formula1`, and `formula2` for between / not between |
| 2 | Color scale | `colorScale` |
| 3 | Data bar | `dataBar` |
| 4 | Icon set | `iconSet` |
| 5 | Top / bottom N | `rank`, `percent`, `bottom` |
| 6 | Above / below average | `aboveAverage`, `equalAverage`, `stdDev` |
| 7, 8 | Contains / does not contain text | `text` |
| 9, 10 | Begins / ends with | `text` |
| 11, 12 | Blank / not blank | none |
| 13, 14 | Error / no error | none |
| 15 | Date period | `timePeriod` |
| 16, 17 | Duplicate / unique values | none |

The cell-value `op` is 0 less than, 1 less than or equal, 2 equal, 3 not equal, 4 greater than or equal, 5 greater than, 6 between, 7 not between. This numbering differs from the data-validation `op` below. `timePeriod` is 0 today, 1 yesterday, 2 tomorrow, 3 last 7 days, 4 this week, 5 last week, 6 next week, 7 this month, 8 last month, 9 next month.

Every rule needs `sqref`, one or more inclusive ranges. Formulas are written without the leading `=`. Relative references in a formula are read from the top-left cell of the first range, as in Excel, so a rule on `A2:D5` that shades every row whose status is Draft uses `$C2`:

```json
{
  "sessionId": "sales",
  "operation": "add",
  "rule": {
    "sqref": [{ "firstRow": 1, "firstCol": 0, "lastRow": 4, "lastCol": 3 }],
    "type": 0,
    "formula1": "$C2=\"Draft\"",
    "dxfId": 0
  }
}
```

A formula that does not parse is rejected and nothing is added.

### Styles for formula and comparison rules

Types 0, 1, and 5 to 17 show their result through `dxfId`. The `addDxf` record accepts these optional parts, each written only when present:

| Part | Common fields |
| --- | --- |
| `font` | `colorArgb`, `bold`, `italic`, `strike`, `underline`, `size`, `name` |
| `fill` | `pattern` (1 solid), `fgArgb`, `bgArgb` |
| `border` | `left`, `right`, `top`, `bottom`, each `{style, colorArgb}` |
| `numFmt` | `numFmtId` and `formatCode` |

A `font` part always carries a size, which defaults to 11, so a font change on cells of another size should state `size`. A fill-only style leaves the font untouched. `formulon_workbook_api` with `operation: "describe"` and `method: "addDxf"` returns the full record declaration, and `getDxf` with the index reads a registered style back.

### Color scales, data bars, and icon sets

Types 2, 3, and 4 carry their own colors or icons and take no `dxfId`. The payload object matching the type is required. A two-color scale from white at the lowest value to green at the highest:

```json
{
  "sessionId": "sales",
  "operation": "add",
  "rule": {
    "sqref": [{ "firstRow": 1, "firstCol": 1, "lastRow": 4, "lastCol": 1 }],
    "type": 2,
    "colorScale": {
      "thresholds": [{ "type": 3 }, { "type": 4 }],
      "colors": [
        { "r": 255, "g": 255, "b": 255 },
        { "r": 99, "g": 190, "b": 123 }
      ]
    }
  }
}
```

Threshold `type` is 0 number, 1 percent, 2 percentile, 3 min, 4 max, 5 formula, 6 automatic min, 7 automatic max; number, percent, percentile, and formula thresholds put their value in `value` as a string. A color scale has two or three thresholds and the same number of colors. A data bar needs `min`, `max`, and `fill`. An icon set needs `name` (0 to 16) and one threshold fewer than its icon count: two for the three-icon sets, three for four icons, four for five. Colors are `{r, g, b}` from 0 to 255, with `a` optional.

### Order, list, and removal

Rules run in `priority` order, lowest first. An omitted `priority` places the new rule after the existing ones, and `stopIfTrue: true` stops lower-priority rules from applying to a cell that matched.

`operation: "list"` returns every rule on the sheet in that order under `result.items`, with its `id`, `type`, `priority`, `sqref`, `dxfId`, and type fields. To remove one rule, pass its position in that list:

```json
{
  "sessionId": "sales",
  "operation": "removeAt",
  "index": 1
}
```

Positions shift after each add or remove, so list again before a second `removeAt`. `operation: "clear"` removes every rule on the sheet.

### Check which cells match {#evaluate}

`operation: "evaluate"` runs every rule on the sheet over a rectangle and returns the matching cells without changing the workbook:

```json
{
  "sessionId": "sales",
  "operation": "evaluate",
  "firstRow": 1,
  "firstCol": 0,
  "lastRow": 4,
  "lastCol": 3
}
```

`result.cells` lists only cells with at least one match. Each match has `kind` (0 dxf style, 1 color scale, 2 data bar, 3 icon set) and `priority`. A dxf match carries `dxfId`, with `dxfIdEngaged: 1` when the rule names a style; a color-scale match carries the resolved `color`; a data bar carries its bar length and colors; an icon set carries `iconSetName` and `iconIndex`.

Date-period rules depend on today's date, and the evaluation uses the date given in `todaySerial`, an Excel date serial. Without `todaySerial`, no date-period rule matches. `0` is not "off": it is the serial for 1899-12-30, and date-period rules are evaluated against that day. To check a "last 7 days" rule as of 2026-10-13, pass that date's serial:

```json
{
  "sessionId": "sales",
  "operation": "evaluate",
  "firstRow": 1,
  "firstCol": 3,
  "lastRow": 4,
  "lastCol": 3,
  "todaySerial": 46308
}
```

`formulon_preview_range` does not draw conditional formatting, so `evaluate` is the way to confirm a rule before the file is opened in Excel.

## Data validation {#data-validation}

`validation.type` chooses what a cell may hold, and `op` with `formula1` and `formula2` sets the bounds:

| `type` | Allows | Bounds |
| --- | --- | --- |
| 0 | Anything | none |
| 1 | Whole numbers | `op`, `formula1`, `formula2` |
| 2 | Decimals | `op`, `formula1`, `formula2` |
| 3 | A value from a list | `formula1` |
| 4 | Dates | `op`, `formula1`, `formula2` |
| 5 | Times | `op`, `formula1`, `formula2` |
| 6 | Text of a given length | `op`, `formula1`, `formula2` |
| 7 | Values for which a formula is true | `formula1` |

The validation `op` is 0 between, 1 not between, 2 equal, 3 not equal, 4 greater than, 5 less than, 6 greater than or equal, 7 less than or equal. `formula2` is the upper bound for between and not between. When `op` is omitted it is 0, between.

### Dropdown list

`formula1` is either a quoted literal list, as in the worked example, or a reference to cells that hold the choices, such as `"$H$2:$H$5"`. Set `showDropDown: false` to keep the list check without showing the in-cell arrow.

### Number range

Amounts from 0 to 2,000, with an input prompt shown when the cell is selected:

```json
{
  "sessionId": "sales",
  "operation": "add",
  "validation": {
    "ranges": [{ "firstRow": 1, "firstCol": 1, "lastRow": 20, "lastCol": 1 }],
    "type": 2,
    "op": 0,
    "formula1": "0",
    "formula2": "2000",
    "allowBlank": true,
    "showInputMessage": true,
    "promptTitle": "Amount",
    "promptMessage": "Enter 0 to 2000.",
    "showErrorMessage": true
  }
}
```

### Custom formula

A custom rule accepts the entry when the formula is true. Relative references follow the top-left cell of the first range, and the formula has no leading `=`. This one keeps region names in `A2:A21` unique:

```json
{
  "sessionId": "sales",
  "operation": "add",
  "validation": {
    "ranges": [{ "firstRow": 1, "firstCol": 0, "lastRow": 20, "lastCol": 0 }],
    "type": 7,
    "formula1": "COUNTIF($A$2:$A$21,A2)=1",
    "allowBlank": true,
    "showErrorMessage": true,
    "errorMessage": "Each region appears once."
  }
}
```

### Messages

`errorStyle` decides what Excel does with a rejected entry: 0 stops it (the default), 1 warns, 2 informs. The error box appears only with `showErrorMessage: true`, and the input prompt only with `showInputMessage: true`; `errorTitle`, `errorMessage`, `promptTitle`, and `promptMessage` fill them in.

### List, remove, and check existing values

`operation: "list"` returns the sheet's rules under `result.items`, each with every field filled in. `removeAt` takes a position from that list, and `clear` removes all of them. A successful `add` returns a plain status, not an index, so list the rules when a position is needed.

Adding a rule does not change cells that already hold values. To find values that break a rule, call `listInvalidCells` through `formulon_workbook_call` with the sheet index:

```json
{
  "sessionId": "sales",
  "method": "listInvalidCells",
  "args": [0]
}
```

The result lists each failing cell with its row, column, and value, a page at a time; pass `result.nextCursor` as the second argument while it is not `null`. The call is read-only and leaves the session clean.

## Saving {#saving}

Rules and styles live in the session until `formulon_save_session` writes them. Save to `.xlsx`:

```json
{
  "sessionId": "sales",
  "outputPath": "out/sales-rules.xlsx"
}
```

The `.xlsx` file carries the rules, their dxf styles, and the validations. An `.xlsb` save also writes the rules and validations but reports `losses.deferredFeatures`, and when Formulon reopens that file the conditional formats no longer point at their styles. Use `.xlsx` for a workbook with conditional formatting, and read `losses` in the save response either way.

The full field lists are in the [tool reference](/mcp/tools#rich-workbook-objects). Discovery and the low-level call contract are in [Advanced API](/mcp/advanced).
