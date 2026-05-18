# ワークブック操作

Workbook API はセルの変更と再計算に加えて、構造編集も扱います。WASM バインディングが最も広い API を公開し、Python は安定した部分集合、CLI は再計算と調査に絞っています。

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

Python は安定した部分集合を公開します。

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

WASM バインディングが現時点で最も広いワークブック API を公開します。

- row / column の挿入・削除と formula 書き換え
- defined names
- tables
- OOXML parts の passthrough
- pivot table の layout 投影
- 条件付き書式の read / evaluate / write subset
- sheet view、freeze panes、hidden tabs
- sheet protection の metadata
- row / column layout の override
- styles、number formats、fonts、fills、borders
- merges、comments、hyperlinks、data validations
- precedent / dependent の tracing
- function metadata、function-name ヘルパ
- 動的配列の spill information

Python バインディングはワークブックの作成 / 読み込み、セル変更、再計算 / 保存、反復計算ヘルパーに意図的に絞った安定 API です。より広いワークブック管理 API が現時点で必要であれば、WASM・Native Node・あるいは C ABI を直接使ってください。

::: tip 実装済み関数を実行時に確認する
WASM `Module.functionNames()` や MCP の `formulon function_lookup` は、実行時に登録されている関数を列挙できます。静的なドキュメントを読むより、対象 Excel バージョンに合わせて毎回確認するほうが確実です。
:::

## 次に読むもの

- [再計算](/ja/workbook/recalculation) ─ 編集がいつ値に反映されるか
- [API 一覧](/ja/api/surfaces) ─ 各バインディングが公開する範囲の比較
- [互換性 / エラー](/ja/compatibility/errors) ─ 不正入力時の挙動
