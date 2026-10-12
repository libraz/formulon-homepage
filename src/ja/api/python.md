# Python API

Python パッケージは、`formulon_capi.wasm` にコンパイルされた Formulon C ABI を呼ぶ Python 向けラッパーです。公開 wheel は `py3-none-any` 形式で、pip が実行環境に合う `wasmtime` wheel をインストールします。

::: info 用語: py3-none-any wheel
Python ABI タグ・プラットフォームタグ・ネイティブコードのいずれも持たない wheel。互換する `wasmtime` wheel が利用できる CPython 3.9 以降で動作します。プラットフォーム依存部分は `wasmtime` が担い、`formulon` 自体には含まれません。
:::

## トップレベル API

| API | 用途 |
| --- | --- |
| `formulon.eval_formula(formula)` | 単発の数式評価 |
| `formulon.error_display_name(error_code)` | エラーコードを Excel の表示文字列へ変換 |
| `formulon.library_version()` | ロード済み Formulon モジュールのバージョン |
| `formulon.version_string()` | `library_version()` の別名 |
| `formulon.set_log_min_level(level)` | エンジンのログを出す閾値をプロセス全体で設定します。既定の `LogLevel.OFF` では何も出力せず、`WARN` 以下にすると 1 行 1 件の JSON を stderr に書きます。独自のログ出力先コールバックはバインドしていません |
| `formulon.merge_function_metadata(base, entry, locale)` | ロケールに依存しないエンジンの構造カタログへ、ホスト提供のローカライズ済みメタデータを重ねる純関数。`locale` は BCP-47 の表示ロケール |
| `ValueKind` | C ABI と一致する enum |
| `FormulonError` | ホスト側の失敗を表す例外 |

パッケージは、ワークブックのレコードで使う enum も公開します。

| 分野 | enum |
| --- | --- |
| 寸法と表示 | `GeometryMode`（`DISPLAY = 0`、`PRINT = 1`）、`DisplayStatus`（`OK = 0`、`OVERFLOW = 1`、`INVALID_FORMAT = 2`） |
| AutoFilter | `FilterKind`、`FilterOperator`、`DynamicFilterType`、`SortBy`、`SortMethod`、`DateTimeGrouping` |
| 入力規則 | `ValidationErrorStyle`（`STOP = 0`、`WARNING = 1`、`INFORMATION = 2`） |
| テーマとスタイル | `ColorContext`、`ColorResolution`、`ThemeSource`、`EffectiveStyleSource` |
| 画像と描画 | `ImageFormat`、`DrawingObjectKind`、`AnchorKind`、`AnchorEditAs` |
| テキスト照合 | `CollationStrength`（`COMPARE = 0`、`DYNAMIC = 1`、`CLASSIC_EXACT = 2`） |
| ワークブック状態 | `CalcMode`、`SheetVisibility`、`WorkbookFormat` |

関数カタログは役割ごとに分かれています。`Workbook.function_metadata(name)` は正規名、引数数、利用可能性などの構造フィールドだけを返し、人間向けのシグネチャと説明は `None` です。Excel の表示名と数式テキストはプロファイル単位のヘルパーで変換し、説明文の翻訳はホスト側の BCP-47 UI ロケールを指定して `merge_function_metadata()` に渡してください。

## Workbook クラス

```python
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_formula(0, 0, 0, "=SUM(1,2,3)")
    wb.recalc()
    print(wb.get_value(0, 0, 0).to_python())
```

ファクトリ:

- `Workbook.create_default()`
- `Workbook.create_for_profile(profile_id)`
- `Workbook.create_empty()`
- `Workbook.load(data)`

`create_default()` は Calibri 11 を含む通常の 1 シートワークブックを作成します。`create_for_profile(profile_id)` は選択したプロファイルを記録し、本文用フォントと必要なロケールのふりがな用フォント、ローカライズされた `Normal` スタイルと最初のシート名、セル XF の配置、ふりがな設定、ページ余白、Mac の行の高さと基本列幅を設定します。テーマパートは書き出さないため、新しいワークブックは既定の Office テーマとして読み取られます。Windows の行と列の寸法はエンジンの既定値を使います。

主なメソッド:

- `sheet_count()`, `sheet_name(index)`, `add_sheet(name)`
- `set_number`, `set_bool`, `set_text`, `set_blank`, `set_formula`
- `get_value`, `lambda_text_at`, `evaluate_formula_array`
- `recalc`, `partial_recalc`, `set_iterative`, `get_iterative`
- `pinned_now`, `set_pinned_now`, `clear_pinned_now`
- `save`, `save_as(fmt)`（XLSX / XLSB のコンテナ形式を選択）
- `save_with_diagnostics(fmt)`, `read_diagnostics()`
- `iter_cells`, `iter_defined_names`, `iter_tables`, `iter_passthrough`
- シート構造編集、行 / 列編集、定義名
- セル結合、`get_comment` / `set_comment`、`comment_count` / `get_comments`、ハイパーリンク、入力規則
- `evaluate_cf_formula`、条件付き書式の表示データ（`ColorScale`、`DataBar`、`IconSet`）、DXF、`paginate`
- スタイル、行 / 列スタイルの上書き、範囲スタイルの置換とスナップショット、`set_range_xf_index`、条件付き書式、シート表示 / 保護、3 状態の表示状態
- 型付き印刷設定（`set_page_setup`、`set_page_margins`、`set_print_options`、`set_header_footer`、印刷範囲 / タイトル、行 / 列改ページ）
- ピボットキャッシュ / テーブル API（ワークシート参照、キャッシュの共有項目インデックスによるフィルター、ピボットレポートのレイアウトを含む）、依存関係の追跡、スピル情報、関数メタデータ、DXF

プロファイルと数式テキストのヘルパーは、ワークブックに依存しない静的メソッドとしても利用できます。

```python
from formulon import Workbook

profile = "mac-365-de_DE"
shown = Workbook.localize_formula("=SUM(1.5,TRUE)", profile)
stored = Workbook.canonicalize_formula(shown, profile)
facts = Workbook.locale_facts(profile)
print(shown, stored, facts.decimal_separator, facts.true_name)
```

`localize_function_name()` / `canonicalize_function_name()` は 1 つの関数名を変換します。`localize_formula()` は関数名、リスト / 配列区切り、少数点、真偽値名、エラー名を変換し、文字列、引用符付きシート名、外部修飾子、構造化参照の角括弧を保持します。`canonicalize_formula()` はこの変換を戻します。これらは数値ロケールコードではなく完全なプロファイル ID を受け取り、数式の検証や登録は行いません。プロファイルは 28 個あり、ロケール情報はすべての `mac-*` と `win-365-ja_JP` で Excel の実測値、残り 13 個の Windows プロファイルは推定値です。`LocaleFacts.collation_measured` は別の項目で、テキスト照合の実測値を持つのは `mac-*` だけです。

`Workbook.compare_text(a, b, strength, profile_id)` は選択したテキストの折りたたみ方で `-1`、`0`、`1` を返します。`CollationStrength` は通常の比較、動的配列の検索、従来の完全一致検索で使う折りたたみ方を選びます。`Workbook.collation_classes(values, strength, profile_id)` は `CollationClasses` として、SORT の順序（数値、テキスト、真偽値、エラー、空白）で密なクラス ID を返します。同じ ID になるのは `ValueKind` も一致する値だけです。テキストは選択した強度で比較し、`-0` と `0` は同じ数値、空白は 1 クラスです。ID は 1 回の呼び出しの中だけで意味を持つため、保存済みの値と現在の値を同じ呼び出しで分類して選択を照合してください。

```python
from formulon import CollationStrength, Value, ValueKind, Workbook

profile = "mac-365-en_US"
order = Workbook.compare_text("a", "b", CollationStrength.COMPARE, profile)
values = [Value(kind=ValueKind.TEXT, text="A"), Value(kind=ValueKind.TEXT, text="a")]
classes = Workbook.collation_classes(values, CollationStrength.DYNAMIC, profile)
print(order, classes.class_ids, classes.class_count)
```

新しいワークブックメソッドを対象ごとにまとめます。

| 分類 | メソッド |
| --- | --- |
| 範囲 | `get_formula`、`get_formula_r1c1`、`get_cells_in_range`、`get_merges_in_range`、`set_range_xf_index`、`list_invalid_cells` |
| テキスト照合 | `compare_text`、`collation_classes` |
| 寸法とレイアウト | `get_cell_rect_pt`、`get_column_width_pt`、`get_row_height_pt`、`get_width_model`、`column_chars_to_pt`、`column_pt_to_chars`、シート表示、保護、行 / 列レイアウト、型付き印刷設定 |
| 表示 | `get_display_text`、`format_value` |
| テーマとスタイル | `get_theme`、`set_theme_colors`、`set_theme_fonts`、`set_theme_script_font`、`resolve_color`、`get_effective_style`、行 / 列スタイルの設定と解除、`get_cell_xf_index`、`set_cell_xf_index`、`clear_cell_xf_index`、`set_range_xf_index`、`range_style_bases`、`remap_range_style`、`snapshot_range_style`、`restore_range_style`、`set_cell_style`、`remove_cell_style` |
| フィルター | `get_auto_filter` / `set_auto_filter` / `remove_auto_filter`、`apply_auto_filter`、`clear_auto_filter`、`evaluate_auto_filter`、テーブル向けの対応 API |
| 入力規則 | `get_validations`、`add_validation`、`remove_validation_at`、`clear_validations`、`validate_value`、`list_invalid_cells` |
| スレッドコメント | `get_threaded_comments`、`add_threaded_comment`、`edit_threaded_comment`、`set_thread_resolved`、`remove_threaded_comment`、`get_persons`、`add_person`、`remove_person` |
| 画像と描画 | `probe_image`、`list_drawing_objects`、`get_image`、`insert_image`、`remove_image` |

`CellStyle` は `set_cell_style()` と `get_cell_style()` が使う名前付きスタイルのレコードです。フィールドは `name`、`xf_id`、`builtin_id`、`i_level`、`hidden`、`custom_builtin` で、`name` と `xf_id` は必須です。それ以外はデータクラスの既定値を使います。カスタムスタイルでは `builtin_id` を既定値のままにしてください。`xf_id` は名前付きスタイルの XF テーブルを指し、セル単位の XF テーブルは指しません。

`set_column_style()` / `clear_column_style()` と `set_row_style()` / `clear_row_style()` は、行または列のほかの属性を残してセル書式 XF だけを設定または解除します。インデックス `0` は既定 XF です。`clear_cell_xf_index()` はセルの明示的な割り当てを解除し、空白セルが行、列、ワークブックの既定値を継承できるようにします。`set_cell_xf_index(..., 0)` は明示的な Normal XF を残すため、解除とは異なります。`get_effective_style().source` でその違いを確認できます。`range_style_bases()` は選択範囲のセルが実際に解決する XF を返し、各基底を変更した XF に対応付けて `remap_range_style()` に渡します。`snapshot_range_style()` / `restore_range_style()` は値と数式を変えずにスタイルを元へ戻すために使います。選択範囲の規則は [ワークブック操作](/ja/workbook/operations) を参照してください。

`get_theme()` はテーマ内の順序で `major_scripts` と `minor_scripts` を返し、テーマパートがない場合も既定の Office テーマにある 47 個のスクリプト項目を返します。`set_theme_script_font(major, script, typeface)` は 1 つのスクリプトを変更または追加します。読み取り時は、`Jpan` の項目が対応する東アジア書体として使われるのは、そのフォントセットの `<a:ea typeface>` が空の場合だけです。`<a:ea typeface>` に明示値があれば、そちらが優先されます。`script` は 4 個の ASCII 英字、`typeface` は空でない文字列にしてください。

::: tip ライフタイムはコンテキストマネージャーで管理する
`with` ブロックを抜けるとネイティブハンドルが解放されます。例外が出ても解放されるため、`Workbook` の参照を `with` の外で使わないでください。
:::

::: info Python の評価境界
Python は `evaluate_formula_array(sheet, row, col, formula)` で配列全体を返し、`evaluate_cf_formula(sheet, row, col, anchor_row, anchor_col, formula)` で条件付き書式の述語を評価します。一般的なスカラー `evaluate_formula_text` は公開していません。`comment_count(sheet)` / `get_comments(sheet)` でコメントを列挙でき、`paginate(sheet)` はページ形状と改ページ情報を含む完全な `PaginationResult` を返します。
:::

`get_iterative()` は `set_iterative()` 後の `{ enabled, max_iterations, max_change }` を返します。エンジンは `max_iterations` を `32767` までに制限し、制限後の値を報告します。`set_sheet_visibility()` は `SheetVisibility.VISIBLE`、`HIDDEN`、`VERY_HIDDEN` を受け取り、`get_sheet_view()` は `tab_hidden` に加えて解決済みの 3 状態を返します。`pivot_field_add_item_at()` はキャッシュの共有項目インデックスで手動フィルター項目を指定でき、空白の項目も表現できます。`pivot_field_add_item()` に空のラベルを渡す方法では空白の項目を指定できません。`set_iterative_enabled(enabled)` と `add_batch()` は Python だけのバインディングです。前者は保存済みの上限と閾値を保ったまま反復計算を切り替え、後者はフォント・塗りつぶし・罫線・表示形式・XF を 1 回の呼び出しで登録します。

ワークシートの印刷設定は `set_page_setup()`、`set_page_margins()`、`set_print_options()`、`set_header_footer()`、`set_print_area()`、`set_print_titles()`、`add_row_break()`、`add_col_break()` で作成します。`set_range_xf_index()` はセル書式（XF）インデックスを両端を含む矩形へ適用し、存在しないセルを書式付きの空セルとして作成します。`DataValidationInput` の `allow_blank` を省略した既定値は `False` です。空セルを許可する場合は `allow_blank=True` を指定してください。

`get_cells_in_range(sheet, cell_range, cursor=None, limit=None)` は、行・列の順序で `(cells, next_cursor)` を返します。各 `Cell` は `row`、`col`、`formula`、`value` を持ちます。`next_cursor` が `None` になるまで次の呼び出しへ渡してください。`limit` の省略または 0 は最大 65,536 件を選びます。数式セル、空白でない値、スピルの仮想セルを含み、スタイルだけを持つ空セルは含みません。`list_invalid_cells()` も同じページング規則に従います。

寸法メソッドは 96 DPI の画面向けモデルに `GeometryMode.DISPLAY`、ページ分割に使う DPI に依存しないモデルに `GeometryMode.PRINT` を指定します。`get_display_text()` と `format_value()` は、値が書式の表現可能な範囲を外れると `DisplayStatus.OVERFLOW` と `########` を返し、書式コードが不正な場合は `DisplayStatus.INVALID_FORMAT` として General 表示へフォールバックします。

`probe_image()` はワークブックを変更せず、PNG、JPEG、GIF、BMP の画像形式と寸法を読み取ります。`list_drawing_objects()` はシートのアンカー付きオブジェクトを文書順で返します。`get_image()` は画像バイト列をコピーし、`insert_image()` は既存の描画を保持します。`remove_image()` は画像を削除し、他のオブジェクトがメディアを参照しなくなった場合にメディアも解放します。スレッドコメント API は返信と人物レコードを含み、コメントやメンションが参照している人物は削除できません。

AutoFilter の条件と行の表示状態は別に管理します。`evaluate_auto_filter()` で一致結果を確認し、`apply_auto_filter()` で非表示行を更新してください。`clear_auto_filter()` は範囲を残したまま条件を削除します。入力規則 API は値を保存せずに候補値を検証し、`list_invalid_cells()` は既存の違反を列挙します。

`paginate(sheet)` は `page_count`、`print_area`、`horizontal_breaks`、`vertical_breaks`、`paper`、`margins`、`printable`、`scale`、`page_order`、`print_titles`、`pages`、`horizontal_break_manual`、`vertical_break_manual` を持つ `PaginationResult` を返します。`paper` はポイント単位の寸法、向き、用紙コードを認識できたかを持ちます。`pages` の各 `PageLayout` は `area_index`、両端を含むセル範囲、原点、拡大縮小後の寸法を持ちます。印刷範囲の指定がない場合も `print_area` は空のままですが、ページ分割は使用範囲へフォールバックします。手動改ページのリストは対応する改ページリストと同じ順序です。

`set_formula()` は不正な数式を `kParserUnexpectedToken` として拒否し、既存の数式とキャッシュ値を変更しません。保存済みの XLSX / XLSB に不正な数式が含まれる場合は読み込みできますが、`recalc()` 後のセル値は `#NAME?` になります。単発の `eval_formula()` はアドホック評価のため、不正な入力を `#NAME?` の値として返します。

正確なメソッド一覧は、パッケージに含まれる type stub と docstring を確認してください。

`iter_cells(sheet)` は、書式だけの空白セル、`set_blank` で書き込んだセル、スピル先のセルを含む書き込み済み座標を `(row, col)` の昇順で列挙します。未書き込みの隙間は含みません。列挙中はシートを変更しないでください。`get_cells_in_range()` とは異なり、明示的に書き込んだ空白セルも対象です。詳しくは [ワークブック操作](/ja/workbook/operations)を参照してください。

## 保存時の診断

`save_with_diagnostics(fmt)` は、保存した `bytes` と書き出し側が検出した損失・保存時に出力されなかった機能のカウンターを持つ `SaveDiagnostics` を返します。`read_diagnostics()` は、ワークブックの読み込み時に取得したカウンターを持つ `ReadDiagnostics` を返します。カウンターの対象は一部の損失だけです。すべて 0 であることは、記載された損失が発生しなかったことを示しますが、パッケージをバイト単位で比較したことや、診断イベントが一切なかったことは示しません。

| 結果 | フィールド | 意味 |
| --- | --- | --- |
| `SaveDiagnostics` | `downgraded_formula_count` | キャッシュ済みリテラルとして出力された数式セルの数。XLSX では常に 0 です。 |
|  | `deferred_feature_count` | レコードへ変換されなかったシート機能の数。XLSX では常に 0 です。 |
|  | `dropped_part_count` | いずれかの書き出し側が破棄した、そのまま保持していたパートの数。 |
|  | `dropped_relationship_count` | 対象パートの破棄に伴って破棄された関連付けの数。`dropped_part_count` と同じ損失を表す場合があります。 |
|  | `renumbered_part_count` | 書き出し側が割り当てたパート ID で出力されたテーブルの数。XLSB では常に 0 です。 |
| `ReadDiagnostics` | `undecoded_formula_count` | デコードできなかった保存済み数式の数。XLSB のみです。 |
|  | `undecoded_defined_name_count` | デコードできずにスキップされた定義名の数。XLSB のみです。 |
|  | `undecoded_part_count` | コンテンツタイプを解決できなかった XLSB パッケージパートの数。 |
|  | `skipped_feature_count` | 参照が利用できずスキップされた OOXML の表示オーバーレイ項目の数。 |
|  | `unknown_content_type_count` | コンテンツタイプを認識できなかった OOXML ワークブックパートの数。 |

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

ワークブックが固定されていない場合、`NOW()`、`TODAY()`、ピボットの相対期間フィルターはホストの時計を読み取ります。これらの結果を 1 回の再計算で一致させる場合や、ホストをまたいで再現する場合は、ワークブックを 1 つの年月日・時分秒の値に固定してください。

```python
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_pinned_now(2026, 8, 19, 12, 0, 0)
    print(wb.pinned_now())  # CivilTime(year, month, day, hour, minute, second)
    wb.recalc()
    wb.clear_pinned_now()
```

`pinned_now()` は `CivilTime` オブジェクトを返し、ワークブックがホストの時計に従う場合は `None` を返します。`set_pinned_now()` は `year` 1900–9999、`month` 1–12、月ごとの実在する日、`hour` 0–23、`minute` / `second` 0–59 を検証します。不正な値は正規化せず、`FormulonError` を送出します。値はタイムスタンプではなく、年月日・時分秒の値として保持するため、タイムゾーンの解釈はありません。固定の設定・解除ではキャッシュ済みの数式値を再計算しないため、必要に応じて `recalc()` を明示的に呼び出してください。固定はファイル状態ではなくワークブックのモデル状態です。保存時には記録されず、読み込み直後のワークブックは固定されていません。

## 値

`Value.to_python()` は空白、数値、真偽値、テキストを Python 型（`None` / `float` / `bool` / `str`）に変換します。エラー、配列、参照、ラムダは `Value` ラッパーのまま返るので、`kind` とデータを確認できます。

```python
value = wb.get_value(0, 0, 0)
if value.kind is ValueKind.NUMBER:
    print(value.number)
elif value.kind is ValueKind.ERROR:
    print(formulon.error_display_name(value.error_code))
```

Python の `Value` が持つのは `error_code` だけで、`error_text` というフィールドはありません。`formulon.error_display_name(value.error_code)` で `#DIV/0!` や `#VALUE!` の表示文字列を得られます。

## エラー処理

`FormulonError` はホスト側の失敗（バイト列不正・ハンドル失効・入出力エラー・エンジン内部失敗）を表します。Excel のセルエラーは値です。

```python
import formulon
from formulon import Workbook, ValueKind, FormulonError

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

- [ワークブックの流れ](/ja/workbook/lifecycle) ─ 開く / 変更 / 再計算 / 保存
- [表示とレイアウト](/ja/workbook/presentation) ─ 表示文字列、テーマ、スタイル、寸法、ページ分割
- [フィルターと入力規則](/ja/workbook/filters-validation) ─ AutoFilter と候補値の検証
- [コメントと画像](/ja/workbook/comments-images) ─ スレッドコメント、人物、描画オブジェクト、画像
- [Python で一括再計算](/ja/scenarios/python-batch) ─ 一連のパイプライン
