# Native Node 連携

`packages/npm-native` の Native Node パッケージは、Node.js の [N-API](https://nodejs.org/api/n-api.html) アドオンです。WASM パッケージと共有する計算・ワークブックメソッドを、ネイティブバイナリとして公開します。バインディングのメソッド構成は同一ではなく、テーブル作成、AutoFilter XML、セルスタイル作成は WASM にのみあります。WASM ヒープへのコピーコストや、ブラウザ専用のオリジン間分離要件は不要です。

::: info 用語: N-API
Node がネイティブアドオン向けに提供する C ABI。N-API レベルが同じなら同じ事前ビルド済み `.node` を複数の Node マイナー版で使い回せます。
:::

選ぶ条件:

- 配置先に合う `.node` バイナリをデプロイできる
- 大規模ワークブックで WASM ヒープコピーを避けたい
- ブラウザの隔離制約を意識せずにネイティブのスケジューラを使いたい

::: info 実行入口の一致度
Native Node と WASM は共通する Workbook メソッドと 3 個の静的ファクトリ（`createDefault`、`createEmpty`、`loadBytes`）を公開します。次の 7 メソッドは WASM にのみあります。`createTable`、`updateTable`、`removeTable`、`getSheetAutoFilterXml`、`setSheetAutoFilterXml`、`addCellStyleXf`、`setCellStyle` です。Native Node には `dispose()` による明示的な解放と、ネイティブの使用メモリ量の推定値を返す `memoryUsage()` があります。推定値はセル、共有文字列、そのまま保持するパート、ワークブックのメタデータを含み、V8 の外部メモリ報告を更新します。解放後の `memoryUsage()` は `0` を返します。GC は最後の手段です。WASM は WASM ヒープ上のネイティブハンドルを `delete()` で解放します。
:::

## 提供状況

Native Node アドオンはソースツリーの `packages/npm-native` にありますが、現時点では公開 npm レジストリには公開されていません。Formulon のチェックアウトからビルドするか、自分の配布環境へ配置して使います。

ソースを取得したディレクトリで、次を実行します。

```sh
make node-native
make node-package
make node-test
```

その後、`packages/npm-native/dist/index.mjs` に配置されたパッケージをインポートするか、社内向けの配布フローに乗せてください。

## 使い方

```js
import { Workbook, ValueKind, evalFormula } from './packages/npm-native/dist/index.mjs'

console.log(evalFormula('=SUM(1,2,3)'))

const wb = Workbook.createDefault()
try {
  const set = wb.setFormula(0, 0, 0, '=1+2')
  if (!set.ok) throw new Error(`${set.message}: ${set.context}`)
  const recalculated = wb.recalc()
  if (!recalculated.ok) throw new Error(`${recalculated.message}: ${recalculated.context}`)

  const result = wb.getValue(0, 0, 0)
  if (!result.status.ok) throw new Error(`${result.status.message}: ${result.status.context}`)
  if (result.value.kind === ValueKind.Number) {
    console.log(result.value.number)
  }
} finally {
  wb.dispose()
}
```

スコープを抜けるときは `dispose()` を呼びます。呼び忘れても JavaScript の GC がハンドルを最終化します。

## 現在公開している API

| 分類 | メソッド |
| --- | --- |
| 作成 | `Workbook.createDefault()`, `createEmpty()`, `loadBytes(bytes)` |
| セル変更 | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula` |
| 再計算と読み取り | `getValue`, `recalc`, `recalcParallel`, `partialRecalc`, `setIterative`, `getIterative`, `evaluateFormulaText`, `evaluateConditionalFormula`, `evaluateFormulaArray`, `paginate`, `save`, `saveAs`, `saveWithDiagnostics`, `readDiagnostics`, `spillInfo`, `precedents`, `dependents` |
| シートと構造 | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, 行 / 列の挿入削除、定義名、テーブルの列挙（`tableCount`, `tableAt`）、そのまま保持するパート |
| ワークブックデータ | セルスタイル作成を除くスタイル、ふりがなと表示設定、セル結合、コメント、`getComments`、ハイパーリンク、入力規則、条件付き書式、シート表示 / レイアウト / 保護、3 状態の表示状態、型付き印刷設定、範囲 XF 設定 |
| ピボットテーブル | ピボットキャッシュ / ピボットテーブルの作成、キャッシュインデックスによる項目フィルター、変更、レイアウトの反映 |
| WASM のみ | `createTable`, `updateTable`, `removeTable`, `getSheetAutoFilterXml`, `setSheetAutoFilterXml`, `addCellStyleXf`, `setCellStyle` |
| 計算ポリシー / カタログ | 計算モード、Excel プロファイル ID、関数メタデータ、ローカライズ名、外部リンク |
| トップレベル | `evalFormula`, `version`, `lastErrorMessage`, `lastErrorContext`, `statusString`, `mergeFunctionMetadata` |

正確なメソッド一覧はパッケージの TypeScript 宣言ファイルを確認してください。Native Node は、配置先にプラットフォーム別バイナリを置ける Node サービス向けです。ブラウザ、AutoFilter XML の操作、テーブルやセルスタイルの作成、またはネイティブアドオンなしの Node 配置には WASM を使います。

Native Node は WASM と同じく、反復設定の読み戻し、3 状態のシート表示、印刷設定の作成、`setRangeXfIndex()`、`pivotFieldAddItemAt()` を公開します。`getIterative()` の `maxIterations` は共通の `32767` 上限適用後の値です。`SheetVisibility.VeryHidden` は `Hidden` と別状態であり、`pivotFieldAddItemAt()` はキャッシュの共有項目インデックスを使って空白のピボット項目をフィルターできます。

`getValue` は `CellResult`（`{ status, value }`）を返し、`value` フィールドにキャッシュ済みの `Value` が入ります。トップレベルの `evalFormula` とワークブックの `evaluateFormulaText` は、同じ `status` / `value` を持つ `EvalResult` の戻り値を返します。

::: tip evaluateFormulaText / evaluateConditionalFormula は読み取り専用
`evaluateFormulaText` と `evaluateConditionalFormula` は、ワークブックを変更せず依存関係グラフにも参加しない読み取り専用評価です。スカラー版は配列やスピルの左上の要素だけを返すため、全体が必要なら `evaluateFormulaArray` を使います。
:::

::: tip メモリ使用量
`memoryUsage()` は割り当て台帳ではなく推定値です。セルを大量に書き換えた後に呼ぶと、V8 に渡す外部メモリの手掛かりが更新され、大きなネイティブワークブックを実行環境のメモリ管理に反映できます。
:::

## 次に読むもの

- [API 一覧](/ja/api/surfaces) ─ バインディングごとの現状
- [ワークブック操作](/ja/workbook/operations) ─ 共有 Workbook API で何ができるか
