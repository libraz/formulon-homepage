# Native Node 連携

`packages/npm-native` の Native Node パッケージは、Node.js の [N-API](https://nodejs.org/api/n-api.html) アドオンです。WASM パッケージと共有する計算・ワークブックメソッドを、ネイティブバイナリとして公開します。バインディングのメソッド構成は同一ではなく、テーブル作成、AutoFilter XML、`addCellStyleXf` は WASM にのみあります。`setCellStyle` は Native Node でも使えます。WASM ヒープへのコピーコストや、ブラウザ専用のオリジン間分離要件は不要です。

::: info 用語: N-API
Node がネイティブアドオン向けに提供する C ABI。N-API レベルが同じなら同じ事前ビルド済み `.node` を複数の Node マイナー版で使い回せます。
:::

選ぶ条件:

- 配置先に合う `.node` バイナリをデプロイできる
- 大規模ワークブックで WASM ヒープコピーを避けたい
- ブラウザの隔離制約を意識せずにネイティブのスケジューラを使いたい

::: info 実行入口の一致度
Native Node と WASM は共通する Workbook メソッドと 4 個の静的ファクトリ（`createDefault`、`createForProfile`、`createEmpty`、`loadBytes`）を公開します。次の 6 メソッドは WASM にのみあります。`createTable`、`updateTable`、`removeTable`、`getSheetAutoFilterXml`、`setSheetAutoFilterXml`、`addCellStyleXf` です。Native Node には `dispose()` による明示的な解放と、ネイティブの使用メモリ量の推定値を返す `memoryUsage()` があります。推定値はセル、共有文字列、そのまま保持するパート、ワークブックのメタデータを含み、V8 の外部メモリ報告を更新します。解放後の `memoryUsage()` は `0` を返します。GC は最後の手段です。WASM は WASM ヒープ上のネイティブハンドルを `delete()` で解放します。
:::

## 提供状況

Native Node アドオンはソースツリーの `packages/npm-native` にありますが、現時点では公開 npm レジストリには公開されていません。Formulon のチェックアウトからビルドするか、自分の配布環境へ配置して使います。

ソースを取得したディレクトリで、次を実行します。

```sh
make NODE_NATIVE_BUILD_DIR=build-node-native node-test
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
| 作成 | `Workbook.createDefault()`, `createForProfile(profileId)`, `createEmpty()`, `loadBytes(bytes)` |
| セル変更 | `setNumber`, `setBool`, `setText`, `setBlank`, `setFormula` |
| 再計算と読み取り | `getValue`, `recalc`, `recalcParallel`, `partialRecalc`, `setIterative`, `getIterative`, `evaluateFormulaText`, `evaluateConditionalFormula`, `evaluateFormulaArray`, `paginate`, `save`, `saveAs`, `saveWithDiagnostics`, `readDiagnostics`, `spillInfo`, `precedents`, `dependents` |
| シートと構造 | `addSheet`, `removeSheet`, `renameSheet`, `moveSheet`, 行 / 列の挿入削除、定義名、テーブルの列挙（`tableCount`, `tableAt`）、そのまま保持するパート |
| ワークブックデータ | 行 / 列スタイルの上書き、`setCellStyle` を含むスタイル、`clearCellXfIndex`、範囲スタイルの置換とスナップショット、ジオメトリとテーマ / 実効スタイル、シート / テーブルの型付き AutoFilter、入力規則の検査、ふりがなと表示設定、セル結合、コメント、`getComments`、画像と描画オブジェクト、ハイパーリンク、入力規則、条件付き書式、シート表示 / レイアウト / 保護、3 状態の表示状態、型付き印刷設定、範囲 XF 設定 |
| ピボットテーブル | ピボットキャッシュ / ピボットテーブルの作成、キャッシュインデックスによる項目フィルター、変更、レイアウトの反映 |
| WASM のみ | `createTable`, `updateTable`, `removeTable`, `getSheetAutoFilterXml`, `setSheetAutoFilterXml`, `addCellStyleXf` |
| 計算ポリシー / カタログ | 計算モード、Excel プロファイル ID、ロケール情報、関数メタデータ、ローカライズされた名前と数式、外部リンク |
| トップレベル | `evalFormula`, `version`, `lastErrorMessage`, `lastErrorContext`, `statusString`, `mergeFunctionMetadata` |

正確なメソッド一覧はパッケージの TypeScript 宣言ファイルを確認してください。Native Node は、配置先にプラットフォーム別バイナリを置ける Node サービス向けです。ブラウザ、AutoFilter XML の操作、テーブルの作成、`addCellStyleXf`、またはネイティブアドオンなしの Node 配置には WASM を使います。型付き AutoFilter、ジオメトリとテーマ、入力規則の検査、コメント、画像 / 描画オブジェクトは両方の JavaScript バインディングで使えます。詳しくは [表示とレイアウト](/ja/workbook/presentation)、[フィルターと入力規則](/ja/workbook/filters-validation)、[コメントと画像](/ja/workbook/comments-images) を参照してください。

Native Node は WASM と同じく、反復設定の読み戻し、3 状態のシート表示、印刷設定の作成、`setRangeXfIndex()`、`setColumnStyle()`、`setRowStyle()`、`clearCellXfIndex()`、`rangeStyleBases()`、`remapRangeStyle()`、`snapshotRangeStyle()`、`restoreRangeStyle()`、`setThemeScriptFont()`、`pivotFieldAddItemAt()` を公開します。`getIterative()` の `maxIterations` は共通の `32767` 上限適用後の値です。`SheetVisibility.VeryHidden` は `Hidden` と別状態であり、`pivotFieldAddItemAt()` はキャッシュの共有項目インデックスを使って空白のピボット項目をフィルターできます。`setThemeScriptFont()` はスクリプトを変更または追加し、読み取り時に `Jpan` の項目が対応する東アジア書体として使われるのは、そのフォントセットの `<a:ea typeface>` が空の場合だけです。`<a:ea typeface>` に明示値があれば、そちらが優先されます。

`createDefault()` は Calibri 11 を含む通常の 1 シート既定値を使います。`createForProfile(profileId)` は選択したプロファイルを記録し、本文用フォントと必要なロケールのふりがな用フォント、ローカライズされた `Normal` スタイルと最初のシート名、セル XF の配置、ふりがな設定、ページ余白、Mac の行の高さと基本列幅を設定します。テーマパートは書き出さないため、新しいワークブックは既定の Office テーマとして読み取られます。Windows の行と列の寸法はエンジンの既定値を使います。

`localizeFunctionName()`、`canonicalizeFunctionName()`、`localizeFormula()`、`canonicalizeFormula()`、`localeFacts()` は完全な Excel プロファイル ID を受け取ります。数式テキストは不変の保存形式を保ち、ヘルパーが選択プロファイルの表示形式を生成または受け取ります。`functionMetadata()` はロケールに依存せず構造フィールドだけを持つため、画面向けのカタログはホスト側で別途マージしてください。既定値は `win-365-en_US` で、28 個のプロファイルを受け付けます。ロケール情報は Mac プロファイルと `win-365-ja_JP` で実測値ですが、`localeFacts().facts.collationMeasured` が true になるのは Mac プロファイルだけです。

`compareText(a, b, strength, profileId)` はテキスト順序の符号を `order` に返し、`CollationStrength` は通常の比較、動的配列の検索、従来の完全一致検索の折りたたみ方を選びます。`collationClasses(values, strength, profileId)` は SORT の順序（数値、テキスト、真偽値、エラー、空白）で密なクラス ID を返します。同じ ID になるのは値の種類も一致する場合だけで、テキストは選択した強度、`-0` と `0` は同じ数値、空白は 1 クラスです。ID は 1 回の呼び出しの中だけで意味を持つため、保存済みの値と現在の値を同じ呼び出しで分類して選択を照合してください。スタイルの選択規則と標準的な操作手順は [ワークブック操作](/ja/workbook/operations) を参照してください。

`setColumnStyle()` / `clearColumnStyle()` と `setRowStyle()` / `clearRowStyle()` は、幅、高さ、表示状態などの軸の属性を保持します。`clearCellXfIndex()` は空白セルの直接指定を外し、行・列の書式を継承させます。`setCellXfIndex(..., 0)` は Normal の XF を明示的に指定するため、解除とは異なります。`rangeStyleBases()`、`remapRangeStyle()`、`snapshotRangeStyle()`、`restoreRangeStyle()` は、値と数式を保持したまま属性だけの書式変更と取り消しを扱います。`getTheme()` の `majorScripts` と `minorScripts` で、スクリプト別の書体を読み取れます。

`getValue` は `CellResult`（`{ status, value }`）を返し、`value` フィールドにキャッシュ済みの `Value` が入ります。トップレベルの `evalFormula` とワークブックの `evaluateFormulaText` は、同じ `status` / `value` を持つ `EvalResult` の戻り値を返します。

::: tip evaluateFormulaText / evaluateConditionalFormula は読み取り専用
`evaluateFormulaText` と `evaluateConditionalFormula` は、ワークブックを変更せず依存関係グラフにも参加しない読み取り専用評価です。スカラー版は配列やスピルの左上の要素だけを返すため、全体が必要なら `evaluateFormulaArray` を使います。

`setFormula()` は不正なテキストを `kParserUnexpectedToken` として拒否し、セルを変更しません。XLSX / XLSB に保存済みの不正な数式は読み込みでき、再計算すると `#NAME?` になります。アドホックな `evalFormula()` は不正なテキストを `#NAME?` の値として返します。
:::

::: tip メモリ使用量
`memoryUsage()` は割り当て台帳ではなく推定値です。セルを大量に書き換えた後に呼ぶと、V8 に渡す外部メモリの手掛かりが更新され、大きなネイティブワークブックを実行環境のメモリ管理に反映できます。
:::

## 次に読むもの

- [API 一覧](/ja/api/surfaces) ─ バインディングごとの現状
- [ワークブック操作](/ja/workbook/operations) ─ 共有 Workbook API で何ができるか
