# WASM API

正式な TypeScript 宣言はパッケージ同梱の `dist/formulon.d.ts` です。このページは主要 API の要約です。

::: tip 宣言ファイルを優先する
ページとインストール済みパッケージで内容が食い違う場合、対応バージョンの `dist/formulon.d.ts` を正としてください。
:::

::: info 用語: ステータス envelope
WASM の失敗しうる呼び出しが返す `Status` オブジェクトです。`ok`、数値 `status`、人間向け `message`、診断用 `context` を持ちます。Excel のセルエラーはステータス失敗ではなく `kind = Error` の `Value` として返ります。
:::

## モジュール

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
```

| API | 用途 |
| --- | --- |
| `Module.evalFormula(formula)` | 新規ワークブックで 1 式評価 |
| `Module.Workbook.createDefault()` | `Sheet1` 付きワークブック |
| `Module.Workbook.createEmpty()` | sheet 0 個のワークブック |
| `Module.Workbook.loadBytes(bytes)` | メモリ上のワークブックを読み込む（`.xlsx` / `.xlsb` を自動判別） |
| `Module.versionString()` | エンジンバージョン |
| `Module.errorDisplayName(errorCode)` | エラー序数の Excel 表示文字列 |
| `Module.statusString(status)` | status の名前 |
| `Module.lastErrorMessage()` | 直近の診断メッセージ |
| `Module.lastErrorContext()` | 直近の診断 context |

## 結果 envelope

失敗しうる呼び出しは `Status`、または `status` を含む構造体を返します。

```ts
interface Status {
  ok: boolean
  status: number
  message: string
  context: string
}
```

Excel セルエラーは `ValueKind.Error`。Status の失敗とは区別されます。

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

`getValue()` は `CellResult`（`{ status, value }`）を返します。一方、`evalFormula()`、`evaluateFormulaText()`、`evaluateConditionalFormula()` は同じ `status` / `value` を持つ `EvalResult` envelope を返します。いずれも `value` フィールドは `kind` で payload が分かれる `Value` です。数値は `value.number`、真偽値は `value.boolean`（`0` または `1`）、テキストは `value.text`、エラーは `value.errorCode`（`formulon::ErrorCode` の序数）で読み取ります。`errorText` というフィールドは存在しません（各コードの意味は [エラーモデル](/ja/compatibility/errors) を参照）。`Array` / `Ref` / `Lambda` は現時点で `Value` に追加の payload を持たず、これらのフィールドは将来の拡張のために C ABI 側で予約されているだけです。ラムダの数式テキストを読むには、ワークブックの `getLambdaText(sheet, row, col)` を別途呼び出します。

## ワークブックのライフサイクル

```ts
const wb = Module.Workbook.loadBytes(bytes)
try {
  if (!wb.isValid()) throw new Error(Module.lastErrorMessage())
  wb.recalc()
  const saved = wb.save()
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

`saveWithDiagnostics(format)` は保存したバイト列と、writer が検出した損失・延期のカウンターを返します。`readDiagnostics()` はワークブックの読み込み時に取得したカウンターを返します。カウンターの対象は一部の損失だけです。すべて 0 であることは、記載された損失が発生しなかったことを示しますが、パッケージをバイト単位で比較したことや、診断イベントが一切なかったことは示しません。

| 結果 | フィールド | 意味 |
| --- | --- | --- |
| `saveWithDiagnostics` | `downgradedFormulaCount` | キャッシュ済みリテラルとして出力された数式セルの数。XLSX では常に 0 です。 |
|  | `deferredFeatureCount` | レコードへ変換されなかったシート機能の数。XLSX では常に 0 です。 |
|  | `droppedPartCount` | いずれかの writer が破棄した passthrough パートの数。 |
|  | `droppedRelationshipCount` | 対象パートの破棄に伴って破棄された relationship の数。`droppedPartCount` と同じ損失を表す場合があります。 |
|  | `renumberedPartCount` | writer が割り当てたパート ID で出力された table の数。XLSB では常に 0 です。 |
| `readDiagnostics` | `undecodedFormulaCount` | デコードできなかった保存済み数式の数。XLSB のみです。 |
|  | `undecodedDefinedNameCount` | デコードできずにスキップされた defined name の数。XLSB のみです。 |
|  | `undecodedPartCount` | content type を解決できなかった XLSB パッケージパートの数。 |
|  | `skippedFeatureCount` | 参照が利用できずスキップされた OOXML の presentation-overlay エントリの数。 |
|  | `unknownContentTypeCount` | content type が認識できなかった OOXML workbook パートの数。 |

## 固定する時計

ワークブックが pin されていない場合、`NOW()`、`TODAY()`、pivot の相対期間フィルターはホストの時計を読み取ります。これらの結果を 1 回の再計算で一致させる場合や、ホストをまたいで再現する場合は、ワークブックを 1 つの local civil time に固定してください。

```ts
wb.setPinnedNow(2026, 8, 19, 12, 0, 0)
const pin = wb.pinnedNow() // { year, month, day, hour, minute, second }
wb.recalc()
wb.clearPinnedNow()
```

`pinnedNow()` は `CivilTime` オブジェクトを返し、ワークブックがホストの時計に従う場合は `null` を返します。`setPinnedNow()` は `year` 1900–9999、`month` 1–12、月ごとの実在する日、`hour` 0–23、`minute` / `second` 0–59 を検証します。不正な値は正規化せず、失敗した `Status` を返します。値は timestamp ではなく local civil field として保持するため、タイムゾーンの解釈はありません。pin の設定・解除ではキャッシュ済みの数式値を再計算しないため、必要に応じて `recalc()` を明示的に呼び出してください。pin はファイル状態ではなくワークブックのモデル状態です。保存時には記録されず、読み込み直後のワークブックは pin されていません。

## 主な workbook methods

| 分類 | Methods |
| --- | --- |
| Sheets | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, `sheetCount`, `sheetName` |
| Cells | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula`, `setCellPhonetic`, `getCellPhonetic`, `getValue`, `cellCount`, `cellAt`, `getLambdaText` |
| Calculation | `recalc`、`recalcParallel`、`partialRecalc`、`evaluateFormulaText`、`evaluateFormulaArray`、`evaluateConditionalFormula`、`setIterative`、`getIterative`、`setIterativeProgress`、`calcMode`、`setCalcMode`、`pinnedNow`、`setPinnedNow`、`clearPinnedNow`、`paginate` |
| Serialization | `save`, `saveAs`, `saveWithDiagnostics`, `readDiagnostics` |
| Profiles | `excelProfileId`, `setExcelProfileId` |
| Names/tables | `definedNameCount`, `definedNameAt`, `setDefinedName`, `tableCount`, `tableAt` |
| Structure | `insertRows`, `deleteRows`, `insertCols`, `deleteCols` |
| Layout | sheet view と 3 状態 visibility、protection、row/column layout、styles、merges、typed print settings |
| Rich workbook data | comments（`getCommentResult`）、hyperlinks、data validations、conditional formats、pivot layout と cache-item filter、external links |
| Styles | `getFont` / `addFont` の `FontRecord.vertAlign`（`0` baseline、`1` superscript、`2` subscript） |
| Introspection | `precedents`, `dependents`, `functionMetadata`, `functionNames`, `spillInfo` |

`recalcParallel(threadCount)` は同期的に実行され、`{ status, stats }` を返します。`0` は最大 8 worker の自動検出、`1` は呼び出し元スレッド、`2..8` は worker 数の上限を選択します。引数なし、整数でない値、有限でない値、負の値、8 超は `kInvalidArgument` で失敗します。

`setIterative(enabled, maxIterations, maxChange)` で反復計算の設定を保存し、`getIterative()` で `{ status, enabled, maxIterations, maxChange }` として読み戻します。`maxIterations` は `32767` を上限とし、getter は上限適用後の値を返します。

`SheetVisibility` は `Visible = 0`、`Hidden = 1`、`VeryHidden = 2` の 3 状態です。`setSheetVisibility(sheet, visibility)` は tab state 全体を設定し、`getSheetView(sheet).view.visibility` で hidden と very-hidden を区別できます。従来の `tabHidden` はどちらの hidden state でも `1` です。very-hidden を hidden へ降格する場合は `setSheetVisibility()` を使います。`setSheetTabHidden(true)` だけでは降格しません。

worksheet の印刷設定は `setSheetPageSetup()`、`setSheetPageMargins()`、`setSheetPrintOptions()`、`setSheetHeaderFooter()`、`setSheetPrintArea()`、`setSheetPrintTitles()`、`addSheetRowBreak()`、`addSheetColBreak()` で作成できます。モデル化していない fragment には raw XML setter を使えますが、保存前に入力を検証します。header / footer は decoded な Excel section string を受け取り、文字どおりの ampersand は `&&` と書きます。

`setRangeXfIndex(sheet, firstRow, firstCol, lastRow, lastCol, xfIndex)` は cell-style XF index を両端を含む矩形へ適用し、存在しないセルを style 付き blank として作成します。

`pivotFieldAddItemAt(sheet, pivotIdx, fieldIdx, cacheIndex, visible)` は、結び付いた cache field の shared-item index で手動 filter item を指定します。blank pivot member を指定できる唯一の形式です。`pivotFieldAddItem()` に空の name を渡す方法は文字列比較なので blank には一致しません。まだ解決できない index は受け付けますが、何も filter しません。

data validation の入力で `allowBlank` を省略すると既定値は `false` です。空セルを許可する場合は `allowBlank: true` を指定してください。`showDropDown` は引き続き OOXML の意味が反転する例外です。

::: info 読み取り専用のアドホック評価
`evaluateFormulaText` と `evaluateConditionalFormula` は、既存ワークブックに対する読み取り専用評価です。ローカル参照、シート跨ぎ参照、定義名、`ROW()` / `COLUMN()` のアンカーを解決し、条件付き書式では相対参照と predicate coercion を適用します。配列 / スピルの結果はスカラー版では左上隅に縮約されます。自己参照は対象セルのキャッシュ値を読み取ります。

`evaluateFormulaArray(sheet, row, col, formula)` は配列全体を `EvalArrayResult`（`rows` × `cols` の `cells`）として返します。範囲形の定義名は Array として評価され、スピルの phantom cell も列挙されます。

`INDIRECT(ref_text, FALSE)` は R1C1 文法を選択します。絶対参照は `R5C2` のように書き、相対軸は `R[-1]C` のように数式を置いたセルを基準に解決します。`R` または `C` だけを指定すると現在の行または列を表し、1 軸だけを持つ endpoint はもう一方の軸全体を対象にします（`R5` は `5:5` と同じく 5 行全体です）。`a1` 引数は fallback を追加するのではなく文法を選択するため、`FALSE` に A1 文字列を渡した場合と、`TRUE` に R1C1 文字列を渡した場合は `#REF!` になります。相対 R1C1 参照を、基準となる数式セルを持たない ad-hoc 評価入口から評価した場合も `#REF!` になります。

以下の図は、同じワークブックに対する 2 つの経路を対比したものです。

<DiagramFlow label="変更する経路: setFormula から recalc" :steps="[
  { label: 'setFormula(sheet, row, col, formula)' },
  { label: 'recalc()', note: '依存グラフに参加し、依存先も再計算される' }
]" />

<DiagramFlow label="読み取り専用の経路: evaluateFormulaText" :steps="[
  { label: 'evaluateFormulaText(sheet, row, col, formula)', note: '参照・定義名・ROW()/COLUMN() のアンカーを解決' },
  { label: 'スカラーの EvalResult', note: '配列/スピルは左上隅に縮約、自己参照はキャッシュ値、依存グラフには参加しない' }
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
