# Python API

Python パッケージは、`formulon_capi.wasm` にコンパイルされた Formulon C ABI を呼ぶ Python 向けラッパーです。公開 wheel は `py3-none-any`。プラットフォームランタイムは `pip` が `wasmtime` の wheel として解決します。

::: info 用語: py3-none-any wheel
Python ABI タグ・プラットフォームタグ・ネイティブコードのいずれも持たない wheel。依存が解決できるなら、どの CPython 3 でも動きます。プラットフォーム依存部分は `wasmtime` が担い、`formulon` 自体には含まれません。
:::

## トップレベル API

| API | 用途 |
| --- | --- |
| `formulon.eval_formula(formula)` | 単発の数式評価 |
| `formulon.error_display_name(error_code)` | エラー序数を Excel の表示文字列へ変換 |
| `formulon.library_version()` | ロード済み Formulon モジュールのバージョン |
| `formulon.version_string()` | `library_version()` の別名 |
| `formulon.merge_function_metadata(base, entry, locale)` | ホスト提供のローカライズ済み関数メタデータを、エンジンの構造カタログに重ねてマージする純関数 |
| `ValueKind` | C ABI と一致する enum |
| `FormulonError` | ホスト側の失敗を表す例外 |

## Workbook

```python
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_formula(0, 0, 0, "=SUM(1,2,3)")
    wb.recalc()
    print(wb.get_value(0, 0, 0).to_python())
```

ファクトリ:

- `Workbook.create_default()`
- `Workbook.create_empty()`
- `Workbook.load(data)`

主なメソッド:

- `sheet_count()`, `sheet_name(index)`, `add_sheet(name)`
- `set_number`, `set_bool`, `set_text`, `set_blank`, `set_formula`
- `get_value`, `lambda_text_at`, `evaluate_formula_array`
- `recalc`, `partial_recalc`, `set_iterative`
- `save`, `save_ex`（XLSX / XLSB のコンテナ形式を選択）
- `iter_cells`, `iter_defined_names`, `iter_tables`, `iter_passthrough`
- シート構造編集、行 / 列編集、定義名
- merges、`get_comment` / `set_comment`、`comment_count` / `get_comments`、hyperlinks、data validations
- `evaluate_cf_formula`、visual conditional-format payload（`ColorScale`、`DataBar`、`IconSet`）、DXF、`paginate`
- styles、conditional formats、sheet view / protection
- pivot cache / table API（worksheet-source access と pivot report layout を含む）、依存関係 trace、spill 情報、function metadata、DXF

::: tip ライフタイムは context manager
`with` ブロックを抜けるとネイティブハンドルが解放されます。例外が出ても解放は走るため、`Workbook` 参照を `with` の外で持ち回さないでください。
:::

::: info Python の評価境界
Python は `evaluate_formula_array(sheet, row, col, formula)` で配列全体を返し、`evaluate_cf_formula(sheet, row, col, anchor_row, anchor_col, formula)` で条件付き書式の述語を評価します。一般的なスカラー `evaluate_formula_text` は公開していません。`comment_count(sheet)` / `get_comments(sheet)` でコメントを列挙でき、`paginate(sheet)` は `page_count`、`print_area`、`horizontal_breaks`、`vertical_breaks` を持つ `PaginationResult` を返します。
:::

正確なメソッド一覧は、パッケージに含まれる type stub と docstring を確認してください。

## Values

`Value.to_python()` は blank / number / bool / text を Python 型（`None` / `float` / `bool` / `str`）に変換します。error / array / ref / lambda は `Value` ラッパーのまま返るので、`kind` と payload を確認できます。

```python
value = wb.get_value(0, 0, 0)
if value.kind is ValueKind.NUMBER:
    print(value.number)
elif value.kind is ValueKind.ERROR:
    print(formulon.error_display_name(value.error_code))
```

Python の `Value` が持つのは `error_code` だけで、`error_text` というフィールドはありません。`formulon.error_display_name(value.error_code)` で `#DIV/0!` や `#VALUE!` の表示文字列を得られます。

## エラー処理

`FormulonError` はホスト側の失敗（バイト列不正・ハンドル失効・IO エラー・エンジン内部失敗）を表します。Excel のセルエラーは値です。

```python
import formulon
from formulon import ValueKind, FormulonError

try:
    with Workbook.load(blob) as wb:
        wb.recalc()
        v = wb.get_value(0, 0, 0)
        if v.kind is ValueKind.ERROR:
            handle_cell_error(v)
except FormulonError as e:
    handle_host_failure(e)
```

## 次に読むもの

- [ワークブックの流れ](/ja/workbook/lifecycle) ─ open / mutate / recalc / save
- [Python で一括再計算](/ja/scenarios/python-batch) ─ 一連のパイプライン
