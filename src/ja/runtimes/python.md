# Python 連携

Python パッケージは、Excel を起動せずに再計算やワークブック編集を行いたいスクリプト・ノートブック・テスト・データパイプライン向けです。

::: tip 向いている用途
バッチジョブや分析ワークフローの一部にスプレッドシートが含まれるなら Python。ワークブックをブラウザ内にとどめたいなら WASM。
:::

::: info 用語: wasmtime
Bytecode Alliance がメンテナンスするスタンドアロン WebAssembly ランタイム。Formulon Python パッケージは `formulon_capi.wasm` を同梱し、import 時に `wasmtime` でロードします。これによって wheel は `py3-none-any` 1 種類で済み、`wasmtime` の wheel が出ている OS であればどこでも動きます。
:::

::: info 用語: C ABI
Formulon のネイティブライブラリが公開するフラットな C 関数インタフェース。各バインディングはこの安定したインタフェースを介してエンジンを呼びます。Python / CLI / WASM のどれも同じ C ABI の上に乗っています。詳しくは [C ABI](/ja/development/bindings)。
:::

典型用途:

- アップロードされたワークブックの数式検証
- 帳票・モデルのバッチ再計算
- ワークブック出力と期待値比較
- 計算値を下流システムへ展開
- Python からシート構造、スタイル、コメント、入力規則、条件付き書式、PivotTables を編集

ワークブックの入出力はスクリプトの端で行い、テスト用データでは選択プロファイルを明示してください。

## パッケージング

PyPI パッケージはプラットフォーム別の `libformulon` を同梱しません。`formulon_capi.wasm` と純 Python ラッパーを含む `py3-none-any` wheel で配布し、ロードを担うのは `wasmtime` です。実行時に Cython / pybind11 / NumPy への依存はありません。

## API 範囲

`Workbook` は、npm バインディングが公開する C ABI の実行入口をそのまま踏襲しています。`load -> mutate -> recalc -> save` に加えて、シート / 行列編集、定義名、partial recalc、merge、comment、hyperlink、validation、style、conditional formatting、PivotTables、依存関係 trace、spill 情報、function metadata、sheet view / protection、calc policy、external links を扱えます。

主な実行時差分は threading です。Python は `wasmtime` 経由で C ABI の WASM ビルドを呼び出すため、`recalc()` は serial です。計算結果の忠実度は他の実行入口と同じです。

::: warning Python は v0.9.4 の追加分をまだ公開していません
`evaluateFormulaText` / `evaluateConditionalFormula`、およびコメント列挙（Node アドオンの `getComments`、C API の `fm_sheet_get_comment_count` / `fm_sheet_get_comment_at_index`）は v0.9.4 で C API・Node アドオン・WASM に追加されましたが、Python ラッパーにはまだ対応するものがありません。「C ABI の実行入口をそのまま踏襲」というのはバインディングの全体的な設計方針を指しているのであって、メソッド単位の完全な一致を保証するものではありません。なお Python の `add_conditional_format` は、Node アドオンや C API の `addConditionalFormat` が v0.9.4 で返すようになったのと同じ、新規ルールのインデックスを返します。
:::

<DiagramLayers :layers="[
  { title: 'v0.9.4 の追加分', nodes: ['evaluateFormulaText / evaluateConditionalFormula / getComments'] },
  { title: '公開先', nodes: [
    { label: 'C API', note: '一次情報源' },
    { label: 'Node アドオン' },
    { label: 'WASM' }
  ] },
  { title: '未公開', nodes: [{ label: 'Python ラッパー' }] }
]" />

::: tip v0.9.5: Python に配列全体版が追加
v0.9.5 で Python にも `evaluate_formula_array`（読み込み済みワークブックに対する読み取り専用のアドホック評価で、動的配列 / スピル数式の結果を左上端に縮約せず配列全体として返す）と、ホスト提供のローカライズ済み関数メタデータをエンジンの構造カタログに重ねる純粋ヘルパー `merge_function_metadata` が入りました。一方でスカラー版の `evaluate_formula_text` / `evaluate_conditional_formula` は依然として未対応なので、上記の警告はそのまま有効です。
:::

## エラー処理

`FormulonError` はホスト操作の失敗（バイト列不正・ハンドル失効・IO 失敗・エンジン内部失敗）を表します。Excel のセルエラーは `Value(kind=ValueKind.ERROR)` として返ります。

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

- [Python API](/ja/api/python) ─ API 詳細
- [ワークブックの流れ](/ja/workbook/lifecycle) ─ エンジン側から見た同じフロー
- [Python で一括再計算](/ja/scenarios/python-batch) ─ 一連の処理例
