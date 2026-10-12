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
| `Module.Workbook.createForProfile(profileId)` | 指定した Excel プロファイルのロケール既定値で 1 シートのワークブックを作成 |
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

`sheetCount()`、すべての `*Count()`、`calcMode()` などの数値アクセサは、`{ status, value }` 形式の `NumberResult` を返します。`sheetName()`、`excelProfileId()`、`localizeFunctionName()`、`canonicalizeFunctionName()`、`localizeFormula()`、`canonicalizeFormula()` などの文字列アクセサは `StringResult` を返します。`value` を読む前に `status.ok` を確認してください。失敗時の既定値も、0 件や空文字列として返ります。

リスト取得 API は `ListResult<T>` を返します。これは `status` プロパティを持つ配列そのものです。要素は `result[0]` のように読み取り、`items` や `value` の戻り値で包まれた形式は使いません。`spillInfo()` は `SpillInfo` を返すため、領域フィールドを読む前に `status` を確認してください。

JavaScript バインディングは、C ABI を呼び出す前に引数の型と整数への変換を検証します。プリミティブ型の誤り、`Symbol`、`BigInt`、有限でない値や小数の整数引数、安全な整数でないカーソル、形の違う入れ子レコードは、結果を返さずに `TypeError` または `RangeError` を送出することがあります。型が正しい引数をエンジンが拒否した場合は `Status.ok === false` を返し、ワークブックは変更しません。

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

宣言ファイルは、次の enum グループも公開します。

| 分野 | enum |
| --- | --- |
| 寸法と表示 | `GeometryMode`（`Display = 0`、`Print = 1`）、`DisplayStatus`（`Ok = 0`、`Overflow = 1`、`InvalidFormat = 2`） |
| AutoFilter | `FilterKind`、`FilterOperator`、`DynamicFilterType`、`SortBy`、`SortMethod`、`DateTimeGrouping` |
| 入力規則 | `ValidationErrorStyle`（`Stop = 0`、`Warning = 1`、`Information = 2`） |
| テーマとスタイル | `ColorContext`、`ColorResolution`、`ThemeSource`、`EffectiveStyleSource` |
| 画像と描画 | `ImageFormat`、`DrawingObjectKind`、`AnchorKind`、`AnchorEditAs` |
| テキスト照合 | `CollationStrength`（`Compare = 0`、`Dynamic = 1`、`ClassicExact = 2`） |
| ワークブック状態 | `CalcMode`、`SheetVisibility`、`WorkbookFormat` |

フィルター関連の enum は対応する OOXML の序数に従います。`ImageFormat` は `Unknown` に加えて `Png`、`Jpeg`、`Gif`、`Bmp` を表します。全メンバーは宣言ファイルを参照してください。

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

## プロファイルと数式テキスト

既定の Excel プロファイルは `win-365-en_US` です。プロファイルはワークブックの実行時状態であり、保存されません。読み込み後にも `setExcelProfileId()` を呼び出してください。利用できるプロファイル ID は 28 個で、14 個のロケールに対して Mac / Windows 版があります。ロケール情報はすべての `mac-*` と `win-365-ja_JP` で Excel の実測値、残り 13 個の Windows プロファイルは推定値です。`localeFacts().facts.collationMeasured` は別の項目で、テキスト照合の実測値を持つのは `mac-*` だけです。

`createDefault()` は Calibri 11 を含む通常の 1 シート既定値を使います。`createForProfile(profileId)` は選択したプロファイルを記録し、本文用フォントと必要なロケールのふりがな用フォント、ローカライズされた `Normal` スタイルと最初のシート名、セル XF の配置、ふりがな設定、ページ余白、Mac の行の高さと基本列幅を設定します。テーマパートは書き出さないため、新しいワークブックは既定の Office テーマとして読み取られます。Windows の行と列の寸法はエンジンの既定値を使います。

```ts
import createFormulon from '@libraz/formulon'

const LocaleModule = await createFormulon()
const profile = 'mac-365-de_DE'
const localeWorkbook = LocaleModule.Workbook.createForProfile(profile)
try {
  const shown = localeWorkbook.localizeFormula('=SUM(1.5,TRUE)', profile)
  if (!shown.status.ok) throw new Error(shown.status.message)
  const stored = localeWorkbook.canonicalizeFormula(shown.value, profile)
  if (!stored.status.ok) throw new Error(stored.status.message)
  const facts = localeWorkbook.localeFacts(profile)
  if (!facts.status.ok || facts.facts === null) throw new Error(facts.status.message)
  console.log(shown.value, stored.value, facts.facts)
} finally {
  localeWorkbook.delete()
}
```

`localizeFormula()` は関数名、引数と配列の区切り文字、小数点、真偽値名、エラー名を変換します。文字列、引用符付きシート名、外部修飾子、構造化参照の角括弧は保持します。`canonicalizeFormula()` は逆方向に変換します。どちらもテキストの変換だけを行い、数式を検証したりワークブックに設定したりはしません。評価時の挙動は `setExcelProfileId()` で選び、`setFormula()` には英語の不変な保存形式を渡してください。

`functionMetadata()` は、保存用の関数名、引数の数、対応状況など、ロケールに依存しない構造情報だけを返します。人が読むシグネチャと説明文のフィールドは現在空です。画面向けの説明はホスト側の `mergeFunctionMetadata()` で補えます。このヘルパーの BCP-47 UI ロケールは、エンジンのプロファイル ID とは別です。`localeFacts()` は選択したプロファイルの区切り文字、真偽値名、日付順、通貨、ローカライズ済みエラー名を返します。

`compareText(a, b, strength, profileId)` はテキストの順序の符号（`-1`、`0`、`1`）を `order` に返します。`CollationStrength` は通常の比較、動的配列の検索、従来の完全一致検索で使うテキストの折りたたみ方を選びます。`collationClasses(values, strength, profileId)` は `Value` ごとの密な `classIds` とクラス数を返します。1 回の呼び出しの中で同じ ID になるのは値の種類も一致する場合だけで、ID は SORT の順序（数値、テキスト、真偽値、エラー、空白）に並びます。テキストは選択した強度で比較し、`-0` と `0` は同じ数値、空白は 1 クラスです。ID は呼び出しの外では意味を持たないため、保存済みの値と現在の値を同じ呼び出しで分類して選択を照合してください。

## 主なワークブックメソッド

`cellCount()` / `cellAt()` は、書式だけの空白セル、`setBlank` で書き込んだセル、スピル先のセルを含む書き込み済み座標を列挙します。未書き込みの隙間は含まず、インデックスは連続した整数で `(row, col)` の昇順です。列挙中はシートを変更しないでください。値や数式のある範囲の列挙とは対象が異なります。詳しくは [ワークブック操作](/ja/workbook/operations)を参照してください。

| 分類 | メソッド |
| --- | --- |
| シート | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, `sheetCount`, `sheetName` |
| セル | `setNumber`、`setBool`、`setError`、`setText`、`setBlank`、`setFormula`、`getValue`、`getFormula`、`getFormulaR1C1`、`localizeFormula`、`canonicalizeFormula`、`cellCount`、`cellAt`、`getLambdaText`、ふりがなの取得 / 設定 |
| 範囲 | `getCellsInRange`、`getMergesInRange`、`setRangeXfIndex`、`listInvalidCells` |
| 計算 | `recalc`、`recalcParallel`、`partialRecalc`、`evaluateFormulaText`、`evaluateFormulaArray`、`evaluateConditionalFormula`、`setIterative`、`getIterative`、`setIterativeProgress`、`calcMode`、`setCalcMode`、`pinnedNow`、`setPinnedNow`、`clearPinnedNow`、`paginate` |
| 保存 | `save`, `saveAs`, `saveWithDiagnostics`, `readDiagnostics` |
| プロファイルと数式テキスト | `excelProfileId`、`setExcelProfileId`、`localizeFunctionName`、`canonicalizeFunctionName`、`localizeFormula`、`canonicalizeFormula`、`localeFacts`、`compareText`、`collationClasses` |
| 定義名 / テーブル | `definedNameCount`, `definedNameAt`, `setDefinedName`, `tableCount`, `tableAt` |
| 構造 | `insertRows`, `deleteRows`, `insertCols`, `deleteCols` |
| 寸法とレイアウト | `getCellRectPt`、`getColumnWidthPt`、`getRowHeightPt`、`getWidthModel`、`columnCharsToPt`、`columnPtToChars`、シート表示、保護、行 / 列レイアウト、型付き印刷設定 |
| 表示 | `getDisplayText`、`formatValue` |
| テーマとスタイル | `getTheme`、`setThemeColors`、`setThemeFonts`、`setThemeScriptFont`、`resolveColor`、`getEffectiveStyle`、行 / 列スタイルの設定と解除、`getCellXfIndex`、`setCellXfIndex`、`clearCellXfIndex`、`setRangeXfIndex`、`rangeStyleBases`、`remapRangeStyle`、`snapshotRangeStyle`、`restoreRangeStyle`、`getFont` / `addFont`、`setFont`、`setDefaultFont`、`setCellStyle`、`removeCellStyle` |
| フィルター | `getAutoFilter` / `setAutoFilter` / `removeAutoFilter`、`applyAutoFilter`、`clearAutoFilter`、`evaluateAutoFilter`、テーブル向けの対応 API |
| 入力規則 | `getValidations`、`addValidation`、`removeValidationAt`、`clearValidations`、`validateValue`、`listInvalidCells` |
| スレッドコメント | `getThreadedComments`、`addThreadedComment`、`editThreadedComment`、`setThreadResolved`、`removeThreadedComment`、`getPersons`、`addPerson`、`removePerson` |
| 画像と描画 | `probeImage`、`listDrawingObjects`、`getImage`、`insertImage`、`removeImage` |
| ワークブックデータ | コメント（`getCommentResult`）、ハイパーリンク、条件付き書式、ピボットレイアウトとキャッシュ項目フィルター、外部リンク |
| 内部参照 | `precedents`, `dependents`, `functionMetadata`, `functionNames`, `spillInfo` |

`setCellPhoneticRuns()` は、注釈対象テキストを UTF-16 の位置で順序付けた、重ならない区間に分割して設定します。`setCellPhoneticProperties()` は、読み仮名とは独立してフォント、かな種別、配置を変更します。セルの値を書き換えると、区間とプロパティの両方が消去されます。

`recalcParallel(threadCount)` は同期的に実行され、`{ status, stats }` を返します。既定の `@libraz/formulon` 入口ではシリアルに評価し、`stats.workerThreadsStarted === 0` を報告します。`@libraz/formulon/threads` 入口ではワーカーを起動します。`0` は最大 8 ワーカーの自動検出、`1` は呼び出し元スレッド、`2..8` はワーカー数の上限を選択します。引数なし、小数、有限でない値、負の値、8 超は `kInvalidArgument` で失敗します。

`setIterative(enabled, maxIterations, maxChange)` で反復計算の設定を保存し、`getIterative()` で `{ status, enabled, maxIterations, maxChange }` として読み戻します。`maxIterations` は `32767` を上限とし、getter は上限適用後の値を返します。

`SheetVisibility` は `Visible = 0`、`Hidden = 1`、`VeryHidden = 2` の 3 状態です。`setSheetVisibility(sheet, visibility)` はシートの表示状態全体を設定し、`getSheetView(sheet).view.visibility` で hidden と very-hidden を区別できます。従来の `tabHidden` はどちらの非表示状態でも `1` です。very-hidden を hidden へ降格する場合は `setSheetVisibility()` を使います。`setSheetTabHidden(true)` だけでは降格しません。

ワークシートの印刷設定は `setSheetPageSetup()`、`setSheetPageMargins()`、`setSheetPrintOptions()`、`setSheetHeaderFooter()`、`setSheetPrintArea()`、`setSheetPrintTitles()`、`addSheetRowBreak()`、`addSheetColBreak()` で作成できます。モデル化していない断片には生の XML を設定するメソッドを使えますが、保存前に入力を検証します。ヘッダー / フッターはデコード済みの Excel セクション文字列を受け取り、文字どおりのアンパサンドは `&&` と書きます。

`setRangeXfIndex(sheet, firstRow, firstCol, lastRow, lastCol, xfIndex)` はセル書式（XF）インデックスを両端を含む矩形へ適用し、存在しないセルを書式付きの空セルとして作成します。

`setColumnStyle()` / `clearColumnStyle()` と `setRowStyle()` / `clearRowStyle()` は、行または列のほかの属性を残してセル書式 XF だけを設定または解除します。インデックス `0` は既定 XF です。`clearCellXfIndex()` はセルの明示的な割り当てを解除し、空白セルが行、列、ワークブックの既定値を継承できるようにします。`setCellXfIndex(..., 0)` は明示的な Normal XF を残すため、解除とは異なります。`getEffectiveStyle().source` で `Cell` と `Row`、`Column`、`Default` を区別できます。

`rangeStyleBases()` は選択範囲のセルが実際に解決するセル XF のインデックスを昇順で返します。各基底を変更した XF に置き換えて `remapRangeStyle()` に渡すと、値と数式を保った属性だけの変更になります。`snapshotRangeStyle()` は対象の行 / 列スタイルと保存済みセルの割り当てを取得し、`restoreRangeStyle()` は値、数式、ふりがな、コメントを変更せずに復元します。選択範囲の規則と標準的な操作手順は [ワークブック操作](/ja/workbook/operations) を参照してください。

`setFormula()` は不正な数式を `kParserUnexpectedToken` として拒否し、失敗前のセル状態を保ちます。保存済みファイルに不正な数式文字列が含まれている場合は読み込み自体は成功しますが、再計算後のセル値は文字どおりの `#NAME?` になります。`evalFormula()` のアドホック評価は `#NAME?` を値として返し、成功ステータスのままです。

`getCellsInRange(sheet, range, cursor, limit)` は、行・列の順序で `{ status, cells, nextCursor }` を返します。各 `RangeCell` は `row`、`col`、`formula`、`value` を持ちます。最初のページでは `cursor` を省略し、完了して `nextCursor` が `null` になるまで値を次の呼び出しへ渡してください。`limit` の省略または 0 は最大 65,536 件を選びます。数式セル、空白でない値、スピルの仮想セルを含み、スタイルだけを持つ空セルは含みません。`listInvalidCells()` も同じカーソルと上限を使います。

寸法 API の `GeometryMode.Display` は 96 DPI の画面向けモデル、`GeometryMode.Print` はページ分割に使う DPI に依存しないモデルを選びます。表示 API は日付シリアルが暦の範囲外になる場合など、値が書式の表現可能な範囲を外れると `DisplayStatus.Overflow` と `########` を返します。書式コードが不正な場合は `DisplayStatus.InvalidFormat` として General 表示へフォールバックします。

`setCellStyle(record)` は名前付きセルスタイルを追加または置換します。JavaScript のレコードは `{ name, xfId?, builtinId?, iLevel?, hidden?, customBuiltin? }` です。省略した項目は `xfId: 0`、カスタムスタイルを表す `builtinId`、レベル 0、両方のフラグ `false` になります。`xfId` は名前付きスタイルの `cellStyleXfs` テーブルを指し、セル単位の `cellXfs` テーブルは指しません。`getEffectiveStyle()` は、セル、行、列、ワークブック既定値のどこから書式を解決したかと、テーマを解決した色を返します。

`getTheme()` は 4 つのテーマ書体に加えて、テーマ内の順序で `majorScripts` と `minorScripts` を返します。テーマパートがない場合も、既定の Office テーマにある 47 個のスクリプト項目を返します。`setThemeScriptFont(major, script, typeface)` は 1 つのスクリプトを変更または追加します。読み取り時は、`Jpan` の項目が対応する東アジア書体として使われるのは、そのフォントセットの `<a:ea typeface>` が空の場合だけです。`<a:ea typeface>` に明示値があれば、そちらが優先されます。テーマパートがない場合は変更前に既定の全項目を作成し、`script` は 4 個の ASCII 英字、`typeface` は空でない文字列にしてください。

`pivotFieldAddItemAt(sheet, pivotIdx, fieldIdx, cacheIndex, visible)` は、結び付いたキャッシュ項目の共有項目インデックスで手動フィルター項目を指定します。空白のピボット項目を指定できる唯一の形式です。`pivotFieldAddItem()` に空の名前を渡す方法は文字列比較なので空白の項目には一致しません。まだ解決できないインデックスは受け付けますが、フィルターは適用しません。

入力規則で `allowBlank` を省略すると既定値は `false` です。空セルを許可する場合は `allowBlank: true` を指定してください。`showDropDown` は引き続き OOXML の意味が反転する例外です。

AutoFilter の条件と行の表示状態は別に管理します。`evaluateAutoFilter()` で一致結果を確認し、`applyAutoFilter()` で非表示行を更新してください。`clearAutoFilter()` は範囲を残したまま条件を削除します。入力規則 API は値を保存せずに候補値を検証し、`listInvalidCells()` は既存の違反を列挙します。

`probeImage()` はワークブックを変更せず、PNG、JPEG、GIF、BMP の画像形式と寸法を読み取ります。`listDrawingObjects()` はシートのアンカー付きオブジェクトを文書順で返します。`getImage()` は画像バイト列をコピーし、`insertImage()` は既存の描画を保持します。`removeImage()` は画像を削除し、他のオブジェクトがメディアを参照しなくなった場合にメディアも解放します。スレッドコメント API は返信と人物レコードを含み、コメントやメンションが参照している人物は削除できません。

`paginate(sheet)` は、`status` とともに `printArea`、`horizontalBreaks`、`verticalBreaks`、`pageCount`、`paper`、`margins`、`printable`、`scale`、`pageOrder`、`printTitles`、`pages`、`horizontalBreakManual`、`verticalBreakManual` を返します。`paper` はポイント単位の寸法、向き、用紙コードを認識できたかを持ちます。`pages` は印刷順の物理ページを並べ、`areaIndex`、両端を含むセル範囲、原点、拡大縮小後の寸法を含みます。印刷範囲の指定がない場合も `printArea` は空のままですが、ページ分割は使用範囲へフォールバックします。手動改ページの配列は対応する改ページ配列と同じ順序です。

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
- [表示とレイアウト](/ja/workbook/presentation) ─ 表示文字列、テーマ、スタイル、寸法、ページ分割
- [フィルターと入力規則](/ja/workbook/filters-validation) ─ AutoFilter と候補値の検証
- [コメントと画像](/ja/workbook/comments-images) ─ スレッドコメント、人物、描画オブジェクト、画像
- [動的配列](/ja/workbook/dynamic-arrays) ─ 上記で触れたスピルの挙動
- [エラーモデル](/ja/compatibility/errors) ─ 各エラーコードの意味
- [ファイル形式サポート](/ja/compatibility/file-format-support) ─ XLSB が現在どこまで往復保存できるか
