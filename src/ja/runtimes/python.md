# Python 連携

Python パッケージは、Excel を起動せずに再計算やワークブック編集を行いたいスクリプト・ノートブック・テスト・データパイプライン向けです。

::: tip 向いている用途
バッチジョブや分析ワークフローの一部にスプレッドシートが含まれるなら Python。ワークブックをブラウザ内にとどめたいなら WASM。
:::

::: info 用語: wasmtime
Bytecode Alliance がメンテナンスするスタンドアロン WebAssembly ランタイム。Formulon Python パッケージは `formulon_capi.wasm` を同梱し、インポート時に `wasmtime` でロードします。これによって wheel は `py3-none-any` 1 種類で済み、`wasmtime` の wheel が出ている OS であればどこでも動きます。
:::

::: info 用語: C ABI
Formulon のネイティブライブラリが公開するフラットな C 関数インターフェース。各バインディングはこの共有インターフェースを介してエンジンを呼びます。Python / CLI / WASM のどれも同じ C ABI の上に乗っています。詳しくは [C ABI](/ja/development/bindings)。
:::

典型用途:

- アップロードされたワークブックの数式検証
- 帳票・モデルのバッチ再計算
- ワークブック出力と期待値比較
- 計算結果を後続のシステムに渡す
- Python からシート構造、スタイル、コメント、入力規則、条件付き書式、ピボットテーブルを編集

ワークブックの入出力はスクリプトの端で行い、テスト用データでは選択プロファイルを明示してください。

## パッケージング

PyPI パッケージはプラットフォーム別の `libformulon` を同梱しません。`formulon_capi.wasm` と純 Python ラッパーを含む `py3-none-any` wheel で配布し、ロードを担うのは `wasmtime` です。実行時に Cython / pybind11 / NumPy への依存はありません。

## API 範囲

`Workbook` は、npm バインディングが公開する C ABI の実行入口をそのまま踏襲しています。`load -> mutate -> recalc -> save` に加えて、シート / 行列編集、定義名、部分再計算、ジオメトリ、ワークブックのテーマと実効スタイル、シート / テーブルの型付き AutoFilter、入力規則の検査、セル結合、コメントとスレッドコメントの人物、ハイパーリンク、入力規則、スタイル、条件付き書式の表示データ（`ColorScale`、`DataBar`、`IconSet`）、DXF、画像と描画オブジェクト、ピボットレポートのレイアウト、ピボットキャッシュのワークシート参照、ピボットテーブル、依存関係の追跡、スピル情報、関数メタデータ、シート表示 / 保護、計算ポリシー、外部リンクを扱えます。

テーブルは `table_create()` / `table_update()` / `table_remove()` で作成・更新・削除できます。`column_names` は `ref` の列幅と一致し、見出しセルは呼び出し側が書き込みます。`table_update()` で `None` にした項目は保持され、既存テーブルの AutoFilter は範囲を変更しても条件と拡張を保ちます。ワークシート単位の AutoFilter XML は `get_auto_filter_xml()` / `set_auto_filter_xml()` で `<autoFilter>` XML 断片をそのまま扱え、空文字列で削除できます。`add_hyperlink_range()` は両端を含む矩形にハイパーリンクを追加し、読み出した `Hyperlink` には `last_row` / `last_col` が入ります。

Python の `DataBar` は `x14` の全制御項目（`gradient`、`axis_position`（`0` は自動、`1` は中央、`2` はなし）、`negative_fill`、`border`、`negative_border`、`axis_color`）を公開します。省略時はモデルの既定値を使い、保存と読み込みをまたいで設定を保持します。API で新しく作成したピボットテーブルは、保存前に `set_pivot_cache_worksheet_source()` へ `PivotWorksheetSource(ref="A1:C10", sheet="Data")` を渡してください。ワークシート参照のない新規キャッシュの保存は失敗します。ファイルから読み込んだキャッシュは、対応する参照元のメタデータを保持します。参照元がワークシート以外や外部データの場合もあります。

Python はワークシートの表示メタデータも作成できます。`set_sheet_visibility()` に `SheetVisibility.VISIBLE`、`HIDDEN`、`VERY_HIDDEN` を渡し、`get_sheet_view()` で解決済みの 3 状態 `visibility` を読み出します。型付きの印刷設定には `set_page_setup()`、`set_page_margins()`、`set_print_options()`、`set_header_footer()`、`set_print_area()`、`set_print_titles()`、`add_row_break()`、`add_col_break()` を使います。`set_range_xf_index()` はセルスタイルの XF インデックスを両端を含む矩形へ適用し、存在しないセルをスタイル付きの空セルとして作成します。`pivot_field_add_item_at()` はキャッシュの共有項目インデックスで、空白のピボット項目を含む項目を指定できます。ラベル形式に空文字列を渡す方法では指定できません。

入力規則で `allow_blank` を省略した場合、Python の既定値は `False` です。空セルを許可する場合は `allow_blank=True` を指定してください。行 / 列の構造編集では、AutoFilter の `ref` 範囲とモデル化された条件・並べ替えのオフセットを移動したセルに合わせて組み替えます。未解析のワークシート XML はバイト列のまま保持します。

シートのジオメトリ（`get_cell_rect_pt`、幅・高さのヘルパー）、テーマの色・フォントと実効スタイル、型付き AutoFilter の評価、`validate_value()` / `list_invalid_cells()`、スレッドコメント、画像 / 描画オブジェクトも公開します。詳しくは [表示とレイアウト](/ja/workbook/presentation)、[フィルターと入力規則](/ja/workbook/filters-validation)、[コメントと画像](/ja/workbook/comments-images) を参照してください。

ワークブックに依存しないロケールヘルパーも `set_excel_profile_id()` と同じ完全な Excel プロファイル ID を使います。

```python
from formulon import Workbook

profile = "mac-365-de_DE"
display_text = Workbook.localize_formula("=SUM(1.5,TRUE)", profile)
stored_text = Workbook.canonicalize_formula(display_text, profile)
facts = Workbook.locale_facts(profile)
```

ヘルパーは表示ロケールの数式テキストを変換または調べます。ワークブックの状態は変更せず、評価を制御する設定は `set_excel_profile_id()` です。`Workbook.function_metadata()` はロケールに依存しない構造メタデータを返すため、説明文とシグネチャの翻訳は BCP-47 の UI ロケールを指定して `formulon.merge_function_metadata(..., locale)` で重ねてください。エンジンのプロファイルは 28 個あり、14 個の Mac と 14 個の Windows で構成されます。すべての Mac プロファイルと `win-365-ja_JP` は Excel との実測値、残り 13 個の Windows プロファイルは推定ロケールデータです。

主な実行時差分はスレッドの扱いです。Python は `wasmtime` 経由で C ABI の WASM ビルドを呼び出すため、`recalc()` は直列実行です。Python には `recalc_parallel()` / `recalcParallel()` API がありません。並列実行が必要な場合は `@libraz/formulon/threads`、Native Node、または CLI の `--threads` を使います。npm WASM の標準入口も直列実行です。同じエンジン・プロファイル・入力で結果が一致するよう共通コアを使いますが、各実行入口の互換性の制限は適用されます。対象のワークブックで結果を確認してください。

`set_formula()` は不正なテキストを `kParserUnexpectedToken` として拒否し、既存セルを変更しません。XLSX / XLSB に保存済みの不正な数式は読み込みでき、再計算すると `#NAME?` になります。単発の `eval_formula()` はアドホック評価のため、不正な入力を `#NAME?` の値として返します。

PyPI の WASM ビルドはワークシート XML を DOM として読み込みます。シートを 1 枚ずつ処理するため、解析時のピークメモリは最大のワークシート XML に比例し、32-bit WASM アドレス空間内に収める必要があります。Native CLI は 256 KiB を超える XML でストリーミングに切り替えます。どの実行環境でも、まずワークシートのパートを丸ごとメモリに展開します（zip の展開上限は 1 エントリ 100 MiB、1 回の読み込みで 256 MiB）。そのため CLI のストリーミング解析でも、省けるのは DOM ツリーだけで、展開済みのバッファは保持します。

::: info Python の評価とワークブック API
Python は `evaluate_formula_array(sheet, row, col, formula)` で配列全体を返し、`evaluate_cf_formula(sheet, row, col, anchor_row, anchor_col, formula)` で条件付き書式を評価します。一般的なスカラー `evaluate_formula_text` は公開していません。コメントは `comment_count(sheet)` / `get_comments(sheet)` で列挙でき、画像と描画オブジェクトにも型付きアクセサーがあり、`paginate(sheet)` はページ形状を返します。`error_display_name(error_code)` はエラーコードの Excel 表示文字列を返します。
Python はワークブック機能の大部分を同等に扱いますが、C ABI のすべてのエントリーポイントをそのまま公開するわけではありません。反復進捗コールバックは Python にはありません。ふりがなテキストは `set_phonetic()` / `get_phonetic()` で取得・設定できます。UTF-16 の区間を保った読み仮名には `set_phonetic_runs()` / `get_phonetic_runs()` を使い、表示用のフォント、かな種別、配置は `set_phonetic_properties()` / `get_phonetic_properties()` で扱います。セルの値を書き換えると読み仮名の区間とプロパティは消去されます。ワークブックの文脈で一般的なスカラーを評価する場合は、変更して再計算してください。
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

`FormulonError` はホスト操作の失敗（バイト列不正・ハンドル失効・入出力失敗・エンジン内部失敗）を表します。Excel のセルエラーは `Value(kind=ValueKind.ERROR)` として返ります。

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

`Workbook` はコンテキストマネージャーとして使います。ブロック内で例外が出てもネイティブハンドルは確実に解放されます。

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
