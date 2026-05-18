# WASM API

正式な TypeScript 宣言はパッケージ同梱の `dist/formulon.d.ts` です。このページは主要 API の要約です。

::: tip 宣言ファイルを優先する
ページとインストール済みパッケージで内容が食い違う場合、対応バージョンの `dist/formulon.d.ts` を正としてください。
:::

::: info 用語: ステータスの包み
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
| `Module.Workbook.loadBytes(bytes)` | メモリ上の `.xlsx` を読み込む |
| `Module.versionString()` | エンジンバージョン |
| `Module.statusString(status)` | status の名前 |
| `Module.lastErrorMessage()` | 直近の診断メッセージ |
| `Module.lastErrorContext()` | 直近の診断 context |

## 結果の包み

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

`getValue()` / `evalFormula()` は `kind` で payload が分かれた `Value` を返します。`Number` は `value.number`、`Bool` は `value.bool`、`Text` は `value.text`、`Error` は `value.errorCode` / `value.errorText`、`Array` は `value.array`、`Ref` は `value.ref`、`Lambda` は `value.lambda`。

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

## 主な workbook methods

| 分類 | Methods |
| --- | --- |
| Sheets | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, `sheetCount`, `sheetName` |
| Cells | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula`, `getValue`, `cellCount`, `cellAt` |
| Calculation | `recalc`, `partialRecalc`, `setIterative`, `setIterativeProgress`, `calcMode`, `setCalcMode` |
| Profiles | `excelProfileId`, `setExcelProfileId` |
| Names/tables | `definedNameCount`, `definedNameAt`, `setDefinedName`, `tableCount`, `tableAt` |
| Structure | `insertRows`, `deleteRows`, `insertCols`, `deleteCols` |
| Layout | sheet view, protection, row/column layout, styles, merges |
| Rich workbook data | comments, hyperlinks, data validations, conditional formats, pivot layout, external links |
| Introspection | `precedents`, `dependents`, `functionMetadata`, `functionNames`, `spillInfo` |

## 次に読むもの

- [ワークブックの流れ](/ja/workbook/lifecycle) ─ エンジン側のフロー
- [ワークブック操作](/ja/workbook/operations) ─ シート / セル / 構造
- [エラーモデル](/ja/compatibility/errors) ─ 各エラーコードの意味
