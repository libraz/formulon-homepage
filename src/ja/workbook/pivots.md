# PivotTable

ピボットテーブルは、元データの列とレコードを保持する **ピボットキャッシュ** と、それらをシート上で分類・集計する **ピボットテーブル** から構成されます。最初にキャッシュを作成し、ワークシートソースを設定してからピボットテーブルを作成・設定してください。

Formulon は、設定済みのキャッシュを `pivotLayout()` で投影します。`pivotLayout()` が返すセルはホストで表示するための結果で、ワークシートのセルへ自動的に書き込まれるわけではありません。元シートからピボットキャッシュを再構築したり、外部接続を実行したりはしません。新規キャッシュの内容は明示的に設定し、宣言したワークシートソースは元データと一致させます。

## 単純な集計を作成する

この例では、`Region` / `Product` / `Sales` のキャッシュを作り、行の階層と合計値を `E1` を起点に設定します。ワークシートソースとキャッシュレコードに同じ見出しとデータ行を入れるため、Excel で更新してもソースが食い違いません。`pivotLayout()` は投影結果を返しますが、`E1` や周囲のワークシートセルへ値を書き込みません。C ABI を直接使う場合、`PivotAxis.Row` は `0`、`PivotAxis.Value` は `2`、`PivotAggregation.Sum` は `0` です。

::: code-group

```ts [WASM]
import createFormulon, {
  PivotAggregation, PivotAxis, ValueKind,
} from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
type StatusLike = { ok: boolean; message: string }
const requireOk = <T extends StatusLike | { status: StatusLike }>(result: T): T => {
  const status: StatusLike = 'ok' in result ? result as StatusLike : result.status
  if (!status.ok) throw new Error(status.message)
  return result
}
try {
  const cacheId = requireOk(wb.pivotCacheCreate(0)).index
  requireOk(wb.pivotCacheSetWorksheetSource(cacheId, { present: true, ref: 'A1:C3', sheet: 'Sheet1' }))
  requireOk(wb.setText(0, 0, 0, 'Region'))
  requireOk(wb.setText(0, 0, 1, 'Product'))
  requireOk(wb.setText(0, 0, 2, 'Sales'))
  requireOk(wb.setText(0, 1, 0, 'East'))
  requireOk(wb.setText(0, 1, 1, 'Widget'))
  requireOk(wb.setNumber(0, 1, 2, 10))
  requireOk(wb.setText(0, 2, 0, 'West'))
  requireOk(wb.setText(0, 2, 1, 'Gadget'))
  requireOk(wb.setNumber(0, 2, 2, 30))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Region'))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Product'))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Sales'))

  const rows: Array<[string, string, number]> = [
    ['East', 'Widget', 10], ['West', 'Gadget', 30],
  ]
  for (const [region, product, sales] of rows) {
    const record = requireOk(wb.pivotCacheRecordAdd(cacheId)).index
    requireOk(wb.pivotCacheRecordSetText(cacheId, record, 0, region))
    requireOk(wb.pivotCacheRecordSetText(cacheId, record, 1, product))
    requireOk(wb.pivotCacheRecordSetNumber(cacheId, record, 2, sales))
  }

  const pivot = requireOk(wb.pivotCreate(0, 'SalesSummary', cacheId, 0, 4))
  const regionField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Region', axis: PivotAxis.Row }))
  const productField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Product', axis: PivotAxis.Row }))
  const salesField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Sales', axis: PivotAxis.Value }))
  requireOk(wb.pivotSetRowFieldOrder(
    0, pivot.index, [regionField.index, productField.index],
  ))
  const fmt = requireOk(wb.addNumFmt('#,##0.00'))
  requireOk(wb.pivotDataFieldAdd(0, pivot.index, {
    name: 'Sum of Sales', fieldIndex: salesField.index, aggregation: PivotAggregation.Sum,
    numberFormat: String(fmt.numFmtId)
  }))

  requireOk(wb.pivotFieldSetNumberFormat(0, pivot.index, salesField.index, String(fmt.numFmtId)))
  const layout = requireOk(wb.pivotLayout(0, pivot.index))
  const labels = layout.cells.map((cell) => cell.value.text).filter(Boolean)
  if (!labels.includes('East') || !labels.includes('West')) throw new Error('Pivot row labels are missing')
  const anchor = wb.getValue(0, 0, 4)
  if (!anchor.status.ok || anchor.value.kind !== ValueKind.Blank) throw new Error('pivotLayout wrote E1')
  console.log(labels)
} finally {
  wb.delete()
}
```

```ts [Native Node]
import {
  PivotAggregation, PivotAxis, ValueKind, Workbook,
} from '@libraz/formulon-native'

const wb = Workbook.createDefault()
type StatusLike = { ok: boolean; message: string }
const requireOk = <T extends StatusLike | { status: StatusLike }>(result: T): T => {
  const status: StatusLike = 'ok' in result ? result as StatusLike : result.status
  if (!status.ok) throw new Error(status.message)
  return result
}
try {
  const cacheId = requireOk(wb.pivotCacheCreate(0)).index
  requireOk(wb.pivotCacheSetWorksheetSource(cacheId, { present: true, ref: 'A1:C3', sheet: 'Sheet1' }))
  requireOk(wb.setText(0, 0, 0, 'Region'))
  requireOk(wb.setText(0, 0, 1, 'Product'))
  requireOk(wb.setText(0, 0, 2, 'Sales'))
  requireOk(wb.setText(0, 1, 0, 'East'))
  requireOk(wb.setText(0, 1, 1, 'Widget'))
  requireOk(wb.setNumber(0, 1, 2, 10))
  requireOk(wb.setText(0, 2, 0, 'West'))
  requireOk(wb.setText(0, 2, 1, 'Gadget'))
  requireOk(wb.setNumber(0, 2, 2, 30))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Region'))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Product'))
  requireOk(wb.pivotCacheFieldAdd(cacheId, 'Sales'))

  const rows: Array<[string, string, number]> = [
    ['East', 'Widget', 10], ['West', 'Gadget', 30],
  ]
  for (const [region, product, sales] of rows) {
    const record = requireOk(wb.pivotCacheRecordAdd(cacheId)).index
    requireOk(wb.pivotCacheRecordSetText(cacheId, record, 0, region))
    requireOk(wb.pivotCacheRecordSetText(cacheId, record, 1, product))
    requireOk(wb.pivotCacheRecordSetNumber(cacheId, record, 2, sales))
  }

  const pivot = requireOk(wb.pivotCreate(0, 'SalesSummary', cacheId, 0, 4))
  const regionField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Region', axis: PivotAxis.Row }))
  const productField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Product', axis: PivotAxis.Row }))
  const salesField = requireOk(wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Sales', axis: PivotAxis.Value }))
  requireOk(wb.pivotSetRowFieldOrder(0, pivot.index, [regionField.index, productField.index]))
  const fmt = requireOk(wb.addNumFmt('#,##0.00'))
  requireOk(wb.pivotDataFieldAdd(0, pivot.index, {
    name: 'Sum of Sales', fieldIndex: salesField.index, aggregation: PivotAggregation.Sum,
    numberFormat: String(fmt.numFmtId),
  }))
  requireOk(wb.pivotFieldSetNumberFormat(0, pivot.index, salesField.index, String(fmt.numFmtId)))

  const layout = requireOk(wb.pivotLayout(0, pivot.index))
  const labels = layout.cells.map((cell) => cell.value.text).filter(Boolean)
  if (!labels.includes('East') || !labels.includes('West')) throw new Error('Pivot row labels are missing')
  const anchor = wb.getValue(0, 0, 4)
  if (!anchor.status.ok || anchor.value.kind !== ValueKind.Blank) throw new Error('pivotLayout wrote E1')
  console.log(labels)
} finally {
  wb.dispose()
}
```

```python [Python]
from formulon import (
    PivotAggregation, PivotAxis, PivotDataFieldSpec, PivotFieldSpec,
    PivotWorksheetSource, ValueKind,
    Workbook,
)

with Workbook.create_default() as wb:
    cache_id = wb.pivot_cache_create()
    wb.set_pivot_cache_worksheet_source(cache_id, PivotWorksheetSource(ref='A1:C3', sheet='Sheet1'))
    wb.set_text(0, 0, 0, 'Region')
    wb.set_text(0, 0, 1, 'Product')
    wb.set_text(0, 0, 2, 'Sales')
    wb.set_text(0, 1, 0, 'East')
    wb.set_text(0, 1, 1, 'Widget')
    wb.set_number(0, 1, 2, 10)
    wb.set_text(0, 2, 0, 'West')
    wb.set_text(0, 2, 1, 'Gadget')
    wb.set_number(0, 2, 2, 30)
    wb.pivot_cache_field_add(cache_id, 'Region')
    wb.pivot_cache_field_add(cache_id, 'Product')
    wb.pivot_cache_field_add(cache_id, 'Sales')

    for region, product, sales in [('East', 'Widget', 10), ('West', 'Gadget', 30)]:
        record = wb.pivot_cache_record_add(cache_id)
        wb.pivot_cache_record_set_text(cache_id, record, 0, region)
        wb.pivot_cache_record_set_text(cache_id, record, 1, product)
        wb.pivot_cache_record_set_number(cache_id, record, 2, sales)

    pivot = wb.pivot_create(0, 'SalesSummary', cache_id, 0, 4)
    region_field = wb.pivot_field_add(0, pivot, PivotFieldSpec(source_name='Region', axis=PivotAxis.ROW))
    product_field = wb.pivot_field_add(0, pivot, PivotFieldSpec(source_name='Product', axis=PivotAxis.ROW))
    sales_field = wb.pivot_field_add(0, pivot, PivotFieldSpec(source_name='Sales', axis=PivotAxis.VALUE))
    wb.pivot_set_row_field_order(0, pivot, [region_field, product_field])
    fmt_id = wb.add_num_fmt('#,##0.00')
    wb.pivot_data_field_add(0, pivot, PivotDataFieldSpec(
        name='Sum of Sales', field_index=sales_field, aggregation=PivotAggregation.SUM,
        number_format=str(fmt_id)
    ))

    wb.pivot_field_set_number_format(0, pivot, sales_field, str(fmt_id))
    layout = wb.pivot_layout(0, pivot)
    labels = [cell.value.text for cell in layout.cells if cell.value.text]
    if 'East' not in labels or 'West' not in labels:
        raise RuntimeError('Pivot row labels are missing')
    if wb.get_value(0, 0, 4).kind is not ValueKind.BLANK:
        raise RuntimeError('pivot_layout wrote E1')
    print(labels)
```

:::

ワークブックの座標はすべて 0 始まりです。そのためピボットの起点 `(0, 4)` は `E1` です。新規ピボットを保存するにはキャッシュソースの設定が必要です。設定なしでは Excel が修復を提案するパッケージになるため、`save()` は失敗します。起点は投影結果の位置を示すだけで、`pivotLayout()` の結果を `E1` 周辺のワークシートセルへ書き込みません。

以下の短いコードは続きとして実行する例です。上の完全な例の `finally` / `with` によるクリーンアップより前に挿入するか、新しいワークブックでセットアップを繰り返してください。クリーンアップ済みのワークブックでは実行できません。

### キャッシュ項目をインデックスで指定する

手動フィルターをキャッシュの共有項目インデックスに結び付ける場合は、`pivotFieldAddItemAt()` / `pivot_field_add_item_at()` を使います。空白の項目を指定できるのはこの形式です。`pivotFieldAddItem()` に空のラベルを渡しても文字列との比較になるため、空白項目は指定できません。インデックスは OOXML のピボット項目 `x` 属性と同じ 0 始まりです。まだ解決できないインデックスも受け付けますが、その項目ではフィルターされません。評価前にキャッシュを構築しておくと、意図した項目に一致します。

```ts [WASM / Native Node]
wb.pivotFieldAddItemAt(0, pivot.index, /*fieldIdx*/ 0, /*cacheIndex*/ 2, false)
```

```python [Python]
wb.pivot_field_add_item_at(0, pivot, 0, 2, False)  # field_idx=0、cache_index=2
```

## 投影結果を調べる

`pivotLayout()` / `pivot_layout()` は、投影した矩形とセルを返します。ホストで表示するための結果であり、通常のワークシート値は書き換えません。保存するとピボットテーブルの定義とキャッシュが保持され、Excel で表示できます。静的な帳票を作る場合は、返されたセルを setter で明示的に書き込んでください。

投影結果のコードも同じライフサイクル規則に従います。クリーンアップ処理の前に実行するか、新しいワークブックでセットアップを繰り返してください。

::: code-group

```ts [WASM / Native Node]
const layout = wb.pivotLayout(0, pivot.index)
if (!layout.status.ok) throw new Error(layout.status.message)
for (const cell of layout.cells) console.log(cell.row, cell.col, cell.value)
```

```python [Python]
layout = wb.pivot_layout(0, pivot)
for cell in layout.cells:
    print(cell.row, cell.col, cell.value)
```

:::

表示形式には `pivotSetLayout()` / `set_pivot_report_layout()` を使います。compact、tabular、outline を選べます。フィールド順、集計行、フィルター、日付グループ化、集計方法、値の表示方法は別々に設定します。完全な一覧は各バインディングの宣言を確認してください。

### 日付を明示した日数単位でグループ化する

`PivotDateGrouping.Days` / `PivotDateGrouping.DAYS` は Excel の日数間隔による日付グループ化です。以下のコードは、`OrderDate` フィールドを持つ別のピボットを前提にしています。`dateField` には、そのフィールドを追加したときに返されたインデックスを渡します。週専用の粒度はないため、7 日単位なら `intervalDays: 7` / `interval_days=7` を使います。日付グループの呼び出しには `startYear` と `endYear`（年を切り詰める場合以外は `-1`）、日数単位、Excel シリアル値による任意の開始 / 終了範囲を渡します。シリアル値のどちらかを `-1` にすると、フィールドのデータ最小値を開始値、データ最大値に 1 日を加えた値を終了値として自動設定します。ラベルは単位区間の日付範囲になり、明示した範囲より前後の値は `<start` / `>end` と表示されます。単位が 0、または開始値が終了値より後の場合は拒否されます。

日付フィールドのインデックスには `pivotFieldAdd()` / `pivot_field_add()` の `index` / 戻り値を使います。

::: code-group

```ts [WASM / Native Node]
const dateStatus = wb.pivotFieldSetDateGroup(
  0, pivot.index, dateField.index, PivotDateGrouping.Days, PivotCalendar.Gregorian,
  -1, -1, 7, -1, -1
)
if (!dateStatus.ok) throw new Error(dateStatus.message)
```

```python [Python]
wb.pivot_field_set_date_group(
    0, pivot, date_field, PivotDateGrouping.DAYS, PivotCalendar.GREGORIAN,
    start_year=-1, end_year=-1, interval_days=7,
    start_serial=-1.0, end_serial=-1.0,
)
```

:::

ピボットフィールドとデータフィールドの表示形式は書式コードではなく、10 進数の `numFmtId` 文字列で指定します。組み込み ID、または先に `addNumFmt()` / `add_num_fmt()` で登録した書式コードの ID を使ってください。その他の空でない文字列は拒否され、ID はピボットパーツに書き込まれます。上の例はその登録と設定を示しています。

## 境界

- 新規キャッシュは、宣言したワークシート範囲から自動でデータを取り込みません。フィールドとレコードを明示的に追加します。
- ソース範囲は有効なワークブックを保存するためのメタデータであり、キャッシュ更新を予約するものではありません。
- 外部接続とピボットキャッシュの再計算は、Formulon のローカル計算モデルの対象外です。
- 既存のピボットテーブルは読み取り・変更・投影・保持ができます。XLSB の `pivotCacheDefinition`、`pivotCacheRecords`、ピボットテーブルのパーツは、レコード形式が対応済みであれば評価します。未計測の形式は推測せずスキップします。文書化されたモデルの外にある機能を含むファイルでは、元のワークブックとの互換性検査を続けてください。

## 次に読むもの

- [ワークブック操作](/ja/workbook/operations) ─ より広いワークブック編集 API
- [ファイル形式](/ja/workbook/file-formats) ─ ピボットテーブル / ピボットキャッシュの保持境界
- [対象外の機能](/ja/compatibility/non-goals) ─ 外部接続とローカルエンジンの範囲
