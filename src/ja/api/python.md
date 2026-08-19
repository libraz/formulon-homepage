# Python API

Python パッケージは、`formulon_capi.wasm` にコンパイルされた Formulon C ABI を呼ぶ Python 向けラッパーです。公開 wheel は `py3-none-any`。プラットフォームランタイムは `pip` が `wasmtime` の wheel として解決します。

::: info 用語: py3-none-any wheel
Python ABI タグ・プラットフォームタグ・ネイティブコードのいずれも持たない wheel。互換する `wasmtime` wheel が利用できる CPython 3.9 以降で動作します。プラットフォーム依存部分は `wasmtime` が担い、`formulon` 自体には含まれません。
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
- `pinned_now`, `set_pinned_now`, `clear_pinned_now`
- `save`, `save_as(fmt)`（XLSX / XLSB のコンテナ形式を選択）
- `save_with_diagnostics(fmt)`, `read_diagnostics()`
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

## 保存時の診断

`save_with_diagnostics(fmt)` は、保存した `bytes` と writer が検出した損失・延期のカウンターを持つ `SaveDiagnostics` を返します。`read_diagnostics()` は、ワークブックの読み込み時に取得したカウンターを持つ `ReadDiagnostics` を返します。カウンターの対象は一部の損失だけです。すべて 0 であることは、記載された損失が発生しなかったことを示しますが、パッケージをバイト単位で比較したことや、診断イベントが一切なかったことは示しません。

| 結果 | フィールド | 意味 |
| --- | --- | --- |
| `SaveDiagnostics` | `downgraded_formula_count` | キャッシュ済みリテラルとして出力された数式セルの数。XLSX では常に 0 です。 |
|  | `deferred_feature_count` | レコードへ変換されなかったシート機能の数。XLSX では常に 0 です。 |
|  | `dropped_part_count` | いずれかの writer が破棄した passthrough パートの数。 |
|  | `dropped_relationship_count` | 対象パートの破棄に伴って破棄された relationship の数。`dropped_part_count` と同じ損失を表す場合があります。 |
|  | `renumbered_part_count` | writer が割り当てたパート ID で出力された table の数。XLSB では常に 0 です。 |
| `ReadDiagnostics` | `undecoded_formula_count` | デコードできなかった保存済み数式の数。XLSB のみです。 |
|  | `undecoded_defined_name_count` | デコードできずにスキップされた defined name の数。XLSB のみです。 |
|  | `undecoded_part_count` | content type を解決できなかった XLSB パッケージパートの数。 |
|  | `skipped_feature_count` | 参照が利用できずスキップされた OOXML の presentation-overlay エントリの数。 |
|  | `unknown_content_type_count` | content type が認識できなかった OOXML workbook パートの数。 |

```python
from formulon import Workbook, WorkbookFormat

with Workbook.create_default() as wb:
    saved = wb.save_with_diagnostics(WorkbookFormat.XLSB)
    print(saved.bytes, saved.downgraded_formula_count)
    loaded = Workbook.load(saved.bytes)
    try:
        print(loaded.read_diagnostics().undecoded_formula_count)
    finally:
        loaded.close()
```

`dropped_part_count` と `dropped_relationship_count` は、1 つのパートを破棄したときにどちらも増える場合があります。失われたオブジェクト数として合計しないでください。

## 時計の固定

ワークブックが pin されていない場合、`NOW()`、`TODAY()`、pivot の相対期間フィルターはホストの時計を読み取ります。これらの結果を 1 回の再計算で一致させる場合や、ホストをまたいで再現する場合は、ワークブックを 1 つの local civil time に固定してください。

```python
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_pinned_now(2026, 8, 19, 12, 0, 0)
    print(wb.pinned_now())  # CivilTime(year, month, day, hour, minute, second)
    wb.recalc()
    wb.clear_pinned_now()
```

`pinned_now()` は `CivilTime` オブジェクトを返し、ワークブックがホストの時計に従う場合は `None` を返します。`set_pinned_now()` は `year` 1900–9999、`month` 1–12、月ごとの実在する日、`hour` 0–23、`minute` / `second` 0–59 を検証します。不正な値は正規化せず、`FormulonError` を送出します。値は timestamp ではなく local civil field として保持するため、タイムゾーンの解釈はありません。pin の設定・解除ではキャッシュ済みの数式値を再計算しないため、必要に応じて `recalc()` を明示的に呼び出してください。pin はファイル状態ではなくワークブックのモデル状態です。保存時には記録されず、読み込み直後のワークブックは pin されていません。

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
