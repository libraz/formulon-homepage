# WASM API

正式な TypeScript 宣言はパッケージ同梱の `dist/formulon.d.ts` です。このページは主要 API の要約です。

::: tip 宣言ファイルを優先する
ページとインストール済みパッケージで内容が食い違う場合、対応バージョンの `dist/formulon.d.ts` を正としてください。
:::

::: info 用語: ステータス付きの戻り値
WASM の失敗しうる呼び出しが返す `Status` オブジェクトです。`ok`、数値 `status`、人間向け `message`、診断用 `context` を持ちます。Excel のセルエラーはステータス失敗ではなく `kind = Error` の `Value` として返ります。
:::

## モジュール

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
```

`@libraz/formulon` は単一スレッドの実行入口です。通常のメモリを使うため、ブラウザでオリジン間分離なしに読み込めます。`recalcParallel` でワーカーを使う場合は `@libraz/formulon/threads` を読み込んでください。この入口は付属の `@libraz/formulon/formulon_threads.wasm` を使い、ブラウザではオリジン間分離が必要です。どちらの入口も同じ API と宣言ファイルを公開します。

| API | 用途 |
| --- | --- |
| `Module.evalFormula(formula)` | 新規ワークブックで 1 つの数式を評価 |
| `Module.Workbook.createDefault()` | `Sheet1` 付きワークブック |
| `Module.Workbook.createEmpty()` | sheet 0 個のワークブック |
| `Module.Workbook.loadBytes(bytes)` | メモリ上のワークブックを読み込む（`.xlsx` / `.xlsb` を自動判別） |
| `Module.versionString()` | エンジンバージョン |
| `Module.errorDisplayName(errorCode)` | エラーコードの Excel 表示文字列 |
| `Module.statusString(status)` | status の名前 |
| `Module.lastErrorMessage()` | 直近の診断メッセージ |
| `Module.lastErrorContext()` | 直近の診断 context |

## 結果の形式

失敗しうる呼び出しは `Status`、または `status` を含む構造体を返す、ステータス付きの戻り値です。

```ts
interface Status {
  ok: boolean
  status: number
  message: string
  context: string
}
```

Excel セルエラーは `ValueKind.Error`。Status の失敗とは区別されます。

`sheetCount()`、すべての `*Count()`、`calcMode()` などの数値アクセサは、`{ status, value }` 形式の `NumberResult` を返します。`sheetName()`、`excelProfileId()`、`localizeFunctionName()`、`canonicalizeFunctionName()` などの文字列アクセサは `StringResult` を返します。`value` を読む前に `status.ok` を確認してください。失敗時の既定値も、0 件や空文字列として返ります。

リスト取得 API は `ListResult<T>` を返します。これは `status` プロパティを持つ配列そのものです。要素は `result[0]` のように読み取り、`items` や `value` の戻り値で包まれた形式は使いません。`spillInfo()` は `SpillInfo` を返すため、領域フィールドを読む前に `status` を確認してください。

条件付き書式のデータには、ルールの方向とアイコンセットの下限がそのまま含まれます。`dataBar.direction` は `0` がシートの読み方向、`1` が左から右、`2` が右から左です。`iconSet.floor` は下限を表す `CfValueObjectInput` で、ルール追加時は省略でき、アイコンセット規則を読み出すと必ず含まれます。`CfMatch` の評価結果には同じ方向が `CfMatch.barDirection` として含まれます。

## 値の種類

```ts
enum ValueKind {
  Blank,
  Number,
  Bool,
  Text,
  Error,
  Array,
  Ref,
  Lambda
}
```

`getValue()` は `CellResult`（`{ status, value }`）を返します。一方、`evalFormula()`、`evaluateFormulaText()`、`evaluateConditionalFormula()` は同じ `status` / `value` を持つ `EvalResult` の戻り値を返します。いずれも `value` フィールドは `kind` でデータの種類が分かれる `Value` です。数値は `value.number`、真偽値は `value.boolean`（`0` または `1`）、テキストは `value.text`、エラーは `value.errorCode`（`formulon::ErrorCode` の値）で読み取ります。`errorText` というフィールドは存在しません（各コードの意味は [エラーモデル](/ja/compatibility/errors) を参照）。`Array` / `Ref` / `Lambda` は現時点で `Value` に追加のデータを持たず、これらのフィールドは将来の拡張のために C ABI 側で予約されているだけです。ラムダの数式テキストを読むには、ワークブックの `getLambdaText(sheet, row, col)` を別途呼び出します。

## ワークブックのライフサイクル

```ts
const wb = Module.Workbook.loadBytes(bytes)
try {
  if (!wb.isValid()) throw new Error(Module.lastErrorMessage())
  const recalculated = wb.recalc()
  if (!recalculated.ok) {
    throw new Error(`${recalculated.message} (${recalculated.context})`)
  }
  const saved = wb.save()
  if (!saved.status.ok || saved.bytes === null) {
    throw new Error(`${saved.status.message} (${saved.status.context})`)
  }
} finally {
  wb.delete()
}
```

`delete()` は必ず呼んでください。

## コンテナ形式

`save()` は常に OOXML `.xlsx` を書き出します。`saveAs(format)` で書き出すコンテナ形式を明示できます。

```ts
enum WorkbookFormat {
  Unknown = 0,
  Xlsx = 1,
  Xlsb = 2
}

const result = wb.saveAs(WorkbookFormat.Xlsb) // SaveResult { status, bytes }
```

`loadBytes(bytes)` はフラグなしでどちらのコンテナも受け付けます。ファイル名ではなく、パッケージのバイト列そのものから `.xlsb` / `.xlsx` を判別するため、同じ呼び出しでどちらも扱えます。各コンテナが何を往復保存できるかは [ファイル形式サポート](/ja/compatibility/file-format-support) を参照してください。

`saveWithDiagnostics(format)` は保存したバイト列と、書き出し側が検出した損失・延期のカウンターを返します。`readDiagnostics()` はワークブックの読み込み時に取得したカウンターを返します。カウンターの対象は一部の損失だけです。すべて 0 であることは、記載された損失が発生しなかったことを示しますが、パッケージをバイト単位で比較したことや、診断イベントが一切なかったことは示しません。

| 結果 | フィールド | 意味 |
| --- | --- | --- |
| `saveWithDiagnostics` | `downgradedFormulaCount` | キャッシュ済みリテラルとして出力された数式セルの数。XLSX では常に 0 です。 |
|  | `deferredFeatureCount` | レコードへ変換されなかったシート機能の数。XLSX では常に 0 です。 |
|  | `droppedPartCount` | いずれかの書き出し側が破棄した、そのまま保持していたパートの数。 |
|  | `droppedRelationshipCount` | 対象パートの破棄に伴って破棄された関連付けの数。`droppedPartCount` と同じ損失を表す場合があります。 |
|  | `renumberedPartCount` | 書き出し側が割り当てたパート ID で出力されたテーブルの数。XLSB では常に 0 です。 |
| `readDiagnostics` | `undecodedFormulaCount` | デコードできなかった保存済み数式の数。XLSB のみです。 |
|  | `undecodedDefinedNameCount` | デコードできずにスキップされた定義名の数。XLSB のみです。 |
|  | `undecodedPartCount` | コンテンツタイプを解決できなかった XLSB パッケージパートの数。 |
|  | `skippedFeatureCount` | 参照が利用できずスキップされた OOXML の表示オーバーレイ項目の数。 |
|  | `unknownContentTypeCount` | コンテンツタイプを認識できなかった OOXML ワークブックパートの数。 |

## 固定する時計

ワークブックが固定されていない場合、`NOW()`、`TODAY()`、ピボットの相対期間フィルターはホストの時計を読み取ります。これらの結果を 1 回の再計算で一致させる場合や、ホストをまたいで再現する場合は、ワークブックを 1 つの年月日・時分秒に固定してください。

```ts
const setPinned = wb.setPinnedNow(2026, 8, 19, 12, 0, 0)
if (!setPinned.ok) throw new Error(setPinned.message)
const pinned = wb.pinnedNow()
if (!pinned.status.ok) throw new Error(pinned.status.message)
const recalculated = wb.recalc()
if (!recalculated.ok) throw new Error(recalculated.message)
const now = pinned.now // CivilTime | null
const cleared = wb.clearPinnedNow()
if (!cleared.ok) throw new Error(cleared.message)
```

`pinnedNow()` は `{ status, now }` を返します。`now` は固定中なら `CivilTime` オブジェクト、ホストの時計に従う場合や呼び出しが失敗した場合は `null` です。`setPinnedNow()` は `year` 1900–9999、`month` 1–12、月ごとの実在する日、`hour` 0–23、`minute` / `second` 0–59 を検証します。不正な値は正規化せず、失敗した `Status` を返します。値はタイムスタンプではなく年月日・時分秒のフィールドとして保持するため、タイムゾーンの解釈はありません。固定の設定・解除ではキャッシュ済みの数式値を再計算しないため、必要に応じて `recalc()` を明示的に呼び出してください。固定はファイル状態ではなくワークブックのモデル状態です。保存時には記録されず、読み込み直後のワークブックは固定されていません。

## 主なワークブックメソッド

| 分類 | メソッド |
| --- | --- |
| シート | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, `sheetCount`, `sheetName` |
| セル | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula`, `setCellPhonetic`, `getCellPhonetic`, `setCellPhoneticRuns`, `getCellPhoneticRuns`, `setCellPhoneticProperties`, `getCellPhoneticProperties`, `getValue`, `cellCount`, `cellAt`, `getLambdaText` |
| 計算 | `recalc`、`recalcParallel`、`partialRecalc`、`evaluateFormulaText`、`evaluateFormulaArray`、`evaluateConditionalFormula`、`setIterative`、`getIterative`、`setIterativeProgress`、`calcMode`、`setCalcMode`、`pinnedNow`、`setPinnedNow`、`clearPinnedNow`、`paginate` |
| 保存 | `save`, `saveAs`, `saveWithDiagnostics`, `readDiagnostics` |
| プロファイル | `excelProfileId`, `setExcelProfileId` |
| 定義名 / テーブル | `definedNameCount`, `definedNameAt`, `setDefinedName`, `tableCount`, `tableAt` |
| 構造 | `insertRows`, `deleteRows`, `insertCols`, `deleteCols` |
| レイアウト | シート表示と 3 状態の表示状態、保護、行 / 列レイアウト、スタイル、セル結合、型付き印刷設定 |
| ワークブックデータ | コメント（`getCommentResult`）、ハイパーリンク、入力規則、条件付き書式、ピボットレイアウトとキャッシュ項目フィルター、外部リンク |
| スタイル | `getFont` / `addFont`、`setFont`、`setDefaultFont`; `FontRecord.vertAlign` は `0` が標準、`1` が上付き、`2` が下付き、`scheme` はテーマフォントへのリンクを保持 |
| 内部参照 | `precedents`, `dependents`, `functionMetadata`, `functionNames`, `spillInfo` |

`setCellPhoneticRuns()` は、注釈対象テキストを UTF-16 の位置で順序付けた、重ならない区間に分割して設定します。`setCellPhoneticProperties()` は、読み仮名とは独立してフォント、かな種別、配置を変更します。セルの値を書き換えると、区間とプロパティの両方が消去されます。

`recalcParallel(threadCount)` は同期的に実行され、`{ status, stats }` を返します。既定の `@libraz/formulon` 入口ではシリアルに評価し、`stats.workerThreadsStarted === 0` を報告します。`@libraz/formulon/threads` 入口ではワーカーを起動します。`0` は最大 8 ワーカーの自動検出、`1` は呼び出し元スレッド、`2..8` はワーカー数の上限を選択します。引数なし、小数、有限でない値、負の値、8 超は `kInvalidArgument` で失敗します。

`setIterative(enabled, maxIterations, maxChange)` で反復計算の設定を保存し、`getIterative()` で `{ status, enabled, maxIterations, maxChange }` として読み戻します。`maxIterations` は `32767` を上限とし、getter は上限適用後の値を返します。

`SheetVisibility` は `Visible = 0`、`Hidden = 1`、`VeryHidden = 2` の 3 状態です。`setSheetVisibility(sheet, visibility)` はシートの表示状態全体を設定し、`getSheetView(sheet).view.visibility` で hidden と very-hidden を区別できます。従来の `tabHidden` はどちらの非表示状態でも `1` です。very-hidden を hidden へ降格する場合は `setSheetVisibility()` を使います。`setSheetTabHidden(true)` だけでは降格しません。

ワークシートの印刷設定は `setSheetPageSetup()`、`setSheetPageMargins()`、`setSheetPrintOptions()`、`setSheetHeaderFooter()`、`setSheetPrintArea()`、`setSheetPrintTitles()`、`addSheetRowBreak()`、`addSheetColBreak()` で作成できます。モデル化していない断片には生の XML を設定するメソッドを使えますが、保存前に入力を検証します。ヘッダー / フッターはデコード済みの Excel セクション文字列を受け取り、文字どおりのアンパサンドは `&&` と書きます。

`setRangeXfIndex(sheet, firstRow, firstCol, lastRow, lastCol, xfIndex)` はセル書式（XF）インデックスを両端を含む矩形へ適用し、存在しないセルを書式付きの空セルとして作成します。

`pivotFieldAddItemAt(sheet, pivotIdx, fieldIdx, cacheIndex, visible)` は、結び付いたキャッシュ項目の共有項目インデックスで手動フィルター項目を指定します。空白のピボット項目を指定できる唯一の形式です。`pivotFieldAddItem()` に空の名前を渡す方法は文字列比較なので空白の項目には一致しません。まだ解決できないインデックスは受け付けますが、フィルターは適用しません。

入力規則で `allowBlank` を省略すると既定値は `false` です。空セルを許可する場合は `allowBlank: true` を指定してください。`showDropDown` は引き続き OOXML の意味が反転する例外です。

::: info 読み取り専用のアドホック評価
`evaluateFormulaText` と `evaluateConditionalFormula` は、既存ワークブックに対する読み取り専用評価です。ローカル参照、シートをまたぐ参照、定義名、`ROW()` / `COLUMN()` のアンカーを解決し、条件付き書式では相対参照と条件判定のための値の変換を適用します。スカラー版は、配列 / スピルの結果の左上の要素だけを返します。自己参照は対象セルのキャッシュ済みの値を読み取ります。

`evaluateFormulaArray(sheet, row, col, formula)` は配列全体を `EvalArrayResult`（`rows` × `cols` の `cells`）として返します。範囲を指す定義名は配列として評価され、スピル先の仮想セルも列挙されます。
:::

`INDIRECT(ref_text, FALSE)` は R1C1 文法を選択します。絶対参照は `R5C2` のように書き、相対軸は `R[-1]C` のように数式を置いたセルを基準に解決します。`R` または `C` だけを指定すると現在の行または列を表し、1 軸だけを持つ参照の端点はもう一方の軸全体を対象にします（`R5` は `5:5` と同じく 5 行全体です）。`a1` 引数は別文法への切り替えを追加するのではなく文法を選択するため、`FALSE` に A1 文字列を渡した場合と、`TRUE` に R1C1 文字列を渡した場合は `#REF!` になります。相対 R1C1 参照を、基準となる数式セルを持たないその場限りの評価入口から評価した場合も `#REF!` になります。

以下の図は、同じワークブックに対する 3 つの経路を対比したものです。

<DiagramFlow label="変更する経路: setFormula から recalc" :steps="[
  { label: 'setFormula(sheet, row, col, formula)' },
  { label: 'recalc()', note: '依存グラフに参加し、依存先も再計算される' }
]" />

<DiagramFlow label="読み取り専用の経路: evaluateFormulaText" :steps="[
  { label: 'evaluateFormulaText(sheet, row, col, formula)', note: '参照・定義名・ROW()/COLUMN() のアンカーを解決' },
  { label: 'スカラーの EvalResult', note: '配列/スピルは左上の要素のみ、自己参照はキャッシュ値、依存グラフには参加しない' }
]" />

<DiagramFlow label="配列全体の経路: evaluateFormulaArray" :steps="[
  { label: 'evaluateFormulaArray(sheet, row, col, formula)', note: '同じ読み取り専用の解決規則' },
  { label: 'EvalArrayResult', note: 'rows × cols の cells、依存グラフには参加しない' }
]" />

## 次に読むもの

- [ワークブックの流れ](/ja/workbook/lifecycle) ─ エンジン側のフロー
- [ワークブック操作](/ja/workbook/operations) ─ シート / セル / 構造
- [動的配列](/ja/workbook/dynamic-arrays) ─ 上記で触れたスピルの挙動
- [エラーモデル](/ja/compatibility/errors) ─ 各エラーコードの意味
- [ファイル形式サポート](/ja/compatibility/file-format-support) ─ XLSB が現在どこまで往復保存できるか
