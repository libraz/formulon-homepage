<script setup>
import reference from '@/data/api-reference.json'
</script>

# Python API

Python パッケージは、`formulon_capi.wasm` にコンパイルされた Formulon C ABI を呼ぶ Python 向けラッパーです。公開 wheel は `py3-none-any` 形式で、pip が実行環境に合う `wasmtime` wheel をインストールします。

::: info 用語: py3-none-any wheel
Python ABI タグ・プラットフォームタグ・ネイティブコードのいずれも持たない wheel。互換する `wasmtime` wheel が利用できる CPython 3.9 以降で動作します。プラットフォーム依存部分は `wasmtime` が担い、`formulon` 自体には含まれません。
:::

## トップレベル API

モジュール関数（`formulon.eval_formula`、`formulon.error_display_name`、`formulon.merge_function_metadata`、`formulon.library_version`、その別名の `formulon.version_string`、`formulon.set_log_min_level`）は、ワークブックのメソッドと一緒に [関数とメソッド](#functions-and-methods) に載せています。`formulon.__version__` はインストール済みパッケージのバージョンです。`set_log_min_level()` はプロセス全体に効きます。既定の `LogLevel.OFF` では何も出力せず、`WARN` 以下にすると 1 行 1 件の JSON を stderr に書きます。Python にはログの受け取り先を渡すコールバックはありません。主な型は、ワークブックのハンドル `Workbook`、セル値のレコード `Value` とその種類を表す enum `ValueKind`、ホスト側の失敗を表す例外 `FormulonError` です。

パッケージは、ワークブックのメソッドが使う enum とデータクラスのレコード（`Cell`、`Comment`、`ConditionalFormat`、`DataValidation`、`PaginationResult`、`PivotLayout`、`Theme` など。一覧は `formulon.__all__`）も公開します。

| 分野 | enum |
| --- | --- |
| 値 | `ErrorCode`（`NULL = 0`、`DIV0 = 1`、… `UNKNOWN = 16`） |
| 寸法と表示 | `GeometryMode`（`DISPLAY = 0`、`PRINT = 1`）、`DisplayStatus`（`OK = 0`、`OVERFLOW = 1`、`INVALID_FORMAT = 2`） |
| AutoFilter | `FilterKind`、`FilterOperator`、`DynamicFilterType`、`SortBy`、`SortMethod`、`DateTimeGrouping` |
| 入力規則 | `ValidationErrorStyle`（`STOP = 0`、`WARNING = 1`、`INFORMATION = 2`） |
| テーマとスタイル | `ColorContext`、`ColorResolution`、`ThemeSource`、`EffectiveStyleSource` |
| 画像と描画 | `ImageFormat`、`DrawingObjectKind`、`AnchorKind`、`AnchorEditAs` |
| ピボットテーブル | `PivotAxis`、`PivotAggregation`、`PivotShowValuesAs`、`PivotFilterType`、`PivotFilterValueKind`、`PivotDateGrouping`、`PivotCalendar`、`PivotReportLayout`、`PivotCellKind` |
| テキスト照合 | `CollationStrength`（`COMPARE = 0`、`DYNAMIC = 1`、`CLASSIC_EXACT = 2`） |
| ワークブック状態 | `CalcMode`、`SheetVisibility`、`WorkbookFormat`、`ExternalLinkKind` |
| ログ | `LogLevel`（`DEBUG = 0`、`INFO = 1`、`WARN = 2`、`ERROR = 3`、`OFF = 4`） |

関数カタログは役割ごとに分かれています。`Workbook.function_metadata(name)` は正規名、引数数、利用可能性などの構造フィールドだけを返し、人間向けのシグネチャと説明は `None` です。Excel の表示名と数式テキストはプロファイル単位のヘルパーで変換し、説明文の翻訳はホスト側の BCP-47 UI ロケールを指定して `merge_function_metadata()` に渡してください。

## Workbook クラス

```python
from formulon import Workbook

with Workbook.create_default() as wb:
    wb.set_formula(0, 0, 0, "=SUM(1,2,3)")
    wb.recalc()
    print(wb.get_value(0, 0, 0).to_python())
```

`create_default()` は Calibri 11 を含む通常の 1 シートワークブックを作成します。`create_for_profile(profile_id)` は選択したプロファイルを記録し、本文用フォントと必要なロケールのふりがな用フォント、ローカライズされた `Normal` スタイルと最初のシート名、セル XF の配置、ふりがな設定、ページ余白、Mac の行の高さと基本列幅を設定します。テーマパートは書き出さないため、新しいワークブックは既定の Office テーマとして読み取られます。Windows の行と列の寸法はエンジンの既定値を使います。

プロファイルと数式テキストのヘルパーは、ワークブックに依存しない静的メソッドです。

```python
from formulon import Workbook

profile = "mac-365-de_DE"
shown = Workbook.localize_formula("=SUM(1.5,TRUE)", profile)
stored = Workbook.canonicalize_formula(shown, profile)
facts = Workbook.locale_facts(profile)
print(shown, stored, facts.decimal_separator, facts.true_name)
```

`localize_function_name()` / `canonicalize_function_name()` は 1 つの関数名を変換します。`localize_formula()` は関数名、リスト / 配列区切り、小数点、真偽値名、エラー名を変換し、文字列、引用符付きシート名、外部修飾子、構造化参照の角括弧を保持します。`canonicalize_formula()` はこの変換を戻します。これらは数値ロケールコードではなく完全なプロファイル ID を受け取り、数式の検証や登録は行いません。プロファイルは 28 個あり、ロケール情報はすべての `mac-*` と `win-365-ja_JP` で Excel の実測値、残り 13 個の Windows プロファイルは推定値です。`LocaleFacts.collation_measured` は別の項目で、テキスト照合の実測値を持つのは `mac-*` だけです。

`Workbook.compare_text(a, b, strength, profile_id)` は `-1`、`0`、`1` のいずれかを返します。`Workbook.collation_classes(values, strength, profile_id)` は `CollationClasses(class_ids, class_count)` を返します。ID は `Value` ごとに 1 つ、SORT の順序で昇順に振られ、その呼び出しの中だけで意味を持ちます。`CollationStrength` ごとの比較規則とクラスの規則は [テキスト照合](/ja/compatibility/text-collation) を参照してください。

```python
from formulon import CollationStrength, Value, ValueKind, Workbook

profile = "mac-365-en_US"
order = Workbook.compare_text("a", "b", CollationStrength.COMPARE, profile)
values = [Value(kind=ValueKind.TEXT, text="A"), Value(kind=ValueKind.TEXT, text="a")]
classes = Workbook.collation_classes(values, CollationStrength.DYNAMIC, profile)
print(order, classes.class_ids, classes.class_count)
```

## 関数とメソッド {#functions-and-methods}

パッケージの type stub（`formulon/__init__.pyi`）と formulon ソースの docstring から生成した一覧です。`formulon.` で始まる名前はモジュール関数、`Workbook.` で始まる名前はクラスメソッドまたは静的メソッドで、それ以外はすべて `Workbook` インスタンスのメソッドです。`is_valid` はプロパティです。`= ...` は stub と同じく既定値のある引数を表します。説明列は docstring の最初の 1 文で、API 自身の英語のテキストをそのまま載せています。`Workbook` はコンテキストマネージャーでもあり、`with` ブロックを抜けると `close()` が呼ばれます。

::: info 参照元
この一覧は、ドキュメント対象 {{ reference.version }} のコアソースから生成しています。<a :href="`https://github.com/libraz/formulon/commit/${reference.source.commit}`">取得元のコミット</a>を固定し、WASM・Python・C の宣言を同じリビジョンで照合しています。デモは公開済みパッケージを使い、実行バージョンを別に表示します。
:::

### ライブラリ、診断、ログ {#library}

<ApiReferenceTable surface="python" family="library" />

### ワークブックのライフサイクルと入出力 {#lifecycle}

<ApiReferenceTable surface="python" family="lifecycle" />

### シートと構造 {#sheets}

<ApiReferenceTable surface="python" family="sheets" />

### セル {#cells}

<ApiReferenceTable surface="python" family="cells" />

### 再計算 {#calculation}

<ApiReferenceTable surface="python" family="calculation" />

### 読み取り専用の評価 {#evaluation}

<ApiReferenceTable surface="python" family="evaluation" />

### プロファイル、ロケール、テキスト {#profiles}

<ApiReferenceTable surface="python" family="profiles" />

### 定義名 {#names}

<ApiReferenceTable surface="python" family="names" />

### テーブル {#tables}

<ApiReferenceTable surface="python" family="tables" />

### 依存関係、スピル、外部リンク {#dependencies}

<ApiReferenceTable surface="python" family="dependencies" />

### シートの表示と保護 {#view}

<ApiReferenceTable surface="python" family="view" />

### 行、列、ジオメトリ {#rows-columns}

<ApiReferenceTable surface="python" family="rows-columns" />

### 表示テキスト {#display}

<ApiReferenceTable surface="python" family="display" />

### スタイル {#styles}

<ApiReferenceTable surface="python" family="styles" />

### テーマと色 {#themes}

<ApiReferenceTable surface="python" family="themes" />

### セルの結合 {#merges}

<ApiReferenceTable surface="python" family="merges" />

### コメントとハイパーリンク {#comments-links}

<ApiReferenceTable surface="python" family="comments-links" />

### スレッド形式のコメントと人物 {#threaded-comments}

<ApiReferenceTable surface="python" family="threaded-comments" />

### オートフィルター {#filters}

<ApiReferenceTable surface="python" family="filters" />

### データの入力規則 {#validation}

<ApiReferenceTable surface="python" family="validation" />

### 条件付き書式 {#conditional-formats}

<ApiReferenceTable surface="python" family="conditional-formats" />

### 画像と描画オブジェクト {#images}

<ApiReferenceTable surface="python" family="images" />

### グラフ {#charts}

<ApiReferenceTable surface="python" family="charts" />

### 印刷設定とページ分割 {#print}

<ApiReferenceTable surface="python" family="print" />

### ピボットテーブル {#pivots}

<ApiReferenceTable surface="python" family="pivots" />

### ピボットキャッシュ {#pivot-caches}

<ApiReferenceTable surface="python" family="pivot-caches" />

## メソッドの補足

`CellStyle` は `set_cell_style()` と `get_cell_style()` が使う名前付きスタイルのレコードです。フィールドは `name`、`xf_id`、`builtin_id`、`i_level`、`hidden`、`custom_builtin` で、`name` と `xf_id` は必須です。それ以外はデータクラスの既定値を使います。カスタムスタイルでは `builtin_id` を既定値のままにしてください。`xf_id` は名前付きスタイルの XF テーブルを指し、セル単位の XF テーブルは指しません。

行と列のスタイル、`clear_cell_xf_index()` と `set_cell_xf_index(..., 0)` の違い、`range_style_bases()` → `remap_range_style()` による変更と、その取り消しに使う `snapshot_range_style()` / `restore_range_style()` は [ワークブック操作](/ja/workbook/operations) の規則に従います。`get_theme()` は `major_scripts` と `minor_scripts` を返します。スクリプト別フォントの規則は [表示とレイアウト](/ja/workbook/presentation) を参照してください。

Python にはスカラーの `evaluate_formula_text()` がありません。`evaluate_formula_array(sheet, row, col, formula)` は結果全体を読み取り専用で返し、`evaluate_cf_formula(sheet, row, col, anchor_row, anchor_col, formula)` は条件付き書式の条件式を評価します。

`get_iterative()` は `IterativeSettings(enabled, max_iterations, max_change)` を返します。エンジンは `max_iterations` を `32767` までに制限し、制限後の値を返します。`set_iterative_enabled(enabled)` は保存済みの上限と閾値を保ったまま反復計算を切り替え、`add_batch()` はフォント、塗りつぶし、罫線、表示形式、XF を 1 回の呼び出しで登録します。

`set_calc_mode(mode)` は `CalcMode` を受け取ります。`AUTO_NO_TABLE` では、`recalc_data_tables()` を呼ぶまで `recalc()` はデータテーブルの結果を計算しません。`full_precision()`、`calc_on_save()`、`ref_mode()`、`date1904()` は対応する `<calcPr>` と `<workbookPr>` の設定を読み、それぞれに `set_` 版があります。`<calcPr>` のその他の属性は再保存しても保持されます。

`active_sheet()` / `set_active_sheet(sheet)` はアクティブタブを読み書きします。設定すると `tabSelected` も移り、非表示シートは拒否されます。アクティブなシートを非表示にするか削除すると、右隣の次の表示シート、なければ左側で最も近い表示シートがアクティブになります。`set_sheet_top_left()` と `set_sheet_pane_top_left()` はビューと右下ペインのスクロール原点を設定し、`get_sheet_selection()` / `set_sheet_selection()` は各ペインの選択範囲を扱います。`set_sheet_split(sheet, x_twips, y_twips)` は、固定せずに twips 単位の位置でビューを分割します。分割は固定を置き換え、固定も分割を置き換え、`0, 0` で分割を解除します。ビューに存在しないペインの選択は保存時に捨てられ、選択範囲のどれにも入らないアクティブセルは最初の範囲の左上へ移ります。`get_sheet_view()` は `show_formulas` と `show_outline_symbols` を返し、`set_sheet_show_formulas()` と `set_sheet_show_outline_symbols()` で設定できます。

`set_row_collapsed()` と `set_column_collapsed()` は、行・列の上書き設定の getter が返すアウトラインの `collapsed` フラグを設定します。`outlineLevelRow` と `outlineLevelCol` は、保存のたびに最も深いレベルから導出します。7 を超えるアウトラインレベルは `FormulonError` を送出します。

`add_data_table()`、`get_data_table(sheet, row, col)`、`remove_data_table(sheet, row, col)` は What-If データテーブル（`<f t="dataTable">`）を扱います。`recalc()` は、入力セルに値を順に代入し、それを読むセルを再計算して入力を元に戻すことで、1 変数（列入力または行入力）と 2 変数のテーブルを埋めます。結果セルへの書き込みは `kPreconditionFailed` の `FormulonError` になり、テーブルまたはその見出し行・列を横切る行・列の挿入と削除も同様です。結果セルは数式 getter で `=TABLE(row_input,col_input)` を返し、`FORMULATEXT` は `{=TABLE(...)}`、`ISFORMULA` は TRUE を返します。

`list_shapes()`、`insert_shape()`、`update_shape()`、`remove_shape()` は、シートの描画に含まれる `xdr:sp` の図形とテキストボックス、`xdr:cxnSp` のコネクタ、`xdr:grpSp` のグループを扱います。更新は指定したフィールドだけを書き換え、図形の残りの XML は保持します。レコードで表現できない図形は `ShapePaint.OTHER` または空のフィールドで列挙され、保存してもそのまま通過します。図形は画像と同様に行・列の編集に追従します。

`list_sparkline_groups()`、`add_sparkline_group()`、`update_sparkline_group()`、`set_sparkline_group_sparklines()`、`remove_sparkline_group()` は、シートの `x14:sparklineGroups` を扱います。更新しても、`rightToLeft`、`uid`、未知の拡張といったレコード外の属性と子要素は保持されます。

`list_slicers()`、`add_slicer()`、`update_slicer()`、`remove_slicer()` はテーブルスライサーを扱います。追加するとスライサーパーツ、キャッシュ、拡張エントリ、定義名、描画フレームが作られます。スライサーを削除すると、ほかに使うスライサーがなくなった時点でそのキャッシュも削除されます。テーブルやシートの削除、スライサーのフレーム下の行・列の削除では、それに結び付いたスライサーも削除されます。ピボットキャッシュ上のスライサーはそのまま通過し、列挙されません。テーブルスライサーの選択状態はテーブルの AutoFilter が保持します。

`get_workbook_protection()` / `set_workbook_protection()` は `<workbookProtection>` を読み書きし、`get_protected_ranges()`、`add_protected_range()`、`update_protected_range()`、`remove_protected_range()` はシートの `<protectedRange>` を扱います。保護範囲は行・列の編集に追従します。パスワードハッシュはホストが計算した値をそのまま保存し、レコードにない属性は保持します。どちらの保護もセル編集では強制されません。

`table_rename(index, name, display_name=None)` はテーブルの名前を変更し、セル、定義名、条件付き書式、入力規則、計算列と集計行の数式、グラフ系列にある構造化参照を書き換えます。そのテーブルを元にしたピボットキャッシュも追従します。`table_set_style_info()` はスタイル名と、最初の列・最後の列・行ストライプ・列ストライプの切り替えを設定し、`table_set_column_totals()` は 1 列の集計関数、ラベル、数式を設定します。集計行をオンにすると、各列の集計セルが書き込まれます。`get_table_style()`、`set_table_style()`、`remove_table_style()`、`table_style_defaults()`、`set_table_style_defaults()` は、カスタムの `<tableStyles>` と既定のテーブル・ピボットテーブルのスタイル名を扱い、`pivot_style_info()` / `pivot_set_style_info()` はピボットテーブルのスタイルを読み書きします。`set_defined_name_attrs(name, local_sheet_id, ...)` は名前のコメントと非表示フラグを設定し、名前の数式を置き換えても両方とも保持されます。

`get_comment_visible()` / `set_comment_visible()` は、従来のメモが表示状態かどうかを読み書きします。メモのボックス、表示状態、コメントパーツの作成者テーブルは再保存しても保持され、ボックスは行・列の編集でメモに追従します。`get_show_phonetic()` / `set_show_phonetic()` は、セルごとの「ふりがなを表示」フラグを読み書きします。保存ファイルでこのフラグを持つのは定数と空白セルだけで、数式セルには付きません。

`add_sheet()` と `rename_sheet()` は、空の名前、UTF-16 で 31 単位を超える名前、`: \ / ? * [ ]` を含む名前、アポストロフィで始まるまたは終わる名前、大文字小文字を同一視すると別のシート名と重なる名前を `kInvalidSheetName` の `FormulonError` で拒否します。`win-*` プロファイル（既定を含む）では、大文字小文字を問わず `History` も拒否し、`mac-*` プロファイルは受け付けます。表示中の唯一のシートを非表示にするか削除すると `FormulonError` を送出し、データテーブル、従来の配列ブロック、ピボットテーブルを横切る行・列の挿入と削除、またはそれらやテーブルをグリッドの端より先へ押し出す挿入も同様です。

`set_sheet_visibility()` は `SheetVisibility.VISIBLE`、`HIDDEN`、`VERY_HIDDEN` を受け取り、`get_sheet_view()` は `tab_hidden` に加えて解決済みの 3 状態を返します。`set_range_xf_index()` はセル書式（XF）インデックスを両端を含む矩形へ適用し、存在しないセルを書式付きの空セルとして作成します。

`table_create()` の `column_names` は `ref` の列数と一致させます。見出しセルは呼び出し側が書き込みます。`table_update()` は `None` を渡した項目を変更せず、既存テーブルの AutoFilter は範囲を変えても条件と拡張を保ちます。`get_auto_filter_xml()` / `set_auto_filter_xml()` はシートの AutoFilter を `<autoFilter>` の XML 断片のまま読み書きし、空文字列を渡すと削除します。行や列を挿入・削除すると、AutoFilter の `ref` と、モデル化した条件・並べ替えのオフセットもセルと一緒に移動します。解析しないワークシート XML はバイト列のまま保持します。

`add_hyperlink_range()` は両端を含む矩形に 1 つのハイパーリンクを追加し、読み出した `Hyperlink` には `last_row` と `last_col` が入ります。`DataValidationInput` で `allow_blank` を省略した場合の既定値は `False` です。空セルを許可する場合は `allow_blank=True` を指定してください。

条件付き書式の表示データは `ColorScale`、`DataBar`、`IconSet` で表します。`DataBar` は `x14` の制御項目 `gradient`、`axis_position`（`0` は自動、`1` は中央、`2` はなし）、`negative_fill`、`border`、`negative_border`、`axis_color`、`direction`（`0` はシートの読み方向、`1` は左から右、`2` は右から左）を持ちます。省略した項目はモデルの既定値を使い、保存と読み込みをまたいで保持されます。

新しく作成したピボットキャッシュには、保存前にワークシートの参照元を設定してください。たとえば `set_pivot_cache_worksheet_source(cache_id, PivotWorksheetSource(ref="A1:C10", sheet="Data"))` です。参照元のない新規キャッシュは保存に失敗します。読み込んだキャッシュは参照元のメタデータを保持し、参照元がワークシート以外や外部データの場合もあります。`pivot_field_add_item_at()` はキャッシュの共有項目インデックスで手動フィルター項目を指定します。空白の項目を指定できるのはこの方法だけで、`pivot_field_add_item()` に空のラベルを渡しても指定できません。

`get_cells_in_range(sheet, cell_range, cursor=None, limit=None)` は、行・列の順序で `(cells, next_cursor)` を返します。各 `Cell` は `row`、`col`、`formula`、`value` を持ちます。`next_cursor` が `None` になるまで次の呼び出しへ渡してください。`limit` の省略または 0 は最大 65,536 件を選びます。数式セル、空白でない値、スピルの仮想セルを含み、スタイルだけを持つ空セルは含みません。`list_invalid_cells()` も同じページング規則に従います。

寸法メソッドは 96 DPI の画面向けモデルに `GeometryMode.DISPLAY`、ページ分割に使う DPI に依存しないモデルに `GeometryMode.PRINT` を指定します。`get_display_text()` と `format_value()` は、値が書式の表現可能な範囲を外れると `DisplayStatus.OVERFLOW` と `########` を返し、書式コードが不正な場合は `DisplayStatus.INVALID_FORMAT` として General 表示へフォールバックします。

`probe_image()` はワークブックを変更せず、PNG、JPEG、GIF、BMP の画像形式と寸法を読み取ります。`list_drawing_objects()` はシートのアンカー付きオブジェクトを文書順で返します。`get_image()` は画像バイト列をコピーし、`insert_image()` は既存の描画を保持します。`remove_drawing()` は画像またはグラフを削除し、他のオブジェクトがメディアを参照しなくなった場合にメディアも解放します。スレッドコメント API は返信と人物レコードを含み、コメントやメンションが参照している人物は削除できません。

AutoFilter の条件と行の表示状態は別に管理します。`evaluate_auto_filter()` で一致結果を確認し、`apply_auto_filter()` で非表示行を更新してください。`clear_auto_filter()` は範囲を残したまま条件を削除します。入力規則 API は値を保存せずに候補値を検証し、`list_invalid_cells()` は既存の違反を列挙します。

`paginate(sheet)` は `page_count`、`print_area`、`horizontal_breaks`、`vertical_breaks`、`paper`、`margins`、`printable`、`scale`、`page_order`、`print_titles`、`pages`、`horizontal_break_manual`、`vertical_break_manual` を持つ `PaginationResult` を返します。`paper` はポイント単位の寸法、向き、用紙コードを認識できたかを持ちます。`pages` の各 `PageLayout` は `area_index`、両端を含むセル範囲、原点、拡大縮小後の寸法を持ちます。印刷範囲の指定がない場合も `print_area` は空のままですが、ページ分割は使用範囲へフォールバックします。手動改ページのリストは対応する改ページリストと同じ順序です。

`set_formula()` は不正な数式を `kParserUnexpectedToken` として拒否し、既存の数式とキャッシュ値を変更しません。保存済みの XLSX / XLSB に不正な数式が含まれる場合は読み込みできますが、`recalc()` 後のセル値は `#NAME?` になります。単発の `eval_formula()` はアドホック評価のため、不正な入力を `#NAME?` の値として返します。

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

`Value` は構築時にペイロードを検証します。`kind` は `ValueKind` に変換され、その種類が取らないペイロードや欠けたペイロードは `ValueError`、型の違うペイロードは `TypeError` になります。そのため `Value(ValueKind.NUMBER)` や `Value(ValueKind.BLANK, text="a")` は失敗し、`bool` は数値として受け付けません。

Python の `Value` が持つのは `error_code` だけで、`error_text` というフィールドはありません。`formulon.error_display_name(value.error_code)` で `#DIV/0!` や `#VALUE!` の表示文字列を得られます。

## エラー処理 {#error-handling}

`FormulonError` はホスト側の失敗を表します。不正なバイト列、範囲外のインデックス、`set_formula()` に渡した不正なテキスト、`close()` 後の呼び出し、エンジン内部の失敗が該当します。例外は `status`（数値の `fm_status_t`）、`status_name`（`kParserUnexpectedToken` など）、`message`、`context` を持ちます。小数であったり、負のシート番号のように C ABI の整数の幅に収まらなかったりする整数引数は、エンジンを呼ぶ前に `ValueError` を送出します。パックされた整数引数も同じ方法で範囲を検査します。Excel のセルエラーは例外ではなく値です。

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
