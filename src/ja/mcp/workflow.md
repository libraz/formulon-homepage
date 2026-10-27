# MCP ワークフロー

`formulon-mcp` は、開いたワークブックを名前付きのインメモリセッションに保持します。通常は `formulon_open_workbook` で開き、構造と値を確認し、変更、再計算、プレビュー、保存、終了の順に進めます。

<DiagramFlow
  :steps="[
    { label: 'formulon_open_workbook', note: 'session.id を返し、一度再計算' },
    { label: '調べて読む', note: 'formulon_inspect_workbook など' },
    { label: '変更する', note: 'set_cells は既定で再計算' },
    { label: 'formulon_recalc_session', note: '数式の結果を明示的に更新' },
    { label: 'プレビュー', note: 'formulon_preview_range が画像を描画' },
    { label: 'formulon_save_session', note: '書き出すが再計算はしない' },
    { label: 'formulon_close_workbook', note: 'セッションを終了' }
  ]"
  label="MCP セッションの典型的な流れ。ワークブックを開き、調べて読み、変更し、再計算し、プレビューし、保存してからセッションを閉じる"
  caption="保存では再計算されないため、出力のすべての数式結果を最新にしたいときは、先に formulon_recalc_session を呼びます。"
/>

最初に 1 度開き、返された `session.id` を後続の呼び出しで使います。保存先には `outputPath` を明示します。セッションは相互に分離され、ワークブック、数式キャッシュ、変更あり（dirty）の状態、依存関係グラフを共有しません。

## 開いて調べる

複数回操作する既存ワークブックは、固定した ID で開きます。

```json
{
  "path": "input.xlsx",
  "sessionId": "monthly-edit"
}
```

`formulon_open_workbook` は `{ "session": ... }` を返します。セッションには ID、入力と出力のパス、作成・更新時刻、`dirty`、任意の `loadLosses` が入ります。ファイルを開くと 1 度再計算します。新規セッションの最初のシート名は Excel プロファイルで決まり、`sourcePath` はありません。`Sheet1` を使う手順では `profile: "win-365-en_US"` を明示し、それ以外のプロファイルでは調査結果からシート名を取得してください。

### ツールが再計算するタイミング

読み取りや書き込みの一部では自動で再計算します。保存は現在のワークブック状態を書き出し、再計算は実行しません。

| ツール | `recalc` の既定値 | 動作 |
| --- | --- | --- |
| `formulon_set_cells`、`formulon_set_range` | `true` | 値を書き込み、再計算します。`false` なら計算を後回しにします。 |
| `formulon_get_cell` | `true` | 1 セルを返す前に再計算します。`false` なら現在のキャッシュを読みます。 |
| `formulon_get_range` | `false` | 現在キャッシュされている値を読みます。`true` なら先に再計算します。 |
| `formulon_preview_range` | `false` | 現在の値を描画します。`true` なら描画前に再計算します。 |
| `formulon_audit_formulas` | `false` | 現在の数式と計算済み値を監査します。`true` なら先に再計算します。 |
| `formulon_recalc_session` | — | セッションを明示的に再計算します。 |
| `formulon_save_session` | — | 再計算せずに現在の状態を保存します。 |

`dirty` は、メモリ上のワークブックが最後に損失なく保存できた状態と異なる可能性を示します。書き込みや再計算で `dirty` になる場合があります。このフラグだけでは、すべての数式キャッシュが最新かどうかは分かりません。すべての数式結果を更新してから保存するには、`formulon_recalc_session` を呼んでください。部分再計算や保存だけでは、対象外のキャッシュが古いまま残ることがあります。

セルの位置を指定する前に構造を調べます。

```json
{
  "sessionId": "monthly-edit",
  "includeCells": false,
  "maxCellsPerSheet": 200
}
```

`formulon_inspect_session` は `session` と、`sheets`、`definedNames`、ネイティブ `tables` を含むワークブック概要を返します。`includeCells` を `true` にするとセルの疎な一覧を含めます。`maxCellsPerSheet` の既定値は 200、上限は 10,000 です。`cellCount` と `cells` はエンジンの書き込み済み座標を使い、書式付きセル、明示した空白セル、スピル先を含みます。`formulon_get_range` は値と数式を読むツールのため、書式だけの空白セルを含む数式のない空白を省略します。使用範囲、結合、寸法、表示、保護、数式、スタイルが必要な場合は `formulon_inspect_layout` を使います。既定ではセルを含め、選択したシートごとに 10,000 セルまで返します。解決済みのスタイル情報が必要なら `includeStyles: true` を指定します。`formulon_detect_regions` と `formulon_analyze_workbook` は、構造が分からないシートを調べるための一定の規則に基づく分類・検出結果を返します。同じ入力には同じ結果を返しますが、元データを読む代わりにはなりません。`formulon_list_sessions` は開いているセッションを一覧し、`formulon_session_metadata` は登録済みの関数名またはワークブックの外部リンクを返します。

## Excel プロファイル {#excel-profile}

プロファイルは、数値・日付・真偽値のテキスト、`TEXT` の書式コード、照合順序（比較、検索、並べ替え）、`CHAR` / `CODE` のコードページ、2 バイト系関数（`*B`、`ASC`、`DBCS`）を決めます。プロファイル ID は `{mac|win}-365-<locale>` の形で、ロケールは `en_US`、`ja_JP`、`de_DE`、`fr_FR`、`es_ES`、`es_MX`、`pt_BR`、`it_IT`、`nl_NL`、`ru_RU`、`zh_CN`、`zh_TW`、`ko_KR`、`th_TH` です。`mac-*` は Mac 版 Excel から実測した値、`win-*` はそれと Windows ホストの規則から推定した値です。ただしテキストの照合順序は、Windows 版 Excel 365 で実測したロケール対応の照合を使います（`ß` は `ss` と等しく扱われ、厳密な（strength 2）比較でのみ区別されます。Mac と同じ挙動です）。既定は `win-365-en_US` です。

`formulon_open_workbook`、`formulon_inspect_workbook`、`formulon_update_workbook` は任意の `profile` を受け取ります。新規ワークブックでは、そのロケールで Excel が作るとおりに本文フォント、Normal スタイル、シート名、余白を設定します。読み込んだファイルでは、オープン時の再計算の前に評価プロファイルを設定します。`profile` を省略すると、サーバーの環境変数 `FORMULON_MCP_PROFILE`、なければ `win-365-en_US` を使います。未知の ID はエラーです。環境変数の値が原因のときは、メッセージにそのことが示されます。

```json
{
  "sessionId": "ja-book",
  "profile": "mac-365-ja_JP"
}
```

プロファイルは実行時の設定で、`.xlsx` には保存されません。`formulon_open_workbook`、`formulon_inspect_workbook`、`formulon_update_workbook` では、指定したプロファイル、`FORMULON_MCP_PROFILE`、`win-365-en_US` の順で決まります。パス指定の `formulon_get_cell` は `loadWorkbook` を直接呼ぶため、`FORMULON_MCP_PROFILE` を適用しません。ロケールに依存する読み取りには、必要なプロファイルでセッションを開いてください。

セッションの途中で切り替えるには、`formulon_workbook_call` で `setExcelProfileId` を `args` に `["mac-365-ja_JP"]` を渡して呼び、続けて `formulon_recalc_session` を呼びます。変わるのは評価だけで、フォントやシート名は変わりません。現在の値は `excelProfileId` で読めます。

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

`formulon_get_range` は疎な一覧を返します。エンジンは指定範囲の値や数式があるセルとスピル先を列挙し、書式だけの空白セルは省略します。返す件数は `maxCells`（既定 10,000、最大 50,000）で制限し、それを超えるセルがある場合だけ `truncated` が真になります。矩形の走査面積には上限がありません。返されるセルには A1 参照、0 始まりの座標、`{kind, ...}` 形式の値が入ります。`includeFormulas` を指定すると `formula` が追加されます。日付、通貨、パーセント書式の数値セルには `numberFormat`、`formatKind`、`formatted` が付く場合があります。General 以外の数値書式では、取得できればエンジンの表示用 `text` も付きます。`textStatus` は `overflow` または `invalidFormat` を表します。

`formulon_get_cell` は `sessionId` と `path` のどちらか一方だけを受け取ります。`a1`、または `row` と `col` を指定し、`sheet` の既定値は 0 です。既定の `recalc: true` はセッションを再計算してから読むため、セッションは変更あり（dirty）になります。計算キャッシュを変えずに読む場合は `false` を指定します。パス読み込みは 1 回限りで、セッションを作らず、`FORMULON_MCP_PROFILE` も適用しません。ロケールに依存する読み取りには `sessionId` を使います。`formulon_eval_formula` はセルを書き込まずに数式を評価し、セッション指定時はそのセッションのプロファイルで参照、定義名、`ROW()`、`COLUMN()` を解決します。`row` と `col` は既定値 0 です。グローバルモードはエンジンの既定プロファイルを使うため、ロケールに依存する数式にはプロファイル付きセッションを使ってください。

`formulon_trace` は 1 つのセルの参照関係をたどります。`precedents` はそのセルが参照するセル、`dependents` はそのセルを参照するセル、`spillInfo` は動的配列数式のスピル範囲を返します。結果はシート名付きの A1 参照です。`depth`（既定 1、最大 32）を増やすと、さらに先までたどります。

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

`formulon_sheet_operation` は `add`、`remove`、`rename`、`move` を処理します。対応するフィールドは `name`、`index`、`newName`、`fromIndex`、`toIndex` です。`formulon_set_defined_name` は `sheet` を省略するとワークブックスコープ、指定するとシートローカルスコープになり、空の `formula` で名前を削除します。保存された名前の式は先頭の `=` なしで読み返されます。`comment` と `hidden` は名前のメモと名前の管理での表示を設定し、式を置換しても指定しない限り保持されます。`_xlnm.Print_Area` と `_xlnm.Print_Titles` はシートローカルで指定します。`formulon_edit_structure` は行や列を挿入・削除し、`formulon_set_sheet_view` はズーム、固定行・列、分割位置、スクロールの起点、数式とアウトライン記号の表示、アクティブシート、`hidden` または `visibility` を設定します。固定行・列を変更するときは `freezeRows` と `freezeCols` の両方を指定してください。片方を省略すると、その固定数は以前の値ではなく `0` になります。エンジンは最後の表示シートを隠せません。各フィールドは[レイアウトとプレビュー](/ja/mcp/layout-preview#sheet-view)を参照してください。

## コメント、リンク、入力規則、結合 {#sheet-objects}

シート単位のオブジェクトは 5 つのツールで編集します。どれも `sessionId`、任意の `sheet`（既定は最初のシート）、`operation` を受け取ります。セルツールと違い、セルは A1 参照ではなく 0 始まりの番号で指定します。

| ツール | 操作 | 位置の指定 |
| --- | --- | --- |
| `formulon_comment_operation` | `list`、`get`、`set`、`remove`、`visibility` | `row`、`col`。`set` は `author` と `text`、`visibility` は `visible`（`true` でコメントをシート上に表示したままにする）を受け取ります |
| `formulon_hyperlink_operation` | `list`、`add`、`remove`、`removeAt`、`clear` | `row`、`col`、任意の `lastRow` / `lastCol`。`target` は URL です。ブック内リンクにするには `target` を空にして `location`（`Sheet2!A1` など）を指定します |
| `formulon_validation_operation` | `list`、`add`、`removeAt`、`clear` | `validation.ranges` に `{firstRow, firstCol, lastRow, lastCol}` |
| `formulon_conditional_format_operation` | `list`、`add`、`removeAt`、`clear`、`evaluate` | `rule.sqref` の範囲。`evaluate` は `firstRow`、`firstCol`、`lastRow`、`lastCol` |
| `formulon_merge_operation` | `list`、`add`、`remove`、`removeAt`、`clear` | `range` に `{firstRow, firstCol, lastRow, lastCol}` |

`removeAt` には、対応する `list` の結果にある `index` を渡します。応答はいずれも `{session, method, result}` で、`result` にエンジンの結果が入ります。入力規則と条件付き書式のルールの種類、スタイル、評価、作業例は[条件付き書式と入力規則](/ja/mcp/conditional-formats-validation)にまとめています。フィールドの一覧は[ツールリファレンス](/ja/mcp/tools#rich-workbook-objects)を参照してください。

図形、スパークライン、What-If データテーブルには、さらに 3 つのツールがあります。これらは 0 始まりの番号ではなく、選択したシート上の A1 セル参照を使い、変更したオブジェクトを返します。図形は[レイアウトとプレビュー](/ja/mcp/layout-preview#shapes)で扱います。スパークライングループは、スパークラインごとに 1 つのデータ範囲を 1 つのセルへ描画します。データテーブルは、入力セルへ値を代入して結果範囲を埋めます。

#### `formulon_sparkline_operation`

```json
{
  "sessionId": "review",
  "operation": "add",
  "sparklines": [
    { "data": "B2:M2", "location": "N2" },
    { "data": "B3:M3", "location": "N3" }
  ],
  "type": "line",
  "high": true,
  "low": true,
  "colors": { "series": "#336699", "high": "#CC3333" }
}
```

応答は `{session, sheet, group}` で、グループの `index` を含みます。この `index` を `update` や `remove` に渡します。グループを削除すると、後続の番号は前に詰まります。

#### `formulon_data_table_operation`

```json
{ "sessionId": "review", "operation": "add", "range": "C3:E8", "rowInput": "H1", "colInput": "H2" }
```

これは `C3:E8` に対する 2 変数のテーブルです。数式は左上の角のセル `B2` に置き、`H1` に代入する値を `C2:E2`、`H2` に代入する値を `B3:B8` に置きます。入力が片方だけのときは、数式を範囲の上の行（`colInput`）または左の列（`rowInput`）に置きます。結果セルはテーブルを削除するまで書き込みを拒否します。`add` は再計算するので、結果をすぐ読めます。`recalc` は、自動（テーブルを除く）の計算モードでも、すべてのデータテーブルを再計算します。

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

応答には `results`、`count`、`truncated` が入り、各結果にはシート、A1 参照、対象種別、一致した文字列が入ります。`target` の既定値は `both`、`maxResults` の既定値は 1,000、上限は 10,000 です。`sheet` を省略すると全シートを検索します。`formulon_replace_cells` は `replacement` を追加します。置換できるのは文字列セルと数式の文字列で、数値・真偽値の定数は置換しません。`maxReplacements` を省略すると `maxResults` の値を使います。両方省略した場合は 1,000 件です。`maxReplacements` を指定した場合、その値が置換件数の上限になります。置換は元の文字列や数式をエンジン経由で書き戻し、置換ごとに `before`、`after`、ステータスを返します。既定では置換後に再計算します。正規表現はグローバル指定でコンパイルされ、大文字と小文字の区別は `matchCase` で決まります。`wholeCell` は `regex: false` の場合だけ有効です。正規表現でセル全体に一致させるには、`^` と `$` を使います。

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
