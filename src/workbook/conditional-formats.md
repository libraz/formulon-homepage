# Conditional Formats

Formulon stores conditional-format rules on a worksheet, evaluates them on request, and saves them with the workbook. The engine does not paint cells. `evaluateCfRange()` tells the host which rules matched each cell and what to draw; the host combines that with the cell's own style.

::: info Glossary: conditional-format rule
A rule applies to one or more ranges (its `sqref`) and has a type, a condition, and a priority. A style rule (a value comparison, a formula, a top-N or text test, and so on) points at a *differential format*: a partial style stored in the workbook's `dxf` table, such as a fill or a font colour, that is laid over the cell's style where the rule matches. A visual rule (color scale, data bar, icon set) carries its own colours and thresholds instead. Rules never change the cell's stored style.
:::

## Highlight values above a threshold

Register the fill with `addDxf()`, then add a `cellIs` rule that points at it. The example marks values in `A1:A4` that are greater than 70.

::: code-group

```js [JavaScript]
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
const check = (result) => {
  const status = 'ok' in result ? result : result.status
  if (!status.ok) throw new Error(status.message)
  return result
}
try {
  ;[40, 75, 90, 60].forEach((value, row) => check(wb.setNumber(0, row, 0, value)))

  // Light red fill. Set both colours: Excel paints a solid dxf fill with bgColor.
  const red = 0xffffc7ce
  const dxfId = check(wb.addDxf({ fill: { pattern: 1, fgArgb: red, bgArgb: red } })).index

  check(wb.addConditionalFormat(0, {
    sqref: [{ firstRow: 0, firstCol: 0, lastRow: 3, lastCol: 0 }], // A1:A4
    type: 1, // cellIs
    op: 5, // greater than
    formula1: '70',
    dxfId,
  }))

  const hits = check(wb.evaluateCfRange(0, 0, 0, 3, 0, NaN))
  for (const cell of hits.cells) console.log(cell.row, cell.matches[0].dxfId)
  // 1 0
  // 2 0
} finally {
  wb.delete()
}
```

```python [Python]
from formulon import ConditionalFormatInput, DifferentialFormat, FillRecord, MergeRange, Workbook

with Workbook.create_default() as wb:
    for row, value in enumerate([40, 75, 90, 60]):
        wb.set_number(0, row, 0, value)

    # Light red fill. Set both colours: Excel paints a solid dxf fill with bgColor.
    red = 0xFFFFC7CE
    dxf_id = wb.add_dxf(DifferentialFormat(fill=FillRecord(pattern=1, fg_argb=red, bg_argb=red)))

    wb.add_conditional_format(0, ConditionalFormatInput(
        sqref=[MergeRange(0, 0, 3, 0)],  # A1:A4
        type=1,  # cellIs
        op=5,  # greater than
        formula1="70",
        dxf_id=dxf_id,
    ))

    for cell in wb.evaluate_cf_range(0, 0, 0, 3, 0):
        print(cell.row, cell.matches[0].dxf_id)
    # 1 0
    # 2 0
```

:::

Native Node (`@libraz/formulon-native`) has the same methods as the WASM package. In Python's `ConditionalFormatInput`, `dxf_id`, `op`, `rank`, `std_dev`, and `time_period` are `Optional`: a value that is not `None` is stored, and `None` leaves the field out. `ConditionalFormat.op`, `rank`, `std_dev`, and `time_period` are `None` when the rule does not state them, so a rule read back can be passed to `add_conditional_format` unchanged. A `cellIs` rule with no operator never matches, and a rule with no `dxfId` matches without a format to apply.

## Differential formats

`addDxf()` / `add_dxf()` appends a record to the workbook's `dxf` table and returns its index, which is the rule's `dxfId`. A record holds any of `font`, `fill`, `border`, and `numFmt` (Python: `font`, `fill`, `border`, `num_fmt_id` / `num_fmt_code`); a part left out does not change that aspect of the cell. Several rules can share one record. `getDxf()` / `get_dxf()` reads a record back and `dxfCount()` / `dxf_count()` returns the table size.

For a fill, use `pattern: 1` (solid) and give `bgArgb` the colour as well as `fgArgb`: Excel draws a solid differential fill from its background colour. For a font, set only the fields to change, such as `bold` with `hasBold: true`, or `colorArgb`. A differential font carries `<sz>` only when `hasSize` is true. In JavaScript, leaving `size` out implies `hasSize: false`; in Python pass `has_size=False` for a font without a size. A font without one leaves the cell's size unchanged, whereas a font with `size` saves it with the record, so then keep the default 11 or set it to the body font size.

## Rule types and operators

`type` is an ordinal. Each type reads only some of the input fields:

| `type` | Rule | Fields |
| --- | --- | --- |
| `0` | Expression | `formula1` |
| `1` | Cell value (`cellIs`) | `op`, `formula1`, `formula2` for between |
| `2` | Color scale | `colorScale` |
| `3` | Data bar | `dataBar` |
| `4` | Icon set | `iconSet` |
| `5` | Top / bottom N | `rank`, `percent`, `bottom` |
| `6` | Above / below average | `aboveAverage`, `equalAverage`, `stdDev` |
| `7`–`10` | Contains, not contains, begins with, ends with | `text` |
| `11`–`14` | Blanks, no blanks, errors, no errors | none |
| `15` | Time period | `timePeriod` |
| `16`, `17` | Duplicate values, unique values | none |

The `cellIs` operator `op` counts `0` less than, `1` less than or equal, `2` equal, `3` not equal, `4` greater than or equal, `5` greater than, `6` between, `7` not between. This order differs from the data-validation `op`. A between rule accepts its bounds in either order.

`timePeriod` counts `0` today, `1` yesterday, `2` tomorrow, `3` last 7 days, `4` this week, `5` last week, `6` next week, `7` this month, `8` last month, `9` next month.

Formula text is stored without a leading `=`, and `formula1` / `formula2` and formula-typed thresholds read back in that form (`$B1>100`, not `=$B1>100`). A formula that starts with `==` is rejected. An expression is written for the top-left cell of the bounding box of all the rule's ranges and shifts for the others, so `formula1: '$B1>100'` over `A1:C10` tests column B of each row. A non-empty formula, or a formula-typed threshold, that does not parse is rejected with `kParserUnexpectedToken` (1000). Text, blanks, errors, and time-period rules added without a formula get the formula Excel stores for them, anchored at the same cell, and `formula1` reads it back. A contains rule matches like `SEARCH`, wildcards included, and begins-with and ends-with rules compare under the active profile's [collation](/compatibility/text-collation). To check what a predicate returns at one cell without adding a rule, use `evaluateConditionalFormula()` (see [Ad-hoc formula evaluation](/workbook/operations#ad-hoc-formula-evaluation)).

`priority` orders rules across the sheet: a lower number is evaluated first. When it is omitted or not positive, the new rule goes after every existing rule. With `stopIfTrue`, a match stops evaluation of lower-priority rules for that cell.

## Evaluate a range

`evaluateCfRange(sheet, firstRow, firstCol, lastRow, lastCol, todaySerial)` / `evaluate_cf_range(...)` evaluates every rule on the sheet against the inclusive rectangle. It does not change the workbook. The result lists only cells that matched at least one rule, each with its matches in priority order:

| `kind` | Match | Fields to read |
| --- | --- | --- |
| `0` | Differential format | `dxfIdEngaged`, `dxfId` |
| `1` | Color scale | `color` (RGBA) |
| `2` | Data bar | `barLengthPct`, `barAxisPositionPct`, `barIsNegative`, `barFill`, `barBorderEngaged`, `barBorder`, `barGradient`, `barDirection` |
| `3` | Icon set | `iconSetName`, `iconIndex` |

The JavaScript packages export these values as `CfMatchKind`. Python uses the snake-case field names and returns colours as `(r, g, b, a)` tuples.

`todaySerial` is the date that time-period rules compare against, as an Excel serial. `NaN` switches those rules off, so none of them match; this is the Python default. `0` does not switch them off: it is the serial for 1899-12-30, and the rules compare against that date. To use the current local date:

::: code-group

```js [JavaScript]
const today = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000) + 25569
const hits = wb.evaluateCfRange(0, 0, 0, 99, 9, today)
```

```python [Python]
from datetime import date

today = (date.today() - date(1899, 12, 30)).days
hits = wb.evaluate_cf_range(0, 0, 0, 99, 9, today_serial=today)
```

:::

`getEffectiveStyle()` does not include conditional formatting. A host that renders cells applies the matched differential format over the effective style itself.

## Color scales, data bars, and icon sets

Visual rules position a cell between thresholds. Each threshold is a value object with a `type` (`0` number, `1` percent, `2` percentile, `3` lowest value, `4` highest value, `5` formula, `6` automatic minimum, `7` automatic maximum), a `value` string where the type needs one, and `gte`. Colours are `{ r, g, b, a }` with 0–255 channels; Python's `CfColor(r, g, b)` defaults `a` to 255.

::: code-group

```js [JavaScript]
import createFormulon, { CfMatchKind } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
const check = (result) => {
  const status = 'ok' in result ? result : result.status
  if (!status.ok) throw new Error(status.message)
  return result
}
try {
  ;[10, 40, 70, 100].forEach((value, row) => check(wb.setNumber(0, row, 0, value)))
  const sqref = [{ firstRow: 0, firstCol: 0, lastRow: 3, lastCol: 0 }]
  const min = { type: 3 }
  const max = { type: 4 }

  check(wb.addConditionalFormat(0, {
    sqref, type: 2, // colorScale
    colorScale: { thresholds: [min, max], colors: [{ r: 248, g: 105, b: 107, a: 255 }, { r: 99, g: 190, b: 123, a: 255 }] },
  }))
  check(wb.addConditionalFormat(0, {
    sqref, type: 3, // dataBar
    dataBar: { min, max, fill: { r: 99, g: 142, b: 198, a: 255 }, direction: 1 },
  }))
  check(wb.addConditionalFormat(0, {
    sqref, type: 4, // iconSet
    iconSet: { name: 0, thresholds: [{ type: 1, value: '33' }, { type: 1, value: '67' }] }, // 3Arrows
  }))

  for (const cell of check(wb.evaluateCfRange(0, 0, 0, 3, 0, NaN)).cells) {
    const parts = cell.matches.map((m) => {
      if (m.kind === CfMatchKind.ColorScale) return `rgb(${m.color.r},${m.color.g},${m.color.b})`
      if (m.kind === CfMatchKind.DataBar) return `bar ${m.barLengthPct.toFixed(1)}%`
      return `icon ${m.iconIndex}`
    })
    console.log(cell.row, parts.join(' | '))
  }
  // 0 rgb(248,105,107) | bar 10.0% | icon 0
  // 1 rgb(198,133,112) | bar 36.7% | icon 1
  // 2 rgb(149,162,118) | bar 63.3% | icon 1
  // 3 rgb(99,190,123) | bar 90.0% | icon 2
} finally {
  wb.delete()
}
```

```python [Python]
from formulon import (CfColor, CfValueObject, ColorScale, ConditionalFormatInput, DataBar, IconSet,
                      MergeRange, Workbook)

with Workbook.create_default() as wb:
    for row, value in enumerate([10, 40, 70, 100]):
        wb.set_number(0, row, 0, value)
    sqref = [MergeRange(0, 0, 3, 0)]
    low, high = CfValueObject(3), CfValueObject(4)  # min, max

    wb.add_conditional_format(0, ConditionalFormatInput(
        sqref=sqref, type=2,
        color_scale=ColorScale([low, high], [CfColor(248, 105, 107), CfColor(99, 190, 123)]),
    ))
    wb.add_conditional_format(0, ConditionalFormatInput(
        sqref=sqref, type=3,
        data_bar=DataBar(minimum=low, maximum=high, fill=CfColor(99, 142, 198), direction=1),
    ))
    wb.add_conditional_format(0, ConditionalFormatInput(
        sqref=sqref, type=4,
        icon_set=IconSet(name=0, thresholds=[CfValueObject(1, "33"), CfValueObject(1, "67")]),
    ))

    for cell in wb.evaluate_cf_range(0, 0, 0, 3, 0):
        color, bar, icon = cell.matches
        print(cell.row, color.color[:3], round(bar.bar_length_pct, 1), icon.icon_index)
    # 0 (248, 105, 107) 10.0 0
    # 1 (198, 133, 112) 36.7 1
    # 2 (149, 162, 118) 63.3 1
    # 3 (99, 190, 123) 90.0 2
```

:::

A **color scale** takes two or three thresholds and the same number of colours. The match reports the interpolated `color`.

A **data bar** takes `min`, `max`, and `fill` (Python: `minimum`, `maximum`, `fill`), plus `showValue` and `minLengthPct` / `maxLengthPct` (defaults 10 and 90). It also carries the `x14` extension settings: `gradient`, `axisPosition` (`0` automatic, `1` middle, `2` none), `negativeFill`, `border`, `negativeBorder`, `axisColor`, and `direction` (`0` follows the sheet's reading direction, `1` left to right, `2` right to left). Omitted values use the model defaults: gradient fill, automatic axis, the positive fill for negative values, no border, and a black axis. The match gives the bar's length and axis position as percentages of the cell width, stated from the left edge; `barIsNegative` marks a negative value. The host mirrors the bar for a right-to-left rule, and for a `0` rule on a right-to-left sheet.

An **icon set** takes `name`, the icon set ordinal, and exactly N−1 `thresholds` between the buckets of an N-icon set; `Three_Arrows` (`0`) takes two. Adding a rule with any other count is rejected with `kInvalidArgument`, and evaluation ignores thresholds past N−1 in a loaded rule. The ordinals follow the OOXML names: `0` 3Arrows, `1` 3ArrowsGray, `2` 3Flags, `3` 3TrafficLights1, `4` 3TrafficLights2, `5` 3Signs, `6` 3Symbols, `7` 3Symbols2, `8` 4Arrows, `9` 4ArrowsGray, `10` 4RedToBlack, `11` 4Rating, `12` 4TrafficLights, `13` 5Arrows, `14` 5ArrowsGray, `15` 5Rating, `16` 5Quarters. `floor` is the lower bound of the lowest bucket and defaults to `percent 0`; a value below it gets no icon and no match. `iconIndex` counts from `0` for the lowest bucket, and `reverse` flips it. The `percent` flag is kept for round-trip only; each threshold's own `type` decides how it is read.

## Read back and remove rules

`getConditionalFormats(sheet)` / `get_conditional_formats(sheet)` returns every rule on the sheet in one flattened list, in priority order. Python also has `cf_count()` and `get_conditional_format_at()`. `addConditionalFormat()` returns the new rule's position in that list. `removeConditionalFormatAt(sheet, index)` removes one rule, and `clearConditionalFormats(sheet)` removes all of them. Adding or removing a rule renumbers the list, so read it again before using an index.

In JavaScript, a rule read back can be passed to `addConditionalFormat()` unchanged, visual payloads included. Python returns a `ConditionalFormat`, which is not a `ConditionalFormatInput`; copy its fields into a new input to re-add it.

## Saving and loading

Rules are saved in both `.xlsx` and `.xlsb`, with the differential formats they use, data-bar `x14` settings, icon-set floors, and the theme or indexed colours of a loaded rule. A rule edited after load is written from the model. Inserting or deleting rows and columns moves rule ranges and formulas.

::: code-group

```js [JavaScript]
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const check = (result) => {
  const status = 'ok' in result ? result : result.status
  if (!status.ok) throw new Error(status.message)
  return result
}
const wb = Module.Workbook.createDefault()
let bytes
try {
  const fill = { pattern: 1, fgArgb: 0xffc6efce, bgArgb: 0xffc6efce }
  const dxfId = check(wb.addDxf({ fill })).index
  const sqref = [{ firstRow: 0, firstCol: 0, lastRow: 9, lastCol: 0 }]
  check(wb.addConditionalFormat(0, { sqref, type: 15, timePeriod: 0, dxfId })) // today
  check(wb.addConditionalFormat(0, { sqref, type: 16, dxfId })) // duplicate values
  bytes = check(wb.save()).bytes
} finally {
  wb.delete()
}

const loaded = Module.Workbook.loadBytes(bytes)
try {
  const rules = check(loaded.getConditionalFormats(0))
  console.log(rules.map((r) => `${r.type}:${r.priority}:${r.dxfId}`)) // [ '15:1:0', '16:2:0' ]
  console.log(check(loaded.getDxf(rules[0].dxfId)).fill.bgArgb.toString(16)) // ffc6efce

  check(loaded.removeConditionalFormatAt(0, 0))
  console.log(check(loaded.getConditionalFormats(0)).map((r) => r.type)) // [ 16 ]
  check(loaded.clearConditionalFormats(0))
} finally {
  loaded.delete()
}
```

```python [Python]
from formulon import ConditionalFormatInput, DifferentialFormat, FillRecord, MergeRange, Workbook

with Workbook.create_default() as wb:
    green = 0xFFC6EFCE
    dxf_id = wb.add_dxf(DifferentialFormat(fill=FillRecord(pattern=1, fg_argb=green, bg_argb=green)))
    sqref = [MergeRange(0, 0, 9, 0)]
    wb.add_conditional_format(0, ConditionalFormatInput(  # today
        sqref=sqref, type=15, time_period=0,
        dxf_id=dxf_id,
    ))
    wb.add_conditional_format(0, ConditionalFormatInput(  # duplicate values
        sqref=sqref, type=16, dxf_id=dxf_id,
    ))
    data = wb.save()

with Workbook.load(data) as loaded:
    rules = loaded.get_conditional_formats(0)
    print([(r.type, r.priority, r.dxf_id) for r in rules])  # [(15, 1, 0), (16, 2, 0)]
    print(hex(loaded.get_dxf(rules[0].dxf_id).fill.bg_argb))  # 0xffc6efce

    loaded.remove_conditional_format_at(0, 0)
    print([r.type for r in loaded.get_conditional_formats(0)])  # [16]
    loaded.clear_conditional_formats(0)
```

:::

See [File formats](/workbook/file-formats) for what each container keeps.

## Read next

- [Workbook operations](/workbook/operations) — styles, validation, and the other per-sheet structures.
- [Presentation and geometry](/workbook/presentation) — effective styles and display text.
- [Filters and validation](/workbook/filters-validation) — the data-validation rule model.
