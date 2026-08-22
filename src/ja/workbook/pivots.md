# PivotTable

PivotTable は、source field と record を持つ **pivot cache** と、その field を worksheet 上へ配置・集計する **pivot table** の 2 つで構成されます。最初に cache を作成し、worksheet source を設定してから pivot table を作成・設定してください。

Formulon は、設定済み cache を `pivotLayout()` でセルへ投影します。worksheet から pivot cache を再構築したり、外部 connection を実行したりはしません。新規 cache の内容は明示的に設定し、宣言した worksheet source は source data と一致させます。

## 単純な集計を作成する

この例では、`Region` / `Amount` の cache を作り、row label と合計値を `E1` に配置します。C ABI を直接使う場合、`PivotAxis.Row` は `0`、`PivotAxis.Value` は `2`、`PivotAggregation.Sum` は `0` です。

```ts
import createFormulon, { PivotAggregation, PivotAxis } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
```

::: code-group

```ts [WASM / Native Node]
const cacheId = wb.pivotCacheCreate(0).index
wb.pivotCacheSetWorksheetSource(cacheId, { present: true, ref: 'A1:B3', sheet: 'Sheet1' })
wb.pivotCacheFieldAdd(cacheId, 'Region')
wb.pivotCacheFieldAdd(cacheId, 'Amount')

for (const [region, amount] of [['East', 10], ['West', 30]]) {
  const record = wb.pivotCacheRecordAdd(cacheId).index
  wb.pivotCacheRecordSetText(cacheId, record, 0, region)
  wb.pivotCacheRecordSetNumber(cacheId, record, 1, amount)
}

const pivot = wb.pivotCreate(0, 'SalesSummary', cacheId, 0, 4)
wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Region', axis: PivotAxis.Row })
const amount = wb.pivotFieldAdd(0, pivot.index, { sourceName: 'Amount', axis: PivotAxis.Value })
wb.pivotDataFieldAdd(0, pivot.index, {
  name: 'Sum of Amount', fieldIndex: amount.index, aggregation: PivotAggregation.Sum
})
```

```python [Python]
from formulon import PivotAggregation, PivotAxis, PivotDataFieldSpec, PivotFieldSpec, PivotWorksheetSource

cache_id = wb.pivot_cache_create()
wb.set_pivot_cache_worksheet_source(cache_id, PivotWorksheetSource(ref='A1:B3', sheet='Sheet1'))
wb.pivot_cache_field_add(cache_id, 'Region')
wb.pivot_cache_field_add(cache_id, 'Amount')

for region, amount in [('East', 10), ('West', 30)]:
    record = wb.pivot_cache_record_add(cache_id)
    wb.pivot_cache_record_set_text(cache_id, record, 0, region)
    wb.pivot_cache_record_set_number(cache_id, record, 1, amount)

pivot = wb.pivot_create(0, 'SalesSummary', cache_id, 0, 4)
wb.pivot_field_add(0, pivot, PivotFieldSpec(source_name='Region', axis=PivotAxis.ROW))
amount = wb.pivot_field_add(0, pivot, PivotFieldSpec(source_name='Amount', axis=PivotAxis.VALUE))
wb.pivot_data_field_add(0, pivot, PivotDataFieldSpec(
    name='Sum of Amount', field_index=amount, aggregation=PivotAggregation.SUM
))
```

:::

ワークブックの座標はすべて 0 始まりです。そのため pivot anchor の `(0, 4)` は `E1` です。新規 pivot を保存するには cache source の設定が必要です。設定なしでは Excel が修復を提案するパッケージになるため、`save()` は失敗します。

### cache item を index で指定する

手動 filter を cache の shared-item index に結び付ける場合は、`pivotFieldAddItemAt()` / `pivot_field_add_item_at()` を使います。blank member を指定できるのはこの形式です。`pivotFieldAddItem()` に空の label を渡しても文字列との比較になるため、blank item は指定できません。index は OOXML の pivot item `x` 属性と同じ 0 始まりの空間です。まだ解決できない index も受け付けますが、その item は何も filter しません。評価前に cache を構築しておくと、意図した item に一致します。

```ts [WASM / Native Node]
wb.pivotFieldAddItemAt(0, pivot.index, /*fieldIdx*/ 0, /*cacheIndex*/ 2, false)
```

```python [Python]
wb.pivot_field_add_item_at(0, pivot, 0, 2, False)  # field_idx=0、cache_index=2
```

## 投影結果を調べる

`pivotLayout()` / `pivot_layout()` は、投影した矩形とセルを返します。これは pivot 結果をプログラムから見る方法です。Excel で開く出力が必要な場合は workbook を保存してください。

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

表示形式には `pivotSetLayout()` / `set_pivot_report_layout()` を使います。compact、tabular、outline を選べます。field order、subtotal、filter、date grouping、aggregation、show-values-as は別々に設定します。完全な一覧は各 binding の declaration を確認してください。

## 境界

- 新規 cache は、宣言した worksheet range から自動でデータを取り込みません。field と record を明示的に追加します。
- source range は有効な workbook を保存するための metadata であり、cache refresh を予約するものではありません。
- 外部 connection と PivotCache の再計算は、Formulon のローカル計算モデルの対象外です。
- 既存の PivotTable は読み取り・変更・投影・保持できます。XLSB の `pivotCacheDefinition`、`pivotCacheRecords`、pivot table パートは、record encoding が対応済みであれば評価します。未計測の encoding は推測せずスキップします。文書化された model の外にある機能を含むファイルでは、source workbook に対する互換性検査を続けてください。

## 次に読むもの

- [ワークブック操作](/ja/workbook/operations) ─ より広い workbook 編集 API
- [ファイル形式](/ja/workbook/file-formats) ─ PivotTable / PivotCache の保持境界
- [互換性の非対象](/ja/compatibility/non-goals) ─ 外部 connection とローカル engine の範囲
