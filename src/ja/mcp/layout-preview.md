---
description: 画面の見本から編集可能なセル配置を作り、上限付きのレイアウトバッチと PNG・SVG プレビューで確認します。
---

# レイアウトとプレビュー

`formulon_apply_layout` でスクリーンショットから読み取った配置をワークシートへ適用し、`formulon_preview_range` で結果を確認します。レイアウトバッチはワークシートの構造とスタイルを変更します。プレビューは描画画像と位置情報を返しますが、ワークブックへ画像を挿入しません。

フォームでは次の流れを使います。

1. 新規または既存のワークブックをセッションとして開きます。
2. `formulon_set_range` または `formulon_set_cells` でラベル、値、数式をセルへ書き込みます。
3. `formulon_apply_layout` で列、行、結合、スタイル、印刷設定を順序付きで適用します。
4. `formulon_get_range` または `formulon_inspect_layout` で編集した範囲を読み取ります。
5. `formulon_preview_range` でプレビューし、必要なら明示的な `.png` または `.svg` の成果物を書き出します。
6. 明示的な `.xlsx` パスへ保存し、`losses` を確認します。
7. セッションを終了します。

## 順序付きレイアウトバッチを適用する

`formulon_apply_layout` は `sessionId`、省略可能な `sheet`（0 始まりの番号または名前）、1 件から 200 件の `operations` を受け取ります。最初の変更を行う前に全操作を検証します。その後、指定された順番で操作を適用します。後のスタイルで先に作った罫線を調整でき、後の結合で先に設定したサイズを使えます。

操作の形は 5 種類です。

| `type` | 入力 |
| --- | --- |
| `column` | `first`、省略可能な `last`、0 以上の `size`、省略可能な `unit`（`chars`、`pt`、`px`、`mm`）です。`last` の既定値は `first` です。 |
| `row` | `first`、省略可能な `last`、0 以上の `size`、省略可能な `unit`（`pt`、`px`、`mm`）です。`last` の既定値は `first` です。 |
| `merge` | 選択したシートの A1 `range` と `operation`（`add` または `remove`）です。 |
| `style` | A1 `range`（限定した範囲、`C:C` のような列全体、`1:1` のような行全体）、`style` オブジェクト、省略可能な `base`（`existing` または `default`）です。列全体・行全体はセルを作らず、列・行のスタイルとして適用します。 |
| `print` | `formulon_print_settings` が受け付ける空でない `settings` オブジェクトです。 |

列幅の既定単位は Excel の文字単位です。行高の既定単位はポイントです。`px` と `mm` は 96 DPI の表示基準で変換し、Excel の文字単位またはポイントで保存します。結果には保存値と、`points`、`pixels`、`mm` を持つ `displayGeometry` が含まれます。

列幅の変換は、エンジンのシートごとの表示用列幅モデルと Normal フォントの校正を使います。ポイントで正の列幅を指定する場合は、モデルの表示用余白を超える必要があります。ゼロは指定できます。行・列の寸法もエンジンから取得し、シートの既定値と非表示状態を反映します。

`style` オブジェクトには `font`（`name`、`size`、`bold`、`italic`、`strike`、`underline`、`vertAlign`、`color`）、`fill`（`color`、`bgColor`、`pattern`）、`border`（`all`、`outline`、`left`、`right`、`top`、`bottom`）、`numberFormat`、`align`（`horizontal`、`vertical`、`wrapText`、`indent`、`textRotation`、`shrinkToFit`）を指定できます。色は `#RRGGBB` または `#AARRGGBB` です。`border.all` は各セルを囲み、`border.outline` は外周だけを描きます。

レイアウトの `style` 操作では `base` を使います。`base: "existing"` は各セルの現在のスタイルへ差分を加え、`base: "default"` は各セルをワークブックの既定スタイルから始めます。単独の `formulon_style_range` では同じ項目が `baseOn` です。そちらの入力では `baseOn` を使い、`base` は使いません。

5 種類の操作をすべて含むバッチの例は、後述の[エンドツーエンド例](#reproduce-a-form)にあります。応答には操作ごとの項目が 1 つずつ入ります。列の項目は `storedUnits: "chars"`、行の項目は `storedUnits: "pt"` を返します。スタイルの項目は解決済み範囲、基準、変更したスタイル領域を返します。事前検証のエラーではセッションは変更されず、そのバッチの操作も適用されません。

### 範囲と失敗時の挙動

レイアウトの上限は入力契約の一部です。

| 上限 | 値 |
| --- | ---: |
| 1 バッチの操作数 | 200 |
| 保存する列幅 | Excel の文字単位で 255 |
| 保存する行高 | 409 ポイント |
| 行操作で展開される行数 | 10,000 行 |
| 1 バッチのスタイル対象セル数 | 100,000 セル（列全体・行全体は数えません） |
| 列番号 | 0 から 16,383（`XFD`） |
| 行番号 | 0 から 1,048,575（Excel の行 1,048,576） |

事前検証では、範囲、単位、寸法、印刷範囲、印刷タイトル、上限をすべて確認してから変更を始めます。事前検証後の適用はトランザクションではありません。検証を通った操作でも、エンジンが途中で失敗すると先行する操作がワークブックに残り、セッションは変更あり（dirty）のままになる場合があります。その場合はセッションを読み取り、部分結果を破棄するなら新しいセッションで入力元を開き直します。

## 範囲をプレビューする

`formulon_preview_range` の項目は次のとおりです。

| 項目 | 既定値と意味 |
| --- | --- |
| `sessionId` | 開いているセッションを必ず指定します。 |
| `sheet` | 省略すると最初のシートです。シート名または 0 始まりの番号を使います。 |
| `range` | 省略可能な A1 範囲です。 |
| `scale` | `1` です。`0.25` から `2` の範囲です。 |
| `showGridLines` | `false` です。 |
| `showPageBreaks` | `true` です。 |
| `recalc` | `false` です。`true` にすると描画前に再計算し、セッションを変更あり（dirty）にします。 |
| `outputPath` | `.png` または `.svg` で終わる省略可能な成果物パスです。 |

MCP 応答の最初のコンテンツは MIME が `image/png` の PNG 画像です。2 番目のコンテンツは JSON メタデータです。`outputPath` を指定すると、生成した PNG または SVG もそのパスへ書き込みます。`.svg` を指定しても最初の応答項目は変わらず、MCP の先頭は PNG です。別のプロセスへファイルを渡す場合は明示的な成果物パスを使います。

`range` を省略すると、印刷範囲が 1 つだけならそれを使い、印刷範囲がなければ使用セルに結合範囲を加えた範囲を使います。印刷範囲が複数あるシートでは明示的な範囲が必要です。空のシートも明示的な範囲が必要です。明示した範囲が結合セルを途中で切る場合は拒否されるため、結合全体を含む範囲を指定します。シート名付きの範囲と異なる `sheet` を同時に指定した場合も拒否されます。

下のフォーム入力では、先頭列 180 px と他の 3 列 96 px から `logicalWidth: 351` ポイントになります。36 px のタイトル行と 24 px の本文 4 行から `logicalHeight: 99` ポイントになります。`scale: 1` では PNG のメタデータが `scaledWidth: 468`、`scaledHeight: 132`、`pageCount: 1` を返します。応答には `sheet`、`sheetName`、`range`、`scale`、`fontList`、`rowBreaks`、`colBreaks`、`warnings`、`cells`、`cellGeometryUnit: "pt"`、`metadataTruncated`、`omittedCellCount`、`warningsTruncated` も含まれます。

`cells` は空でないセルまたは数式セルを最大 500 件まで返します。セルごとのテキストと数式は 256 文字で切り詰め、フラグで切り詰めを示します。`logicalWidth` と `logicalHeight` はポイントです。セルの `x`、`y`、`width`、`height` もポイントです。

`pages` はシート全体のページ情報で、`count`、印刷用 `scale`、`paperWidthPt`、`paperHeightPt`、`landscape`、最大 50 件の A1 `ranges`、`rangesTruncated` を返します。この印刷倍率は、最上位のプレビュー画像用 `scale` とは別です。`objects` には範囲と交差する描画の `objectId`、`kind`、`name`、`rendered` が入ります。印刷設定の取得にも `settings.layout` があり、用紙、ポイント単位の余白、印刷可能領域、倍率、ページ順、改ページ位置と手動フラグ、最大 50 件のページ範囲と `pagesTruncated` を返します。

### プレビューの上限

プレビューは描画前に次の上限を検査します。

| 上限 | 値 |
| --- | ---: |
| 指定範囲の面積 | 10,000 セル |
| 拡大後の画像の幅または高さ | 4,096 ピクセル |
| 拡大後の画像の面積 | 8,000,000 ピクセル |
| 生成する SVG | 4 MiB |
| 使用範囲を検出するためのセル列挙 | 1,000,000 セル |
| 指定範囲と交差する結合範囲 | 10,000 |
| プレビューと交差する描画オブジェクト | 100 |
| 埋め込む画像の Base64 文字列の累計 | 2 MiB |
| メタデータ内のページ範囲 | 50 |
| メタデータのセル数 | 500 |
| セルごとのメタデータ文字列 | 256 文字 |
| 異なる警告メッセージ | 100 |

セル列挙の上限は、`range` を省略し、印刷範囲からも対象を決められない場合だけ適用します。範囲を明示すると数式と結合はその矩形内だけを取得するため、範囲外のセルはこの列挙上限に数えません。

## 描画の近似

プレビューはワークシート範囲の描画です。印刷ページ全体の描画には対応しません。インストール済みのシステムフォントとエンジンの表示寸法を使い、有効なスタイル、テーマ色・インデックス色、表示形式に従うテキストもエンジンが解決します。テーマがない場合や読み取れない場合は、既定の Office テーマを使って警告します。別のマシンでは Excel が別のフォントへ置き換える場合があります。

条件付き書式は適用せず、ヘッダー、フッター、ページ余白も描画しません。セルの表示テキスト、結合、塗りつぶし、罫線、配置、ページ計算による改ページ線を描画します。PNG、JPEG、GIF は埋め込み上限内なら画像として描画します。グラフ、図形、BMP、非対応または大きすぎる画像は破線の代替表示になります。パターン塗り、回転文字、縮小表示、斜め罫線は近似です。結果を判断する際は、`warnings` と各オブジェクトの `rendered` を確認してください。条件付き書式は、代わりに[ルールを評価](/ja/mcp/conditional-formats-validation#evaluate)して確かめます。

`recalc: true` は描画前に現在の数式値を取得します。プレビュー自体は何も書き込みませんが、再計算でキャッシュ値が変わるため、セッションは変更あり（dirty）になります。キャッシュ値を比較対象にする場合は `recalc: false` を使います。

## 画像を挿入・確認する {#images}

先にセッションを開き、20 MiB 以下の既存の PNG、JPEG、GIF、BMP ファイルを用意します。`formulon_image_operation` は選択したシートの、シート名を付けないセル参照へ画像を挿入します。寸法とオフセット（`width`、`height`、`offsetX`、`offsetY`）は `{size,unit?}` で指定し、単位は既定 `pt`、または `px`、`mm` です。片方の寸法だけを指定すると縦横比を保ち、両方省略すると画像のピクセル寸法を 96 DPI で使います。`anchorKind` は `oneCell` または `twoCell` で、`twoCell` は行・列のサイズ変更に追従して伸縮します。挿入では省略すると `oneCell` になります。

挿入結果には `objectId`、元画像の寸法、配置が入ります。一覧は画像、グラフ、図形などを含みます。取得は画像のバイト列を返し、移動、並べ替え、削除は画像とグラフが対象です。下の `2` は、応答で返された画像 ID に置き換えてください。取得は既知の形式なら画像コンテンツ、続いて JSON メタデータを返します。`outputPath` を指定すると、画像のバイト列をそのファイルにも書き出します。

#### `formulon_image_operation`: insert

```json
{
  "sessionId": "form-layout",
  "sheet": "Sheet1",
  "operation": "insert",
  "path": "/tmp/logo.png",
  "anchor": "B2",
  "width": { "size": 96, "unit": "px" },
  "name": "Logo",
  "description": "Company logo"
}
```

#### `formulon_image_operation`: list

```json
{ "sessionId": "form-layout", "operation": "list" }
```

#### `formulon_image_operation`: get

```json
{ "sessionId": "form-layout", "operation": "get", "objectId": 2, "outputPath": "/tmp/extracted-logo.png" }
```

#### `formulon_image_operation`: remove

```json
{ "sessionId": "form-layout", "operation": "remove", "objectId": 2 }
```

`move` は、指定した `anchor`、`offsetX`、`offsetY`、`width`、`height`、`anchorKind` だけを変更します。省略した項目は現在の値を保ち、幅か高さの片方だけを指定したときはオブジェクトの縦横比を保ちます。オブジェクトの ID、名前、代替テキストは変わらず、画像ではトリミングと回転も変わりません。結果は `{session,sheet,objectId,placed}` です。

#### `formulon_image_operation`: move

```json
{
  "sessionId": "form-layout",
  "operation": "move",
  "objectId": 2,
  "anchor": "D4",
  "width": { "size": 120, "unit": "px" }
}
```

`reorder` は `objectId` と、一覧順での移動先 `index` を取ります。一覧順は背面から前面の順なので、`0` が最背面です。結果は `{session,sheet,objectId,index,order}` で、`order` に新しい順序のオブジェクト ID が入ります。

#### `formulon_image_operation`: reorder

```json
{ "sessionId": "form-layout", "operation": "reorder", "objectId": 2, "index": 0 }
```

挿入、移動、並べ替え、削除はセッションを変更ありにし、他の描画オブジェクトは保持します。対象範囲のプレビューで配置を確認し、XLSX を明示して保存してください。XLSB 保存では OOXML の描画を省略し、損失として報告します。詳しくは [ファイル形式](/ja/workbook/file-formats#xlsb) を参照してください。プレビュー自体は画像を挿入・削除しません。

## エンドツーエンド例: スクリーンショットからフォームを再現する {#reproduce-a-form}

次のプロンプトは、見た目を編集可能なセルへ変換し、結果を確認するようエージェントへ指示します。

```text
提供された申請書のスクリーンショットを、編集可能な Sheet1 のグリッドとして再現してください。タイトルを A1:D1 に置き、列 A は 180 px、列 B:D は 96 px、行 1 は 36 px、行 2:5 は 24 px にします。ラベルと値はワークシートのセルとして保持してください。順序付きの 1 回のバッチでレイアウトを適用し、A1:D5 を /tmp/form-layout.png にプレビューし、セルとメタデータを読み取り、/tmp/form-layout.xlsx に保存してセッションを閉じてください。プレビューは近似であることを明記し、警告を報告してください。
```

後続の `Sheet1` 範囲が意図した最初のシートを指すように、安定したセッション ID と Windows 英語の既定プロファイルを指定して空のワークブックを開きます。別のプロファイルを選ぶ場合は、返されたシート名を使います。

#### `formulon_open_workbook`

```json
{
  "sessionId": "form-layout",
  "profile": "win-365-en_US"
}
```

編集可能なラベルと値を書き込みます。`null` はセルを変更せず、`{ "f": "..." }` は数式を書き込みます。

#### `formulon_set_range`

```json
{
  "sessionId": "form-layout",
  "start": "Sheet1!A1",
  "values": [
    ["Application form", null, null, null],
    ["Name", "Aki Sato", null, null],
    ["Department", "Design", null, null],
    ["Quantity", 3, null, null],
    ["Amount", 120000, null, null]
  ],
  "recalc": false
}
```

レイアウトを適用します。タイトルのスタイル操作は `base: "default"` を使い、本文のスタイル操作は `base: "existing"` を使います。本文の操作はバッチ内でタイトルの後にあります。

#### `formulon_apply_layout`

```json
{
  "sessionId": "form-layout",
  "sheet": "Sheet1",
  "operations": [
    { "type": "column", "first": 0, "size": 180, "unit": "px" },
    { "type": "column", "first": 1, "last": 3, "size": 96, "unit": "px" },
    { "type": "row", "first": 0, "size": 36, "unit": "px" },
    { "type": "row", "first": 1, "last": 4, "size": 24, "unit": "px" },
    { "type": "merge", "operation": "add", "range": "A1:D1" },
    {
      "type": "style",
      "range": "A1:D1",
      "base": "default",
      "style": {
        "font": { "name": "Yu Gothic", "size": 16, "bold": true, "color": "#FFFFFF" },
        "fill": { "color": "#1F4E79" },
        "align": { "horizontal": "center", "vertical": "center" },
        "border": { "outline": "medium" }
      }
    },
    {
      "type": "style",
      "range": "A2:D5",
      "base": "existing",
      "style": { "border": { "all": "thin" }, "align": { "vertical": "center" } }
    },
    { "type": "print", "settings": { "printArea": "A1:D5", "printOptions": { "gridLines": false } } }
  ]
}
```

意味のある応答は、保存単位と `displayGeometry`、追加された `A1:D1` の結合、2 つのスタイル領域、適用された印刷範囲を返します。後の操作に不正な範囲があれば、事前検証がエラーを返し、この操作群はどれもセッションを変更しません。

レイアウト後にセルを読み取ります。

#### `formulon_get_range`

```json
{
  "sessionId": "form-layout",
  "range": "Sheet1!A1:D5",
  "includeFormulas": true,
  "recalc": false,
  "maxCells": 100
}
```

範囲を明示して PNG の成果物へプレビューします。

#### `formulon_preview_range`

```json
{
  "sessionId": "form-layout",
  "range": "Sheet1!A1:D5",
  "scale": 1,
  "showGridLines": false,
  "showPageBreaks": true,
  "recalc": false,
  "outputPath": "/tmp/form-layout.png"
}
```

結果の先頭は PNG 画像です。続く JSON メタデータには `Sheet1!A1:D5`、フォント、セルの位置情報、ページ数、近似に関する警告、メタデータの切り詰め状態が含まれます。ベクター成果物が必要なら `outputPath: "/tmp/form-layout.svg"` で再度呼び出します。その場合も MCP 応答の先頭は PNG です。

別のワークブックパスへ保存し、結果を確認します。

#### `formulon_save_session`

```json
{
  "sessionId": "form-layout",
  "outputPath": "/tmp/form-layout.xlsx"
}
```

保存応答にはバイト数、選択形式、`losses` が含まれます。成果物とメタデータを確認してからセッションを終了します。

#### `formulon_close_workbook`

```json
{
  "sessionId": "form-layout"
}
```
