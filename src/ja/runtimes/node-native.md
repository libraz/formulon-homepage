# Native Node 連携

`packages/npm-native` の Native Node パッケージは、Node.js の [N-API](https://nodejs.org/api/n-api.html) アドオンです。WASM パッケージと共有する計算・ワークブックメソッドを、ネイティブバイナリとして公開します。binding のメソッド構成は同一ではなく、table 作成、AutoFilter XML、cell-style 作成は WASM にのみあります。WASM ヒープコピーのコストや、ブラウザ専用の cross-origin isolation 要件は不要です。

::: info 用語: N-API
Node がネイティブアドオン向けに提供する C ABI。N-API レベルが同じなら同じ prebuilt `.node` を複数の Node マイナー版で使い回せます。
:::

選ぶ条件:

- 配置先に合う `.node` バイナリをデプロイできる
- 大規模ワークブックで WASM ヒープコピーを避けたい
- ブラウザの隔離制約を意識せずにネイティブのスケジューラを使いたい

::: info 実行入口の一致度
Native Node と WASM は共通する Workbook メソッドと 3 個の static factory（`createDefault`、`createEmpty`、`loadBytes`）を公開します。次の 7 メソッドは WASM にのみあります。`createTable`、`updateTable`、`removeTable`、`getSheetAutoFilterXml`、`setSheetAutoFilterXml`、`addCellStyleXf`、`setCellStyle` です。Native Node には決定的に解放する `dispose()` と、ネイティブフットプリントの推定値を返す `memoryUsage()` があります。推定値はセル、shared strings、passthrough part、ワークブックメタデータを含み、V8 の external-memory 報告を更新します。GC はフォールバックです。WASM は WASM ヒープ上のネイティブハンドルを `delete()` で解放します。
:::

## 提供状況

Native Node アドオンはソースツリーの `packages/npm-native` にありますが、現時点では public npm registry には公開されていません。Formulon の checkout からビルドするか、自分の配布環境に stage して使います。

ソース checkout では次を実行します。

```sh
make node-native
make node-package
make node-test
```

その後、`packages/npm-native/dist/index.mjs` の staged package を import するか、社内向けの配布フローに乗せてください。

## 使い方

```js
import { Workbook, ValueKind, evalFormula } from './packages/npm-native/dist/index.mjs'

console.log(evalFormula('=SUM(1,2,3)'))

const wb = Workbook.createDefault()
wb.setFormula(0, 0, 0, '=1+2')
wb.recalc()

const result = wb.getValue(0, 0, 0)
if (result.status.ok && result.value.kind === ValueKind.Number) {
  console.log(result.value.number)
}
```

スコープを抜けるときは `dispose()` を呼びます。呼び忘れても JavaScript の GC がハンドルを最終化します。

## 現在公開している API

| 分類 | Methods |
| --- | --- |
| 作成 | `Workbook.createDefault()`, `createEmpty()`, `loadBytes(bytes)` |
| セル変更 | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula` |
| 再計算と読み取り | `getValue`, `recalc`, `recalcParallel`, `partialRecalc`, `setIterative`, `getIterative`, `evaluateFormulaText`, `evaluateConditionalFormula`, `evaluateFormulaArray`, `paginate`, `save`, `saveAs`, `saveWithDiagnostics`, `readDiagnostics`, `spillInfo`, `precedents`, `dependents` |
| シートと構造 | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, 行 / 列の挿入削除、定義名、table の列挙（`tableCount`, `tableAt`）、passthrough parts |
| workbook data | cell-style 作成を除く styles、merges、comments、`getComments`、hyperlinks、validations、conditional formatting、sheet view / layout / protection、3 状態 visibility、typed print settings、range XF 設定 |
| PivotTables | pivot cache / pivot table の作成、cache-index item filter、変更、layout 投影 |
| WASM のみ | `createTable`, `updateTable`, `removeTable`, `getSheetAutoFilterXml`, `setSheetAutoFilterXml`, `getCellPhonetic`, `setCellPhonetic`, `addCellStyleXf`, `setCellStyle` |
| policy / catalog | calc mode、Excel profile id、function metadata、ローカライズ名、external links |
| トップレベル | `evalFormula`, `version`, `lastErrorMessage`, `lastErrorContext`, `statusString`, `mergeFunctionMetadata` |

正確な method 一覧はパッケージの TypeScript declaration を確認してください。Native Node は、配置先に platform-specific binary を置ける Node サービス向けです。ブラウザ、ふりがなや AutoFilter XML の操作、table や cell-style の作成、または native addon なしの Node 配置には WASM を使います。

Native Node は WASM と同じく、反復設定の read-back、3 状態の sheet visibility、印刷設定の作成、`setRangeXfIndex()`、`pivotFieldAddItemAt()` を公開します。`getIterative()` の `maxIterations` は共通の `32767` 上限適用後の値です。`SheetVisibility.VeryHidden` は `Hidden` と別状態であり、`pivotFieldAddItemAt()` は cache shared-item index を使って blank pivot member を filter できます。

`getValue` は `CellResult`（`{ status, value }`）を返し、`value` フィールドにキャッシュ済みの `Value` が入ります。トップレベルの `evalFormula` と workbook の `evaluateFormulaText` は、同じ `status` / `value` を持つ `EvalResult` envelope を返します。

::: tip evaluateFormulaText / evaluateConditionalFormula は読み取り専用
`evaluateFormulaText` と `evaluateConditionalFormula` は、ワークブックを変更せず依存関係グラフにも参加しない読み取り専用評価です。スカラー版で配列やスピルを扱うと左上端へ縮約されるため、全体が必要なら `evaluateFormulaArray` を使います。
:::

## 次に読むもの

- [API 一覧](/ja/api/surfaces) ─ バインディングごとの現状
- [ワークブック操作](/ja/workbook/operations) ─ 共有 Workbook API で何ができるか
