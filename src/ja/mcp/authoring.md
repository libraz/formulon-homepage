---
description: 名前付きブロックから印刷用のワークブック文書を作成し、確認、プレビュー、保存、セッション終了まで行います。
---

# 文書を作成する

`formulon_build_document` は、名前付きブロックの配列から開いているワークブックに文書を書き込みます。配列から行、結合、表の罫線、表示形式、列幅、数式、印刷範囲を計算します。応答には A1 の対応表が含まれるため、後続のツールで正確な範囲を調整できます。

このツールが扱うのは文書の配置です。請求書、領収書、申請書、税計算の意味は決めません。ラベル、税率、丸め、業務ルールは呼び出し側が渡す値と数式で表します。

## 作成の流れ

編集全体で同じセッションを使います。

1. `formulon_open_workbook` に安定した `sessionId` を渡して新しいワークブックを開きます。
2. ブロックと印刷プリセットを指定して `formulon_build_document` を呼びます。
3. 返された名前と数式を `formulon_get_range` または `formulon_inspect_layout` で読み取ります。
4. `formulon_default_font`、`formulon_style_range`、`formulon_dimension_operation`、`formulon_print_settings` で返された範囲を調整します。
5. `formulon_preview_range` で最終範囲をプレビューします。応答の最初のコンテンツは PNG 画像で、次のテキストコンテンツが JSON メタデータです。
6. `formulon_save_session` に明示的な `.xlsx` の `outputPath` を渡して保存します。
7. `formulon_close_workbook` でセッションを終了します。

明示的な出力先を指定すると、確認用の成果物を入力ファイルから分離できます。新規セッションには入力元パスがないため、`outputPath` を省略すると保存に失敗します。既存ファイルを開いたセッションでは入力元パスにフォールバックするため、入力ファイルを上書きする場合があります。

## `formulon_build_document` の入力

必須項目は `sessionId` と空でない `blocks` 配列です。トップレベルのその他の項目は次のとおりです。

| 項目 | 意味 |
| --- | --- |
| `sheet` | `start` にシート名がない場合に使うシート名または 0 始まりの番号です。既定値は最初のシートです。 |
| `start` | `Sheet1!B2` のような左上の A1 アンカーです。既定値は `B2` で、上と左に 1 行・1 列の余白を残します。 |
| `width` | 文書の列数です。省略すると最も幅の広い表の列数になり、表がない文書は 2 列になります。 |
| `theme` | 下記の基本フォントと表の表示設定です。 |
| `print` | 名前付き印刷プリセットのいずれかです。プリセットは文書範囲を印刷範囲にも設定します。 |
| `repeatTableHeader` | 印刷ページごとに最初の表の見出しを繰り返します。`print` を指定した場合の既定値は `true` です。 |

ブロックは上から下へ配置します。`sameRow` は現在の行グループの開始行を使います。空いている列へ自動で移動する機能ではありません。`span` や左右の配置を指定して、各ブロックの列が重ならないようにしてください。重なりはエラーになりますが、エラーの前にセルが変更される場合があります。再試行する前に対象範囲を確認してください。`sameRow` を指定しない次のブロックは、現在の行グループで最も高いブロックの下から始まります。

### ブロックの全項目

すべてのブロックは `name` と `sameRow` を指定できます。

| ブロック | 項目 |
| --- | --- |
| `title` | `text` が必須です。`align`（`left`、`center`、`right`）、正の数の `size`、`bold` を指定できます。文書幅に合わせて結合します。 |
| `text` | `text` が必須です。`align`、正の数の `size`、`bold`、正の数の `span`、`wrap`、正の数の `rows` を指定できます。`span` は結合する列数を制限し、`rows` は折り返し用の複数行を確保します。 |
| `fields` | 空でない `items` が必須です。`align`（`left` または `right`）、正の数の `labelSpan`、正の数の `valueSpan`、`rule` を指定できます。`rule` は各値の範囲の下側に罫線を付けます。 |
| `table` | 空でない `columns` が必須です。`rows`、0 以上の `rowCount`、`bandColor` を指定できます。`rows` を省略したときの `rowCount` は、空の罫線付き行を作ります。 |
| `summary` | 空でない `items` が必須です。`align`（`left` または `right`）、正の数の `labelSpan`、正の数の `valueSpan`、`border` を指定できます。`border` の既定値は `true` です。 |
| `spacer` | 0 以上の `rows` を指定できます。既定値は 1 行で、`rows: 0` は行を確保しません。 |

`fields` と `summary` の各項目には `label`、省略可能なリテラルの `value`、省略可能な `formula`、省略可能な `format`、省略可能な `name` があります。`formula` と `value` を両方指定した場合は数式を優先します。値は値の範囲に書き、ラベルの範囲は `labelSpan` 列で結合します。`summary` の項目では `emphasis: true` も使えます。行を太字にし、`border` が有効な場合は外周の罫線も追加します。

既定値は、中央揃え・18 ポイント・太字の `title`、左揃え・1 行・太字なしで文書幅を `span` に使う `text`、左揃えで `labelSpan: 1` と `valueSpan: 1` の `fields`、右揃えで `valueSpan: 1` と `labelSpan: min(2, width - 1)` の `summary` です。

表の列には次の項目があります。

| 項目 | 意味 |
| --- | --- |
| `header` | 表示する見出しです。既定の数式キーにもなります。 |
| `key` | 数式と行オブジェクトで使うキーです。省略すると `header` を使います。 |
| `formula` | 行ごとの数式です。`{qty}` のような波括弧の名前は、その行の列セルに結び付きます。その列の行に値がない場合に数式を書き込みます。 |
| `width` | Excel の文字単位で指定する列幅です。 |
| `format` | 表示形式の別名または Excel の表示形式コードです。 |
| `align` | `left`、`center`、`right` のいずれかです。 |

表の行には位置配列または列の `key`・`header` をキーにしたオブジェクトを使えます。オブジェクトの項目がない場合は値を書き込みません。新しい文書領域では空セルになりますが、既存セルには前の値が残ります。位置配列の値は列の順番に対応します。`rowCount` は、納品後に入力するフォームで便利です。

## 名前とプレースホルダー

数式では `{name}` 形式のプレースホルダーを使えます。ビルダーは先行するブロックが作った A1 アドレスへ置き換えます。未知の名前は、誤った範囲を指す数式を書かずにエラーにします。`{1,2;3,4}` のような Excel の配列定数はそのまま残ります。

応答の `names` オブジェクトには次の項目が入ります。

| 生成元 | 登録される名前 |
| --- | --- |
| タイトル | 既定では `title` で、ブロック名を指定した場合はその名前です。 |
| 名前付きテキスト | テキストブロックの `name` です。 |
| フィールド | 各項目のラベルまたは項目の `name` です。ブロック名も指定した場合は `<block>.<item>` が追加されます。ブロック名はブロック全体の範囲になります。 |
| 表 | `<prefix>`、`<prefix>.header`、`<prefix>.body`、`<prefix>.<header>` です。`prefix` はブロック名、または `table` です。列の `key` があれば `<prefix>.<key>` も登録します。 |
| 集計 | 各項目のラベルまたは項目の `name` です。ブロック名も指定した場合は `<block>.<item>` が追加されます。ブロック名はブロック全体の範囲になります。 |

本体行がある表では、行数式の `{qty}` と `{unit}` が同じ行のセルを指し、応答には `.body` と列範囲が含まれます。本体行がない入力用表では、表範囲と見出し範囲だけが登録されます。表の外の数式では `{table.Amount}` が金額列の本体範囲を指します。後続の集計項目は `{Subtotal}` のように先行項目を参照できます。これにより、表の本体位置が決まった後に `=SUM({table.Amount})` を結び付けられます。

各種類のブロックが 1 つだけなら既定の名前を使えます。複数の表や同じラベルがある文書では、ブロックと項目に明示的な名前を付けてください。

## 表示形式、日付、印刷設定

`format` には Excel の表示形式コード、または次の別名を指定できます。

| 別名 | Excel のコード |
| --- | --- |
| `date` | `yyyy/mm/dd` |
| `datetime` | `yyyy/mm/dd hh:mm` |
| `time` | `hh:mm` |
| `number` | `#,##0` |
| `decimal` | `#,##0.00` |
| `percent` | `0.0%` |

`2026-08-22` のような ISO 日付文字列に日付形式を指定すると、Excel の日付シリアル値へ変換します。日付に見える文字列ではなく、日付の値として保存されます。通貨には `"¥"#,##0` のようなリテラル形式を使います。

`print` には `a4-portrait`、`a4-portrait-fit`、`a4-landscape`、`a4-landscape-fit`、`letter-portrait`、`letter-portrait-fit`、`letter-landscape`、`letter-landscape-fit` を指定できます。`-fit` 付きのプリセットは横幅を 1 ページに合わせ、高さは制限しません。行数の多い表は後続ページへ流れます。`repeatTableHeader` を `false` にしない限り、最初の表の見出しを繰り返します。印刷プリセットを使った応答には `pageCount` が含まれます。

ビルド後に設定を変える場合は、`formulon_print_settings` に部分更新を渡します。

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

`paperSize: 9` は A4、`paperSize: 1` は Letter です。ヘッダーとフッターは Excel のコードを使います。`&L`、`&C`、`&R` は位置、`&P` と `&N` はページ番号、`&D` は日付、`&&` はアンパサンドを表します。設定を省略して読み取りだけを行うと、保存済みの設定と `pageCount` が返ります。

余白（`left`、`right`、`top`、`bottom`、`header`、`footer`）の単位はインチです。`0.5` は 12.7 mm に相当します。

## フォントとスタイルの調整

`theme` には `font`、`size`、`accent`、`headerText`、`border`、`outline` を指定できます。テーマのフォントとサイズはビルダーが書き込むセルに適用されます。`accent` は表の見出し帯を塗り、`headerText` を見出し文字色に使います。`border` の既定値は `thin`、`outline` の既定値は `medium` です。

日本語の文書や指定フォントを使う文書では、ワークブックの既定フォントを一度設定します。`font` を省略すると読み取りになり、指定したプロパティだけが更新されます。

#### `formulon_default_font`

```json
{
  "sessionId": "invoice",
  "font": { "name": "Yu Gothic", "size": 11 }
}
```

既定フォントは、明示的なスタイルを持たないセルに適用されます。`name` を指定すると、そのフォントレコードのテーマリンクも外れるため、テーマが変わっても指定した書体を保持します。

範囲ごとの調整には `formulon_style_range` を使います。各プロパティは差分として適用されるため、見出しに塗りつぶしと太字を加えても、既存の罫線や表示形式は消えません。`baseOn` の既定値は `existing` で、`default` を指定すると、ワークブックの既定スタイルを基準に各セルへ適用します。

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

`style` には `font`（`name`、`size`、`bold`、`italic`、`strike`、`underline`、`vertAlign`、`color`）、`fill`（`color`、`bgColor`、`pattern`）、`border`（`all`、`outline`、`left`、`right`、`top`、`bottom`）、`numberFormat`、`align`（`horizontal`、`vertical`、`wrapText`、`indent`、`textRotation`、`shrinkToFit`）を指定できます。色は `#RRGGBB` または `#AARRGGBB` です。`border.all` は範囲内の各セルを罫線で囲み、`border.outline` は外周だけに枠を付けます。スタイルを付けた範囲の空セルも実体化するため、空の入力フォームにも罫線が表示されます。

## エンドツーエンド例: 印刷用請求書

次のプロンプトは、確認可能な請求書を作るための制約をエージェントに渡します。

```text
`invoice-demo` というセッションで新しいワークブックを開き、B2 から印刷用の請求書を作成してください。明細表の列は Item、Qty、Unit、Amount とし、各行の Amount、小計 Subtotal、10% の税額 Tax、合計 Total を数式で計算してください。税の扱いはここで指定した数式に従い、地域の税制は推測しないでください。日本語を表示できる既定フォントを設定し、値と数式を読み取り、B2:E13 を PNG でプレビューしてください。最終結果を /tmp/invoice-demo.xlsx に保存して保存結果を確認し、セッションを閉じてください。
```

空のセッションを開きます。

#### `formulon_open_workbook`

```json
{
  "sessionId": "invoice-demo"
}
```

文書を作る前にワークブックの既定フォントを設定します。

#### `formulon_default_font`

```json
{
  "sessionId": "invoice-demo",
  "font": { "name": "Yu Gothic", "size": 11 }
}
```

文書を作成します。`date` 形式を指定した日付は日付シリアル値で保存されます。

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

ビルド応答で確認する値は次のとおりです。

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

調整や保存の前に、値と数式を読み取ります。

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

疎な応答には、`E8` の `=C8*D8` と値 `360000`、`E9` の `=C9*D9` と値 `490000`、`E11` の `=SUM(E8:E9)` と値 `850000`、`E12` の `=ROUND(E11*0.1,0)` と値 `85000`、`E13` の `=E11+E12` と値 `935000` が含まれます。ビルダーは、ここで渡した数式以外の税ルールを追加・解釈しません。

同じ範囲をプレビューし、PNG の成果物を明示的に書き出します。

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

MCP の結果では最初に `image/png` のコンテンツが返ります。2 番目のコンテンツは、選択範囲、論理・拡大後の寸法、フォント一覧、ページ数、改ページ、警告、セルの位置情報を含む JSON メタデータです。メタデータだけで画像の確認を置き換えないでください。

保存結果を確認します。

#### `formulon_save_session`

```json
{
  "sessionId": "invoice-demo",
  "outputPath": "/tmp/invoice-demo.xlsx"
}
```

応答には `outputPath`、`bytes`、`format: "xlsx"`、省略可能な書き込み時の `losses` が含まれます。作成した文書は XLSX で保存すると、印刷設定とスタイルを保持できます。結果を確認したら、インメモリのワークブックを終了します。

#### `formulon_close_workbook`

```json
{
  "sessionId": "invoice-demo"
}
```

## 次に使うツール

新しい文書を積み上げ、数式を名前で記述できる場合は `formulon_build_document` を使います。既存ワークブックのセルが決まっていて表示だけを変える場合は `formulon_style_range`、`formulon_dimension_operation`、`formulon_print_settings` を使います。範囲をフィルター付きの Excel 構造化テーブルとして管理する場合は `formulon_table_operation` を使います。ここでの `table` ブロックは罫線付きの表示用表を作るだけで、ネイティブのテーブルオブジェクトは作りません。
