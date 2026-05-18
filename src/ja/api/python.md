# Python API

Python パッケージは、`formulon_capi.wasm` にコンパイルされた Formulon C ABI を呼ぶ小さな Python 向けラッパーです。公開 wheel は `py3-none-any`。プラットフォームランタイムは `pip` が `wasmtime` の wheel として解決します。

::: info 用語: py3-none-any wheel
Python ABI タグ・プラットフォームタグ・ネイティブコードのいずれも持たない wheel。依存が解決できるなら、どの CPython 3 でも動きます。プラットフォーム依存部分は `wasmtime` が担い、`formulon` 自体には含まれません。
:::

## トップレベル API

| API | 用途 |
| --- | --- |
| `formulon.eval_formula(formula)` | 単発の数式評価 |
| `formulon.library_version()` | ロード済み Formulon モジュールのバージョン |
| `formulon.version_string()` | `library_version()` の別名 |
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
- `get_value`
- `recalc`, `set_iterative`
- `save`
- `iter_cells`, `iter_defined_names`, `iter_tables`, `iter_passthrough`

::: tip ライフタイムは context manager
`with` ブロックを抜けるとネイティブハンドルが解放されます。例外が出ても解放は走るため、`Workbook` 参照を `with` の外で持ち回さないでください。
:::

## Values

`Value.to_python()` は blank / number / bool / text を Python 型（`None` / `float` / `bool` / `str`）に変換します。error / array / ref / lambda は `Value` ラッパーのまま返るので、`kind` と payload を確認できます。

```python
value = wb.get_value(0, 0, 0)
if value.kind is ValueKind.NUMBER:
    print(value.number)
elif value.kind is ValueKind.ERROR:
    print(value.error_code, value.error_text)
```

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
