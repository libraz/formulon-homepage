---
description: ネイティブの Excel テーブルとピボットテーブルを作成し、入力範囲の検証、グローバルなインデックス、XLSX 保存の注意点を確認します。
---

# テーブルとピボットテーブル

`formulon_table_operation` はネイティブの Excel テーブル（Table）を作成します。`formulon_create_pivot` はワークシートを元にしたピボットキャッシュ（PivotCache）とネイティブのピボットテーブル（PivotTable）を作成します。これらは Excel がフィルター、更新、検査に使えるワークブックのメタデータとして保存されます。

[`formulon_build_document`](/ja/mcp/authoring) の `table` ブロックは、見出し、罫線、数式、帯状の塗りつぶしを持つ表示用の表を作ります。ネイティブの Excel テーブルは作りません。Excel のテーブルメタデータやピボットテーブルが必要ならネイティブのツールを使い、印刷用のレイアウトが目的なら文書ブロックを使います。

## ネイティブのワークシートテーブル

### 作成と一覧

作成には `sessionId`、`operation: "create"`、`range`（または別名の `ref`）、空でないネイティブ名 `name` が必要です。範囲は 1 枚のシート内の A1 矩形です。

| 項目 | 意味 |
| --- | --- |
| `sheet` | シート名のない `range` または `ref` に使うシートです。範囲にシート名があれば範囲側を優先します。 |
| `columns` | 範囲の各列に 1 つずつ、空でない一意な名前を指定します。`headerRow` が `true` の場合は省略して先頭行から生成できます。 |
| `headerRow` | 範囲の先頭行を見出しにするかどうかです。作成時の既定値は `true` です。`false` の場合は `columns` が必須です。 |
| `totalsRow` | 合計行を持つかどうかです。作成時の既定値は `false` です。 |
| `style` / `styleName` | Excel の TableStyle 名です。2 つは同じ意味で、両方を指定した場合は `styleName` を優先します。 |

見出しを生成する場合、先頭行の全セルが空でない文字列でなければなりません。生成された名前は、大文字小文字を区別せず一意でなければなりません。`columns` を明示した場合も、範囲の列数と一致し、同じ規則を満たす必要があります。

`operation: "list"` で全テーブルを一覧できます。`sheet` を渡すとシートで絞り込めます。一覧を絞り込んでもテーブルの `index` はワークブック全体の番号です。後で更新や削除を行うときは返された番号を使い、シートごとの位置に置き換えないでください。

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "create",
  "range": "Data!A1:C5",
  "name": "Sales",
  "style": "TableStyleMedium2",
  "headerRow": true,
  "totalsRow": false
}
```

作成結果には `session`、`table`、`status` が含まれます。`table` にはグローバルな `index`（インデックス）、`name`、`displayName`、A1 の `ref`、数値の `sheet`、`sheetName`、エンジンが返すテーブルの生データが含まれます。ワークブックで最初のテーブルなら、典型的には `index: 0`、`ref: "A1:C5"`、`sheetName: "Data"` になります。

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "list",
  "sheet": "Data"
}
```

一覧結果には `count` と `tables` が含まれます。テーブルがない場合も `count: 0` の成功応答になります。

### 更新と削除

更新と削除にはグローバルな `index`（インデックス）が必要です。

更新では `range` または `ref`、`style` または `styleName`、`headerRow`、`totalsRow` のいずれかを指定します。新しい範囲は既存テーブルと同じシートにあり、列数を変えないでください。空文字列のスタイルは `TableStyle` を消します。更新と削除では、変更または削除されたテーブルが作成時と同じ表現で返ります。

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "update",
  "index": 0,
  "ref": "Data!A1:C6",
  "totalsRow": true
}
```

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "remove",
  "index": 0
}
```

テーブルの作成・更新・削除では、エンジンを呼ぶ前にセッションを変更あり（dirty）にします。一覧取得では変更あり（dirty）の状態を変えません。下位層でエラーになった場合は、保存または入力元の再オープンを決める前にセッションを調べます。

## ピボットテーブルを作成する

`formulon_create_pivot` はワークシート範囲を読み取り、ワークシートを元にしたピボットキャッシュを作り、指定したセルにピボットテーブルを配置します。必須項目は `sessionId`、`sourceRange`、`target`、`name`、1 件以上の `values` です。

| 項目 | 意味 |
| --- | --- |
| `sourceRange` | 見出し行を含む A1 矩形です。シート名を含められます。 |
| `sourceSheet` | シート名のない `sourceRange` に使うシートです。既定値は最初のシートです。 |
| `target` | ピボットテーブルの左上セルです。レポートシート名を含められます。 |
| `targetSheet` | シート名のない `target` に使うシートです。既定値は入力シートです。 |
| `name` | ネイティブのピボットテーブル名です。 |
| `rows` | 行軸へ置く入力見出しです。既定値は `[]` です。 |
| `columns` | 列軸へ置く入力見出しです。既定値は `[]` です。 |
| `pages` | フィルター軸へ置く入力見出しです。既定値は `[]` です。 |
| `values` | 1 件以上の値フィールドです。`field`、省略可能な `aggregation`、`name`、`numberFormat` を持ちます。 |
| `layout` | `compact`（既定値）、`tabular`、`outline` のいずれかです。 |
| `grandTotals` | `{ "rows": boolean, "columns": boolean }` を指定できます。省略したメンバーの既定値は `true` です。 |
| `sourceLimit` | `2` から `10_000` の入力セル上限です。既定値は `10_000` です。 |

入力範囲には見出し行とデータ行が 1 行以上必要です。すべての見出しは、空でない一意な文字列でなければなりません。見出し行を含む入力セル数は `sourceLimit` 以下にします。

すべての入力見出しを、`rows`、`columns`、`pages`、または値フィールドのいずれか 1 つへ割り当てます。未知の項目、未使用の見出し、同じ軸での重複、軸と値の両方への割り当ては、キャッシュを変更する前の検証で拒否します。同じ入力値フィールドは、異なる集計と一意な表示名を持つ複数の `values` 項目で使えます。

利用できる集計は `sum`、`count`、`average`、`max`、`min`、`product`、`countNumbers`、`stddev`、`stddevp`、`var`、`varp` です。既定値は `sum` です。`name` を省略すると、`Sum of Amount` のような `<Aggregation> of <field>` を生成します。`numberFormat` は Excel の表示形式コードで、データフィールドを追加する前に登録します。

入力範囲に数式がある場合、キャッシュのレコードを読む前に再計算します。キャッシュまたはピボットテーブルの作成に失敗すると、サーバーはその呼び出しで作成したキャッシュとピボットテーブルの削除を試みます。削除も失敗する場合があり、セッションは変更あり（dirty）のままです。保存や再試行の前に、残ったオブジェクトを確認してください。

## エンドツーエンド例: 売上一覧とレポートのピボットテーブル

次のプロンプトは、入力一覧、ネイティブテーブル、レポートのピボットテーブルを分けて作成します。

```text
`sales-report` というワークブックセッションを開いてください。最初のシート名を Data に変更し、Report というシートを追加します。Data!A1:C5 に Region、Product、Amount の売上一覧を書き込みます。Sales という名前のネイティブテーブルを TableStyle 付きで作成し、一覧からグローバルなインデックスを取得してください。North の売上を 6 行目へ追加してテーブルをそこまで拡張し、7 行目へ合計行を書き込み、合計行を有効にします。Report!A1 に SalesByProduct を作成し、Region を行、Product を列に配置し、Amount から sum 集計の Revenue と average 集計の Average amount という 2 つの値フィールドを作ります。すべての入力見出しを 1 回ずつ割り当て、`tabular` レイアウトと両方の総計帯を有効にし、`sourceLimit` を 50 にします。入力データとネイティブのピボットテーブルのレイアウトを読み取り、元の売上一覧を /tmp/sales-report.png へプレビューし、/tmp/sales-report.xlsx に保存して損失情報を確認し、セッションを閉じてください。
```

ワークブックを開き、入力シートとレポートシートを作ります。空のセッションの最初のシートは、`Data!` の範囲へ書き込む前に名前を変更します。

#### `formulon_open_workbook`

```json
{
  "sessionId": "sales-report"
}
```

#### `formulon_sheet_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "rename",
  "index": 0,
  "newName": "Data"
}
```

#### `formulon_sheet_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "add",
  "name": "Report"
}
```

最初の 4 件のデータを書き込みます。入力範囲には見出し行を含め、テーブルを 6 行目まで広げる前に 5 件目のデータを追加します。

#### `formulon_set_range`

```json
{
  "sessionId": "sales-report",
  "start": "Data!A1",
  "values": [
    ["Region", "Product", "Amount"],
    ["East", "Pen", 20],
    ["East", "Book", 10],
    ["West", "Pen", 5],
    ["South", "Pen", 7]
  ],
  "recalc": true
}
```

ネイティブテーブルを作成します。見出しが有効な文字列なので、`columns` を省略して 1 行目から生成できます。

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "create",
  "range": "Data!A1:C5",
  "name": "Sales",
  "style": "TableStyleMedium2"
}
```

ワークブックに先行するネイティブテーブルがなければ、意味のある結果は `table.index: 0`、`table.ref: "A1:C5"`、`table.sheetName: "Data"` です。シートごとに 0 から始まると仮定せず、この番号を保持します。

テーブルを一覧し、入力行と合計行を追加して、取得したグローバルなインデックスを更新します。

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "list"
}
```

#### `formulon_set_range`

```json
{
  "sessionId": "sales-report",
  "start": "Data!A6",
  "values": [["North", "Book", 12]],
  "recalc": false
}
```

更新の前に、5 件の入力レコードの外側へ合計行を書き込みます。

#### `formulon_set_range`

```json
{
  "sessionId": "sales-report",
  "start": "Data!A7",
  "values": [["Total", null, { "f": "=SUM(C2:C6)" }]],
  "recalc": true
}
```

#### `formulon_table_operation`

```json
{
  "sessionId": "sales-report",
  "operation": "update",
  "index": 0,
  "ref": "Data!A1:C7",
  "totalsRow": true
}
```

更新では 3 列の幅を維持し、`table.ref: "A1:C7"` を返します。`totalsRow` は生のテーブルデータにも反映されます。テーブルのメタデータと入力セルは別に管理されるため、ワークシートへ行を追加しても `ref` を更新するまではテーブルの範囲は広がりません。

レポートシートにピボットテーブルを作ります。`Region` を `rows`、`Product` を `columns`、`Amount` を 2 件の `values` に割り当てます。1 つの入力値フィールドへ 2 種類の集計を指定できますが、入力見出しは役割として 1 回だけ割り当てます。

#### `formulon_create_pivot`

```json
{
  "sessionId": "sales-report",
  "sourceRange": "Data!A1:C6",
  "target": "Report!A1",
  "name": "SalesByProduct",
  "rows": ["Region"],
  "columns": ["Product"],
  "pages": [],
  "values": [
    { "field": "Amount", "aggregation": "sum", "name": "Revenue", "numberFormat": "#,##0" },
    { "field": "Amount", "aggregation": "average", "name": "Average amount", "numberFormat": "#,##0.00" }
  ],
  "layout": "tabular",
  "grandTotals": { "rows": true, "columns": true },
  "sourceLimit": 50
}
```

結果には `source`（`sheet`、`sheetName`、`ref`、`headers`、見出しを除くデータ行数の `rows`）、解決済みの `target`、数値の `cacheId`、数値の `pivotIndex`、エンジンの `layout`、`status` が含まれます。このデータでは、入力の `rows` は `5` で、レポートの `layout.cells` には East、West、South、North の行が入ります。Revenue はそれぞれ 30、5、7、12 で、行の総計は 54 です。平均値のフィールドは分離され、指定した `#,##0.00` 形式を使います。

保存前に入力を読み取ります。ネイティブのピボットテーブルのレポートは `formulon_create_pivot` の `layout.cells` に返されます。通常の保存セル範囲ではないため、`formulon_get_range` からは読み取れません。

#### `formulon_get_range`

```json
{
  "sessionId": "sales-report",
  "range": "Data!A1:C7",
  "includeFormulas": true,
  "recalc": false,
  "maxCells": 100
}
```

返された `layout.cells` と `pivotIndex` を使い、固定のレポート幅を仮定しません。ワークシートの画像が必要な場合は、返されたセルを解釈した後に `formulon_set_range` または `formulon_set_cells` で明示的なスナップショットを書き込みます。このスナップショットは通常のワークシートデータであり、ネイティブのピボットテーブルとは別です。

元の売上一覧を明示的な範囲でプレビューし、PNG を書き出します。

#### `formulon_preview_range`

```json
{
  "sessionId": "sales-report",
  "range": "Data!A1:C6",
  "scale": 1,
  "showGridLines": false,
  "showPageBreaks": true,
  "recalc": false,
  "outputPath": "/tmp/sales-report.png"
}
```

最初の MCP コンテンツは PNG 画像で、次がプレビューメタデータです。このプレビューは入力一覧を表示します。明示的にワークシートのスナップショットを書かない限り `Report!` のプレビューは空になり、ネイティブのピボットテーブルの値は `layout.cells` の結果から読み取ります。

作成したテーブルとピボットテーブルのメタデータは XLSX へ保存します。

#### `formulon_save_session`

```json
{
  "sessionId": "sales-report",
  "outputPath": "/tmp/sales-report.xlsx"
}
```

配布前に `format`、`bytes`、省略可能な `losses` を確認します。XLSB 出力ではテーブル、ピボットテーブル、印刷設定、コメントなどが延期または失われることがあります。情報を失った保存では、メモリ上のワークブックが成果物に完全には表現されないため、セッションは変更あり（dirty）のままです。保存結果を確認してから終了します。

#### `formulon_close_workbook`

```json
{
  "sessionId": "sales-report"
}
```

## 2 つの表の使い分け

行、数式、列幅、印刷範囲を 1 つのレイアウトとして作る領収書や請求書には文書の `table` ブロックを使います。名前、フィルター情報、TableStyle、見出しフラグ、合計行フラグが必要なネイティブテーブルには `formulon_table_operation` を使います。入力範囲を元にしたレポートオブジェクトと軸・集計が必要なら `formulon_create_pivot` を使います。どちらのネイティブ機能も XLSX へ保存し、ファイルを完成品として扱う前に書き込み時の `losses` を確認します。
