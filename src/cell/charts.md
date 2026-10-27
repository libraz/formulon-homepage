---
title: Charts | formulon-cell
description: Create, inspect, and style workbook charts with formulon-cell.
---

# Charts {#charts}

Formulon-cell stores chart data references with the workbook and renders a supported set of two-dimensional chart families. Chart settings remain part of the workbook when it is saved.

| Chart family | Useful for |
| --- | --- |
| Column or bar | Comparing values across categories |
| Line or area | Showing a sequence or trend |
| Pie or doughnut | Showing parts of a total |
| Scatter | Comparing paired numeric X and Y values |

## Try the chart UI

Open the demo, select `A1:C9` in its sample workbook, then choose a chart from the Insert ribbon. The selection includes a category column and two value series. The chart reads those cells again after recalculation. Use the chart header to inspect Elements, Styles, and Filters.

<ClientOnly>
  <CellFullDemo />
</ClientOnly>

The demo opens the spreadsheet in an overlay. For the chart data layout and host API, continue with this guide.

The UI supports column, bar, line, area, pie, doughnut, and scatter charts. Source changes appear after recalculation. Use Elements to change an existing chart's type; Recommended charts chooses a type from the selection shape. Charts can be moved, resized, and removed, and those edits support undo and redo.

Charts live in the workbook. Charts in a loaded XLSX file are shown and editable, and charts created or edited in the UI are saved with the workbook. Chart commands take the `WorkbookHandle` as `wb` and change nothing when the engine has no chart support, the sheet is protected, the host policy refuses the edit, or the engine rejects a step; they then return `null` (`false` or `0` from the delete helpers). Options left out of `createSessionChart` take the values Excel's chart template writes; an omitted `title` is Excel's automatic title, and `''` removes it.

A chart the module cannot draw appears as a placeholder showing its title: 3D, bubble, radar, stock, surface, and pie-of-pie charts, combination charts with more than one plot, and Excel's newer chart types such as waterfall and histogram. A placeholder can be moved, resized, and deleted, but its settings cannot be edited. A PivotChart's series and data range follow its PivotTable, so its series direction, series list, and filters are locked.

## Call chart commands from host code

The examples below assume a mounted `SpreadsheetInstance` named `instance`, with source data in its first sheet's `A1:C9`. Reuse the instance's workbook, store, and history so chart edits participate in the same UI and undo stack:

```ts
import {
  addSessionChartSeries, createSessionChart, removeSessionChartSeries
} from '@libraz/formulon-cell'

const { store, history, workbook: wb } = instance
const range = { sheet: 0, r0: 0, c0: 0, r1: 8, c1: 2 }
```

All range coordinates are zero-based and inclusive. A command may return `null` when the edit is refused; check the result before using a created chart's `id`.

### Changing chart type and doughnut charts

Changing the type or series direction reinterprets the source data for the draft's series, point, and filter controls. Apply commits the type and settings together as one undoable operation; Cancel leaves the chart unchanged. Settings the chosen type does not use, such as axes on a pie chart or hole size on a column chart, are not kept in the workbook chart. Implicit palette and legend defaults follow the chosen type without becoming explicit overrides.

Doughnut charts draw one concentric ring per visible series, with the first series on the inside. Each ring uses its own total for slice proportions and percentage labels. Series filters remove rings; category filters remove slices from every ring. `holeSize` accepts 10–90 percent, with a module default of 50. `firstSliceAngle` rotates all rings together. The center remains transparent, including single-slice rings. Doughnut labels use automatic placement at each slice's radial midpoint. Pie and doughnut charts have no axes. Automatic label placement reduces overlap, but small inner rings and large fonts can still overlap; increase the chart size or reduce the label font size.

```ts
createSessionChart(store, range, {
  wb,
  kind: 'doughnut',
  seriesDirection: 'columns',
  holeSize: 65,
  firstSliceAngle: 90,
  dataLabels: { visible: true, showPercentage: true },
}, history);
```

The hole-size range follows Excel's [DoughnutHoleSize](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.doughnutholesize) definition.

### Data and series

The engine splits the source range into categories and series following Excel's rules. Text headers supply series names or category labels. Use `headerRow` and `headerColumn` to explicitly include or exclude headers; this supports numeric year headers without treating ordinary numeric data as names. Series read the current cell values and are re-read after each recalculation.

Use `seriesDirection: 'columns'` for a table with categories down the first column and series across the remaining columns. Use `'rows'` for the transposed layout. The default `'auto'` reads columns when the table has more data rows than data columns, and rows otherwise, including on a tie or when a header row of dates sits beside a header column. Single rows and columns produce one series by default. Explicit direction avoids ambiguity when a table's shape does not match its intended layout.

For example, with direction set to columns, this table produces the categories January and February, and the series Sales and Costs:

| Month | Sales | Costs |
| --- | --- | --- |
| January | 10 | 6 |
| February | 15 | 8 |

Scatter charts take the first column (the first row when reading rows) as shared X values and each remaining column as a Y series. `headerRow` controls series headers in column orientation, and `headerColumn` controls them in row orientation. X values of 1, 10, and 100 have proportional spacing. When the source has no X column, points are placed at 1, 2, 3, and so on. Pie charts use the first series and size slices by absolute magnitudes.

### Chart options

Pass chart options to `createSessionChart(store, range, options, history)` or as the patch of `updateSessionChart(store, id, patch, history, wb)`; a patch can also carry `source` to re-split the series from another range and `anchor` to move or resize the chart. `kind` selects the family. `grouping` selects `'clustered'`, `'stacked'`, or `'percent-stacked'` for column, bar, line, and area charts. Pie, doughnut, and scatter ignore grouping. Positive and negative values stack independently; percent stacks normalize each sign separately.

`scatterStyle` selects `'marker'` (the default), `'line'`, or `'lineMarker'`. Elements exposes these as Markers, Straight lines, and Straight lines with markers. Connecting lines follow source order after filtering; X values are not sorted. Each segment is clipped to the plot, including a crossing segment whose endpoints are both outside the axis bounds. Series line settings control color, width, transparency, and dash; width 0 hides the connector. Explicit series and point marker visibility overrides the subtype default. Point line settings still style marker borders. The three modes follow Microsoft's [scatter style definitions](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/eb0dca58-7fcf-45be-88cd-b3b50aa91020); a series with `smooth: true` in `seriesStyles` draws Excel's smoothed line, shown in Styles as Smoothed line.

Ordinary stacked totals outside JavaScript's finite numeric range are clipped at `±Number.MAX_VALUE`. Percent stacks normalize before summing to preserve ratios for large finite inputs.

`emptyCells` selects `'gap'`, `'zero'`, or `'span'`. Standard line charts support all three modes: gaps break lines, zero plots missing cells at zero, and span connects available points. Stacked and percent-stacked line and area charts always use zero, as specified by Office's blank-cell rules. Standard area, bar, column, pie, and doughnut charts fall back to gap when span is requested. Scatter charts map missing coordinates to zero in zero mode. With connecting lines, gap breaks at an incomplete point and span connects the surrounding valid points. Marker-only scatter charts treat span as gap. Non-finite coordinates are always omitted and break connecting lines.

`gapWidth` sets the gap between bar or column clusters as a percentage of one bar's width, from 0 to 500 (default 150). `overlap` sets the overlap between clustered series, from -100 (one bar-width gap) through 0 (touching bars) to 100 (coincident bars). Stacked series share one slot. `firstSliceAngle` rotates the starting boundary of pie and doughnut charts clockwise from 12 o'clock, from 0 to 360 degrees. Finite values outside these ranges are clamped; non-finite options use the defaults.

Pie slice sizes use the absolute magnitudes of finite values from the first series; zero and missing values have no slice. Magnitudes are normalized before summing so large finite values retain their proportions.

`palette` supplies series colors. `legend` controls visibility and position. `xAxis` and `yAxis` accept titles and numeric bounds; categorical axes use category labels. The renderer supplies tick marks and gridlines.

### Axes and chart options

Elements lets you change grouping, series direction, and empty-cell handling. Styles also exposes bar gap width, clustered-series overlap, the starting angle for pie and doughnut charts, and doughnut hole size. Controls are enabled for the chart families that use them.

Each axis has visibility, title, and Reverse order settings. Numeric axes also accept minimum and maximum bounds, a positive `majorUnit`, a `numberFormat`, and `majorGridlines`. The numeric axis is X for bar charts, Y for column, line, and area charts, and both X and Y for scatter charts. Pie and doughnut charts have no axes. Clear a bound or major unit in the form to restore automatic scaling. Category axes retain their category labels and ignore numeric scale settings.

`visible: false` hides an axis line, labels, and title. Gridline visibility is independent. Explicit major units start at the effective minimum: a domain of 3–13 with a unit of 5 produces 3, 8, and 13. Very small intervals are thinned to bound the number of rendered ticks. Crowded numeric labels are thinned independently of gridlines. Without an explicit number format, existing automatic tick formatting is retained, including percentages for 100% stacks. With a format code, axis labels use the same locale and formatter callback as data labels. See Excel's [major unit](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.majorunit) and [tick-label number format](https://learn.microsoft.com/en-us/office/vba/api/excel.ticklabels.numberformat) definitions.

`reverseOrder: true` reverses one physical axis: `xAxis` is horizontal and `yAxis` is vertical, including on bar charts. Category reversal changes the category bands while retaining the series order within each cluster. Values, source IDs, filters, and point styles retain their original associations. Numeric bounds and tick values remain ascending in the model. The module keeps its existing bar default, with the first category at the top; reversing Y places it at the bottom. By default, tick labels and titles keep their bottom/left gutters, and category reversal does not move the perpendicular axis automatically. The option corresponds to Excel's [ReversePlotOrder](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.reverseplotorder) setting.

`crossing` specifies where the perpendicular axis crosses this axis. Set `xAxis.crossing` to move the vertical axis, or `yAxis.crossing` to move the horizontal axis. The form offers Auto, Minimum, Maximum, and Custom. Numeric axes accept `'min'`, `'max'`, or a finite value clamped to the resolved domain; axis reversal also reverses these positions. Undefined and `'auto'` keep the existing automatic position. Invalid runtime values use automatic positioning.

Category axes use the module's between-category layout: `'min'` is before the first visible category, `'max'` is after the last, and a custom number selects the leading edge of a visible category. Custom numbers are rounded and clamped to the visible 1-based category count. Explicit positions follow category reversal; automatic positions retain the left edge for column, line, and area charts and the bottom edge for bar charts. Crossing moves axis lines; labels using `labelPosition: 'nextTo'` follow those lines. Other label positions, titles, gridlines, plot margins, and the zero baselines used by data marks stay in place. The property combines Excel's [Crosses](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.crosses) and [CrossesAt](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.crossesat) concepts.

`labelPosition` controls numeric tick labels and category labels on each physical axis. `'low'` places X labels below the plot and Y labels to its left; `'high'` places them above and to the right. These sides stay fixed when values or categories are reversed. `'nextTo'` follows that axis's actual line, including a crossing set on the perpendicular axis. In this module, adjacent labels sit below a horizontal line or left of a vertical line. `'none'` hides labels while retaining the axis line, title, and gridlines. Omitted or invalid values keep the existing low placement; the form's Automatic option removes the override.

High labels reserve space beside a top title or legend and before a right legend. Axis titles retain their bottom/left positions. Other label modes retain the existing plot gutters, including None. Long numeric labels and high-side category labels may be shortened, with their full text in `aria-label`. Adjacent labels can overlap data inside the plot. The choices correspond to Excel's [tick-label positions](https://learn.microsoft.com/en-us/office/vba/api/excel.xlticklabelposition).

A finite `logBase` from 2 through 1000 enables a logarithmic numeric axis. The form's Logarithmic scale checkbox starts at base 10; Log base changes the base, and clearing the checkbox removes the override. Bar charts use X, column/line/area charts use Y, and scatter charts accept both axes independently. This implementation applies log scales to clustered category charts and scatter charts. Stacked and 100% stacked charts keep the option without using it; category axes ignore it.

Log axes plot finite positive values. Zero and negative values do not produce marks or data labels; they break line runs even when empty-cell handling is Span. Positive scatter pairs must be valid on both axes. Connectors are clipped after converting the eligible coordinates and bounds to logarithmic space. Source IDs, filters, point styles, and displayed data values keep their original associations.

Automatic bounds expand positive data to powers of the base; empty positive data uses 1–base. Finite positive explicit bounds override automatic bounds when they form a usable interval; equal or unusable extreme bounds are widened to a finite positive range. Nonpositive bounds are ignored. Major ticks use powers of the base and are thinned for extreme ranges. `majorUnit` remains stored for linear mode and is disabled in the log form. Automatic crossing uses 1 clamped to the domain; nonpositive custom crossings also use that automatic position. Bars and area fills use the positive domain minimum as their baseline. Invalid log bases fall back to linear rendering. See Excel's [LogBase property](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.logbase) and [value-axis scale settings](https://support.microsoft.com/en-us/office/change-the-scale-of-the-vertical-value-axis-in-a-chart).

### Filters, labels, and colors

The chart header opens Elements, Styles, or Filters. Changes stay in a draft until Apply; Cancel or Escape discards them. Apply records one undoable operation. The form keeps its draft during chart redraws and language changes, and becomes read-only when the sheet or host policy prevents chart editing.

Filters show or hide series and categories without editing the source cells. `filter.hiddenSeriesIds` contains series IDs; `filter.hiddenCategoryIds` contains category or XY point IDs. Workbook series are `series-0`, `series-1`, and so on, numbered by the index the chart stores for each series. Categories are `category-0`, `category-1`, and XY points `point-0`, `point-1`. Direct chart data can supply `categoryIds` or point `id` values. Hidden data is excluded from axes, legends, stacks, and percentage totals. Remaining points retain their original IDs, indexes, and palette colors.

`dataLabels` controls visibility, series/category names, values, percentages, legend keys, separators, position, number format, text color, and font size. Percentage labels are available for pie, doughnut, and percent-stacked charts. Scatter category labels display the X value; value labels display Y. Supported positions and defaults depend on the chart family and grouping, following [Office's data-label position rules](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/e2b1697c-7adc-463d-9081-3daef72f656f). Area and doughnut labels use their automatic center position. Labels preserve their complete text in `aria-label` when displayed text is shortened.

Styles supplies palette presets and custom colors. `varyColors` assigns palette colors to individual points; pie and doughnut charts enable it by default. `seriesStyles` targets a `seriesId`, with optional `points` overrides keyed by `pointId`. Fill and line settings include color and transparency (0–100%). Lines also accept width and dash style; markers accept visibility, shape, size, fill, and line settings. A series' own `dataLabels` overrides the chart-wide labels. Point overrides take precedence over inherited series settings. Series legend swatches use series styles; pie and doughnut legend swatches use point styles from the first visible series.

```ts
createSessionChart(store, range, {
  wb,
  kind: 'column',
  filter: { hiddenSeriesIds: ['series-1'] },
  yAxis: { min: 0, max: 100, majorUnit: 20, numberFormat: '0.0', majorGridlines: true },
  dataLabels: { visible: true, showValue: true, numberFormat: '#,##0.00' },
  seriesStyles: [{
    seriesId: 'series-0',
    fill: { color: '#4472c4' },
    points: [{ pointId: 'category-2', fill: { color: '#ed7d31' } }],
  }],
}, history);
```

These settings are saved with the workbook. `palette` is written as each series' own color, so a chart read back from the workbook reports its colors in `seriesStyles` rather than `palette`. Both framework adapters use the same commands and settings UI.

### Adding and removing series

In Styles, Add series opens a form for the series name, values, and axis labels as cell references; scatter charts ask for Y and X values instead. Only the values are required. Remove series deletes the selected series. Both change the workbook chart immediately as their own undo step, without waiting for Apply. They are unavailable while the draft changes the chart type or series direction, and a chart keeps at least one series.

`addSessionChartSeries` and `removeSessionChartSeries` do the same from host code. Each range may be on any sheet. Both return the updated chart, or `null` when the chart is a placeholder, the edit is refused, or the engine rejects the references; removing the last series also returns `null`. The React and Vue packages re-export both.

```ts
// chart is a non-null result from createSessionChart().
// nameCell, valueRange, and labelRange are Range objects like range above.
addSessionChartSeries(store, chart.id, {
  name: nameCell,        // optional
  values: valueRange,    // Y values on a scatter chart
  categories: labelRange // optional; scatter charts take `x` instead
}, history, wb);

removeSessionChartSeries(store, chart.id, 'series-1', history, wb);
```

### Using the chart module separately

Import `layoutChart`, `layoutUnsupportedChart`, the value-formatting and scale helpers, and the chart types from `@libraz/formulon-cell/charts`. This entry point has no spreadsheet store, calculation engine, React, Vue, or browser dependency.

`layoutChart({ spec, data, width, height })` takes category or XY chart data and a `ChartSpec`. It returns a scene of SVG-compatible elements with attributes, text, and series/point identifiers. The optional `accents` supplies the theme colors used for automatic series colors. `layoutUnsupportedChart` draws the placeholder frame used for charts the module cannot draw.

`layoutChart` also accepts `locale` and a `formatValue(value, formatCode, locale)` callback. The standalone formatter supports General and common decimal, grouped, and percent codes; null or undefined callback results fall back to it. The session UI uses the spreadsheet number formatter for custom Excel format codes. Keeping the formatter outside `ChartSpec` makes settings JSON-compatible and keeps the chart module independent of the engine.

The engine owns the chart model and what is saved. The spreadsheet layer maps it to `ChartSpec` and owns protection, history, and object placement. The DOM layer maps the scene elements to SVG and owns interactions.

### Excel compatibility

The implemented scope is the seven 2D families listed above, category and series interpretation, numeric scatter axes, grouping, missing-value modes, series and category filters, data labels, and series and point styles. Date axes are drawn as category axes, and trendlines are not drawn. 3D charts, combination charts, and the additional Excel families such as stock, surface, radar, and statistical charts appear as placeholders. Pixel-identical Excel rendering is not guaranteed.

Data arrangement follows [Microsoft's chart creation guide](https://support.microsoft.com/en-us/excel/get-started/create-a-chart-from-start-to-finish?ad=us&rs=en-us&ui=en-us). Blank-cell rules follow [Display Blanks As](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/b5c5c694-21d9-437c-9a4a-21e0e843eed8). Geometry options follow Excel's definitions of [GapWidth](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.gapwidth), [Overlap](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.overlap), and [FirstSliceAngle](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.firstsliceangle).

## Read next

- [Workbook chart model](/workbook/charts) — the data the engine stores and how it reads series from cells.
- [API surface](/cell/api) — chart commands and the rest of the host API.
- [Embedding](/cell/embedding) — choose options for a full, minimal, or embedded sheet.

