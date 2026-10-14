# Charts

A chart is a drawing object on a sheet. Formulon reads charts from Excel-saved workbooks, creates new ones from a cell range, edits their typed properties, and resolves their series against the current cell values. It does not render charts; the data and structure API is meant for a viewer, an editor UI, or a script that needs to know what a chart plots.

Charts in an Excel-saved `.xlsx` or `.xlsb` load. A chart you do not edit is saved byte-for-byte, so opening and saving a workbook never alters its charts.

A workbook loaded from `.xlsb` keeps its charts readable but not editable: `insertChart` and the edit methods report `kIoDrawingUnparseable`, as retained XLSB drawings do for pictures. Charts of the extended chart family (`isChartex`) are read-only, and a PivotChart accepts only the edits that do not change its series, such as appearance and title.

## Addressing a chart

A chart is addressed as `(sheet, objectId)`. `listDrawingObjects(sheet)` reports every anchored object; a chart is the entry whose kind is `DrawingObjectKind.Chart`, and its `objectId` is the id every chart method takes. `insertChart` returns the id of a new chart.

Moving, resizing, restacking, snapshotting and removing a chart use the drawing methods that also cover pictures: `setDrawingAnchor`, `setDrawingZOrder`, `snapshotDrawing`, `restoreDrawing`, and `removeDrawing`. See [Comments and images](/workbook/comments-images#drawing-anchors).

Within a chart, a plot group is addressed by its index in `plots`, a series by its `idx` (the `c:idx` value, stable across edits), and an axis by its `id`.

## Reading a chart

| Method | Returns |
| --- | --- |
| `getChart(sheet, objectId)` | `{ status, chart }`: the typed view of the chart |
| `getChartData(sheet, objectId)` | `{ status, data }`: series resolved against the current cell values |
| `previewChartData(sheet, objectId, overrides)` | `{ status, data }`: the same, as if `overrides` were applied; the workbook is unchanged |

`chart` carries the name, description, title, legend, `blanksAs`, `plotVisibleOnly`, `plots`, `axes`, hidden categories, and `source`. `source` is the rectangle every series was split from, or `null` when the series do not share one. Each plot has its type, grouping, and per-series references, fill, line, marker, data points and data labels. A chart type outside the seven creatable kinds, such as radar, stock or surface, is still readable: `ChartPlotType` covers every plot group, and `isChartex`, `isPivotChart` and `onChartsheet` tell the special forms apart.

`data` resolves each series into numbers by Excel's rules. `domain` is `category` or `xy`; `categories` holds the labels, `series` holds `values` with one `states` entry per point (`Value`, `Gap` or `Connect`, from `ChartPointState`), and `unresolved` lists references that did not resolve. `previewChartData` accepts `source`, `direction`, `headerRow`, `headerColumn`, `blanksAs` and `plotVisibleOnly`, so an editor can show what a different source range would plot before committing it.

## Creating a chart

`insertChart(sheet, options)` builds a chart over an A1 rectangle and returns `{ status, objectId }`. The kind is one of the seven creatable `ChartInsertKind` values: `Column`, `Bar`, `Line`, `Area`, `Pie`, `Scatter` and `Doughnut`.

| Option | Meaning |
| --- | --- |
| `kind`, `source` | Required. `source` is sheet-qualified or on `sheet`. |
| `grouping` | `Clustered`, `Stacked`, `PercentStacked` or `Standard`; applies to column, bar, line and area. |
| `direction` | `Columns`, `Rows` or `Auto`, which follows Excel. |
| `headerRow`, `headerColumn` | Omitted follows Excel's header detection. |
| `title` | Omitted gives Excel's automatic title; an empty string gives no title. |
| `legend` | A `ChartLegendPosition`. The default is `Bottom`; `None` omits the legend. |
| `name`, `description` | Object name and alternative text. |
| `placement` | An anchor as for `insertImage`. The default is a two-cell anchor, and a zero `widthEmu` or `heightEmu` means Excel's default frame. |

The new chart has its series caches filled from the cells it reads.

## Editing a chart

Every edit returns a `Status`, except `addChartSeries`, which returns `{ status, seriesIdx }`.

| Method | Edits |
| --- | --- |
| `setChartType(sheet, objectId, plot, kind, grouping?)` | Replaces a plot group's type, keeping each series' references, idx, order and explicit colors. |
| `setChartTitle(sheet, objectId, title)` | Sets the title text; `null` removes it. |
| `setChartLegend(sheet, objectId, position, overlay, hiddenSeries?)` | Position (`None` removes the legend), overlay, and the hidden legend entries. |
| `setChartAxis(sheet, objectId, axisId, patch)` | Visibility, title, `min`, `max`, `majorUnit`, `numberFormat`, `majorGridlines`, `reversed`, `logBase`, `crosses` with `crossesAt`, and `tickLabelPosition`. |
| `setChartDisplay(sheet, objectId, blanksAs, plotVisibleOnly)` | How blanks plot and whether hidden cells are skipped. |
| `setChartSeries(sheet, objectId, plot, seriesIdx, patch)` | A series' references, fill, line, marker, smoothing and data labels. |
| `setChartPoint(sheet, objectId, plot, seriesIdx, pointIdx, patch)` | One data point's fill, line and marker; `null` clears its formatting. |
| `setChartPlot(sheet, objectId, plot, patch)` | `gapWidth`, `overlap`, `firstSliceAngle`, `varyColors` and `holeSize`. |
| `setChartFilter(sheet, objectId, hiddenSeries, hiddenCategories)` | Replaces the chart filter. |
| `setChartSource(sheet, objectId, source, direction, headerRow?, headerColumn?)` | Rebuilds every series from a new range, keeping the chart kind and each series' formatting by idx, and clears the filter. |
| `addChartSeries(sheet, objectId, plot, patch)` | Appends a series; the patch must set `values` (`y` for a scatter plot). |
| `removeChartSeries(sheet, objectId, plot, seriesIdx)` | Removes a series. |

In a patch, an `undefined` field means keep and `null` means clear. In Python the patch is a `TypedDict`: an omitted key means keep and `None` means clear. A field the plot type does not have is rejected, and `holeSize` (10 to 90) applies to doughnut plots only. On an axis, a `null` `logBase` makes the axis linear, `crosses: ChartAxisCrosses.At` reads `crossesAt`, and `tickLabelPosition` is `nextTo`, `low`, `high` or `none`, with `null` restoring the default. Colors are ARGB integers (`0xAARRGGBB`).

An empty string for a series' `name`, `categories` or `x` removes that reference; an empty `values`, `y` or `size` is rejected.

## Saving and structural edits

On save, the series caches are refreshed from the current cell values. Saving never recalculates, so a workbook in manual calculation mode writes the values it currently stores.

Inserting or deleting rows and columns, renaming a sheet, and deleting a sheet all rewrite the references inside charts, the same way they rewrite formulas.

## Example

The example builds a small table, inserts a column chart, restyles it, and reads back the resolved data.

::: code-group

```js [WASM]
import createFormulon, { ChartInsertKind, ChartLegendPosition } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
try {
  const rows = [['Quarter', 'Sales'], ['Q1', 120], ['Q2', 150], ['Q3', 90], ['Q4', 180]]
  rows.forEach((row, r) => row.forEach((v, c) => {
    checked(typeof v === 'number' ? wb.setNumber(0, r, c, v) : wb.setText(0, r, c, v), 'set cell')
  }))

  const { objectId } = checked(wb.insertChart(0, {
    kind: ChartInsertKind.Column,
    source: 'A1:B5',
    title: 'Sales by quarter',
    legend: ChartLegendPosition.Right,
    placement: { row: 6, col: 0 },
  }), 'insertChart')

  const { chart } = checked(wb.getChart(0, objectId), 'getChart')
  const seriesIdx = chart.plots[0].series[0].idx
  checked(wb.setChartSeries(0, objectId, 0, seriesIdx, { fill: { color: 0xff2f6fed } }), 'setChartSeries')
  checked(wb.setChartAxis(0, objectId, chart.axes[1].id, { title: 'Units', min: 0 }), 'setChartAxis')
  checked(wb.setChartPlot(0, objectId, 0, { gapWidth: 80 }), 'setChartPlot')

  const { data } = checked(wb.getChartData(0, objectId), 'getChartData')
  console.log(data.categories.labels, Array.from(data.series[0].values))
} finally { wb.delete() }
```

```js [Native Node]
import { ChartInsertKind, ChartLegendPosition, Workbook } from '@libraz/formulon-native'

const wb = Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
try {
  const rows = [['Quarter', 'Sales'], ['Q1', 120], ['Q2', 150], ['Q3', 90], ['Q4', 180]]
  rows.forEach((row, r) => row.forEach((v, c) => {
    checked(typeof v === 'number' ? wb.setNumber(0, r, c, v) : wb.setText(0, r, c, v), 'set cell')
  }))

  const { objectId } = checked(wb.insertChart(0, {
    kind: ChartInsertKind.Column,
    source: 'A1:B5',
    title: 'Sales by quarter',
    legend: ChartLegendPosition.Right,
    placement: { row: 6, col: 0 },
  }), 'insertChart')

  const { chart } = checked(wb.getChart(0, objectId), 'getChart')
  const seriesIdx = chart.plots[0].series[0].idx
  checked(wb.setChartSeries(0, objectId, 0, seriesIdx, { fill: { color: 0xff2f6fed } }), 'setChartSeries')
  checked(wb.setChartAxis(0, objectId, chart.axes[1].id, { title: 'Units', min: 0 }), 'setChartAxis')
  checked(wb.setChartPlot(0, objectId, 0, { gapWidth: 80 }), 'setChartPlot')

  const { data } = checked(wb.getChartData(0, objectId), 'getChartData')
  console.log(data.categories.labels, Array.from(data.series[0].values))
} finally { wb.dispose() }
```

```python [Python]
from formulon import ChartInsertKind, ChartLegendPosition, FormulonError, Workbook

rows = [['Quarter', 'Sales'], ['Q1', 120], ['Q2', 150], ['Q3', 90], ['Q4', 180]]
try:
    with Workbook.create_default() as wb:
        for r, row in enumerate(rows):
            for c, v in enumerate(row):
                if isinstance(v, str):
                    wb.set_text(0, r, c, v)
                else:
                    wb.set_number(0, r, c, v)

        object_id = wb.insert_chart(
            0, ChartInsertKind.COLUMN, 'A1:B5',
            title='Sales by quarter', legend=ChartLegendPosition.RIGHT, row=6, col=0,
        )

        chart = wb.get_chart(0, object_id)
        series_idx = chart.plots[0].series[0].idx
        wb.set_chart_series(0, object_id, 0, series_idx, {'fill': {'color': 0xFF2F6FED}})
        wb.set_chart_axis(0, object_id, chart.axes[1].id, {'title': 'Units', 'min': 0})
        wb.set_chart_plot(0, object_id, 0, {'gap_width': 80})

        data = wb.get_chart_data(0, object_id)
        print(data.categories.labels, data.series[0].values)
except FormulonError as exc:
    raise RuntimeError(str(exc)) from exc
```

:::

The C calls are `fm_sheet_insert_chart`, `fm_sheet_chart_open`, `fm_sheet_chart_data_open`, `fm_sheet_chart_preview_open`, `fm_sheet_set_chart_type`, `fm_sheet_set_chart_title`, `fm_sheet_set_chart_legend`, `fm_sheet_set_chart_axis`, `fm_sheet_set_chart_display`, `fm_sheet_set_chart_series`, `fm_sheet_set_chart_point`, `fm_sheet_set_chart_plot`, `fm_sheet_set_chart_filter`, `fm_sheet_set_chart_source`, `fm_sheet_add_chart_series`, and `fm_sheet_remove_chart_series`. WASM and Native Node use the matching camelCase methods; Python uses snake_case.
