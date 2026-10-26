# Native Node 連携

`@libraz/formulon-native`（エンジンのリポジトリでは `packages/npm-native`）は、WASM パッケージと同じ Workbook API を持つ Node.js の [N-API](https://nodejs.org/api/n-api.html) アドオンです。ネイティブバイナリとして動くため、WASM ヒープへのコピー、32-bit アドレス空間の上限、オリジン間分離の要件がありません。

::: info 用語: N-API
Node がネイティブアドオン向けに提供する安定した C インターフェースです。ある N-API バージョンでビルドしたアドオンは、そのバージョンに対応する以降の Node でも読み込めます。そのため OS と CPU ごとに `.node` バイナリを 1 つ用意すれば、複数の Node バージョンで使えます。
:::

## ビルドと最初の呼び出し

アドオンは npm に公開していません。ソースを取得してビルドし、配置します（C++17 のツールチェーン、CMake、Node 22 以降が必要です）。

```sh
git clone https://github.com/libraz/formulon.git
cd formulon
git checkout v0.18.0
make NODE_NATIVE_BUILD_DIR=build-node-native node-package
```

`node-package` は `formulon.node` をビルドし、JavaScript の入口とともに `packages/npm-native/dist/` に配置します。`make node-test` は同じ処理の後にアドオンのテストも実行します。配置したファイルを直接インポートするか、自分の配布フローで公開してください。

```js
import { Workbook, ValueKind, evalFormula } from './packages/npm-native/dist/index.mjs'

console.log(evalFormula('=SUM(1,2,3)').value.number) // 6

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

ワークブックが不要になったら `dispose()` を呼びます。呼び忘れたハンドルは JavaScript の GC が最終化しますが、これは予備の仕組みです。

Native Node が向いているのは次の場合です。

- 配置先にプラットフォーム別の `.node` バイナリを置ける
- 大きなワークブックで、WASM ヒープへのコピーや 32-bit アドレス空間が制約になる
- ブラウザの分離要件なしに並列スケジューラを使いたい

ブラウザで動かす場合、ネイティブアドオンを置けない場合、下表の WASM 専用メソッドが必要な場合は WASM を使います。

## API の範囲

Native Node は [WASM API](/ja/api/wasm#main-workbook-methods) に記載した Workbook メソッドと enum を持ち、戻り値の形と値の意味も同じです。ファクトリが返す `Module` の代わりに、`Workbook` とモジュール関数を名前付きでエクスポートします。関数は `evalFormula`、`version`、`versionString`、`errorDisplayName`、`statusString`、`lastErrorMessage`、`lastErrorContext`、`setLogMinLevel`、`setLogSink`、`mergeFunctionMetadata` です。正確な定義は配置された `index.d.ts` を確認してください。

| 違い | WASM | Native Node |
| --- | --- | --- |
| ワークブックの解放 | `delete()` | `dispose()`。GC による最終化は予備 |
| メモリ使用量の推定 | — | `memoryUsage()` |
| テーブルの作成 | `createTable`、`updateTable`、`removeTable` | —（`tableCount` / `tableAt` のみ） |
| シートの AutoFilter XML | `getSheetAutoFilterXml`、`setSheetAutoFilterXml` | —（型付きの AutoFilter メソッドのみ） |
| 名前付きスタイルの XF レコード | `addCellStyleXf` | —（`setCellStyle` は使える） |
| `loadBytes()` の失敗 | `isValid()` が `false` | `isValid()` が `false`。以降の呼び出しは `kBindingInvalidHandle` を返す |

`memoryUsage()` は、セル、共有文字列、そのまま保持するパート、ワークブックのメタデータが使うバイト数の推定値で、割り当ての正確な集計ではありません。呼び出すたびに V8 へ報告する外部メモリ量も更新するため、大きなネイティブワークブックが GC から見えるようになります。`dispose()` 後は `0` を返します。

## 次に読むもの

- [API 一覧](/ja/api/surfaces) ─ バインディングごとの現状
- [ワークブック操作](/ja/workbook/operations) ─ 共有 Workbook API で何ができるか
