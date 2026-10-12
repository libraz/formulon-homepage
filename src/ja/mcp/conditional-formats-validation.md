---
description: formulon-mcp でブックに条件付き書式と入力規則を追加し、どのセルが一致するかを確かめて XLSX に保存します。
---

# 条件付き書式と入力規則

ルールは普段の言葉で頼めます。「1,000 を超える金額を赤くして」「ステータスが Draft の行全体に色を付けて」「C 列に Draft / Approved / Paid のドロップダウンを付けて」「金額の列には 0 から 2,000 だけ入力できるようにして」。エージェントは `formulon_conditional_format_operation` と `formulon_validation_operation` でルールを書き、セッション内で結果を確かめ、Excel で開いたときにルールが効いている `.xlsx` を保存します。

範囲、条件、見た目、出力ファイルを書いたプロンプトで足ります。

> `sales.xlsx` を開いて。`Sheet1!B2:B5` で 1000 を超える金額を薄い赤の塗りつぶしと濃い赤の文字にして。`C2:C21` に Draft、Approved、Paid のドロップダウンを付けて。一致するセルを確認してから `out/sales-rules.xlsx` に保存して。

## 作業例

シートには見出し行があり、`B2:B5` に金額、`C` 列にステータスが入っています。どちらのツールもセルを 0 始まりの番号で指定するので、`B2:B5` は列 1 の行 1 から 4 です。

### 1. スタイルを登録する

「1000 より大きい」のようなルールは、差分書式（*dxf*）を適用します。差分書式は、塗りつぶしや文字色など、ルールが変える属性だけを持つ書式です。高レベルのツールはこれを作らないため、`formulon_workbook_call` から許可リスト内の `addDxf` メソッドで登録します。

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

色は 10 進数の ARGB 整数で書きます。`4294952910` は `0xFFFFC7CE`（薄い赤）、`4288413702` は `0xFF9C0006`（濃い赤）です。`pattern: 1` は単色の塗りつぶしです。応答の `result.index` がこのスタイルの番号で、次の手順で `dxfId` として渡します。同じ内容のレコードをもう一度追加すると、新しい番号ではなく既存の番号が返ります。

### 2. ルールを追加する

`formulon_conditional_format_operation` に `operation: "add"` を渡します。

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

`type: 1` はセルの値を比べるルール、`op: 5` は「より大きい」です。応答の `result.index` は、シートのルール一覧の中でのこのルールの位置です。`dxfId` のないルールも受け付けられ、一致判定もされますが、見た目は何も変わりません。

### 3. ドロップダウンを付ける

`formulon_validation_operation` に `operation: "add"` を渡します。

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

直接書くリストは、Excel と同じく文字列の中に二重引用符を残します。省略した真偽値は `false` になるため、`allowBlank` と `showErrorMessage` は明示します。既定値が `true` なのは `showDropDown` だけです。

### 4. 確かめて保存する

範囲を評価してルールが当たるセルを確かめ、`formulon_save_session` に `.xlsx` の `outputPath` を明示して保存します。どちらの手順も後で説明します。

## 条件付き書式 {#conditional-formats}

### ルールの種類

`rule.type` は数値で、種類ごとに読むフィールドが決まっています。

| `type` | ルール | 読むフィールド |
| --- | --- | --- |
| 0 | 数式が真 | `formula1` |
| 1 | セルの値の比較 | `op`、`formula1`。範囲内・範囲外では `formula2` も |
| 2 | カラースケール | `colorScale` |
| 3 | データバー | `dataBar` |
| 4 | アイコンセット | `iconSet` |
| 5 | 上位・下位 N | `rank`、`percent`、`bottom` |
| 6 | 平均より上・下 | `aboveAverage`、`equalAverage`、`stdDev` |
| 7、8 | 文字列を含む・含まない | `text` |
| 9、10 | 指定の文字列で始まる・終わる | `text` |
| 11、12 | 空白・空白以外 | なし |
| 13、14 | エラー・エラー以外 | なし |
| 15 | 日付の期間 | `timePeriod` |
| 16、17 | 重複する値・一意の値 | なし |

セルの値の比較で使う `op` は、0 より小さい、1 以下、2 等しい、3 等しくない、4 以上、5 より大きい、6 範囲内、7 範囲外です。後述の入力規則の `op` とは番号の振り方が違います。`timePeriod` は、0 今日、1 昨日、2 明日、3 過去 7 日間、4 今週、5 先週、6 来週、7 今月、8 先月、9 来月です。

どのルールにも、1 つ以上の範囲を含む `sqref` が必要です。数式は先頭の `=` を付けずに書きます。数式内の相対参照は Excel と同じく最初の範囲の左上セルを基準に解釈されるので、`A2:D5` でステータスが Draft の行全体に色を付けるルールは `$C2` を使います。

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

解析できない数式は拒否され、ルールは追加されません。

### 数式ルールと比較ルールのスタイル

種類 0、1、5 から 17 は、`dxfId` で結果を表示します。`addDxf` のレコードは次の部分を任意で受け取り、指定した部分だけを書き出します。

| 部分 | よく使うフィールド |
| --- | --- |
| `font` | `colorArgb`、`bold`、`italic`、`strike`、`underline`、`size`、`name` |
| `fill` | `pattern`（1 で単色）、`fgArgb`、`bgArgb` |
| `border` | `left`、`right`、`top`、`bottom`。それぞれ `{style, colorArgb}` |
| `numFmt` | `numFmtId` と `formatCode` |

`font` 部分は常にフォントサイズを持ち、既定値は 11 です。サイズの違うセルの文字色などを変えるときは `size` も指定してください。塗りつぶしだけのスタイルならフォントには触れません。レコードの完全な宣言は、`formulon_workbook_api` に `operation: "describe"` と `method: "addDxf"` を渡すと返ります。登録済みのスタイルは、番号を渡して `getDxf` で読み返せます。

### カラースケール、データバー、アイコンセット

種類 2、3、4 は自分で色やアイコンを持ち、`dxfId` は使いません。種類に対応するペイロードのオブジェクトが必須です。最小値を白、最大値を緑にする 2 色スケールの例です。

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

しきい値の `type` は、0 数値、1 パーセント、2 百分位、3 最小値、4 最大値、5 数式、6 自動の最小値、7 自動の最大値です。数値、パーセント、百分位、数式のしきい値は、値を文字列で `value` に入れます。カラースケールのしきい値は 2 個か 3 個で、色も同じ数だけ渡します。データバーには `min`、`max`、`fill` が必要です。アイコンセットには `name`（0 から 16）と、アイコン数より 1 少ないしきい値が必要で、3 アイコンなら 2 個、4 アイコンなら 3 個、5 アイコンなら 4 個です。色は 0 から 255 の `{r, g, b}` で、`a` は省略できます。

### 順序、一覧、削除

ルールは `priority` の小さい順に適用されます。`priority` を省略すると、新しいルールは既存のルールの後ろに入ります。`stopIfTrue: true` にすると、一致したセルにはそれより優先度の低いルールが適用されません。

`operation: "list"` は、シート上の全ルールをこの順序で `result.items` に返します。各ルールには `id`、`type`、`priority`、`sqref`、`dxfId` と種類ごとのフィールドが入ります。1 つだけ削除するには、この一覧での位置を渡します。

```json
{
  "sessionId": "sales",
  "operation": "removeAt",
  "index": 1
}
```

追加や削除のたびに位置がずれるので、続けて `removeAt` するときは一覧を取り直してください。`operation: "clear"` はシート上の全ルールを削除します。

### 一致するセルを確かめる {#evaluate}

`operation: "evaluate"` は、シート上の全ルールを矩形の範囲で評価し、一致したセルを返します。ブックは変更しません。

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

`result.cells` には、1 つ以上のルールに一致したセルだけが入ります。各一致には `kind`（0 差分書式、1 カラースケール、2 データバー、3 アイコンセット）と `priority` があります。差分書式の一致は `dxfId` を持ち、ルールがスタイルを指定していれば `dxfIdEngaged` が `1` です。カラースケールの一致には算出した `color`、データバーには棒の長さと色、アイコンセットには `iconSetName` と `iconIndex` が入ります。

日付の期間ルールは今日の日付で結果が変わります。評価では、`todaySerial` に渡した Excel の日付シリアル値を今日として扱います。`todaySerial` を省略すると、日付の期間ルールはどれも一致しません。`0` は「無効」の意味にはなりません。`0` は 1899-12-30 のシリアル値なので、その日を今日として評価されます。2026-10-13 時点で「過去 7 日間」のルールを確かめるなら、その日のシリアル値を渡します。

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

`formulon_preview_range` は条件付き書式を描画しません。Excel で開く前にルールを確かめるには `evaluate` を使います。

## 入力規則 {#data-validation}

`validation.type` でセルに入れられる値の種類を決め、`op`、`formula1`、`formula2` で条件を決めます。

| `type` | 許可する値 | 条件 |
| --- | --- | --- |
| 0 | すべての値 | なし |
| 1 | 整数 | `op`、`formula1`、`formula2` |
| 2 | 小数 | `op`、`formula1`、`formula2` |
| 3 | リストの値 | `formula1` |
| 4 | 日付 | `op`、`formula1`、`formula2` |
| 5 | 時刻 | `op`、`formula1`、`formula2` |
| 6 | 指定した長さの文字列 | `op`、`formula1`、`formula2` |
| 7 | 数式が真になる値 | `formula1` |

入力規則の `op` は、0 次の値の間、1 次の値の間以外、2 次の値に等しい、3 次の値に等しくない、4 次の値より大きい、5 次の値より小さい、6 次の値以上、7 次の値以下です。`formula2` は「間」と「間以外」の上限です。`op` を省略すると 0（次の値の間）になります。

### ドロップダウンリスト

`formula1` には、作業例のように引用符で囲んだリストか、`"$H$2:$H$5"` のように選択肢が入ったセル範囲の参照を渡します。リストの検査は残してセル内の矢印を出さない場合は、`showDropDown: false` を指定します。

### 数値の範囲

0 から 2,000 までの金額だけを許可し、セルを選んだときに入力メッセージを出す例です。

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

### ユーザー設定の数式

ユーザー設定のルールは、数式が真になる入力を受け付けます。相対参照は最初の範囲の左上セルが基準で、数式に先頭の `=` は付けません。次の例は `A2:A21` の地域名が重複しないようにします。

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

### メッセージ

`errorStyle` は、規則に合わない入力を Excel がどう扱うかを決めます。0 は停止（既定値）、1 は注意、2 は情報です。エラーメッセージは `showErrorMessage: true` のときだけ、入力メッセージは `showInputMessage: true` のときだけ表示され、その文面を `errorTitle`、`errorMessage`、`promptTitle`、`promptMessage` で指定します。

### 一覧、削除、既存の値の確認

`operation: "list"` は、シートの入力規則を `result.items` に返します。各規則には全フィールドが埋まった状態で入ります。`removeAt` にはこの一覧での位置を渡し、`clear` はすべて削除します。`add` が成功しても返るのはステータスだけで番号は返らないため、位置が必要なときは一覧を取ってください。

規則を追加しても、すでに入っている値は変わりません。規則に合わない値を探すには、`formulon_workbook_call` からシート番号を渡して `listInvalidCells` を呼びます。

```json
{
  "sessionId": "sales",
  "method": "listInvalidCells",
  "args": [0]
}
```

結果には、規則に合わない各セルの行、列、値がページ単位で入ります。`result.nextCursor` が `null` でない間は、それを 2 番目の引数に渡して続きを取ります。この呼び出しは読み取り専用で、セッションを変更ありにしません。

## 保存 {#saving}

ルールとスタイルは、`formulon_save_session` が書き出すまでセッションの中だけにあります。保存先は `.xlsx` にします。

```json
{
  "sessionId": "sales",
  "outputPath": "out/sales-rules.xlsx"
}
```

`.xlsx` には、ルール、その差分書式、入力規則がすべて入ります。`.xlsb` に保存してもルールと入力規則は書き出されますが、応答の `losses.deferredFeatures` が報告され、そのファイルを Formulon で開き直すと条件付き書式とスタイルの対応が失われています。条件付き書式を含むブックは `.xlsx` で保存し、どちらの形式でも保存応答の `losses` を確認してください。

フィールドの一覧は[ツールリファレンス](/ja/mcp/tools#rich-workbook-objects)にあります。API の調べ方と低レベル呼び出しの決まりは[高度な API](/ja/mcp/advanced) を参照してください。
