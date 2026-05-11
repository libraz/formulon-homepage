# Native Node 連携

`@libraz/formulon-native` は Node.js の [N-API](https://nodejs.org/api/n-api.html) addon です。WASM パッケージと近い surface を、ネイティブバイナリとして公開します。WASM heap コピーのコストや、ブラウザの cross-origin isolation 要件は不要です。

::: info 用語: N-API
Node がネイティブアドオン向けに提供する C ABI。N-API レベルが同じなら同じ prebuilt `.node` を複数の Node マイナー版で使い回せます。
:::

選ぶ条件:

- platform-specific `.node` バイナリをデプロイできる
- 大規模ワークブックで WASM heap コピーを避けたい
- ブラウザの隔離制約を意識せずに native scheduler を使いたい

::: warning MVP subset
Native Node binding は現在、WASM surface の絞られた subset を公開しています。より広い workbook 管理 API（styles・条件付き書式・layout・ピボット・comments・hyperlinks など）が今すぐ必要なら WASM を使ってください。
:::

## Install

```sh
yarn add @libraz/formulon-native@0.9.0
```

prebuilt は `(os, arch)` 別に公開されており、インストーラが該当 artifact を選択します。

## 使い方

```js
import { Workbook, ValueKind, evalFormula } from '@libraz/formulon-native'

console.log(evalFormula('=SUM(1,2,3)'))

const wb = Workbook.createDefault()
wb.setFormula(0, 0, 0, '=1+2')
wb.recalc()

const result = wb.getValue(0, 0, 0)
if (result.status.ok && result.value.kind === ValueKind.Number) {
  console.log(result.value.number)
}
```

native ハンドルは JS オブジェクトの GC にネイティブメモリを紐付ける設計のため、明示的な `delete()` は不要です。利用パターンは WASM と同じです。

## 現在の subset

| 分類 | Methods |
| --- | --- |
| Factory | `Workbook.createDefault()`, `createEmpty()`, `loadBytes(bytes)` |
| セル変更 | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula` |
| 読み取り | `getValue` |
| Engine | `recalc`, `save` |
| シート | `addSheet`, `removeSheet`, `renameSheet`, `sheetCount`, `sheetName` |
| Names | `setDefinedName` |
| トップレベル | `evalFormula`, `version`, `lastErrorMessage`, `lastErrorContext`, `statusString` |

最も広い JavaScript API が必要なら WASM パッケージを選んでください。Native Node は「Node 側で速度を優先したい」用途に当たります。

## 次に読むもの

- [Surface matrix](/ja/api/surfaces) ─ binding ごとの現状
- [ワークブック操作](/ja/workbook/operations) ─ 広い API で何ができるか
