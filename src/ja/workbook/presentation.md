# 表示、ジオメトリ、ページ分割

Formulon はレンダラーが必要とするワークブックの表示状態を公開します。セルやページを描画する機能はありません。座標は 0 始まりで、物理的な寸法はポイント単位で返します。

セルに保存された値、表示形式、表示用テキストは別の層です。たとえば保存値が `0.25`、表示形式が `0%` の場合、値は数値 `0.25` のままです。`getDisplayText()` はレンダラーが描画する文字列 `25%` を返します。

| 層 | 例 | Formulon の API |
| --- | --- | --- |
| 保存値 | `0.25` | `getValue()` |
| 表示形式 | `0%` | `getEffectiveStyle()` が書式コードを返す |
| 表示用テキスト | `25%` | `getDisplayText()` または `formatValue()` |
| セルの描画 | UI 上の文字列、塗りつぶし、枠線、選択状態 | [formulon-cell](/ja/cell/) のようなホスト側のレンダラー |
| 条件付き書式 | 条件に合うセルの見た目を変えるルール | 条件付き書式 API で評価。基本スタイルとは別に扱う |

ジオメトリの単位は保存値と異なります。保存する列幅は余白を含む文字単位ですが、レンダラーは物理的な配置にポイント単位の寸法を使います。`getColumnWidthPt()` と `getCellRectPt()` はポイントを返します。

## 表示状態

`getDisplayText(sheet, row, col)` は、セルの有効な表示形式を使って保存値を 1 つ表示用テキストに変換します。`displayStatus` は `DisplayStatus.Ok`、`Overflow`、`InvalidFormat` のいずれかで、オーバーフローはレンダラーの契約上 `########` になります。`formatValue(value, formatCode)` はセルを読まず、指定した形式で値を変換します。どちらも状態を含む結果を返します。

`getSheetView(sheet)` は、ズーム、固定する行と列の数、タブの表示状態、枠線、行列見出し、ゼロ表示、右から左への表示、タブ選択、表示モード、スクロール起点（`topLeftRow`、`topLeftCol`）、ペイン起点（`paneTopLeftRow`、`paneTopLeftCol`）、分割位置（`splitX`、`splitY`）、`showFormulas`、`showOutlineSymbols` を読み取ります。各項目には設定メソッドがあります。`setSheetZoom`、`setSheetFreeze`、`setSheetVisibility`、`setSheetShowGridLines`、`setSheetShowRowColHeaders`、`setSheetShowZeros`、`setSheetShowFormulas`、`setSheetShowOutlineSymbols`、`setSheetRightToLeft`、`setSheetTabSelected`、`setSheetViewMode`、`setSheetTopLeft`、`setSheetPaneTopLeft`、`setSheetSplit` です。Python では `set_sheet_zoom`、`set_sheet_split` のように snake_case になります。シート保護（`getSheetProtection` / `setSheetProtection`）はメタデータであり、計算エンジンはロックを強制しません。

`setSheetTopLeft(sheet, row, col)` はスクロール起点を設定します。固定または分割されたビューでは、`setSheetPaneTopLeft` で右下ペインの最初の表示セルを設定します。このセルは固定した行と列より後ろにある必要があり、ペインのないビューでは拒否されます。固定を変更すると、ペイン起点は固定されていない最初のセルに戻ります。

`setSheetSplit(sheet, xTwips, yTwips)` は、ビューを固定せずに、各軸の twips 単位のオフセットで分割します。`0` はその軸を分割せず、`0, 0` は分割を解除します。分割は固定を置き換え、固定は分割を置き換えます。どちらの変更でもペイン起点とアクティブペインはリセットされ、アクティブな選択は保持されます。負の値や有限でない値は `kInvalidArgument` で失敗します。ビューが固定されている間、`splitX` と `splitY` は `0` を返します。

`getSheetSelection(sheet)` はアクティブペインのアクティブセルと選択範囲を返し、`setSheetSelection(sheet, { activeRow, activeCol, ranges })` はそれらを置き換えます。`ranges` を省略するとアクティブセルだけが選択されます。固定または分割されたビューでは、他のペインがそれぞれの選択を保持し、保存時にはペインごとに 1 つの選択を書き出します。ビューにないペインの選択は保存時に破棄され、どの選択範囲にも入らないアクティブセルは先頭の範囲の左上セルに移ります。Python では `get_sheet_selection(sheet)` が `((row, col), ranges)` を返します。

再保存では、モデルとして公開していないビュー属性も保持されます。対象は `windowProtection`、`showRuler`、`showWhiteSpace`、`defaultGridColor`、`colorId`、標準・ページレイアウト・シートレイアウトの 3 種類のズーム倍率、`activeCellId`、ピボットの選択、ビューの拡張リストです。2 つ目以降の `<sheetView>` 要素（追加のブックウィンドウ）は、モデル化したビューの後ろにそのまま書き出されます。

## ジオメトリ

`getCellRectPt(sheet, range, mode)` は、両端を含む `MergeRange` を覆う矩形を、A1 の左上隅を原点としたポイント単位で返します。`getColumnWidthPt` と `getRowHeightPt` は実際に使われる寸法を返し、非表示の行と列の寸法は 0 になります。`GeometryMode.Display` は画面用の幅モデルを使い、`GeometryMode.Print` はページ分割に使う DPI に依存しないモデルを使います。`getWidthModel` は Normal フォントの補正値と文字単位からポイント単位への変換情報を返します。`columnCharsToPt` と `columnPtToChars` は 2 つの単位を相互変換します。

列幅は、`<col width>` が保持する Excel の保存幅です。列の余白を含めた文字数で表します。Normal フォントが Calibri 11 の場合、Excel が 8.43 文字と表示する列は 9.140625 として保存されます。`setColumnWidth`、`getSheetColumns`、`columnCharsToPt`、`columnPtToChars`、既定の列幅はすべてこの単位です。画面表示では、`columnCharsToPt` が幅を Normal フォントの最大数字幅のピクセル単位に丸め、`columnPtToChars` は指定したポイント数に対応する保存幅を返します。フォント表が空のワークブックの印刷レイアウトは、Calibri 11 のモデルを使います。

シートの既定値は `getSheetFormatDefaults` で読み取ります。その `effectiveDefaultColWidth`（保存幅）と `effectiveDefaultRowHeight`（ポイント単位、未設定なら約 14.57、`zeroHeight` で行が既定で非表示のときは 0）が、シートのレイアウトに実際に使われる値です。`defaultColWidth` が明示されていない場合、列幅は `baseColWidth` と Normal フォントから導出され、Calibri 11 と既定の基準値 8 なら 9.140625 になります。`customHeight` は、既定の行高が Excel によって Normal フォントから再計算されない明示的な上書きであることを示します。列ごとの上書きは `getSheetColumns`、行ごとの上書きは `getSheetRowOverrides` で読み取り、どちらもアウトラインの `collapsed` フラグを返します（[ワークブック操作](/ja/workbook/operations)を参照）。編集には `setSheetFormatDefaults`、`setColumnWidth`、`clearColumnWidth`、`setRowHeight`、`clearRowHeight` を使います。`clearColumnWidth` は指定した包含範囲の明示的な幅だけを削除し、非表示やアウトラインのメタデータを保持します。削除後の列は、その後にシートの既定値を変更した場合も現在の有効な既定値に従います。表示テキストは列幅に依存しません。狭い列でも `####` にはならず、繰り返し塗りつぶしも幅に加算されません。

## テーマと有効なスタイル

`getTheme` は 12 色のテーマカラー、主要フォントと本文フォント、およびテーマパーツ、既定テーマ、解析不能なテーマのどれを使ったかを示す `ThemeSource` を返します。テーマパーツがない場合の現在の Office 既定値は、アクセント 1 が `#156082`、主要 Latin フォントが `Aptos Display`、本文 Latin フォントが `Aptos Narrow`、主要 East Asian フォントが `游ゴシック Light`、本文 East Asian フォントが `游ゴシック` です。`setThemeColors` と `setThemeFonts` でワークブックのテーマを更新でき、`resetTheme` はカスタムテーマパーツとそのリレーションシップを削除して、次回の読み取りで既定テーマへ戻します。Excel が保存時に独自のテーマパーツを追加する場合があります。`resolveColor(spec, context)` は RGB、テーマ、インデックス、自動色を ARGB に解決します。`ColorContext` によって、フォント、塗りつぶし、枠線での自動色の意味が決まります。

`getTheme()` は、スクリプトごとのフォールバックフォントも `majorScripts` / `minorScripts`（Python は `major_scripts` / `minor_scripts`）として返します。テーマパーツがない場合、各リストには Office 既定の 47 スクリプトが含まれます。`setThemeScriptFont(major, script, typeface)` / `set_theme_script_font()` は他の項目を保持したまま 1 項目を更新し、未知の 4 文字スクリプトは末尾に追加します。East Asian フォントが明示されていない場合だけ、報告されるフォントは `Jpan` へフォールバックします。明示的な設定がある場合はそちらが優先されます。テーマパーツがないワークブックで最初に呼ぶと、既定の全リストを持つテーマを作成します。スクリプトは 4 文字の ASCII 英字、書体名は空でない文字列で指定します。

フォントレコードには `outline`、`shadow`、`condense`、`extend` の切り替えがあり、それぞれに `has*` フラグが付きます。差分フォントで要素がない場合は設定を変更せず、`hasOutline` が真で `outline: false` なら設定を解除します。塗りつぶしレコードは `gradient`（`GradientFill`）を持てます。`type` は線形なら `0`、パスなら `1`、`degree` は線形の角度、`left`、`right`、`top`、`bottom`（0〜1）はパスグラデーションの焦点位置、`stops` は位置と色の一覧です。`gradient` がある場合、パターンのフィールドは無視されます。塗りつぶしレコードと差分書式（`addFill`、`addDxf`）はどちらも読み書きでき、Python では `FontRecord` のフィールドと `GradientFill` が対応します。

`getEffectiveStyle(sheet, row, col)` はセル、行、列、既定値のいずれからスタイルを採用したかを解決し、`EffectiveStyleSource`、フォント・塗りつぶし・枠線のインデックス、解決済みカラー、保護フラグ、表示形式コードを返します。この結果に条件付き書式は含まれません。条件付き書式は専用 API で別に評価します。

## ページ分割

`paginate(sheet)` は、定義された印刷範囲、物理ページ数、用紙、余白、印刷可能矩形、倍率、ページ順、印刷タイトル、各ページのレイアウト、各改ページが手動かどうかを返します。印刷範囲が定義されていない場合、`printArea` は空のままですが、ページ分割は使用範囲へフォールバックします。入力は `setSheetPageSetup`、`setSheetPageMargins`、`setSheetPrintArea`、`setSheetPrintTitles`、`addSheetRowBreak` などの行・列改ページメソッドで設定します。

C 層では `fm_workbook_paginate` と `fm_pagination_*` の読み取り関数が同じモデルを公開します。ジオメトリ、表示、テーマ、スタイルの関数は `src/c_api/formulon_c.h` の `fm_sheet_*`、`fm_workbook_get_theme_*`、`fm_workbook_reset_theme`、`fm_workbook_resolve_color`、`fm_sheet_get_effective_style` です。

::: code-group

```js [WASM]
import createFormulon, { GeometryMode } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
try {
  checked(wb.setNumber(0, 0, 0, 123.45), 'setNumber')
  const text = checked(wb.getDisplayText(0, 0, 0), 'display')
  const rect = checked(wb.getCellRectPt(0, { firstRow: 0, firstCol: 0, lastRow: 0, lastCol: 0 }, GeometryMode.Display), 'rect')
  const theme = checked(wb.getTheme(), 'theme')
  const pages = checked(wb.paginate(0), 'paginate')
  console.log(text.text, rect.width, theme.colors.length, pages.pageCount)
} finally { wb.delete() }
```

```js [Native Node]
import { GeometryMode, Workbook } from '@libraz/formulon-native'

const wb = Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
try {
  checked(wb.setNumber(0, 0, 0, 123.45), 'setNumber')
  const text = checked(wb.getDisplayText(0, 0, 0), 'display')
  const rect = checked(wb.getCellRectPt(0, { firstRow: 0, firstCol: 0, lastRow: 0, lastCol: 0 }, GeometryMode.Display), 'rect')
  const theme = checked(wb.getTheme(), 'theme')
  const pages = checked(wb.paginate(0), 'paginate')
  console.log(text.text, rect.width, theme.colors.length, pages.pageCount)
} finally { wb.dispose() }
```

```python [Python]
from formulon import FormulonError, GeometryMode, MergeRange, Workbook

try:
    with Workbook.create_default() as wb:
        wb.set_number(0, 0, 0, 123.45)
        text, display_status = wb.get_display_text(0, 0, 0)
        rect = wb.get_cell_rect_pt(0, MergeRange(0, 0, 0, 0), GeometryMode.DISPLAY)
        theme = wb.get_theme()
        pages = wb.paginate(0)
        print(text, rect.width, len(theme.colors), pages.page_count)
except FormulonError as exc:
    raise RuntimeError(str(exc)) from exc
```

:::

Python の `Workbook` コンテキストマネージャーはハンドルを閉じ、ホスト側の失敗では `FormulonError` を送出します。WASM は `delete()`、Native Node は `dispose()` で解放します。画像やグラフの描画は呼び出し側の責務です。
