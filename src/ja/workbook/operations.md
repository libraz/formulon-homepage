# ワークブック操作

Workbook API はセルの変更と再計算に加えて、構造編集も扱います。WASM、Native Node、Python は同じ C ABI に沿って広い Workbook API を公開し、CLI は再計算と調査に絞っています。

::: info 用語: 0 始まりの座標
バインディングは `(sheet, row, col)` をすべて 0 から始まる整数で扱います。`Sheet1!A1` は `(0, 0, 0)` です。ロケール依存のアドレス解析を避け、C ABI と一致させるためです。A1 テキストは CLI 引数・数式文字列のように明示的に要求している箇所だけで使います。
:::

## シート

::: code-group

```ts [WASM]
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

```python [Python]
with Workbook.create_default() as wb:
    wb.add_sheet("Inputs")
    wb.rename_sheet(0, "Model")
    wb.move_sheet(1, 0)
    wb.remove_sheet(1)
    print(wb.sheet_count(), wb.sheet_name(0))
```

:::

## セル

種類ごとに値を設定し、再計算のステータスを確認してからキャッシュ済みの結果を読み出します。各例は、そのコードブロック内でワークブックのライフサイクルを完結させています。

::: code-group

```ts [WASM]
import createFormulon, { ValueKind } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
try {
  wb.setNumber(0, 0, 0, 10)
  wb.setBool(0, 0, 1, true)
  wb.setText(0, 0, 2, 'sku-001')
  wb.setFormula(0, 0, 3, '=SUM(A1:A10)')
  wb.setBlank(0, 0, 4)
  const recalcStatus = wb.recalc()
  if (!recalcStatus.ok) throw new Error(recalcStatus.message)
  const result = wb.getValue(0, 0, 3)
  if (!result.status.ok) throw new Error(result.status.message)
  if (result.value.kind === ValueKind.Number) console.log(result.value.number)
} finally {
  wb.delete()
}
```

```ts [Native Node]
import { ValueKind, Workbook } from '@libraz/formulon-native'

const wb = Workbook.createDefault()
try {
  wb.setNumber(0, 0, 0, 10)
  wb.setBool(0, 0, 1, true)
  wb.setText(0, 0, 2, 'sku-001')
  wb.setFormula(0, 0, 3, '=SUM(A1:A10)')
  wb.setBlank(0, 0, 4)
  const recalcStatus = wb.recalc()
  if (!recalcStatus.ok) throw new Error(recalcStatus.message)
  const result = wb.getValue(0, 0, 3)
  if (!result.status.ok) throw new Error(result.status.message)
  if (result.value.kind === ValueKind.Number) console.log(result.value.number)
} finally {
  wb.dispose()
}
```

```python [Python]
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_number(0, 0, 0, 10)
    wb.set_bool(0, 0, 1, True)
    wb.set_text(0, 0, 2, "sku-001")
    wb.set_formula(0, 0, 3, "=SUM(A1:A10)")
    wb.set_blank(0, 0, 4)
    wb.recalc()
    print(wb.get_value(0, 0, 3).to_python())
```

:::

::: warning 数式を設定しても、その場では計算されない
`setFormula()` はモデルを書き換えるだけです。結果は `recalc()`（または `partialRecalc()`）を呼ぶまで `Blank` のままになります。編集後に値を読むホストは必ず再計算を実行してください。
:::

## 範囲を調べる

`getFormula(sheet, row, col)` は保持されている A1 形式の文字列をそのまま返します。保持文字列に先頭の `=` がある場合だけ、それも含まれます。`getFormulaR1C1()` は保持された数式を解析し、セルを基準に先頭の `=` なしの R1C1 形式へ整形します。両 JavaScript バインディングの戻り値は `{ status, formula }` で、数式がない場合は `formula: null` です。Python は `get_formula()` / `get_formula_r1c1()` を使い、文字列か `None` を返します。

公開されている数式設定メソッドは、空でない不正な数式をワークブックへ変更を加える前に拒否します。セル数式、定義名、条件付き書式の数式、入力規則の数式では、C と JavaScript のステータス結果が `kParserUnexpectedToken`（1000）を返し、Python はホスト側のエラーを送出します。入力ファイルにすでに保存されていた不正な数式はラウンドトリップのため文字列を保持し、評価すると `#NAME?` になり、`getFormulaR1C1()` は `kParserUnexpectedToken` を返します。数式設定メソッドがこの状態を作ることはありません。

`getCellsInRange(sheet, range, cursor, limit)` は `{ status, cells, nextCursor }` を行順で返します。各セルには `row`、`col`、`formula`、現在のキャッシュ値 `value` があります。範囲は `firstRow`、`firstCol`、`lastRow`、`lastCol` で指定し、両端を含みます。最初はカーソルを省略し、以後は `nextCursor` を渡して、`null` になったら終了します。`limit` を省略するか `0` にすると、最大 65,536 件を取得します。数式、空白以外の値、スピル先のセルが対象で、書式だけの空白セルは含みません。最新の数式値が必要なら、列挙の前に再計算してください。

Python の `get_cells_in_range(sheet, cell_range, cursor=None, limit=None)` は `MergeRange` を受け取り、`(cells, next_cursor)` を返します。終了時のカーソルは `None` です。カーソルはページ番号ではなく、続きから読み出すための値として扱ってください。JavaScript のカーソルは非負の安全な整数である必要があります。`getMergesInRange()` / `get_merges_in_range()` は指定矩形と交差する結合範囲を列挙します。

`getExternalLinks()` / `get_external_links()` は外部リンクレコードをファイル内の順序で列挙します。C 層では `fm_workbook_external_link_count` と `fm_workbook_external_link_at` を使います。セル、定義名、条件付き書式、入力規則の数式に未登録のブックを角括弧形式またはパス形式で書くと、既存リンクの番号を変えずにレコードを追加します。大文字・小文字だけが異なる既存ブックは同じレコードを再利用します。

`cellCount(sheet)` と `cellAt(sheet, idx)` は、値・数式・書式の設定や `setBlank` で書き込んだ座標と、スピル先のセルを列挙します。セルをクリアしても格納済みの座標は残り、未書き込みの隙間は数えません。インデックスは `[0, cellCount)` の連続した整数で、`(row, col)` の昇順です。Python の `iter_cells()` と C の `fm_workbook_cell_count` / `fm_workbook_cell_at` も同じ仕様です。列挙中はシートを変更しないでください。

## 構造編集

行・列の挿入 / 削除は影響を受ける数式を自動で書き換えます。

::: code-group

```ts [WASM / Native Node]
wb.insertRows(/*sheet*/ 0, /*startRow*/ 5, /*count*/ 2)
wb.deleteCols(/*sheet*/ 0, /*startCol*/ 3, /*count*/ 1)
```

```python [Python]
wb.insert_rows(0, 5, 2)  # sheet, start row, count
wb.delete_cols(0, 3, 1)  # sheet, start column, count
```

:::

挿入 / 削除範囲とともに移動する参照は、`$` で固定した参照を含めてシフトされます。これは数式をコピーするときの相対参照の動きとは異なる、構造編集による書き換えです。残る範囲は必要に応じて縮小・拡張されます。削除された領域に入ってしまった参照はシフト先がないため、繰り上がってきた別のセルを指すのではなく `#REF!` になります。挿入した行や列にはセルを格納しないので、`cellCount` は増えません。

下のパネルでは、これらの呼び出しを実際のシートに対して実行できます。セルを選ぶと対象の行 / 列がそれに追随し、数式の一覧は操作の前後にワークブックから読み直しています。書き換えられた数式も、壊れた数式も、エンジンが保持しているテキストそのものです。

<StructureDemo />

構造編集では、エンジンがモデル化している構造に加えて、可逆保存のためにそのまま保持している範囲も移動します。対象は `x14` の条件付き書式と入力規則、スパークライングループ、保護範囲、シナリオ、並べ替えの状態、ウォッチ式、エラー無視の範囲、Web 公開範囲です。移動しないものは 2 つあります。埋め込み OLE オブジェクトとフォームコントロールの起点は編集前のセルのまま残り、そのことは報告されません。また、行や列を挿入しても、Excel のように隣の行・列の書式は新しい行・列にコピーされません。

## 名前・結合・ハイパーリンク・アウトライン

::: code-group

```ts [WASM / Native Node]
const check = (s: { ok: boolean; message: string }) => {
  if (!s.ok) throw new Error(s.message)
}
for (const [row, v] of [10, 20, 30].entries()) check(wb.setNumber(0, row, 0, v))
check(wb.setDefinedName('Sales', 'Sheet1!$A$1:$A$3')) // workbook scope
check(wb.setDefinedNameScoped('Rate', '0.1', 0))       // local to sheet 0
check(wb.setFormula(0, 0, 1, '=SUM(Sales)*(1+Rate)'))
check(wb.addMerge(0, { firstRow: 4, firstCol: 0, lastRow: 4, lastCol: 2 }))
check(wb.addHyperlink(0, 5, 0, 'https://formulon.libraz.net', 'Docs', '', ''))
check(wb.addHyperlink(0, 6, 0, '', 'Back to top', '', 'Sheet1!A1'))
check(wb.setRowHidden(0, 2, true))
check(wb.setColumnOutline(0, 3, 5, 1))
check(wb.recalc())
console.log(wb.getValue(0, 0, 1).value.number) // 66
```

```python [Python]
from formulon import MergeRange

for row, value in enumerate((10, 20, 30)):
    wb.set_number(0, row, 0, value)
wb.set_defined_name("Sales", "Sheet1!$A$1:$A$3")  # workbook scope
wb.set_defined_name_scoped("Rate", "0.1", 0)       # local to sheet 0
wb.set_formula(0, 0, 1, "=SUM(Sales)*(1+Rate)")
wb.add_merge(0, MergeRange(4, 0, 4, 2))
wb.add_hyperlink(0, 5, 0, "https://formulon.libraz.net", display="Docs")
wb.add_hyperlink(0, 6, 0, "", display="Back to top", location="Sheet1!A1")
wb.set_row_hidden(0, 2, True)
wb.set_column_outline(0, 3, 5, 1)
wb.recalc()
print(wb.get_value(0, 0, 1).to_python())  # 66.0
```

:::

- `setDefinedNameScoped()` の第 3 引数は、ワークブック全体なら `-1`、シートローカルなら 0 始まりのシート番号です。数式に空文字列を渡すと名前を削除します。`definedNameCount()` / `definedNameAt(i)` は名前を `localSheetId` 付きで列挙します。Python では `iter_defined_names()` を使います。
- `getMerges()` はシート上の結合をすべて返します。`removeMerge(range)` は範囲と重なる結合をすべて削除し、`removeMergeAt(i)` は番号で 1 つ、`clearMerges()` はすべてを削除します。
- ハイパーリンクは、外部リンクなら `target` に URL を渡し、ブック内のリンクなら `target` を空にして `location` に A1 形式の移動先を渡します。`getHyperlinks()` で読み出し、`removeHyperlink(sheet, row, col)`、`removeHyperlinkAt()`、`clearHyperlinks()` で削除します。
- `setRowHidden()` / `setColumnHidden()` と `setRowOutline()` / `setColumnOutline()`（レベルは 0〜255 に丸めます）が変えるのはレイアウトだけです。通常の数式は上の `SUM` のように非表示行も読みます。非表示行を除くのは `SUBTOTAL` の 101〜111 です。
- `getSheetProtection()` / `setSheetProtection()` は `<sheetProtection>` のフラグをまとめて読み書きします。`enabled: 0` を設定すると、保存時に保護を外します。エンジンはフラグを保持するだけで、ロックは強制しません。

Python では各メソッドの snake_case 名を使います。

## レイアウト・書式・メタデータ

`Workbook.createDefault()`（および `fm_workbook_create`）は、Excel の最小スタイル表から始まります。フォント、罫線、セルスタイルのインデックス `0` と、塗りつぶしのインデックス `0`（`none`）、`1`（`gray125`）が最初から存在します。そのため、重複しない最初の `addFont()` / `addBorder()` は `1`、新しい最初の `addFill()` は `2` を返します。CJK ロケールの `createForProfile()` ではインデックス `1` にふりがなフォントがすでに存在する場合があるため、スタイル表が空だと仮定せず、返り値のインデックスを使ってください。

`setDefaultFont()` はフォントスロット `0` を置き換えます。`setFont()` は既存の任意のフォントスロットをその場で置き換えます。`FontRecord.scheme` はテーマフォントへのリンクを読み込みと保存で保持します。セルの実効書式には行や列の設定も使われますが、セルに明示したスタイル `0` はそれらに優先し、書式未設定とは区別されます。

`setColumnStyle()` / `set_column_style()` と `setRowStyle()` / `set_row_style()` は、両端を含む列または行の範囲にスタイル XF を設定します。`clear` 版はそのスタイル設定だけを削除し、範囲の幅または高さ、非表示、アウトラインの属性を保持します。後から書き込む未設定セルは列または行のスタイルを受け取り、両方が範囲を覆う場合は行のスタイルが優先されます。

`setCellXfIndex(..., 0)` は明示的な標準スタイルであり、行や列のスタイルに優先します。`clearCellXfIndex()` / `clear_cell_xf_index()` はセルの直接指定を削除し、空白セルが再び行または列のスタイルを継承できるようにします。値、数式、コメントは保持され、存在しないセルは作成されません。空白でないセルは既定 XF の所有を維持します。`getEffectiveStyle().source` / `get_effective_style().source` で、継承したスタイルとセルの直接指定を区別できます。

WASM と Native Node の `setCellStyle(record)` は `name`、`xfId`、`builtinId`、`iLevel`、`hidden`、`customBuiltin` を受け取ります。Python は snake_case のフィールドを持つ `CellStyle` を `set_cell_style()` に渡します。XF はセル XF ではなく、名前付きスタイルの基底を指定します。`removeCellStyle(name)` / `remove_cell_style(name)` で名前付きスタイルを削除できます。テーマ、解決済みの色、実効書式、表示文字列は [表示とレイアウト](/ja/workbook/presentation) を参照してください。

ふりがなは `getCellPhoneticRuns()` / `setCellPhoneticRuns()` で UTF-16 のテキスト範囲として順序付きで取得・設定できます。`getCellPhoneticProperties()` / `setCellPhoneticProperties()` は、ルビのフォント、かなの形式、配置を読みと表示内容から独立して扱います。セルの値を書き換えると、読みとプロパティの両方が消えます。

### テーブルと AutoFilter

WASM と Python はワークシートテーブルを作成できます。WASM は `createTable()` / `updateTable()` / `removeTable()`、Python は `table_create()` / `table_update()` / `table_remove()` を使います。テーブルの `columns` は `ref` の列幅と一致させ、`headerRow` を有効にする場合も呼び出し側が見出しセルを書き込みます。部分更新では省略したメタデータが保持され、既存テーブルの AutoFilter は `ref` だけを書き換えて追従します。Native Node はテーブルの列挙には対応しますが、テーブルの作成・更新・削除は公開していません。

ワークシート単位の AutoFilter XML は、完全な `<autoFilter>` 要素を不透明な値として扱えます。WASM は `getSheetAutoFilterXml()` / `setSheetAutoFilterXml()`、Python は `get_auto_filter_xml()` / `set_auto_filter_xml()` を公開します。フィルター条件、並べ替え状態、拡張ペイロードはそのまま保持されます。空の値を渡すと AutoFilter を削除し、空でない値は完全な `<autoFilter>` 要素である必要があります。

WASM・Native Node・Python は、シートとテーブルの型付き AutoFilter も公開します。条件を設定するだけでは行の表示状態は変わりません。評価して結果を確認するか、適用して行を表示・非表示にします。設定・適用・条件の解除・フィルターの削除の違いは [フィルターと入力規則](/ja/workbook/filters-validation) を参照してください。

行・列の挿入 / 削除では、シートとテーブルの AutoFilter 範囲も対象データと一緒に移動します。編集で範囲全体がなくなった場合はフィルターを削除します。範囲内で列を挿入・削除すると、フィルター条件の列位置も移動します。

シートの表示状態は 3 状態です。WASM / Native Node は `SheetVisibility.Visible`、`Hidden`、`VeryHidden` と `setSheetVisibility(sheet, visibility)`、Python は `set_sheet_visibility(sheet, visibility)` を使います。`getSheetView()` / `get_sheet_view()` は、従来の 2 状態 `tabHidden` とともに正規の `visibility` を返します。すでに `VeryHidden` のシートに `setSheetTabHidden(true)` を呼んでも `Hidden` へ降格しません。3 状態の設定メソッドで明示してください。

### ワークシートの印刷設定を作成する {#author-worksheet-print-settings}

WASM と Native Node は、ページ設定、余白、印刷オプション、ヘッダー / フッター、印刷範囲、印刷タイトル、手動の行 / 列改ページを型付きの設定メソッド（`setSheetPageSetup()`、`setSheetPageMargins()`、`setSheetPrintOptions()`、`setSheetHeaderFooter()`、`setSheetPrintArea()`、`setSheetPrintTitles()`、`addSheetRowBreak()`、`addSheetColBreak()`）で設定できます。Python は対応する `set_page_setup()`、`set_page_margins()`、`set_print_options()`、`set_header_footer()`、`set_print_area()`、`set_print_titles()`、`add_row_break()`、`add_col_break()` を公開します。モデル化していない項目には生の XML を設定するメソッドも使えますが、不正な断片は拒否します。ヘッダー / フッターのセクション文字列は Excel のデコード済み構文を受け取り、文字どおりのアンパサンドは `&&` と書きます。

`setRangeXfIndex()`（WASM / Native Node）と `set_range_xf_index()`（Python）は、セルスタイルの XF インデックスを両端を含む矩形へ 1 回で適用します。存在しないセルは書式付きの空白セルとして作成されるため、空の帳票領域にも罫線を設定できます。

### 属性だけを変更する範囲スタイル

`rangeStyleBases()` / `range_style_bases()` は、選択範囲のいずれかのセルが実際に解決するセル XF を昇順で返します。独自の XF を持つセルはその XF、それ以外のセルは行・列のスタイルまたは既定（`0`）のスタイルに解決します。選択範囲がすべて書式付きセルで覆われていれば `0` は含まれず、全域で行スタイルに隠れる列スタイルも含まれません。属性だけを変更する場合は、まずこの一覧を読み、`addFont()` / `addXf()`（Python は `add_font()` / `add_cell_xf()`）で変更後の XF を作り、対応する組を `remapRangeStyle()` / `remap_range_style()` に渡します。取り消しが必要な操作では先に `snapshotRangeStyle()` / `snapshot_range_style()` を取得し、そのバイト列を `restoreRangeStyle()` / `restore_range_style()` に渡して書式状態を戻します。

再マッピングは対象となる行・列のスタイルと既存セルの XF を書き換えますが、値と数式は変更しません。通常の有限範囲ではすべてのセルが実体化され、行・列またはワークシート全体の選択では、行が列より優先される関係が変わるセルだけが実体化され、対象軸の空白セルは列挙されません。対応する配列の長さが違う場合、元の XF が重複する場合、変換先がセル XF 表の範囲外の場合、書き込みセル数が `1,048,576` を超える場合は、状態を変更せず失敗します。

### 入力規則の既定値

`addValidation()` / `add_validation()` で `allowBlank` を省略すると、WASM と Native Node は Python と同じく `false` を使います。空セルを許可する場合は `allowBlank: true`（Python は `allow_blank=True`）を明示してください。`showDropDown`（Python は `show_dropdown`）だけは OOXML の意味が反転する真偽値オプションで、ホスト向けの値は正規化されています。

入力候補は `validateValue()` / `validate_value()` で保存せずに検証し、既存セルの違反は `listInvalidCells()` / `list_invalid_cells()` で調べられます。編集を受け入れるかはホストが判断します。値を設定するメソッドは入力規則を強制しません。詳しくは [フィルターと入力規則](/ja/workbook/filters-validation) を参照してください。

### 条件付き書式

`addConditionalFormat()` / `add_conditional_format()` でルールを追加し、`evaluateCfRange()` / `evaluate_cf_range()` で一致するセルを調べます。ルールの種類、差分書式、データバー、カラースケール、アイコンセット、`todaySerial` 引数については [条件付き書式](/ja/workbook/conditional-formats) を参照してください。

### ハイパーリンクの範囲

`addHyperlinkRange()`（WASM / Native Node）と `add_hyperlink_range()`（Python）は、`(row, col)` から `(lastRow, lastCol)` / `(last_row, last_col)` までの両端を含む矩形に 1 つのハイパーリンクを追加します。読み出したハイパーリンクにも矩形の終点が含まれ、OOXML と XLSB のどちらでも範囲全体を保持します。

### ピボットキャッシュのワークシート参照

API で新しく作成したピボットテーブルは、保存前にキャッシュのワークシートソースを設定する必要があります。WASM / Native Node では `pivotCacheSetWorksheetSource(cacheId, { present: true, ref: 'A1:C10', sheet: 'Data' })`、Python では `set_pivot_cache_worksheet_source(cache_id, PivotWorksheetSource(ref='A1:C10', sheet='Data'))` を使います。シートが空でも宣言した範囲があれば十分です。ワークシートソースのない新規キャッシュを保存すると失敗します。ファイルから読み込んだキャッシュには対応するソース情報が残りますが、元がワークシート以外や外部ソースの場合もあります。

### ページ分割

`paginate(sheet)` は、印刷範囲、自動改ページと手動改ページ、物理ページ数を求めます。

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

結果の座標は 0 始まりで、印刷範囲は両端を含みます。結果には用紙、余白、印刷可能領域、倍率、ページ順、印刷タイトル、ページごとのレイアウト、手動改ページのフラグも含まれます。単位と配置の挙動は [表示とレイアウト](/ja/workbook/presentation) を参照してください。

## アドホック数式評価 {#ad-hoc-formula-evaluation}

アドホック評価は、数式をどこにも書き込まずに「このセルでこの数式は何を返すか」を求めます。

::: code-group

```ts [WASM / Native Node]
const result = wb.evaluateFormulaText(/*sheet*/ 0, /*row*/ 0, /*col*/ 0, '=A1+B1')
if (result.status.ok && result.value.kind === ValueKind.Number) {
  console.log(result.value.number)
}
const array = wb.evaluateFormulaArray(0, 0, 0, '=SEQUENCE(2)')
if (array.status.ok) console.log(array.rows, array.cols, array.cells)
```

```python [Python]
rows = wb.evaluate_formula_array(0, 0, 0, "=SEQUENCE(2)")  # list of rows of Value
print([[v.to_python() for v in row] for row in rows])
```

:::

この呼び出しはワークブックを変更せず、依存関係グラフにも登録されません。そのため、評価した数式が後の編集で再計算待ちになることもありません。`evaluateFormulaText()` は配列の結果を左上の要素に縮約します。`=SEQUENCE(3)` は 3 行のスピルではなく `1` を返します。配列全体が必要なら `evaluateFormulaArray()` / `evaluate_formula_array()` を使います。同じ数式を実際のセルに書き込めば通常どおりスピルします。詳しくは [動的配列](/ja/workbook/dynamic-arrays) を参照してください。

Python には、ワークブックの文脈でスカラーを返す評価メソッドがありません。`evaluate_formula_array()` の左上の要素を使うか、新しい 1 シートのワークブックに対して評価するモジュール関数 `formulon.eval_formula()` を使います。

`evaluateConditionalFormula()`（WASM と Native Node）と `evaluate_cf_formula()`（Python）は、条件付き書式の判定式を同じく読み取り専用で評価します。さらにルールの起点から相対参照をずらし、Excel の判定規則（エラー、空白、文字列、数値ゼロは `false`、それ以外の数値は `true`）を適用するので、そのセルで実際のルールを評価した結果と一致します。

通常の編集経路とアドホック経路は異なる問いに答えます。前者はあとで読み返せる値を確定させ、後者は使い捨ての「もし」問い合わせです。

<DiagramFlow :steps="[
  { label: 'setFormula()' },
  { label: 'recalc()' },
  { label: 'getValue()', note: 'モデルを変更せず、キャッシュ済みの結果を読む' }
]" label="通常の編集経路: setFormula、recalc、getValue" />

<DiagramFlow :steps="[
  { label: 'evaluateFormulaText()', note: '変更なし・依存関係グラフへの登録なし' },
  { label: 'スカラー結果', note: '配列の結果は左上の要素に縮約される' }
]" label="アドホック経路: evaluateFormulaText、読み取り専用、スカラーのみ" />

::: tip 実装済み関数を実行時に確認する
WASM / Native Node の `wb.functionNames()` や MCP の `formulon_function_lookup` は、実行時に登録されている関数を列挙できます。静的なドキュメントを読むより、対象 Excel バージョンに合わせて毎回確認するほうが確実です。関数選択 UI を作る場合は、`mergeFunctionMetadata()`（両方の npm パッケージが公開）/ `merge_function_metadata()`（Python）で、ホストが用意したローカライズ済みの説明をエンジンのメタデータに重ねられます。優先順位は、ロケール別の上書き、エントリの既定値、エンジンの値の順です。
:::

## 次に読むもの

- [再計算](/ja/workbook/recalculation) ─ 編集がいつ値に反映されるか
- [コメントと画像](/ja/workbook/comments-images) ─ スレッドコメント、ユーザー、描画オブジェクト、画像のアンカー
- [API 一覧](/ja/api/surfaces) ─ 各バインディングが公開する範囲の比較
- [互換性 / エラー](/ja/compatibility/errors) ─ 不正入力時の挙動
