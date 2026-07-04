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

`getValue()`、`evalFormula()`、`evaluateFormulaText()`、`evaluateConditionalFormula()` は、`kind` で payload が分かれた `Value` を返します。数値は `value.number`、真偽値は `value.boolean`（`0` または `1`）、テキストは `value.text`、エラーは `value.errorCode`（`formulon::ErrorCode` の序数）で読み取ります。`errorText` というフィールドは存在しません（各コードの意味は [エラーモデル](/ja/compatibility/errors) を参照）。`Array` / `Ref` / `Lambda` は現時点で `Value` に追加の payload を持たず、これらのフィールドは将来の拡張のために C ABI 側で予約されているだけです。ラムダの数式テキストを読むには、ワークブックの `getLambdaText(sheet, row, col)` を別途呼び出します。

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

`save()` は常に OOXML `.xlsx` を書き出します。`saveEx(format)`（0.9.3 で追加）を使うと、書き出すコンテナ形式を明示できます。

```ts
enum WorkbookFormat {
  Unknown = 0,
  Xlsx = 1,
  Xlsb = 2
}

const result = wb.saveEx(WorkbookFormat.Xlsb) // SaveResult { status, bytes }
```

`loadBytes(bytes)` はフラグなしでどちらのコンテナも受け付けます。ファイル名ではなく、パッケージのバイト列そのものから `.xlsb` / `.xlsx` を判別するため、同じ呼び出しでどちらも扱えます。各コンテナが何を往復保存できるかは [ファイル形式サポート](/ja/compatibility/file-format-support) を参照してください。

## 主な workbook methods

| 分類 | Methods |
| --- | --- |
| Sheets | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, `sheetCount`, `sheetName` |
| Cells | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula`, `getValue`, `cellCount`, `cellAt`, `getLambdaText` |
| Calculation | `recalc`, `partialRecalc`, `evaluateFormulaText`, `evaluateConditionalFormula`, `setIterative`, `setIterativeProgress`, `calcMode`, `setCalcMode` |
| Serialization | `save`, `saveEx` |
| Profiles | `excelProfileId`, `setExcelProfileId` |
| Names/tables | `definedNameCount`, `definedNameAt`, `setDefinedName`, `tableCount`, `tableAt` |
| Structure | `insertRows`, `deleteRows`, `insertCols`, `deleteCols` |
| Layout | sheet view, protection, row/column layout, styles, merges |
| Rich workbook data | comments, hyperlinks, data validations, conditional formats, pivot layout, external links |
| Introspection | `precedents`, `dependents`, `functionMetadata`, `functionNames`, `spillInfo` |

::: info 0.9.4 で追加
`evaluateFormulaText` と `evaluateConditionalFormula` は、既存ワークブックに対して数式テキストを**読み取り専用で（変更せず、依存グラフにも参加させずに）**評価します。ローカル参照、シート跨ぎ参照、定義名、`ROW()` / `COLUMN()` のアンカーを解決し、条件付き書式向け評価ではルールのアンカーから相対参照をずらし、Excel 風の predicate coercion も適用します。配列 / スピルの結果は左上隅の 1 セルに縮約されます — これは Excel の暗黙的な交差やスピルの再現ではなく、意図的な Phase 1 の API 仕様です（[動的配列](/ja/workbook/dynamic-arrays) 参照）。アンカーセル自身を参照する数式は、アドホック評価が依存グラフに参加しないため `#REF!` にはならず、そのセルのキャッシュ済みの値を読み取ります。
:::

以下の図は、同じワークブックに対する 2 つの経路を対比したものです。

<DiagramFlow label="変更する経路: setFormula から recalc" :steps="[
  { label: 'setFormula(sheet, row, col, formula)' },
  { label: 'recalc()', note: '依存グラフに参加し、依存先も再計算される' }
]" />

<DiagramFlow label="読み取り専用の経路: evaluateFormulaText（0.9.4）" :steps="[
  { label: 'evaluateFormulaText(sheet, row, col, formula)', note: '参照・定義名・ROW()/COLUMN() のアンカーを解決' },
  { label: 'スカラーの EvalResult', note: '配列/スピルは左上隅に縮約、自己参照はキャッシュ値、依存グラフには参加しない' }
]" />

## 次に読むもの

- [ワークブックの流れ](/ja/workbook/lifecycle) ─ エンジン側のフロー
- [ワークブック操作](/ja/workbook/operations) ─ シート / セル / 構造
- [動的配列](/ja/workbook/dynamic-arrays) ─ 上記で触れたスピルの挙動
- [エラーモデル](/ja/compatibility/errors) ─ 各エラーコードの意味
- [ファイル形式サポート](/ja/compatibility/file-format-support) ─ XLSB が現在どこまで往復保存できるか
