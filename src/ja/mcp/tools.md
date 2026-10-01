<script setup>
import { MCP_TOOL_COUNT } from '@/data/facts'
</script>

# ツールリファレンス

このページは `formulon-mcp` が登録する {{ MCP_TOOL_COUNT }} 個のツールを説明します。MCP クライアントは接続時にライブのスキーマも受け取るため、ページ公開後にフィールドが追加された場合はライブスキーマを優先してください。

## 共通ルール

- `sessionId` は開いているインメモリワークブックを識別します。`sheet` は 0 始まりの番号または完全一致するシート名です。
- 数値の `row` と `col` は 0 始まりです。A1 参照は `Summary!B2` のような Excel 形式です。
- セルの値は `{kind, ...}` 形式です。数値、真偽値、文字列は `value` を持ち、エラーは `errorCode` と `errorName` を持ち、空白は `kind` だけを持ちます。
- 高レベルの成功応答は JSON テキストです。失敗時は MCP `isError: true` とメッセージを返します。エンジン結果には `ok`、数値の `status`、`message`、`context` を含む `status` が残ります。
- パスは MCP サーバープロセスの作業ディレクトリから解決されます。保存では常に `outputPath` を明示してください。ワークブックは `.xlsx` または `.xlsb`、プレビューは `.png` または `.svg` です。
- A1 範囲は 1 シート内の矩形に限定されます。行全体、列全体、3-D 範囲は MCP の A1 パーサーで拒否されます。


低レベル呼び出しとワークブックメソッドを呼ぶ操作ツールは `{session,method,result}` を返します。外側の `session` は公開セッション情報です。`result` はエンジンの応答を保持し、変更では Status 自体、取得では通常 `status` と値のフィールドを持ちます。

## エンジンと単発ツール

| ツール | 役割 | 入力、既定値、上限 | 成功時の応答 |
| --- | --- | --- | --- |
| `formulon_version` | 読み込んだエンジンとサーバーのバージョンを返します。 | 引数なし。 | `{version, serverVersion}`。 |
| `formulon_eval_formula` | セルを書き込まずに Excel 数式を評価します。セッション指定時は参照、定義名、相対参照、`ROW()`、`COLUMN()` を解決します。 | `formula` 必須。先頭 `=` は任意。`sessionId` は任意。`sheet`、`row`、`col` は既定値 0 です。シート名はセッションモードでのみ指定できます。 | グローバルモードは `{formula,status,value}`。セッションモードは `{session,method,result}` で、`result` に `{status,value}` が入ります。 |
| `formulon_inspect_workbook` | パスを読み込み、セッションを保持せずに概要を返します。 | `path` 必須、`.xlsx` または `.xlsb`。`recalc` と `includeCells` は既定 `false`。`maxCellsPerSheet` は既定 200、最大 10,000。 | `{sheets, definedNames, tables}`。シートには `index`、`name`、`cellCount`、任意のセル一覧と `cellsTruncated` が入ります。 |
| `formulon_update_workbook` | 読み込みまたは新規作成、セル変更、任意の再計算、保存を 1 回で行います。 | `inputPath` は任意。`outputPath` 必須で `.xlsx` または `.xlsb`。`recalc` の既定値は `true`。`mutations` は 1 から 10,000 件の具体的な 0 始まり変更です。 | `{outputPath, bytes, format, losses?, summary}`。`bytes` はバイト数で、`summary` はシート、定義名、テーブルの概要です。 |
| `formulon_workbook_api` | インストール済み Formulon `Workbook` のメソッドと型宣言を、低レベル呼び出し前に調べます。セッション不要です。 | `operation` は既定 `search`、または `describe`。検索の `query` は任意。`limit` は既定 20、最大 100。`offset` は既定 0。`describe` では完全一致の `method` が必要です。 | 検索は `{version, operation, query?, total, truncated, count, methods}`。describe は `declarations`、`declarationsTruncated`、任意の `truncation` を追加します。 |
| `formulon_function_lookup` | 関数一覧、メタデータ、ローカライズ名、正規名を取得します。 | `sessionId` 必須。`operation` は `names`、`metadata`、`localize`、`canonicalize`。`name` は `names` 以外で必須。`locale` はエンジンの非負のロケール番号、既定 0。 | `{session,method,result}`。`result` に `{status,value}`、`{status,items}`、`{status,comment}` などの取得結果、変更の Status、またはメソッド固有のフィールドが入ります。 |
| `formulon_workbook_call` | 明示的な許可リストを通して `Workbook` メソッドを呼び出します。 | `sessionId`、完全な `method`、位置引数の JSON 配列 `args`。`args` の既定値は空配列です。引数の検証と上限は発見したメソッドに従います。 | `{session,method,result}`。`result` に `{status,value}`、`{status,items}`、`{status,comment}` などの取得結果、変更の Status、またはメソッド固有のフィールドが入ります。 |

## セッションと検査

| ツール | 役割 | 入力、既定値、上限 | 成功時の応答 |
| --- | --- | --- | --- |
| `formulon_open_workbook` | パスからセッションを作るか、既定の新規ワークブックを作ります。既存ファイルは最初に 1 度再計算します。 | `path` は任意の `.xlsx` または `.xlsb`。省略すると `Sheet1`。`sessionId` は任意で、省略時は UUID。 | `{session}`。セッションにはパス、時刻、`dirty`、任意の `loadLosses` が入ります。 |
| `formulon_list_sessions` | 開いているセッションを列挙します。 | 引数なし。 | `{sessions}`。ネイティブハンドルは含みません。 |
| `formulon_close_workbook` | セッションとネイティブワークブックハンドルを解放します。 | `sessionId` 必須。 | 最終状態の `{session}`。 |
| `formulon_inspect_session` | ワークブック構造と任意の疎なセル一覧を返します。 | `sessionId` 必須。`includeCells` 既定 `false`。`maxCellsPerSheet` 既定 200、最大 10,000。 | `{session, workbook}`。ワークブックに `sheets`、`definedNames`、`tables` が入ります。 |
| `formulon_recalc_session` | 開いているセッションを再計算します。 | `sessionId` 必須。 | `{session, status}`。計算キャッシュがモデル状態のため変更あり（dirty）になります。 |
| `formulon_find_cells` | セルの文字列と数式文字列を検索します。 | `sessionId` と空でない `query` 必須。`sheet` 省略時は全シート。`target` の既定値は `both` です。`target: "texts"` は文字列セルに加えて、数値と真偽値の定数を文字列として検索します（例: `42`、`TRUE`、`FALSE`）。数式の計算結果は検索しません。`matchCase`、`wholeCell`、`regex` は `false`。`maxResults` は既定 1,000、最大 10,000。`wholeCell` は `regex: false` の場合だけ有効です。正規表現でセル全体に一致させるには `^` と `$` を使います。 | `{session, query, options, results, count, truncated}`。結果にシート座標、A1 参照、対象種別、文字列が入ります。 |
| `formulon_replace_cells` | 一致した文字列または数式文字列を置換します。 | 検索項目に必須の `replacement` を追加します。置換できるのは文字列セルと数式の文字列で、数値・真偽値の定数は置換しません。`maxResults` は既定 1,000、最大 10,000。`maxReplacements` は既定 `maxResults`、最大 10,000。指定した `maxReplacements` が置換件数の上限になり、`maxResults` は追加の上限になりません。`recalc` は既定 `true`。 | `{session, query, replacement, options, replacements, count, truncated}`。各項目に `before`、`after`、対象、アドレス、ステータスが入ります。 |
| `formulon_inspect_layout` | 使用範囲、結合、寸法、表示、保護、セル、任意のスタイルをシートごとに返します。 | `sessionId` 必須。`sheet` 省略時は全シート。`includeCells` 既定 `true`、`includeStyles` 既定 `false`。`maxCells` は既定 10,000、選択した各シートで最大 50,000。 | `{session, sheets}`。各シートに `usedRange`、`cellCount`、結合、view、columns、rows、protection、任意の `cells`、`truncated` が入ります。 |
| `formulon_detect_regions` | テーブルらしい範囲、ラベルと値、合計らしい範囲を規則ベースで検出します。 | `sessionId` 必須。`sheet` 省略時は全シート。`maxCells` は既定 10,000、調査対象の各シートで最大 50,000。 | `{session, sheets, regions}`。領域に種別、範囲、信頼度、根拠、表またはラベル値の詳細が入ります。 |
| `formulon_analyze_workbook` | 表、ラベル、合計などの決定論的な特徴からワークブックの形を分類します。 | `sessionId` 必須。`includeEvidence` は既定 `true`。`maxCellsPerSheet` は既定 10,000、最大 50,000。 | `{session, classification, summary, evidence?, warnings}`。分類には主分類、信頼度、候補、概要にはタイトル、表、合計、主要フィールドが入ります。 |
| `formulon_session_metadata` | 登録関数名または外部リンクを読み取ります。 | `sessionId` 必須。`kind` は `functions` または `externalLinks`。 | `{session,kind,value}`。`value` は関数名または外部リンク情報の配列です。 |

## セル、構造、保存

| ツール | 役割 | 入力、既定値、上限 | 成功時の応答 |
| --- | --- | --- | --- |
| `formulon_get_cell` | セッションまたはパスから 1 セルを読みます。 | `sessionId` と `path` のどちらか一方。`a1`、または `row` と `col`。`sheet` の既定値は 0、`recalc` の既定値は `true`。 | シート、行、列、A1、`status`、`value`、`formula`、任意の表示形式情報を返します。 |
| `formulon_get_range` | セッションから疎な矩形範囲を読みます。 | `sessionId` と `range` 必須。`maxCells` は既定 10,000、最大 50,000。`includeFormulas` と `recalc` は既定 `false`。使用範囲に切り詰めた後の走査範囲は 100,000 セルまでです。 | `{session, range, cellCount, truncated, cells}`。空白かつ数式なしのセルは省略されます。 |
| `formulon_save_session` | 開いているセッションを XLSX または XLSB に書き出します。 | `sessionId` 必須。`outputPath` はスキーマ上任意ですが必ず指定し、拡張子は `.xlsx` または `.xlsb` にします。保存は再計算しません。 | `{session, outputPath, bytes, format, losses?}`。書き出し処理が保持できなかった内容は `losses` に入り、損失保存後は変更あり（dirty）のままです。 |
| `formulon_set_cells` | セッション内の複数セルを変更します。 | `mutations` は 1 から 10,000 件。型は `number`、`bool`、`text`、`blank`、`formula`。A1 または `sheet` と 0 始まり座標を使います。`recalc` 既定 `true`。数値は有限値が必要です。 | `{session, applied, errorCells}`。適用結果には入力位置と `status`、数式エラーにはセル参照とエラー名が入ります。 |
| `formulon_set_range` | 1 つの A1 起点から 2 次元ブロックを書き込みます。 | `sessionId`、`start`、1 行以上の `values` 必須。値は数値、真偽値、文字列、`{"f":"=..."}`、`{"blank":true}`、`null`。`sheet` は未修飾起点の補助、`recalc` の既定値は `true`。Excel の行 1,048,576、列 XFD の範囲内に収めます。 | `{session, range:{sheet,start,end?}, cellsWritten, errorCells}`。`null` だけのブロックは 0 セルです。 |
| `formulon_sheet_operation` | シートを追加、削除、名前変更、移動します。 | `operation` は `add`、`remove`、`rename`、`move`。追加は `name`、削除と名前変更は `index`、名前変更は `newName`、移動は `fromIndex` と `toIndex`。 | `{session, status}`。 |
| `formulon_set_defined_name` | 定義名をワークブックまたはシートのスコープで追加、置換、削除します。 | `sessionId`、`name`、`formula` 必須。空の式で削除。`sheet` 省略時はワークブック、指定時はシートローカル。先頭 `=` は除去されます。 | `{session, status, localSheetId}`。ワークブックスコープは `-1`。 |
| `formulon_edit_structure` | 参照をエンジンに更新させながら行や列を挿入・削除します。 | `operation` は `insertRows`、`deleteRows`、`insertCols`、`deleteCols`。`start` と正の `count` 必須。`sheet` の既定値は 0。 | `{session, sheet, status}`。 |
| `formulon_set_sheet_view` | ズーム、固定行・列、シートタブの表示状態を設定します。 | `sheet` の既定値は 0。`zoom` は 10 から 400、固定数は非負です。固定行・列を変更するときは両方を指定してください。片方を省略すると、その固定数は以前の値ではなく `0` になります。2 状態の `hidden` または 3 状態の `visibility`（`visible`、`hidden`、`veryHidden`）。 | `{session, sheet, statuses}`。指定した設定ごとの `status` が入ります。 |
| `formulon_trace` | セルの先行、後続、または動的配列のスピル情報を読みます。 | `operation` は `precedents`、`dependents`、`spillInfo`。`row` と `col` 必須。`sheet` 既定 0。`depth` は既定 1、最大 32。 | 先行・後続は `{session, operation, cell, depth, count, cells}`。スピルは `spill` に有効状態、起点、行列数、範囲を返します。 |

## レイアウトとプレビュー

| ツール | 役割 | 入力、既定値、上限 | 成功時の応答 |
| --- | --- | --- | --- |
| `formulon_dimension_operation` | 列幅、行高、非表示、アウトラインを一覧または変更します。 | `axis` は `column` または `row`。`operation` は `list`、`size`、`hidden`、`outline`。列は `first` と終端の `last` を含む範囲、行は `row` を指定します。単位は列が既定 `chars`、行が既定 `pt`。列の保存幅は 255 文字、行高は 409 pt が上限。`includeGeometry` で pt、px、mm を追加します。 | 一覧は `{session, axis, operation, sheet, value}`。書き込みは `status`、サイズ変更時は保存単位、保存値、表示ジオメトリを返します。 |
| `formulon_build_document` | `title`、`text`、`fields`、`table`、`summary`、`spacer` のブロックから、位置、式、書式、罫線、結合、印刷範囲をまとめて作成します。 | `start` の既定値は `B2`、`width` は最大テーブル幅。`blocks` は 1 件以上。`sameRow`、テーマ、印刷プリセット、`repeatTableHeader`（既定 `true`）を指定できます。 | `{session, sheet, sheetName, start, range, width, blocks, names, pageCount?}`。`names` は生成した名前から A1 への対応です。 |
| `formulon_style_range` | A1 範囲へフォント、塗りつぶし、罫線、表示形式、配置の差分を適用します。 | `range` と `style` 必須。`baseOn` は既定 `existing`、または `default`。色は `#RRGGBB` または `#AARRGGBB`。範囲は 100,000 セルまでで、空白セルも実体化します。 | `{session, range:{sheet,sheetName,start,end}, regions}`。各領域にセル数とスタイルのインデックスが入ります。 |
| `formulon_default_font` | ワークブック全体の既定フォントを読み取り、または変更します。 | `font` を省略すると読み取り。指定時は名前、サイズ、太字、斜体、下線、上下付き、色などの差分。 | 読み取りも書き込みも `{session, font}`。 |
| `formulon_print_settings` | ページ設定、余白、印刷オプション、ヘッダー・フッター、印刷範囲、タイトル、手動改ページを読み書きします。 | `sheet` の既定値は 0。全設定を省略すると読み取り。余白（`left`、`right`、`top`、`bottom`、`header`、`footer`）の単位はインチで、`0.5` は 12.7 mm です。未対応属性には生の XML フィールドを使います。 | `{session, sheet, sheetName, applied?, settings}`。正規化設定、XML、改ページ、計算済み `pageCount` を含みます。 |
| `formulon_apply_layout` | 寸法、結合、スタイル、印刷設定を順序付きで事前検証して適用します。 | `operations` は 1 から 200 件。`sheet` の既定値は 0。列幅 255 文字、行高 409 pt、展開行書き込み 10,000、スタイルセル 100,000 が上限。事前検証失敗時はセッションを変更しません。 | `{session, sheet, sheetName, operations}`。解決済み範囲、寸法、スタイル、結合、印刷設定の結果を返します。 |
| `formulon_preview_range` | 矩形範囲を PNG に描画し、位置と警告のメタデータを返します。 | `range` 省略時は印刷範囲または使用セルと結合から選びます。`scale` は既定 1、0.25 から 2。グリッド線は既定 false、改ページ線は既定 true、`recalc` は既定 false。10,000 セル、各辺 4,096 px、8,000,000 px、SVG 4 MiB が上限。 | MCP の content に画像を先に、JSON メタデータを後に返します。メタデータにシート、範囲、寸法、フォント、ページ数、改ページ、セルジオメトリ、警告が入ります。 |

## ワークブックオブジェクト

| ツール | 役割 | 入力、既定値、上限 | 成功時の応答 |
| --- | --- | --- | --- |
| `formulon_merge_operation` | 結合範囲の一覧、追加、削除、インデックス削除、全削除を行います。 | `sheet` の既定値は 0。`operation` は `list`、`add`、`remove`、`removeAt`、`clear`。追加・削除は `firstRow`、`firstCol`、`lastRow`、`lastCol` の範囲、`removeAt` は非負の `index`。 | `{session,method,result}`。`result` に `{status,value}`、`{status,items}`、`{status,comment}` などの取得結果、変更の Status、またはメソッド固有のフィールドが入ります。 |
| `formulon_comment_operation` | セルコメントの一覧、取得、設定、削除を行います。 | `operation` は `list`、`get`、`set`、`remove`。一覧以外は `row` と `col` 必須。設定時の `author`、`text` は任意。 | `{session,method,result}`。`result` に `{status,value}`、`{status,items}`、`{status,comment}` などの取得結果、変更の Status、またはメソッド固有のフィールドが入ります。 |
| `formulon_hyperlink_operation` | ハイパーリンクの一覧、追加、削除、インデックス削除、全削除を行います。 | `row`、`col`、任意の終端の `lastRow`、`lastCol` を含む範囲、`target`、`display`、`tooltip`、`location`。空の target と location でブック内リンク。 | `{session,method,result}`。`result` に `{status,value}`、`{status,items}`、`{status,comment}` などの取得結果、変更の Status、またはメソッド固有のフィールドが入ります。 |
| `formulon_validation_operation` | 入力規則の一覧、追加、インデックス削除、全削除を行います。 | `validation` は追加時必須。範囲は終端を含む、0 始まりの矩形範囲です。型は 0 none、1 whole、2 decimal、3 list、4 date、5 time、6 textLength、7 custom。省略した真偽値は false、`showDropDown` の既定値は true。 | `{session,method,result}`。`result` に `{status,value}`、`{status,items}`、`{status,comment}` などの取得結果、変更の Status、またはメソッド固有のフィールドが入ります。 |
| `formulon_conditional_format_operation` | 条件付き書式の一覧、追加、インデックス削除、全削除、評価を行います。 | `operation` は `list`、`add`、`removeAt`、`clear`、`evaluate`。追加は式、セル、カラースケール、データバー、アイコン、文字列、日付などのライブスキーマ。評価は四隅の行列が必須で、`todaySerial` は期間評価用です。 | `{session,method,result}`。`result` に `{status,value}`、`{status,items}`、`{status,comment}` などの取得結果、変更の Status、またはメソッド固有のフィールドが入ります。 |
| `formulon_table_operation` | ネイティブのワークシートテーブルを一覧、作成、更新、削除します。 | `sheet` の既定値は 0。作成は `range`、`name`、任意の列名、`style`、`headerRow`（既定 true）、`totalsRow`（既定 false）。列名省略時はヘッダー行から一意の非空文字列を作ります。更新・削除はワークブック全体の `index`。更新範囲は元の列数を保ちます。 | 一覧は `{session,count,tables}`。作成と更新は `{session,table,status}`、削除は `{session,removed,status}`。 |
| `formulon_create_pivot` | 矩形のワークシート範囲からピボットキャッシュとピボットテーブルを作ります。 | `sourceRange`、`target`、`name`、1 件以上の `values` 必須。行、列、ページ軸は既定空配列。集計は sum、count、average、max、min、product、countNumbers、stddev、stddevp、var、varp。集計の既定値は sum、`layout` の既定値は compact、`sourceLimit` は既定 10,000、最大 10,000、最小 2。各ヘッダーは 1 度だけ軸へ割り当てますが、値集計の繰り返しは可能です。 | `{session, source:{sheet,sheetName,ref,headers,rows}, target, cacheId, pivotIndex, layout, status}`。入力範囲に数式がある場合は読み取り前に再計算します。 |

## 数式監査

| ツール | 役割 | 入力、既定値、上限 | 成功時の応答 |
| --- | --- | --- | --- |
| `formulon_audit_formulas` | 繰り返し数式のパターン、定数、空白、外れ値、数式エラーを確認します。セルの修復や数式の正しさの証明は行いません。 | `sessionId` 必須。`sheet` は既定で先頭シート、`range` は任意。`direction` の既定値は vertical、`window` は 5（2–50）、`minPeers` は 3（3–20）、`maxCells` は 50,000、`maxFindings` は 100（最大 500）、`recalc` は false。`minPeers` は window の 2 倍以下です。保持されているセルの列挙は 1,000,000 セルまでです。 | `{complete, session, sheet, sheetName, range, direction, window, minPeers, scannedCells, formulaCells, unsupportedFormulaCells, findingCount, findings, findingsTruncated, warnings}`。検出項目にはセル、方向、問題種別、近傍の根拠、確認理由が入ります。空白行・列は境界です。 |

セッションの一連の操作は [ワークフロー](/ja/mcp/workflow)、低レベル API の発見、許可リスト、応答、時刻固定、WASM の再計算経路は [高度な API](/ja/mcp/advanced) を参照してください。
