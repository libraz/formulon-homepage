# MCP ワークフロー

`formulon-mcp` は、開いたワークブックを名前付きのインメモリセッションに保持します。通常は `formulon_open_workbook` で開き、構造と値を確認し、変更、再計算、プレビュー、保存、終了の順に進めます。

<DiagramFlow steps="formulon_open_workbook → 開く・調べる → 変更する → 再計算する → プレビューする → formulon_save_session → formulon_close_workbook" />

最初に 1 度開き、返された `session.id` を後続の呼び出しで使います。保存先には `outputPath` を明示します。セッションは相互に分離され、ワークブック、数式キャッシュ、変更あり（dirty）の状態、依存関係グラフを共有しません。

## 開いて調べる

複数回操作する既存ワークブックは、固定した ID で開きます。

```json
{
  "path": "input.xlsx",
  "sessionId": "monthly-edit"
}
```

`formulon_open_workbook` は `{ "session": ... }` を返します。セッションには ID、入力と出力のパス、作成・更新時刻、`dirty`、任意の `loadLosses` が入ります。ファイルを開くと 1 度再計算します。新規セッションには既定の `Sheet1` があり、`sourcePath` はありません。

セルの位置を指定する前に構造を調べます。

```json
{
  "sessionId": "monthly-edit",
  "includeCells": false,
  "maxCellsPerSheet": 200
}
```

`formulon_inspect_session` は `session` と、`sheets`、`definedNames`、ネイティブ `tables` を含むワークブック概要を返します。`includeCells` を `true` にするとセルの疎な一覧を含めます。`maxCellsPerSheet` の既定値は 200、上限は 10,000 です。使用範囲、結合、寸法、表示、保護、数式、スタイルが必要な場合は `formulon_inspect_layout` を使います。既定ではセルを含め、選択したシートごとに 10,000 セルまで返します。`formulon_detect_regions` と `formulon_analyze_workbook` は、構造が分からないシートを調べるための一定の規則に基づく分類・検出結果を返します。同じ入力には同じ結果を返しますが、元データの意味を保証するものではありません。

## 値と数式を読む

表や確認範囲には矩形の A1 範囲を使い、単一セルにはセルツールを使います。

```json
{
  "sessionId": "monthly-edit",
  "range": "Summary!A1:H24",
  "includeFormulas": true,
  "recalc": false
}
```

`formulon_get_range` は疎な一覧を返します。空白かつ数式のないセルは省略され、要求した矩形はシートの使用範囲に切り詰められ、`maxCells`（既定 10,000、最大 50,000）で上限が決まります。使用範囲に切り詰めた後の走査範囲は 100,000 セルまでです。返されるセルには A1 参照、0 始まりの座標、`{kind, ...}` 形式の値が入ります。`includeFormulas` を指定すると `formula` が追加されます。日付、通貨、パーセント書式の数値セルには `numberFormat`、`formatKind`、`formatted` が付く場合があります。

`formulon_get_cell` は `sessionId` と `path` のどちらか一方だけを受け取ります。`a1`、または `row` と `col` を指定し、`sheet` の既定値は 0 です。既定の `recalc: true` はセッションを再計算してから読むため、セッションは変更あり（dirty）になります。計算キャッシュを変えずに読む場合は `false` を指定します。パス読み込みは 1 回限りで、セッションを作りません。`formulon_eval_formula` はセルを書き込まずに数式を評価し、セッション指定時は参照、定義名、`ROW()`、`COLUMN()` を解決します。`row` と `col` は既定値 0 です。

## セルと構造を変更する

関連のない複数セルを変更するには `formulon_set_cells` を使います。

```json
{
  "sessionId": "monthly-edit",
  "mutations": [
    { "type": "text", "a1": "Summary!B2", "value": "2026-10" },
    { "type": "number", "a1": "Summary!B3", "value": 42 },
    { "type": "formula", "a1": "Summary!B4", "formula": "=B3*1.1" }
  ],
  "recalc": true
}
```

変更の型は `number`、`bool`、`text`、`blank`、`formula` です。`a1`、または `sheet` と 0 始まりの `row`、`col` でセルを指定します。1 回のバッチは 1 から 10,000 件で、`recalc` の既定値は `true` です。応答には `session`、`applied`、`errorCells` が入ります。

矩形の表には `formulon_set_range` が適しています。

```json
{
  "sessionId": "monthly-edit",
  "start": "Summary!B8",
  "values": [
    ["Item", "Qty", "Amount"],
    ["Design", 2, { "f": "=C9*120000" }],
    ["Build", 1, { "f": "=C10*98000" }]
  ],
  "recalc": true
}
```

`values` は数値、真偽値、文字列、`{"f":"=..."}`、`{"blank":true}`、セルを飛ばす `null` を受け取ります。応答には開始と終了の参照、`cellsWritten`、`errorCells` が入ります。セル変更は最初の書き込み前にアドレスを検証しますが、ネイティブエンジンが途中で失敗すると先に完了した書き込みが残り、セッションは変更あり（dirty）のままです。成功応答では適用結果を確認し、MCP ツールエラーの後は再試行前に対象範囲を読み取ってください。

`formulon_sheet_operation` は `add`、`remove`、`rename`、`move` を処理します。対応するフィールドは `name`、`index`、`newName`、`fromIndex`、`toIndex` です。`formulon_set_defined_name` は `sheet` を省略するとワークブックスコープ、指定するとシートローカルスコープになり、空の `formula` で名前を削除します。`_xlnm.Print_Area` と `_xlnm.Print_Titles` はシートローカルで指定します。`formulon_edit_structure` は行や列を挿入・削除し、`formulon_set_sheet_view` はズーム、固定行・列、`hidden` または `visibility` を設定します。固定行・列を変更するときは `freezeRows` と `freezeCols` の両方を指定してください。片方を省略すると、その固定数は以前の値ではなく `0` になります。

## 意図的に再計算する

ワークブックを開く操作とセルの変更操作は、既定で再計算します。読み取りと検査ツールの既定値は異なります。次の判断が現在の数式結果に依存するときは、明示的に再計算します。

```json
{
  "sessionId": "monthly-edit"
}
```

これは `formulon_recalc_session` です。`{ "session": ..., "status": ... }` を返し、数式キャッシュがワークブック状態であるためセッションは変更あり（dirty）になります。`formulon_set_cells`、`formulon_set_range`、`formulon_replace_cells`、`formulon_get_cell` の `recalc` は既定値が `true` です。`formulon_get_range`、`formulon_preview_range`、`formulon_audit_formulas` の既定値は `false` です。`recalc: false` で複数変更後の再計算を 1 回にまとめられます。

## 検索と置換

`formulon_find_cells` はセルの文字列、数式文字列、または両方を検索します。`target: "texts"` では文字列セルに加えて、数値と真偽値の定数を文字列として検索します（例: `42`、`TRUE`、`FALSE`）。数式の計算結果は検索しません。

```json
{
  "sessionId": "monthly-edit",
  "query": "budget",
  "target": "both",
  "matchCase": false,
  "wholeCell": false,
  "regex": false,
  "maxResults": 1000
}
```

応答には `results`、`count`、`truncated` が入り、各結果にはシート、A1 参照、対象種別、一致した文字列が入ります。`target` の既定値は `both`、`maxResults` の既定値は 1,000、上限は 10,000 です。`sheet` を省略すると全シートを検索します。`formulon_replace_cells` は `replacement` を追加します。置換できるのは文字列セルと数式の文字列で、数値・真偽値の定数は置換しません。`maxReplacements` を省略すると `maxResults` の値を使います。両方省略した場合は 1,000 件です。`maxReplacements` を指定した場合、その値が置換件数の上限になります。既定では置換後に再計算します。`wholeCell` は `regex: false` の場合だけ有効です。正規表現でセル全体に一致させるには、`^` と `$` を使います。

## プレビューと保存

レイアウト、スタイル、結合、印刷設定を変更したときは、保存前にプレビューします。

この例を実行する前に、サーバーの作業ディレクトリへ `review` と `out` を作成してください。保存ツールとプレビューツールは親ディレクトリを作成しません。

```json
{
  "sessionId": "monthly-edit",
  "range": "Summary!A1:H24",
  "scale": 1,
  "showGridLines": false,
  "showPageBreaks": true,
  "recalc": false,
  "outputPath": "review/summary.png"
}
```

`formulon_preview_range` は最初に画像コンテンツ、次に JSON メタデータを返します。メタデータには範囲、サイズ、フォント、ページ数、改ページ、セル位置、警告が入ります。`scale` は 0.25 から 2、範囲は 10,000 セル、画像の各辺は 4,096 ピクセル、総ピクセル数は 8,000,000、SVG は 4 MiB が上限です。`outputPath` は `.png` または `.svg` で終わる必要があります。結合セルを途中で切る範囲は拒否されます。

```json
{
  "sessionId": "monthly-edit",
  "outputPath": "out/next-month.xlsx"
}
```

`formulon_save_session` は `session`、`outputPath`、バイト数、`format`、任意の `losses` を返します。`.xlsx` と `.xlsb` は拡張子で選ばれます。保存は自動再計算を行いません。内容を削除または格下げした保存後はセッションが変更あり（dirty）のままです。保存先は常に明示してください。省略時は既存セッションの出力先または入力パスへフォールバックしますが、新規セッションではエラーになります。

## 応答とエラー

高レベルツールの成功応答は MCP の `content` に JSON テキストとして入ります。セルの値は次の形式です。

```json
[
  { "kind": "number", "value": 1200 },
  { "kind": "text", "value": "Approved" },
  { "kind": "error", "errorCode": 1, "errorName": "#DIV/0!" }
]
```

空白、真偽値、配列、参照、ラムダ値も `kind` を保持します。ステータス付きのエンジン結果は `{ "status": { "ok": true, "status": 0, "message": "", "context": "" }, "value": ... }` または `items` を使います。失敗時は MCP `isError: true` とエラーメッセージのテキストを返します。ネイティブ処理が途中で失敗すると部分的な変更が残る場合があるため、変更あり（dirty）と対象範囲を確認してください。

## テンプレート編集の例

次のプロンプトは、入力、変更、プレビュー、保存、終了を明示しています。保存先の `review` と `out` ディレクトリは、サーバーを起動するホスト側で事前に作成してください。ワークブックには `Summary` シートと、`B4` が依存する数式があるものとします。

> input.xlsx をセッション monthly-edit で編集します。Summary!B2 を 2026-10 に変更し、元ファイルは残してください。Summary!B4 を再計算し、Summary!A1:H24 を review/summary.png に描画し、ワークブックを out/next-month.xlsx に保存して損失情報を確認し、セッションを閉じてください。

```json
{
  "name": "formulon_open_workbook",
  "arguments": { "path": "input.xlsx", "sessionId": "monthly-edit" }
}
```

```json
{
  "name": "formulon_set_cells",
  "arguments": {
    "sessionId": "monthly-edit",
    "mutations": [
      { "type": "text", "a1": "Summary!B2", "value": "2026-10" }
    ],
    "recalc": false
  }
}
```

```json
{
  "name": "formulon_recalc_session",
  "arguments": { "sessionId": "monthly-edit" }
}
```

```json
{
  "name": "formulon_get_range",
  "arguments": {
    "sessionId": "monthly-edit",
    "range": "Summary!B2:B4",
    "includeFormulas": true,
    "recalc": false
  }
}
```

```json
{
  "name": "formulon_preview_range",
  "arguments": {
    "sessionId": "monthly-edit",
    "range": "Summary!A1:H24",
    "outputPath": "review/summary.png"
  }
}
```

```json
{
  "name": "formulon_save_session",
  "arguments": {
    "sessionId": "monthly-edit",
    "outputPath": "out/next-month.xlsx"
  }
}
```

```json
{
  "name": "formulon_close_workbook",
  "arguments": { "sessionId": "monthly-edit" }
}
```

後続の読み取りが不要な単一の書き込みなら、`formulon_update_workbook` で読み込みまたは新規作成、変更、任意の再計算、保存をまとめられます。`outputPath` は必須で、変更は 1 から 10,000 件です。対応する単発の読み取りは `formulon_inspect_workbook` で、再計算の既定値は `false` です。
