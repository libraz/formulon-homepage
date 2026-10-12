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

`createFormulon(opts?)` は Emscripten の設定として `locateFile(path, prefix)`、`print(msg)`、`printErr(msg)`、`noInitialRun`、`noExitRuntime` を受け取ります。バンドラが `.wasm` ファイルを別の URL から配信する場合は `locateFile` を指定します。

解決された `Module` はライブラリ関数と `Workbook` の静的ファクトリを持ちます。すべて [関数とメソッド](#main-workbook-methods) に一覧があります。`Module.evalFormula(formula)` は新規ワークブックの `Sheet1!A1` を基準に読み取り専用で評価し、配列の結果は左上の要素だけを返します。`Workbook.createForProfile(profileId)` に不明な ID を渡すと `isValid()` が `false` のワークブックを返し、`Workbook.loadBytes(bytes)` は `.xlsx` か `.xlsb` かをバイト列から判別します。`setLogMinLevel(level)` と `setLogSink(sink)` はプロセス全体の状態を変更します。既定値の `LogLevel.Off` では何も出力しません。`sink(record: Uint8Array)` は JSON レコードを 1 件ずつ受け取り、その配列は呼び出し中だけ有効です。`null` を渡すと stderr への出力に戻ります。

パッケージは名前付きエクスポートとして `mergeFunctionMetadata(base, entry, locale)` も公開します。WASM の状態に触れない純粋な JavaScript のヘルパーです。[プロファイルと数式テキスト](#profiles-and-formula-text) を参照してください。

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

`getValue()` は `CellResult`（`{ status, value }`）を返します。一方、`evalFormula()`、`evaluateFormulaText()`、`evaluateConditionalFormula()` は同じ `status` / `value` を持つ `EvalResult` の戻り値を返します。いずれも `value` フィールドは `kind` でデータの種類が分かれる `Value` です。数値は `value.number`、真偽値は `value.boolean`（`0` または `1`）、テキストは `value.text`、エラーは `value.errorCode`（`formulon::ErrorCode` の値）で読み取ります。`errorText` というフィールドは存在しません（各コードの意味は [エラーモデル](/ja/compatibility/errors) を参照）。`Array` / `Ref` / `Lambda` の値は `Value` にデータを持ちません。ラムダの数式テキストはワークブックの `getLambdaText(sheet, row, col)` で、配列の中身は `evaluateFormulaArray()` で読み取ります。

宣言ファイルは、次の enum グループも公開します。

| 分野 | enum |
| --- | --- |
| 値 | `ValueKind`、`ErrorCode`（`Null = 0`、`Div0 = 1`、… `Python = 15`、`Unknown = 16`。`Value.errorCode` の値で、`setError` の引数にも使う） |
| 寸法と表示 | `GeometryMode`（`Display = 0`、`Print = 1`）、`DisplayStatus`（`Ok = 0`、`Overflow = 1`、`InvalidFormat = 2`） |
| AutoFilter | `FilterKind`、`FilterOperator`、`DynamicFilterType`、`SortBy`、`SortMethod`、`DateTimeGrouping` |
| 入力規則 | `ValidationErrorStyle`（`Stop = 0`、`Warning = 1`、`Information = 2`） |
| 条件付き書式 | `CfMatchKind`（`DifferentialFormat = 0`、`ColorScale = 1`、`DataBar = 2`、`IconSet = 3`） |
| テーマとスタイル | `ColorContext`、`ColorResolution`、`ThemeSource`、`EffectiveStyleSource` |
| 画像と描画 | `ImageFormat`、`DrawingObjectKind`、`AnchorKind`、`AnchorEditAs` |
| ピボットテーブル | `PivotAxis`、`PivotAggregation`、`PivotShowValuesAs`、`PivotFilterType`、`PivotFilterValueKind`、`PivotDateGrouping`、`PivotCalendar`、`PivotReportLayout`、`PivotCellKind`、定数 `PIVOT_SHOW_AS_BASE_PREVIOUS` / `PIVOT_SHOW_AS_BASE_NEXT` |
| テキスト照合 | `CollationStrength`（`Compare = 0`、`Dynamic = 1`、`ClassicExact = 2`） |
| ワークブック状態 | `CalcMode`（ファイルに往復保存するだけの情報で、エンジンはどのモードでも未計算のセルを再計算する）、`SheetVisibility`、`WorkbookFormat`、`ExternalLinkKind` |
| ログ | `LogLevel`（`Debug = 0`、`Info = 1`、`Warn = 2`、`Error = 3`、`Off = 4`） |

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

## コンテナ形式 {#container-format}

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

## プロファイルと数式テキスト {#profiles-and-formula-text}

新しいワークブックは `win-365-en_US` プロファイルを使います。プロファイルはワークブックの状態で、ロケールに依存する評価、数値と日付の表示、テキスト比較、Excel 上のローカライズされた名前を決めます。数式の入力は英語の正規形のままなので、画面に表示した数式は下記のヘルパーで変換してから保存します。プロファイル ID はファイルに書き込まれないため、読み込み後に `setExcelProfileId()` で設定し直してください。ID は `{mac,win}-365-{ja_JP,en_US,de_DE,fr_FR,zh_CN,ko_KR,th_TH,es_ES,es_MX,pt_BR,ru_RU,zh_TW,it_IT,nl_NL}` の 28 個です。ロケール情報はすべての `mac-*` と `win-365-ja_JP` で Excel の実測値、残り 13 個の Windows プロファイルは推定値です。

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

`localeFacts()` は選択したプロファイルの区切り文字、真偽値名、日付順、通貨、ローカライズ済みエラー名を返します。`facts.collationMeasured` が true になるのは `mac-*` だけで、`win-365-ja_JP` を含む Windows プロファイルでは false です。

`compareText(a, b, strength, profileId)` は `{ status, order }` を返し、`order` は `-1`、`0`、`1` のいずれかです。`collationClasses(values, strength, profileId)` は `{ status, classIds, classCount }` を返します。ID は入力の `Value` ごとに 1 つ、SORT の順序で昇順に振られ、その呼び出しの中だけで意味を持ちます。`CollationStrength` ごとの比較規則とクラスの規則は [テキスト照合](/ja/compatibility/text-collation) を参照してください。

`functionMetadata(name)` は、保存用の関数名、引数の数、対応状況など、ロケールに依存しない構造情報だけを返します。人が読むシグネチャと説明文のフィールドは空です。`functionNames()` は関数の一覧を返します。画面向けの説明はホスト側で `mergeFunctionMetadata(base, entry, locale)` を使って補います。このヘルパーの BCP-47 UI ロケールは、エンジンのプロファイル ID とは別です。

## 関数とメソッド {#main-workbook-methods}

インストール済みの `@libraz/formulon` に含まれる `dist/formulon.d.ts` から生成した一覧です。`Module.` で始まる名前は `createFormulon()` が返すオブジェクトのメンバー、`Workbook.` で始まる名前は静的ファクトリ、`createFormulon` と `mergeFunctionMetadata` はパッケージのエクスポートで、それ以外はすべて `Workbook` インスタンスのメソッドです。説明列は宣言に付いたドキュメントコメントの最初の 1 文で、API 自身の英語のテキストをそのまま載せています。コメントのない宣言では空欄です。

### ライブラリ、診断、ログ {#library}

<ApiReferenceTable surface="wasm" family="library" />

### ワークブックのライフサイクルと入出力 {#lifecycle}

<ApiReferenceTable surface="wasm" family="lifecycle" />

### シートと構造 {#sheets}

<ApiReferenceTable surface="wasm" family="sheets" />

### セル {#cells}

<ApiReferenceTable surface="wasm" family="cells" />

### 再計算 {#calculation}

<ApiReferenceTable surface="wasm" family="calculation" />

### 読み取り専用の評価 {#evaluation}

<ApiReferenceTable surface="wasm" family="evaluation" />

### プロファイル、ロケール、テキスト {#profiles}

<ApiReferenceTable surface="wasm" family="profiles" />

### 定義名 {#names}

<ApiReferenceTable surface="wasm" family="names" />

### テーブル {#tables}

<ApiReferenceTable surface="wasm" family="tables" />

### 依存関係、スピル、外部リンク {#dependencies}

<ApiReferenceTable surface="wasm" family="dependencies" />

### シートの表示と保護 {#view}

<ApiReferenceTable surface="wasm" family="view" />

### 行、列、ジオメトリ {#rows-columns}

<ApiReferenceTable surface="wasm" family="rows-columns" />

### 表示テキスト {#display}

<ApiReferenceTable surface="wasm" family="display" />

### スタイル {#styles}

<ApiReferenceTable surface="wasm" family="styles" />

### テーマと色 {#themes}

<ApiReferenceTable surface="wasm" family="themes" />

### セルの結合 {#merges}

<ApiReferenceTable surface="wasm" family="merges" />

### コメントとハイパーリンク {#comments-links}

<ApiReferenceTable surface="wasm" family="comments-links" />

### スレッド形式のコメントと人物 {#threaded-comments}

<ApiReferenceTable surface="wasm" family="threaded-comments" />

### オートフィルター {#filters}

<ApiReferenceTable surface="wasm" family="filters" />

### データの入力規則 {#validation}

<ApiReferenceTable surface="wasm" family="validation" />

### 条件付き書式 {#conditional-formats}

<ApiReferenceTable surface="wasm" family="conditional-formats" />

### 画像と描画オブジェクト {#images}

<ApiReferenceTable surface="wasm" family="images" />

### 印刷設定とページ分割 {#print}

<ApiReferenceTable surface="wasm" family="print" />

### ピボットテーブル {#pivots}

<ApiReferenceTable surface="wasm" family="pivots" />

### ピボットキャッシュ {#pivot-caches}

<ApiReferenceTable surface="wasm" family="pivot-caches" />

## メソッドの補足 {#method-notes}

`cellCount()` / `cellAt()` は、書式だけの空白セル、`setBlank` で書き込んだセル、スピル先のセルを含む書き込み済み座標を列挙します。未書き込みの隙間は含まず、インデックスは連続した整数で `(row, col)` の昇順です。列挙中はシートを変更しないでください。値や数式のある範囲の列挙とは対象が異なります。詳しくは [ワークブック操作](/ja/workbook/operations)を参照してください。

`setCellPhoneticRuns()` は、注釈対象テキストを UTF-16 の位置で順序付けた、重ならない区間に分割して設定します。`setCellPhoneticProperties()` は、読み仮名とは独立してフォント、かな種別、配置を変更します。セルの値を書き換えると、区間とプロパティの両方が消去されます。

`recalcParallel(threadCount)` は同期的に実行され、`{ status, stats }` を返します。既定の `@libraz/formulon` 入口ではシリアルに評価し、`stats.workerThreadsStarted === 0` を報告します。`@libraz/formulon/threads` 入口ではワーカーを起動します。`0` は最大 8 ワーカーの自動検出、`1` は呼び出し元スレッド、`2..8` はワーカー数の上限を選択します。引数なし、小数、有限でない値、負の値、8 超は `kInvalidArgument` で失敗します。

`setIterative(enabled, maxIterations, maxChange)` で反復計算の設定を保存し、`getIterative()` で `{ status, enabled, maxIterations, maxChange }` として読み戻します。`maxIterations` は `32767` を上限とし、getter は上限適用後の値を返します。

`SheetVisibility` は `Visible = 0`、`Hidden = 1`、`VeryHidden = 2` の 3 状態です。`setSheetVisibility(sheet, visibility)` はシートの表示状態全体を設定し、`getSheetView(sheet).view.visibility` で hidden と very-hidden を区別できます。従来の `tabHidden` はどちらの非表示状態でも `1` です。very-hidden を hidden へ降格する場合は `setSheetVisibility()` を使います。`setSheetTabHidden(true)` だけでは降格しません。

ワークシートの印刷設定は `setSheetPageSetup()`、`setSheetPageMargins()`、`setSheetPrintOptions()`、`setSheetHeaderFooter()`、`setSheetPrintArea()`、`setSheetPrintTitles()`、`addSheetRowBreak()`、`addSheetColBreak()` で作成できます。モデル化していない断片には生の XML を設定するメソッドを使えますが、保存前に入力を検証します。ヘッダー / フッターはデコード済みの Excel セクション文字列を受け取り、文字どおりのアンパサンドは `&&` と書きます。

`setRangeXfIndex(sheet, firstRow, firstCol, lastRow, lastCol, xfIndex)` はセル書式（XF）インデックスを両端を含む矩形へ適用し、存在しないセルを書式付きの空セルとして作成します。

行と列のスタイル、`clearCellXfIndex()` と `setCellXfIndex(..., 0)` の違い、`rangeStyleBases()` → `remapRangeStyle()` による属性だけの変更と、その取り消しに使う `snapshotRangeStyle()` / `restoreRangeStyle()` は [ワークブック操作](/ja/workbook/operations) で説明しています。`getEffectiveStyle().source` は、スタイルの出どころが `Cell`、`Row`、`Column`、`Default` のどれかを返します。

`setFormula()` は不正な数式を `kParserUnexpectedToken` として拒否し、失敗前のセル状態を保ちます。保存済みファイルに不正な数式文字列が含まれている場合は読み込み自体は成功しますが、再計算後のセル値は `#NAME?` エラーになります。`evalFormula()` のアドホック評価は `#NAME?` を値として返し、成功ステータスのままです。

`getCellsInRange(sheet, range, cursor, limit)` は、行・列の順序で `{ status, cells, nextCursor }` を返します。各 `RangeCell` は `row`、`col`、`formula`、`value` を持ちます。最初のページでは `cursor` を省略し、完了して `nextCursor` が `null` になるまで値を次の呼び出しへ渡してください。`limit` の省略または 0 は最大 65,536 件を選びます。数式セル、空白でない値、スピルの仮想セルを含み、スタイルだけを持つ空セルは含みません。`listInvalidCells()` も同じカーソルと上限を使います。

寸法 API の `GeometryMode.Display` は 96 DPI の画面向けモデル、`GeometryMode.Print` はページ分割に使う DPI に依存しないモデルを選びます。表示 API は日付シリアルが暦の範囲外になる場合など、値が書式の表現可能な範囲を外れると `DisplayStatus.Overflow` と `########` を返します。書式コードが不正な場合は `DisplayStatus.InvalidFormat` として General 表示へフォールバックします。

`setCellStyle(record)` は名前付きセルスタイルを追加または置換します。JavaScript のレコードは `{ name, xfId?, builtinId?, iLevel?, hidden?, customBuiltin? }` です。省略した項目は `xfId: 0`、カスタムスタイルを表す `builtinId`、レベル 0、両方のフラグ `false` になります。`xfId` は名前付きスタイルの `cellStyleXfs` テーブルを指し、セル単位の `cellXfs` テーブルは指しません。

`getTheme()` は 4 つのテーマ書体に加えて `majorScripts` と `minorScripts` を返し、`setThemeScriptFont(major, script, typeface)` はスクリプトの項目を 1 つ変更または追加します。既定値と `Jpan` へのフォールバック規則は [表示とレイアウト](/ja/workbook/presentation) を参照してください。

条件付き書式のレコードの `dataBar.direction` は、`0` がシートの読み方向、`1` が左から右、`2` が右から左です。評価結果では同じ値が `CfMatch.barDirection` に入ります。`iconSet.floor` は下限を表す `CfValueObjectInput` で、ルール追加時は省略でき、アイコンセット規則を読み出すと必ず含まれます。

`pivotFieldAddItemAt(sheet, pivotIdx, fieldIdx, cacheIndex, visible)` は、結び付いたキャッシュ項目の共有項目インデックスで手動フィルター項目を指定します。空白のピボット項目を指定できる唯一の形式です。`pivotFieldAddItem()` に空の名前を渡す方法は文字列比較なので空白の項目には一致しません。まだ解決できないインデックスは受け付けますが、フィルターは適用しません。

入力規則で `allowBlank` を省略すると既定値は `false` です。空セルを許可する場合は `allowBlank: true` を指定してください。`showDropDown` は引き続き OOXML の意味が反転する例外です。

AutoFilter の条件と行の表示状態は別に管理します。`evaluateAutoFilter()` で一致結果を確認し、`applyAutoFilter()` で非表示行を更新してください。`clearAutoFilter()` は範囲を残したまま条件を削除します。入力規則 API は値を保存せずに候補値を検証し、`listInvalidCells()` は既存の違反を列挙します。

`probeImage()` はワークブックを変更せず、PNG、JPEG、GIF、BMP の画像形式と寸法を読み取ります。`listDrawingObjects()` はシートのアンカー付きオブジェクトを文書順で返します。`getImage()` は画像バイト列をコピーし、`insertImage()` は既存の描画を保持します。`removeImage()` は画像を削除し、他のオブジェクトがメディアを参照しなくなった場合にメディアも解放します。スレッドコメント API は返信と人物レコードを含み、コメントやメンションが参照している人物は削除できません。

`paginate(sheet)` は、`status` とともに `printArea`、`horizontalBreaks`、`verticalBreaks`、`pageCount`、`paper`、`margins`、`printable`、`scale`、`pageOrder`、`printTitles`、`pages`、`horizontalBreakManual`、`verticalBreakManual` を返します。`paper` はポイント単位の寸法、向き、用紙コードを認識できたかを持ちます。`pages` は印刷順の物理ページを並べ、`areaIndex`、両端を含むセル範囲、原点、拡大縮小後の寸法を含みます。印刷範囲の指定がない場合も `printArea` は空のままですが、ページ分割は使用範囲へフォールバックします。手動改ページの配列は対応する改ページ配列と同じ順序です。

::: info 読み取り専用のアドホック評価
`evaluateFormulaText` と `evaluateConditionalFormula` は、既存ワークブックに対する読み取り専用評価です。ローカル参照、シートをまたぐ参照、定義名、`ROW()` / `COLUMN()` のアンカーを解決し、条件付き書式では相対参照と条件判定のための値の変換を適用します。スカラー版は、配列 / スピルの結果の左上の要素だけを返します。自己参照は対象セルのキャッシュ済みの値を読み取ります。

`evaluateFormulaArray(sheet, row, col, formula)` は配列全体を `EvalArrayResult`（`rows` × `cols` の `cells`）として返します。範囲を指す定義名は配列として評価され、スピル先の仮想セルも列挙されます。
:::

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
