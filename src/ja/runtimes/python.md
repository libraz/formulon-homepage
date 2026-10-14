# Python 連携

`formulon` パッケージを使うと、スクリプト、ノートブック、テスト、データパイプラインから、Excel を起動せずにワークブックを再計算・編集できます。

## インストールと最初の呼び出し

```sh
python -m pip install formulon==0.15.2
```

```python
import formulon
from formulon import Workbook

print(formulon.eval_formula("=SUM(1,2,3)").to_python())  # 6.0

with Workbook.create_default() as wb:
    wb.set_number(0, 1, 0, 21)          # Sheet1!A2
    wb.set_formula(0, 0, 0, "=A2*2")    # Sheet1!A1
    wb.recalc()
    print(wb.get_value(0, 0, 0).to_python())  # 42.0
```

座標は 0 始まりの `(sheet, row, col)` です。`with` ブロックを抜けると、例外が発生した場合も含めてワークブックを解放します。コンテキストマネージャーを使えない箇所では `close()` を呼んでください。

::: tip 向いている用途
バッチジョブや分析ワークフローの一部にスプレッドシートが含まれるなら Python、ワークブックをブラウザ内にとどめたいなら WASM を使います。
:::

## パッケージ構成

PyPI パッケージは Python 3.9 以降向けの `py3-none-any` wheel 1 つです。中身は WebAssembly にコンパイルした [C ABI](/ja/api/c) である `formulon_capi.wasm` と、純 Python のラッパーです。`pip` はプラットフォーム別のランタイムとして `wasmtime` も一緒にインストールします。Cython、pybind11、NumPy には依存しません。

::: info 用語: wasmtime
Bytecode Alliance がメンテナンスするスタンドアロンの WebAssembly ランタイムです。`formulon` はインポート時に `wasmtime` でモジュールを読み込むため、`wasmtime` の wheel があるプラットフォームならどこでも同じ wheel 1 つで動きます。
:::

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

`load → mutate → recalc → save` が基本の流れです。完全な例は [Python で一括再計算](/ja/scenarios/python-batch) を参照してください。

## 他の実行環境との違い

- `recalc()` は直列に実行します。Python には `recalc_parallel()` がないため、並列スケジューラが必要な場合は `@libraz/formulon/threads`、Native Node、CLI の `--threads` を使います。
- スカラーの `evaluate_formula_text()` はありません。`eval_formula()` は新規ワークブックで評価し、`Workbook.evaluate_formula_array()` は読み込んだワークブックに対して読み取り専用で評価します。
- ワークシートを解析するときのメモリ上限は npm の WASM ビルドと同じです。[メモリの上限](/ja/runtimes/wasm#memory-limits) を参照してください。

ほかのバインディングとの違いは [メソッド差分](/ja/api/surfaces#method-differences) にまとめています。

## エラー

不正なバイト列、範囲外のシート、`set_formula()` に渡した不正な数式テキストなど、ホスト側の失敗は `FormulonError` を送出します。Excel のセルエラーは値として扱い、`get_value()` は `Value(kind=ValueKind.ERROR)` を返します。例外の属性は [Python API](/ja/api/python#error-handling) を参照してください。

## 次に読むもの

- [Python API](/ja/api/python) ─ API 詳細
- [ワークブックの流れ](/ja/workbook/lifecycle) ─ エンジン側から見た同じフロー
- [Python で一括再計算](/ja/scenarios/python-batch) ─ 一連の処理例
