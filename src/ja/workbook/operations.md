# ワークブック操作

Workbook API はセルの変更と再計算に加えて、構造編集も扱います。WASM、Native Node、Python は同じ C ABI に沿って広い Workbook API を公開し、CLI は再計算と調査に絞っています。

::: info 用語: 0-based 座標
バインディングは `(sheet, row, col)` をすべて 0 から始まる整数で扱います。`Sheet1!A1` は `(0, 0, 0)` です。ロケール依存のアドレス解析を避け、C ABI と一致させるためです。A1 テキストは CLI 引数・数式文字列のように明示的に要求している箇所だけで使います。
:::

## シート

```ts
const wb = Module.Workbook.createDefault()
try {
  wb.addSheet('Inputs')
  wb.renameSheet(0, 'Model')
  wb.moveSheet(1, 0)
  wb.removeSheet(1)
} finally {
  wb.delete()
}
```

Python でも同じ座標体系でシート操作を扱います。

```python
with Workbook.create_default() as wb:
    wb.add_sheet("Inputs")
    print(wb.sheet_count())
    print(wb.sheet_name(0))
```

## セル

種類ごとに値を設定し、再計算します。

```ts
wb.setNumber(0, 0, 0, 10)
wb.setBool(0, 0, 1, true)
wb.setText(0, 0, 2, 'sku-001')
wb.setFormula(0, 0, 3, '=SUM(A1:A10)')
wb.setBlank(0, 0, 4)
wb.recalc()
```

計算結果は kind 付きの構造体として読み出します。

```ts
const value = wb.getValue(0, 0, 3)
if (value.kind === ValueKind.Number) console.log(value.number)
```

::: warning 数式の set は評価しない
`setFormula()` は model を書き換えるだけです。結果は `recalc()`（または `partialRecalc()`）を呼ぶまで `Blank` のままになります。編集後に値を読むホストは必ず recalc を挟んでください。
:::

## 構造編集

行・列の挿入 / 削除は影響を受ける数式を自動で書き換えます。

```ts
wb.insertRows(/*sheet*/ 0, /*startRow*/ 5, /*count*/ 2)
wb.deleteCols(/*sheet*/ 0, /*startCol*/ 3, /*count*/ 1)
```

挿入 / 削除範囲とともに移動する参照はシフトされ、範囲外にアンカーされた参照はそのまま残ります。

## レイアウト・style・metadata

WASM、Native Node、Python の各バインディングは、次のようなワークブック操作を公開します。表面上の名前付けはホスト言語に合わせていますが、処理は同じ C ABI を通ります。

- row / column の挿入・削除と formula 書き換え
- defined names
- tables
- OOXML parts の passthrough
- pivot table の report layout と pivot-cache worksheet-source access
- 条件付き書式の read / evaluate / write subset、visual payload（`ColorScale`、`DataBar`、`IconSet`）、DXF
- sheet view、freeze panes、hidden tabs
- sheet protection の metadata
- row / column layout の override
- styles、number formats、fonts、fills、borders
- merges、comments、hyperlinks、data validations
- precedent / dependent の tracing
- function metadata、function-name ヘルパ
- 動的配列のスピル情報

条件付き書式ルールの追加（`addConditionalFormat()` / `fm_sheet_cf_add_rule`）も、新しい rule の flattened index を返すようになったため、ホスト側の UI 選択や後続編集がしやすくなりました。

WASM と Native Node は `getComments(sheet)` で comment を列挙できます。Python は `comment_count(sheet)` / `get_comments(sheet)` を使います。どちらも値が空のセルにだけ付いた comment を含みます。JS surface の `getCommentResult(sheet, row, col)` は、comment が無い場合と不正な sheet を区別します。

### ページ分割

すべての座標と出力範囲は 0 始まりで、印刷範囲の両端を含みます。

::: code-group

```ts [WASM]
const result = wb.paginate(0)
console.log(result.pageCount, result.printArea, result.horizontalBreaks, result.verticalBreaks)
```

```ts [Native Node]
const result = wb.paginate(0)
console.log(result.pageCount, result.printArea, result.horizontalBreaks, result.verticalBreaks)
```

```python [Python]
result = wb.paginate(0)
print(result.page_count, result.print_area, result.horizontal_breaks, result.vertical_breaks)
```

```sh [CLI]
formulon paginate --sheet 0 input.xlsx
```

:::

### アドホック数式評価

WASM と Native Node（C API）は、これに加えて読み取り専用のアドホック数式評価を公開しています。`evaluateFormulaText()` は一般的なスカラー数式をセルへ書き込まずに評価し、`evaluateConditionalFormula()` は条件付き書式の述語を評価します。これらの JavaScript 向けメソッドは Python にはなく、Python では条件付き書式の述語に `evaluate_cf_formula()`、配列全体の結果に `evaluate_formula_array()` を使います。

```ts
const result = wb.evaluateFormulaText(/*sheet*/ 0, /*row*/ 0, /*col*/ 0, '=A1+B1')
if (result.status.ok && result.value.kind === ValueKind.Number) {
  console.log(result.value.number)
}
```

これは読み取り専用です。ワークブックを変更せず、どこにも値を書き込まず、依存関係グラフにも参加しません — ここで評価しても、後の編集で dirty になるセルは増えません。配列・スピル結果もトップレフトの要素だけに縮約されます。この方法で `=SEQUENCE(3)` を評価すると 3 行のスピルではなく単一の数値が返ります。実際に `=SEQUENCE(3)` をセルへ書き込めば、通常どおりスピルします。数式を実際にセルへ書き込んだときのスピルの仕組みは [動的配列](/ja/workbook/dynamic-arrays) を参照してください。

`evaluateFormulaArray()`（Native Node・WASM・C API）と `evaluate_formula_array()`（Python）は、`evaluateFormulaText()` のようにトップレフトへ縮約せず、Array 全体を返します。Python は条件付き書式の述語に `evaluate_cf_formula()` も公開しますが、一般的なスカラー `evaluate_formula_text()` は公開していません。ワークブックの文脈でスカラーを評価する場合は、セルに数式を書き込んで再計算してください。

`evaluateConditionalFormula()` も同じ読み取り専用ルールに従いますが、加えてルールのアンカーからの相対参照シフトと、Excel の CF 述語変換(エラー / 空白 / 文字列 / 数値ゼロは `false`、それ以外の数値は `true`)を適用するため、結果はそのセルで実際の条件付き書式ルールが評価したときの値と一致します。

通常の編集経路とアドホック経路は異なる問いに答えます。前者はあとで読み返せる値を確定させ、後者は使い捨ての「もし」問い合わせです。

<DiagramFlow :steps="[
  { label: 'setFormula()' },
  { label: 'recalc()' },
  { label: 'getValue()', note: 'model を変更する。結果は次の編集まで保持される' }
]" label="通常の編集経路: setFormula、recalc、getValue" />

<DiagramFlow :steps="[
  { label: 'evaluateFormulaText()', note: '変更なし・依存関係グラフへの登録なし' },
  { label: 'スカラー結果', note: '配列・スピル結果はトップレフトの要素に縮約される' }
]" label="アドホック経路: evaluateFormulaText、読み取り専用、スカラーのみ" />

CLI はセルを細かく編集する API ではなく、`eval`、`recalc`、`dump`、`paginate` などの調査・変換コマンドに絞っています。アプリケーションに組み込む場合は、WASM、Native Node、Python のいずれかを選んでください。

::: tip 実装済み関数を実行時に確認する
WASM `Module.functionNames()` や MCP の `formulon_function_lookup` は、実行時に登録されている関数を列挙できます。静的なドキュメントを読むより、対象 Excel バージョンに合わせて毎回確認するほうが確実です。
:::

## 次に読むもの

- [再計算](/ja/workbook/recalculation) ─ 編集がいつ値に反映されるか
- [API 一覧](/ja/api/surfaces) ─ 各バインディングが公開する範囲の比較
- [互換性 / エラー](/ja/compatibility/errors) ─ 不正入力時の挙動
