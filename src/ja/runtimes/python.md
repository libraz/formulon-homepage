# Python 連携

Python パッケージは、Excel を起動せずに再計算やワークブック編集を行いたいスクリプト・ノートブック・テスト・データパイプライン向けです。

::: tip 向いている用途
バッチジョブや分析ワークフローの一部にスプレッドシートが含まれるなら Python。ワークブックをブラウザ内にとどめたいなら WASM。
:::

::: info 用語: wasmtime
Bytecode Alliance がメンテナンスするスタンドアロン WebAssembly ランタイム。Formulon Python パッケージは `formulon_capi.wasm` を同梱し、import 時に `wasmtime` でロードします。これによって wheel は `py3-none-any` 1 種類で済み、`wasmtime` の wheel が出ている OS であればどこでも動きます。
:::

::: info 用語: C ABI
Formulon のネイティブライブラリが公開するフラットな C 関数インタフェース。各バインディングはこの共有インタフェースを介してエンジンを呼びます。Python / CLI / WASM のどれも同じ C ABI の上に乗っています。詳しくは [C ABI](/ja/development/bindings)。
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

`Workbook` は、npm バインディングが公開する C ABI の実行入口をそのまま踏襲しています。`load -> mutate -> recalc -> save` に加えて、シート / 行列編集、定義名、partial recalc、merge、comment、hyperlink、validation、style、visual conditional-format payload（`ColorScale`、`DataBar`、`IconSet`）、DXF、pivot report layout、pivot-cache worksheet-source access、PivotTables、依存関係 trace、spill 情報、function metadata、sheet view / protection、calc policy、external links を扱えます。

table は `table_create()` / `table_update()` / `table_remove()` で作成・更新・削除できます。`column_names` は `ref` の列幅と一致し、header cell は呼び出し側が書き込みます。`table_update()` で `None` にした項目は保持され、既存 table の AutoFilter は範囲を変更しても条件と extension を保ちます。worksheet 単位の AutoFilter XML は `get_auto_filter_xml()` / `set_auto_filter_xml()` で完全な opaque `<autoFilter>` fragment として扱え、空文字列で削除できます。`add_hyperlink_range()` は両端を含む矩形に hyperlink を追加し、読み出した `Hyperlink` には `last_row` / `last_col` が入ります。

Python の `DataBar` は `x14` の全制御項目（`gradient`、`axis_position`（`0` は automatic、`1` は middle、`2` は none）、`negative_fill`、`border`、`negative_border`、`axis_color`）を公開します。省略時は model の既定値を使い、save と load をまたいで設定を保持します。API で新しく作成した PivotTable は、保存前に `set_pivot_cache_worksheet_source()` へ `PivotWorksheetSource(ref="A1:C10", sheet="Data")` を渡してください。worksheet source のない新規 cache の保存は失敗します。ファイルから読み込んだ cache には source があるため影響しません。

Python は worksheet の presentation metadata も作成できます。`set_sheet_visibility()` に `SheetVisibility.VISIBLE`、`HIDDEN`、`VERY_HIDDEN` を渡し、`get_sheet_view()` で解決済みの 3 状態 `visibility` を読み出します。typed print settings には `set_page_setup()`、`set_page_margins()`、`set_print_options()`、`set_header_footer()`、`set_print_area()`、`set_print_titles()`、`add_row_break()`、`add_col_break()` を使います。`set_range_xf_index()` は cell-style XF index を両端を含む矩形へ適用し、存在しないセルを style 付き blank として materialize します。`pivot_field_add_item_at()` は cache shared-item index で blank pivot member を含む item を指定できます。label 形式に空文字列を渡す方法では指定できません。

data validation の入力で `allow_blank` を省略した場合、Python の既定値は `False` です。空セルを許可する場合は `allow_blank=True` を指定してください。行 / 列の構造編集では AutoFilter の `ref` 範囲はセルとともに移動しますが、範囲内の criteria offset は組み替えません。

主な実行時差分は threading です。Python は `wasmtime` 経由で C ABI の WASM ビルドを呼び出すため、`recalc()` は serial です。Python には `recalc_parallel()` / `recalcParallel()` API がありません。並列 scheduler が必要な場合は WASM、Native Node、または CLI の `--threads` を使います。計算結果の忠実度は他の実行入口と同じです。

PyPI の WASM ビルドは worksheet XML を DOM として読み込みます。シートを 1 枚ずつ処理するため、パース時のピークメモリは最大の worksheet XML に比例し、32-bit WASM アドレス空間内に収める必要があります。Native CLI は 256 KiB を超える XML で streaming に切り替えます。

::: info Python の評価とワークブック API
Python は `evaluate_formula_array(sheet, row, col, formula)` で配列全体を返し、`evaluate_cf_formula(sheet, row, col, anchor_row, anchor_col, formula)` で条件付き書式を評価します。一般的なスカラー `evaluate_formula_text` は公開していません。コメントは `comment_count(sheet)` / `get_comments(sheet)` で列挙でき、`paginate(sheet)` はページ形状を返します。`error_display_name(error_code)` はエラー序数の Excel 表示文字列を返します。
Python はワークブック機能の大部分を同等に扱いますが、C ABI のすべてのエントリーポイントをそのまま公開するわけではありません。反復進捗コールバックは Python にはありません。ふりがなテキストは `set_phonetic()` / `get_phonetic()` で取得・設定できます。ワークブックの文脈で一般的なスカラーを評価する場合は、変更して再計算してください。
:::

<DiagramLayers :layers="[
  { title: 'Python のワークブック API', nodes: ['配列評価', 'CF 評価', 'コメント列挙', 'ページ分割'] },
  { title: '公開先', nodes: [
    { label: '共有 C ABI', note: '同じワークブックモデル' },
    { label: 'Python ラッパー' }
  ] },
  { title: 'スカラー評価の境界', nodes: [{ label: 'evaluate_formula_text', note: 'Python には未公開' }] }
]" />

::: tip Python の配列評価
`evaluate_formula_array` は、読み込み済みワークブックに対する読み取り専用の評価で、動的配列 / スピル数式の結果を配列全体として返します。スカラー版の `evaluate_formula_text` は公開していません。
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
