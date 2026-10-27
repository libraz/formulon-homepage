# フィルターと入力規則

型付き AutoFilter と入力規則の検証は、UI を使わずに表計算の判定を扱う API です。対象はメモリ上のワークブックで、シート、行、列のインデックスは 0 始まりです。

AutoFilter の定義、条件に合う行の判定、行の表示状態は別々に管理されます。

| 操作 | フィルター定義の変更 | 行の表示状態の変更 | 計算状態 |
| --- | --- | --- | --- |
| `setAutoFilter` | 条件を置き換える | 変更しない | 行の表示状態に依存する数式が再計算待ちになる |
| `evaluateAutoFilter` | 変更しない | 変更せず、データ行ごとの一致結果を返す | 変更しない |
| `applyAutoFilter` | 変更しない | 不一致の行を隠し、一致する行を表示する | `SUBTOTAL` などの数式セルを再計算待ちにする。値を読む前に `recalc()` を呼ぶ |
| `clearAutoFilter` | 条件を消す | すべてのデータ行を表示する | 行の表示状態に依存する数式が再計算待ちになる |
| `removeAutoFilter` | 定義を削除する | 現在の表示状態を保持する | 行の表示状態に依存する数式が再計算待ちになる |

これらの操作自体は再計算を行いません。状態を変更した後、フィルターや行の表示状態に依存する数式の値を読む前に `recalc()` を呼んでください。

## 型付き AutoFilter

`getAutoFilter(sheet)` と `getTableAutoFilter(tableIndex)` は、フィルターがない場合に `autoFilter` フィールドが `null` となる結果を返します。`AutoFilter` は、ヘッダー行を含む包含範囲 `range`、順序付きの `columns`、任意の `sort` を持ちます。各 `AutoFilterColumn.colId` は範囲の先頭列からのオフセットです。`FilterKind` は `Values`、`Custom`、`Top10`、`Dynamic`、`Color`、`Icon` のいずれかを選び、対応するフィールドに値、日付グループ、演算子、しきい値、色、アイコンを指定します。`SortBy`、`SortMethod`、`DateTimeGrouping` は並べ替えと日付グループの状態を表します。

`setAutoFilter` はシートのフィルターを置き換えますが、行の表示状態は変更しません。`evaluateAutoFilter` は読み取り専用で、データ行の先頭行 `firstRow` と各行の条件一致を示す `match` 配列を返します。`applyAutoFilter` は条件に合わない行を非表示にし、一致する行を表示して、`SUBTOTAL` や `AGGREGATE` などの依存式を再計算待ちにします。新しい値を読む前に再計算してください。`clearAutoFilter` は条件を削除して全データ行を表示します。`removeAutoFilter` は定義を削除しますが、表示状態は変更しません。テーブル用メソッドにも同じ `get`、`set`、`evaluate`、`apply`、`clear`、`remove` があります。

型付きの書き込みでは、モデルが解釈しない `xr:uid`、`calendarType`、`extLst`、その他の AutoFilter 属性も保持します。

C の名前は `fm_sheet_get_auto_filter`、`fm_sheet_set_auto_filter`、`fm_sheet_evaluate_auto_filter`、`fm_sheet_apply_auto_filter`、`fm_sheet_clear_auto_filter`、`fm_sheet_remove_auto_filter` です。テーブル用には `fm_table_*_auto_filter` を使います。WASM と Native Node は camelCase、Python は `get_auto_filter`、`set_auto_filter`、`evaluate_auto_filter`、`apply_auto_filter`、`clear_auto_filter`、`remove_auto_filter` を使います。

### 文字列の照合と順序

文字列の一致、カスタム条件、AutoFilter の並べ替えは、ワークブックで選択した Excel 互換性プロファイルを使います。すべての `mac-*` プロファイルは、比較、並べ替え、検索、グループ化、AutoFilter で各ロケールの Mac Excel 実測照合順序に従います。`win-*` プロファイルは Windows Excel 365 ja-JP で実測した Windows の単語順に従います。プロファイルは実行時のワークブック状態であり、ファイルには保存されません。読み込み後に対象プロファイルを再適用してください。比較の種類と例は [テキスト照合](/ja/compatibility/text-collation) を参照してください。

値リストの一致では、フィルターの項目とセルの表示文字列の先頭・末尾から U+0020 の ASCII 空白だけを削除します。タブ、ノーブレークスペース（U+00A0）、全角スペース（U+3000）は意味のある文字として残ります。

## 入力規則の検証

0〜100 を許可する規則に対して、候補の数値を試せます。検証だけでは A1 の値は変わりません。「直接書き込む」では、規則外の値もエンジンに保存できることを確認できます。規則違反の入力を拒否するアプリケーションでは、書き込み前に検証結果を確認してください。

<ValidationDemo />

`getValidations` は保存済みの規則を読み取り、`addValidation` は規則を追加します。規則の値は OOXML の序数です。`type` の 1～7 は整数、10 進数、リスト、日付、時刻、文字列長、カスタムを表します。`op` の 0～7 は範囲内、範囲外、等しい、等しくない、大きい、小さい、以上、以下を表します。`ValidationErrorStyle` は `Stop`、`Warning`、`Information` です。規則の数式は先頭の `=` なしで保存され、読み戻しも同じ形です。`==` で始まる数式は `kParserUnexpectedToken` で拒否されます。

`validateValue(sheet, row, col, value)` は、値を保存せずに指定セルへ適用される規則を検証します。結果には `hasRule`、`valid`、`ruleIndex`、`errorStyle` が含まれます。規則が重なる場合は、保存順で最初の規則が適用されます。`listInvalidCells` は、現在の値が規則に違反する入力済みセルを行優先順で返し、続きの取得に使う `nextCursor` を返します。値の設定は入力規則を自動で強制しません。ホスト側で `validateValue()` を呼び、その結果を見て、受け付ける値だけ別の操作で書き込む必要があります。既存のワークブックを検査する場合は `listInvalidCells()` を使います。カスタム式、リストの参照元、規則の境界値などの数式は、検証対象セルを読む箇所で入力候補の値に置き換えて評価します。範囲参照や間接参照から対象セルを読む場合も同じです。それ以外のセル値は保存済みのままで、検証によってワークブックが変更されることはありません。たとえば、A 列のセルに `5` を入力する検証では、`COUNTIF($A:$A,5)>0` は候補値の `5` を参照します。

`"Open,Closed"` のようなインラインリストでは、Excel が表示する文字列の先頭・末尾から U+0020 の空白を削除して比較します。リストの解析時には各コンマの直後にある U+0020 も削除します。文字列の一致は大文字・小文字と幅を含めて完全一致です。数値として読める表示文字列とリスト項目は実行中のプロファイルで数値としても比較するため、`01`、全角の `１`、`1e0` は `1` に一致し、パーセント表示は `50%` に一致します。範囲を参照するリストの挙動（`MATCH(..., 0)`）は変わりません。

組み込みの数値書式 ID `5`～`8` と `41`～`44` は、検証時に実行中のプロファイルのロケールに対応する書式コードへ解決されます。

`removeValidationAt` と `clearValidations` は保存済み規則を編集します。C の呼び出しは `fm_sheet_validate_value`、`fm_sheet_list_invalid_cells`、`fm_sheet_get_validation_at`、`fm_sheet_add_validation`、`fm_sheet_remove_validation_at`、`fm_sheet_clear_validations` です。Python は状態オブジェクトを返す代わりに、ホスト側の失敗で `FormulonError` を送出します。

::: code-group

```js [WASM]
import createFormulon, { FilterKind, ValueKind } from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
try {
  for (const [row, value] of ['Name', 'Ada', 'Bob'].entries()) checked(wb.setText(0, row, 0, value), 'setText')
  checked(wb.setAutoFilter(0, { range: { firstRow: 0, firstCol: 0, lastRow: 2, lastCol: 0 }, columns: [{ colId: 0, kind: FilterKind.Values, values: ['Ada'] }], sort: null }), 'setAutoFilter')
  console.log(checked(wb.evaluateAutoFilter(0), 'evaluate').match)
  checked(wb.addValidation(0, { ranges: [{ firstRow: 0, firstCol: 1, lastRow: 0, lastCol: 1 }], type: 3, formula1: '"Open,Closed"' }), 'addValidation')
  console.log(checked(wb.validateValue(0, 0, 1, { kind: ValueKind.Text, number: 0, boolean: 0, text: 'Open', errorCode: 0 }), 'validate').valid)
} finally { wb.delete() }
```

```js [Native Node]
import { FilterKind, ValueKind, Workbook } from '@libraz/formulon-native'

const wb = Workbook.createDefault()
const checked = (r, name) => {
  const s = typeof r?.ok === 'boolean' ? r : r?.status
  if (!s?.ok) throw new Error(`${name}: ${s?.message}`)
  return r
}
try {
  for (const [row, value] of ['Name', 'Ada', 'Bob'].entries()) checked(wb.setText(0, row, 0, value), 'setText')
  checked(wb.setAutoFilter(0, { range: { firstRow: 0, firstCol: 0, lastRow: 2, lastCol: 0 }, columns: [{ colId: 0, kind: FilterKind.Values, values: ['Ada'] }], sort: null }), 'setAutoFilter')
  console.log(checked(wb.evaluateAutoFilter(0), 'evaluate').match)
  checked(wb.addValidation(0, { ranges: [{ firstRow: 0, firstCol: 1, lastRow: 0, lastCol: 1 }], type: 3, formula1: '"Open,Closed"' }), 'addValidation')
  console.log(checked(wb.validateValue(0, 0, 1, { kind: ValueKind.Text, number: 0, boolean: 0, text: 'Open', errorCode: 0 }), 'validate').valid)
} finally { wb.dispose() }
```

```python [Python]
from formulon import AutoFilter, AutoFilterColumn, DataValidationInput, FormulonError, FilterKind, MergeRange, Value, ValueKind, Workbook

try:
    with Workbook.create_default() as wb:
        for row, value in enumerate(('Name', 'Ada', 'Bob')):
            wb.set_text(0, row, 0, value)
        wb.set_auto_filter(0, AutoFilter(MergeRange(0, 0, 2, 0), [AutoFilterColumn(0, kind=FilterKind.VALUES, values=['Ada'])]))
        print(wb.evaluate_auto_filter(0)[1])
        wb.add_validation(0, DataValidationInput(type=3, ranges=[MergeRange(0, 1, 0, 1)], formula1='"Open,Closed"'))
        print(wb.validate_value(0, 0, 1, Value(ValueKind.TEXT, text='Open')).valid)
except FormulonError as exc:
    raise RuntimeError(str(exc)) from exc
```

:::

XLSB から読み込んだフィルターは型付き API に公開されません。XLSB 保存では型付き AutoFilter の編集が省略され、診断が報告されます。上位 N 件や平均の条件は全データ行を使います。入力規則は保持されますが、どのバインディングも変更時に規則を強制しません。
