# Python 連携

Python パッケージは、Excel を起動せずに再計算したいスクリプト・ノートブック・テスト・データパイプライン向けです。

::: tip 向いている用途
バッチジョブや分析ワークフローの一部にスプレッドシートが含まれるなら Python。ワークブックをブラウザ内にとどめたいなら WASM。
:::

::: info 用語: wasmtime
Bytecode Alliance がメンテナンスするスタンドアロン WebAssembly ランタイム。Formulon Python パッケージは `formulon_capi.wasm` を同梱し、import 時に `wasmtime` でロードします。これによって wheel は `py3-none-any` 1 種類で済み、`wasmtime` の wheel が出ている OS であればどこでも動きます。
:::

::: info 用語: C ABI
Formulon のネイティブライブラリが公開するフラットな C 関数インタフェース。binding はこの安定契約を介して engine を呼びます。Python / CLI / WASM のどれも同じ C ABI の上に乗っています。詳しくは [C ABI](/ja/development/bindings)。
:::

典型用途:

- アップロードされたワークブックの数式検証
- 帳票・モデルのバッチ再計算
- ワークブック出力と golden 比較
- 計算値を下流システムへ展開

ワークブック IO はスクリプトの端で行い、テスト fixture では選択 profile を明示してください。

## パッケージング

PyPI パッケージは platform-native な `libformulon` を同梱しません。`formulon_capi.wasm` と pure Python wrapper を含む `py3-none-any` wheel で配布し、ロードを担うのは `wasmtime` です。実行時に Cython / pybind11 / NumPy への依存はありません。

## エラー処理

`FormulonError` はホスト操作の失敗（bytes 不正・ハンドル失効・IO 失敗・engine の内部失敗）を表します。Excel のセルエラーは `Value(kind=ValueKind.ERROR)` として返ります。

```python
import formulon
from formulon import ValueKind, FormulonError

try:
    value = formulon.eval_formula("=1/0")
    assert value.kind is ValueKind.ERROR  # セルエラー
except FormulonError as e:
    # ホスト失敗
    raise
```

## ライフタイム

`Workbook` は context manager として使います。ブロック内で例外が出てもネイティブハンドルは確実に解放されます。

```python
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_formula(0, 0, 0, "=SUM(1,2,3)")
    wb.recalc()
    print(wb.get_value(0, 0, 0).to_python())
```

## バッチ再計算パターン

```python
from formulon import Workbook

with open("input.xlsx", "rb") as f:
    blob = f.read()

with Workbook.load(blob) as wb:
    wb.set_number(0, 3, 1, 125_000.0)
    wb.recalc()
    output = wb.save()

with open("output.xlsx", "wb") as f:
    f.write(output)
```

`load → mutate → recalc → save` が定番です。完全な例は [Python で一括再計算](/ja/scenarios/python-batch) を参照。

## 次に読むもの

- [Python API](/ja/api/python) ─ surface 詳細
- [ワークブックの流れ](/ja/workbook/lifecycle) ─ engine 側から見た同じフロー
- [Python で一括再計算](/ja/scenarios/python-batch) ─ end-to-end 例
