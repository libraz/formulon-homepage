# 表示、ジオメトリ、ページ分割

Formulon は、レンダラーが必要とするワークブックの表示状態を公開します。セルやページを描画する機能はありません。座標は 0 始まりで、物理的な寸法はポイント単位で返します。

## 表示状態

`getDisplayText(sheet, row, col)` は、セルの有効な表示形式を使って保存値を 1 つ表示用テキストに変換します。`displayStatus` は `DisplayStatus.Ok`、`Overflow`、`InvalidFormat` のいずれかで、オーバーフローはレンダラーの契約上 `########` になります。`formatValue(value, formatCode)` はセルを読まず、指定した形式で値を変換します。どちらも状態を含む結果を返します。

`getSheetView(sheet)` は、ズーム、固定する行と列の数、タブの表示状態、枠線、行列見出し、ゼロ表示、右から左への表示、タブ選択、表示モードを読み取ります。対応する設定メソッドは `setSheetFreeze`、`setSheetVisibility`、`setSheetShowGridLines`、`setSheetViewMode` などです。シート保護はメタデータであり、計算エンジンはロックを強制しません。

## ジオメトリ

`getCellRectPt` は A1 の左上を基準に、指定した包含範囲 `MergeRange` を覆う矩形を返します。`getColumnWidthPt` と `getRowHeightPt` は有効な寸法を返し、非表示の行と列の寸法は 0 になります。`GeometryMode.Display` は画面用の幅モデルを使い、`GeometryMode.Print` はページ分割に使う DPI に依存しないモデルを使います。`getWidthModel` は Normal フォントの補正値と文字単位からポイント単位への変換情報を返します。`columnCharsToPt` と `columnPtToChars` は 2 つの単位を相互変換します。

シートの既定値は `getSheetFormatDefaults`、列ごとの上書きは `getSheetColumns`、行ごとの上書きは `getSheetRowOverrides` で読み取ります。編集には `setSheetFormatDefaults`、`setColumnWidth`、`clearColumnWidth`、`setRowHeight`、`clearRowHeight` を使います。`clearColumnWidth` は指定した包含範囲の明示的な幅だけを削除し、非表示やアウトラインのメタデータを保持します。削除後の列は、その後にシートの既定値を変更した場合も現在の有効な既定値に従います。表示テキストは列幅に依存しません。狭い列でも `####` にはならず、繰り返し塗りつぶしも幅に加算されません。

## テーマと有効なスタイル

`getTheme` は 12 色のテーマカラー、主要フォントと本文フォント、およびテーマパーツ、既定テーマ、解析不能なテーマのどれを使ったかを示す `ThemeSource` を返します。テーマパーツがない場合の現在の Office 既定値は、アクセント 1 が `#156082`、主要 Latin フォントが `Aptos Display`、本文 Latin フォントが `Aptos Narrow`、主要 East Asian フォントが `游ゴシック Light`、本文 East Asian フォントが `游ゴシック` です。`setThemeColors` と `setThemeFonts` でワークブックのテーマを更新でき、`resetTheme` はカスタムテーマパーツとそのリレーションシップを削除して、次回の読み取りで既定テーマへ戻します。Excel が保存時に独自のテーマパーツを追加する場合があります。`resolveColor(spec, context)` は RGB、テーマ、インデックス、自動色を ARGB に解決します。`ColorContext` によって、フォント、塗りつぶし、枠線での自動色の意味が決まります。

`getTheme()` は、スクリプトごとのフォールバックフォントも `majorScripts` / `minorScripts`（Python は `major_scripts` / `minor_scripts`）として返します。テーマパーツがない場合、各リストには Office 既定の 47 スクリプトが含まれます。`setThemeScriptFont(major, script, typeface)` / `set_theme_script_font()` は他の項目を保持したまま 1 項目を更新し、未知の 4 文字スクリプトは末尾に追加します。East Asian フォントが明示されていない場合だけ、報告されるフォントは `Jpan` へフォールバックします。明示的な設定がある場合はそちらが優先されます。テーマパーツがないワークブックで最初に呼ぶと、既定の全リストを持つテーマを作成します。スクリプトは 4 文字の ASCII 英字、書体名は空でない文字列で指定します。

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
