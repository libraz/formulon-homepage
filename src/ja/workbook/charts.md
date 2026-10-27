# グラフ

このページではエンジンが扱うグラフのデータを説明します。ブラウザ上でグラフを描画・編集する場合は、[formulon-cell のグラフガイドとデモ](/ja/cell/charts) を参照してください。

グラフはシート上の描画オブジェクトです。Formulon は Excel が保存したワークブックからグラフを読み込み、セル範囲から新しいグラフを作成し、型付きのプロパティを編集し、現在のセル値に対して系列を解決できます。グラフの描画は行いません。ビューア、編集 UI、グラフが何をプロットしているかを知りたいスクリプトのために、データと構造を扱う API を提供します。

Excel が保存した `.xlsx` と `.xlsb` のグラフは型付きで読み取れます。XLSX のグラフは編集にも対応します。ワークブックを保存すると、グラフ定義を編集していなくても、系列キャッシュはその時点で保持しているセル値から更新されます。

`.xlsb` から読み込んだワークブックでは、グラフの読み取りはできますが編集はできません。`insertChart` と各編集メソッドは `kIoDrawingUnparseable` を返します。XLSB から保持された画像の描画と同じ扱いです。拡張グラフ形式（`isChartex`）のグラフは読み取り専用で、ピボットグラフで編集できるのは、タイトルや書式など系列の構成を変えない操作に限られます。

## グラフの指定方法

グラフは `(sheet, objectId)` で指定します。`listDrawingObjects(sheet)` はアンカー付きのオブジェクトをすべて返し、種別が `DrawingObjectKind.Chart` のものがグラフです。その `objectId` を各グラフメソッドに渡します。`insertChart` は新しいグラフの ID を返します。

グラフの移動、サイズ変更、重なり順の変更、スナップショット、削除には、画像と共通の描画メソッド `setDrawingAnchor`、`setDrawingZOrder`、`snapshotDrawing`、`restoreDrawing`、`removeDrawing` を使います。詳しくは[コメントと画像](/ja/workbook/comments-images#drawing-anchors)を参照してください。

グラフの内部では、プロットグループを `plots` のインデックス、系列を `idx`（`c:idx` の値。編集しても変わりません）、軸を `id` で指定します。

## グラフの読み取り

| メソッド | 戻り値 |
| --- | --- |
| `getChart(sheet, objectId)` | `{ status, chart }`。グラフの型付きビュー |
| `getChartData(sheet, objectId)` | `{ status, data }`。現在のセル値に対して解決した系列 |
| `previewChartData(sheet, objectId, overrides)` | `{ status, data }`。`overrides` を適用したものとして解決した結果。ワークブックは変更されません |

`chart` には、名前、説明、タイトル、凡例、`blanksAs`、`plotVisibleOnly`、`plots`、`axes`、非表示のカテゴリ、`source` が含まれます。`source` はすべての系列の元になった矩形で、系列が共通の範囲を持たない場合は `null` です。各プロットは種類、グループ化、系列ごとの参照、塗りつぶし、線、マーカー、データ要素、データラベルを持ちます。作成できる 7 種類以外のグラフ（レーダー、株価、サーフェスなど）も読み取れます。`ChartPlotType` はすべてのプロットグループを表し、`isChartex`、`isPivotChart`、`onChartsheet` で特殊な形式を判別できます。

`data` は Excel の規則で各系列を数値に解決したものです。`domain` は `category` または `xy` です。`categories` にラベルが入り、`series` の `values` には要素ごとに `states`（`ChartPointState` の `Value`、`Gap`、`Connect`）が対応します。解決できなかった参照は `unresolved` に並びます。解決済み系列は x 値の数値書式 `xFormatCode`（Python は `x_format_code`）も持ちます。`previewChartData` は `source`、`direction`、`headerRow`、`headerColumn`、`blanksAs`、`plotVisibleOnly` を受け取るので、エディターは別のソース範囲を確定する前に、何がプロットされるかを表示できます。

## グラフの作成

`insertChart(sheet, options)` は A1 形式の矩形からグラフを作り、`{ status, objectId }` を返します。作成できる種類は `ChartInsertKind` の 7 つ、`Column`、`Bar`、`Line`、`Area`、`Pie`、`Scatter`、`Doughnut` です。

| オプション | 意味 |
| --- | --- |
| `kind`、`source` | 必須です。`source` はシート名付きでも、`sheet` 上の範囲でも構いません。 |
| `grouping` | `Clustered`、`Stacked`、`PercentStacked`、`Standard`。縦棒、横棒、折れ線、面に適用されます。 |
| `direction` | `Columns`、`Rows`、`Auto`（Excel に従う）。 |
| `headerRow`、`headerColumn` | 省略すると Excel の見出し判定に従います。 |
| `title` | 省略すると Excel の自動タイトルになります。空文字列ならタイトルなしです。 |
| `legend` | `ChartLegendPosition`。既定は `Bottom` で、`None` なら凡例を付けません。 |
| `name`、`description` | オブジェクト名と代替テキスト。 |
| `placement` | `insertImage` と同じアンカー指定です。既定は 2 セルアンカーで、`widthEmu` または `heightEmu` が 0 なら Excel の既定サイズになります。 |

新しいグラフの系列キャッシュは、参照先のセルの値で埋められます。

## グラフの編集

編集メソッドはいずれも `Status` を返します。ただし `addChartSeries` は `{ status, seriesIdx }` を返します。

| メソッド | 編集する内容 |
| --- | --- |
| `setChartType(sheet, objectId, plot, kind, grouping?)` | プロットグループの種類を置き換え、各系列の参照、idx、順序を保ちます。系列の色、線、データ要素の書式は Excel の種類変更規則に従います。 |
| `setChartTitle(sheet, objectId, title)` | タイトル文字列、削除を表す `null`、またはタイトルオブジェクトを受け取ります。 |
| `setChartLegend(sheet, objectId, position, overlay, hiddenSeries?)` | 位置（`None` で凡例を削除）、重なり、非表示にする凡例項目。 |
| `setChartAxis(sheet, objectId, axisId, patch)` | 表示、タイトル、`min`、`max`、`majorUnit`、`numberFormat`、`majorGridlines`、`reversed`、`logBase`、`crosses` と `crossesAt`、`tickLabelPosition`。 |
| `setChartDisplay(sheet, objectId, blanksAs, plotVisibleOnly)` | 空白セルの扱いと、非表示セルを除外するかどうか。 |
| `setChartSeries(sheet, objectId, plot, seriesIdx, patch)` | 系列の参照、塗りつぶし、線、マーカー、スムージング、データラベル。 |
| `setChartPoint(sheet, objectId, plot, seriesIdx, pointIdx, patch)` | データ要素 1 点の塗りつぶし、線、マーカー。`null` で書式を消します。 |
| `setChartPlot(sheet, objectId, plot, patch)` | `gapWidth`、`overlap`、`firstSliceAngle`、`varyColors`、`holeSize`。 |
| `setChartFilter(sheet, objectId, hiddenSeries, hiddenCategories)` | グラフフィルターを置き換えます。 |
| `setChartSource(sheet, objectId, source, direction, headerRow?, headerColumn?)` | 新しい範囲から全系列を作り直します。グラフの種類と系列ごとの書式は idx で引き継がれ、フィルターは解除されます。 |
| `addChartSeries(sheet, objectId, plot, patch)` | 系列を末尾に追加します。パッチには `values`（散布図では `y`）が必要です。 |
| `removeChartSeries(sheet, objectId, plot, seriesIdx)` | 系列を削除します。 |

パッチでは、`undefined` のフィールドは変更なし、`null` は削除を表します。Python のパッチは `TypedDict` で、キーを省略すると変更なし、`None` は削除です。プロットの種類にないフィールドは拒否されます。`holeSize`（10 から 90）はドーナツのプロットにだけ指定できます。軸では、`logBase` を `null` にすると線形軸に戻り、`crosses: ChartAxisCrosses.At` のときに `crossesAt` が読まれます。`tickLabelPosition` は `nextTo`、`low`、`high`、`none` のいずれかで、`null` で既定に戻ります。色は ARGB の整数（`0xAARRGGBB`）です。

`setChartTitle` は文字列、`null`、`{ kind, text?, formula? }`（Python は `ChartTitleInfo`）を受け取ります。`ChartTitleKind.Auto` を指定すると Excel の自動タイトルに戻ります。`setChartAxis` の `title` パッチにも同じタイトルオブジェクトを指定できます。マーカー記号には `x`、`star`、`plus`、`dot`、`dash` があります。`picture` マーカーは読み取れますが、マーカーパッチから設定できません。

系列の `name`、`categories`、`x` に空文字列を渡すとその参照を削除します。`values`、`y`、`size` に空文字列を渡すと拒否されます。

## 保存と構造の変更

保存時には、系列キャッシュがその時点で保持しているセル値から更新されます。保存で再計算が行われることはないため、手動計算のブックには、現在キャッシュしている値が書き込まれます。

行や列の挿入・削除、シート名の変更、シートの削除では、数式と同様にグラフ内の参照も書き換えられます。

## 例

小さな表を作り、縦棒グラフを挿入して書式を変え、解決済みのデータを読み戻します。

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

C の呼び出しは `fm_sheet_insert_chart`、`fm_sheet_chart_open`、`fm_sheet_chart_data_open`、`fm_sheet_chart_preview_open`、`fm_sheet_set_chart_type`、`fm_sheet_set_chart_title`、`fm_sheet_set_chart_legend`、`fm_sheet_set_chart_axis`、`fm_sheet_set_chart_display`、`fm_sheet_set_chart_series`、`fm_sheet_set_chart_point`、`fm_sheet_set_chart_plot`、`fm_sheet_set_chart_filter`、`fm_sheet_set_chart_source`、`fm_sheet_add_chart_series`、`fm_sheet_remove_chart_series` です。WASM と Native Node は対応する camelCase、Python は snake_case のメソッドを使います。
