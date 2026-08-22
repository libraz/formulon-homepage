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
const result = wb.getValue(0, 0, 3)
if (!result.status.ok) throw new Error(result.status.message)
if (result.value.kind === ValueKind.Number) console.log(result.value.number)
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

挿入 / 削除範囲とともに移動する参照はシフトされ、範囲外にアンカーされた参照はそのまま残ります。削除された領域に入ってしまった参照はシフト先がないため、繰り上がってきた別のセルを指すのではなく `#REF!` になります。

下のパネルでは、これらの呼び出しを実際のシートに対して実行できます。セルを選ぶと対象の行 / 列がそれに追随し、数式の一覧は操作の前後にワークブックから読み直しています。書き換えられた数式も、壊れた数式も、エンジンが保持しているテキストそのものです。

<StructureDemo />

構造編集では、保持している `extLst`、x14 DataBar 拡張、sparkline、slicer anchor など、未モデル化 payload 内だけにある座標は移動しません。その座標について診断も出ません。こうした機能を含むワークブックは、構造編集後に Excel で確認してください。

## レイアウト・style・metadata

WASM、Native Node、Python の各バインディングは、次のようなワークブック操作を公開します。表面上の名前付けはホスト言語に合わせていますが、処理は同じ C ABI を通ります。

- row / column の挿入・削除と formula 書き換え
- defined names
- tables
- OOXML parts の passthrough
- pivot table の report layout と pivot-cache worksheet-source access
- 条件付き書式の read / evaluate / write subset、visual payload（`ColorScale`、`DataBar`、`IconSet`）、DXF
- sheet view、freeze panes、3 状態の tab visibility
- sheet protection の metadata
- row / column layout の override
- styles、number formats、fonts、fills、borders
- merges、comments、hyperlinks、data validations
- precedent / dependent の tracing
- function metadata、function-name ヘルパ
- 動的配列のスピル情報

条件付き書式ルールの追加（`addConditionalFormat()` / `fm_sheet_cf_add_rule`）も、新しい rule の flattened index を返すようになったため、ホスト側の UI 選択や後続編集がしやすくなりました。

新規ワークブックは Excel が持つ最小の style table から始まります。font、border、cell-style の index `0` と、fill の index `0`（`none`）、`1`（`gray125`）が最初から存在します。そのため、最初の `addFont()` / `addBorder()` は `1`、最初の `addFill()` は `2` を返します。style table が空だと仮定せず、返り値の index を使ってください。

`setDefaultFont()` は、書式未設定セルが使うフォントスロット `0` を置き換えます。`setFont()` は既存の任意のフォントスロットをその場で置き換えます。`FontRecord.scheme` はテーマフォントへのリンクをロードと保存で保持します。

ふりがなは `getCellPhoneticRuns()` / `setCellPhoneticRuns()` で UTF-16 のテキスト範囲として順序付きで取得・設定できます。`getCellPhoneticProperties()` / `setCellPhoneticProperties()` は、ルビのフォント、かなの形式、配置を読みと表示内容から独立して扱います。セルの値を書き換えると、読みとプロパティの両方が消えます。

### Table と AutoFilter

WASM と Python は worksheet table を作成できます。WASM は `createTable()` / `updateTable()` / `removeTable()`、Python は `table_create()` / `table_update()` / `table_remove()` を使います。table の `columns` は `ref` の列幅と一致し、`headerRow` を有効にする場合も呼び出し側が header cell を書き込みます。部分更新では省略した metadata が保持され、既存 table の AutoFilter は `ref` だけを書き換えて追従します。Native Node は table の列挙には対応しますが、table の作成・更新・削除は公開していません。

worksheet 単位の AutoFilter XML は、完全な `<autoFilter>` fragment を opaque な値として扱えます。WASM は `getSheetAutoFilterXml()` / `setSheetAutoFilterXml()`、Python は `get_auto_filter_xml()` / `set_auto_filter_xml()` を公開します。filter 条件、sort 状態、extension payload はそのまま保持されます。空の fragment を渡すと AutoFilter を削除し、空でない値は完全な `<autoFilter>` element である必要があります。

行・列の挿入 / 削除では、AutoFilter の `ref` 矩形も対象データと一緒に移動します。編集で範囲全体が消費された場合は AutoFilter を削除します。`filterColumn` の criteria offset は組み替えないため、filter 範囲内で列を編集すると criteria が以前の列位置に残る場合があります。

sheet visibility は 3 状態です。WASM / Native Node は `SheetVisibility.Visible`、`Hidden`、`VeryHidden` と `setSheetVisibility(sheet, visibility)`、Python は `set_sheet_visibility(sheet, visibility)` を使います。`getSheetView()` / `get_sheet_view()` は、従来の 2 状態 `tabHidden` とともに正規の `visibility` を返します。すでに very-hidden の sheet に `setSheetTabHidden(true)` を呼んでも hidden へ降格しません。3 状態 setter で明示してください。

### worksheet の印刷設定を作成する

WASM と Native Node は、page setup、余白、print options、header / footer、print area、print titles、手動の行 / 列改ページを typed setter（`setSheetPageSetup()`、`setSheetPageMargins()`、`setSheetPrintOptions()`、`setSheetHeaderFooter()`、`setSheetPrintArea()`、`setSheetPrintTitles()`、`addSheetRowBreak()`、`addSheetColBreak()`）で設定できます。Python は対応する `set_page_setup()`、`set_page_margins()`、`set_print_options()`、`set_header_footer()`、`set_print_area()`、`set_print_titles()`、`add_row_break()`、`add_col_break()` を公開します。モデル化していない項目には raw XML setter も使えますが、不正な fragment は拒否します。header / footer の section 文字列は Excel の decoded syntax を受け取り、文字どおりの ampersand は `&&` と書きます。

`setRangeXfIndex()`（WASM / Native Node）と `set_range_xf_index()`（Python）は、cell-style XF index を両端を含む矩形へ 1 回で適用します。存在しないセルは style 付きの blank として materialize されるため、空の帳票領域にも罫線を設定できます。

### data validation の既定値

`addValidation()` / `add_validation()` で `allowBlank` を省略すると、WASM と Native Node は Python と同じく `false` を使います。空セルを許可する場合は `allowBlank: true`（Python は `allow_blank=True`）を明示してください。`showDropDown`（Python は `show_dropdown`）だけは OOXML の意味が反転する boolean オプションで、ホスト向けの値は正規化されています。

### 条件付き書式の visual payload

DataBar は WASM、Native Node、Python で `x14` extension の全 payload を扱えます。項目は `gradient`、`axisPosition`（`0` は automatic、`1` は middle、`2` は none）、`negativeFill`、`border`、`negativeBorder`、`axisColor` です。Python の `DataBar` では対応する snake_case のフィールド名を使います。これらの設定は save と load をまたいで保持されます。省略時は model の既定値（gradient fill、automatic axis、negative value に positive fill、border なし、黒い axis）を使います。

### hyperlink の範囲

`addHyperlinkRange()`（WASM / Native Node）と `add_hyperlink_range()`（Python）は、`(row, col)` から `(lastRow, lastCol)` / `(last_row, last_col)` までの両端を含む矩形に 1 つの hyperlink を追加します。読み出した hyperlink にも矩形の終点が含まれ、OOXML と XLSB のどちらでも範囲全体を保持します。

### pivot cache の worksheet source

API で新しく作成した PivotTable は、保存前に cache の worksheet source を設定する必要があります。WASM / Native Node では `pivotCacheSetWorksheetSource(cacheId, { present: true, ref: 'A1:C10', sheet: 'Data' })`、Python では `set_pivot_cache_worksheet_source(cache_id, PivotWorksheetSource(ref='A1:C10', sheet='Data'))` を使います。シートが空でも宣言した範囲があれば十分です。worksheet source のない新規 cache を保存すると失敗します。ファイルから読み込んだ cache には source があるため影響しません。

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
  { label: 'getValue()', note: 'モデルを変更せず、キャッシュ済みの結果を読む' }
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
