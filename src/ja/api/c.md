# C API

C11 ABI は、独自の言語バインディングやネイティブホストから使うための API です。内部構造を公開しない `fm_workbook_t` ハンドルを中心とするフラットな API で、配布中の Python、CLI、WASM も同じモデルを使います。公開レコードのレイアウトも契約の一部であり、クライアントのビルドに使ったヘッダーと一致させる必要があります。

ソースからビルドした `formulon_c.h` ヘッダーを取り込み、計算コアのライブラリをリンクしてください。公開ヘッダーが完全なリファレンスです。このページでは、バインディング実装で守るべき所有権と寿命のルールを説明します。

## 最小のワークブック往復

ワークブックの座標はすべて 0 始まりです。`(0, 0, 0)` は `Sheet1!A1` を表します。失敗し得る呼び出しはすべて `fm_status_t` を確認してください。`0` は成功です。

```c
#include "formulon_c.h"
#include <stdint.h>
#include <stdio.h>

static void report_failure(const char *operation, fm_status_t status) {
  fprintf(stderr, "%s: %s: %s\n", operation, fm_status_string(status),
          fm_last_error_message());
}

int main(void) {
  fm_workbook_t *wb = NULL;
  uint8_t *bytes = NULL;
  size_t len = 0;
  fm_value_t value;

  fm_status_t status = fm_workbook_create(&wb);
  if (status != 0) { report_failure("create", status); return 1; }

  status = fm_workbook_set_formula(wb, 0, 0, 0, "=SUM(1,2,3)");
  if (status == 0) status = fm_workbook_recalc(wb);
  if (status == 0) status = fm_workbook_get_value(wb, 0, 0, 0, &value);
  if (status == 0 && value.kind == FM_VAL_NUMBER) printf("%.0f\n", value.u.number);
  if (status == 0) status = fm_workbook_save(wb, &bytes, &len);
  if (status != 0) report_failure("workbook operation", status);

  /* `bytes[0..len]` をホスト側で .xlsx ファイルとして保存します。 */
  fm_buffer_free(bytes);
  fm_workbook_destroy(wb);
  return status == 0 ? 0 : 1;
}
```

既存の `.xlsx` または `.xlsb` から始める場合は、`fm_workbook_create()` の代わりに `fm_workbook_load(input_bytes, input_len, &wb)` を呼びます。読み込み処理はバイト列からコンテナ形式を判別します。

## 所有権と参照

| 値 | 所有者 | ルール |
| --- | --- | --- |
| `fm_workbook_t *` | 呼び出し側 | `fm_workbook_destroy()` で解放します。`NULL` でも構いません。 |
| 保存バイト列 | 保存成功後の呼び出し側 | `fm_buffer_free()` だけで解放します。`free()` や `delete[]` は使いません。 |
| `fm_value_t.u.text` とテキスト取得結果 | ワークブック | 次の一時バッファを使う読み取りの成功、変更、ハンドル破棄の前にコピーします。 |
| エラーメッセージとコンテキスト | 現在のスレッド | 同じスレッドで次の API を呼ぶ前にコピーします。 |
| `fm_cell_range_t *` | 呼び出し側 | `fm_cell_range_destroy()` で解放します。スナップショット内のセルのテキストと数式は破棄まで有効です。 |
| `fm_pagination_t *` | 呼び出し側 | `fm_pagination_destroy()` で解放します。ページ分割の getter は所有済みの結果を読み取ります。 |

保存 API は失敗時に出力ポインターと長さを初期値へ戻し、`fm_buffer_free(NULL)` は安全です。そのため、例のように無条件で後処理できます。テキスト取得結果は次の一時バッファを使う読み取りや変更で無効になるため、必要なら呼び出し側でコピーしてください。

`fm_sheet_cells_in_range()` は `fm_cell_range_t` を使う、呼び出し側が所有するページのスナップショットを返します。ページには、値または数式を持つセルとスピルの仮想セルが行・列の順序で入ります。`fm_cell_range_count()`、`fm_cell_range_at()`、`fm_cell_range_next_cursor()` はワークブックの一時バッファを使わずにページを読み取ります。後続のワークブック変更はスナップショットを変更しません。成功したページはすべて `fm_cell_range_destroy()` で破棄し、次の呼び出しにはカーソルを渡してください。

## エラーとスレッド

`#DIV/0!` のようなセルレベルの Excel エラーは `FM_VAL_ERROR` という値であり、ステータスの失敗ではありません。非 0 の `fm_status_t` は、不正な入力、無効なハンドル、I/O エラーなどのホスト側の失敗を表します。`fm_last_error_message()` と `fm_last_error_context()` は同じスレッドの次の API 呼び出しで上書きされるため、その前に読み取ってください。

1 つのワークブックハンドルは、同時には 1 つの外部呼び出しスレッドから使います。同じハンドルを並行して読み取り、変更、再計算してはいけません。`fm_workbook_recalc_parallel()` は 1 回の呼び出しの内部でワーカースレッドを作る場合がありますが、別々の API 呼び出しを安全にはしません。別々のハンドルは並行して使えます。

## ワークブック操作

C ABI では、各バインディングで使うワークブック操作を直接呼び出せます。`fm_workbook_get_iterative()` は `enabled`、`max_iterations`、`max_change` を読み出します。`fm_workbook_set_iterative()` は反復回数の上限を `32767` に制限し、getter は制限後の値を返します。`fm_sheet_set_visibility()` は `FM_SHEET_VISIBLE`、`FM_SHEET_HIDDEN`、`FM_SHEET_VERY_HIDDEN` を受け取り、`fm_sheet_get_view()` は従来の `tab_hidden` と正規の 3 状態 `visibility` を返します。

ワークシートの印刷設定 API は、ページ設定、余白、印刷オプション、ヘッダー / フッター、印刷範囲、印刷タイトル、手動の行 / 列改ページを扱います（`fm_sheet_set_page_setup`、`fm_sheet_set_page_margins`、`fm_sheet_set_print_options`、`fm_sheet_set_header_footer`、`fm_sheet_set_print_area`、`fm_sheet_set_print_titles`、`fm_sheet_add_row_break`、`fm_sheet_add_col_break`）。未モデル化の XML 設定 API は、保存前に整形式でサイズ制限内の断片かを検証します。`fm_sheet_set_range_xf_index()` はセル書式（XF）インデックスを両端を含む矩形へ適用し、書式付きの空セルを作成します。

`fm_workbook_pivot_field_add_item_at()` はキャッシュの共有項目インデックスで手動フィルター項目を指定します。空白のピボット項目を表現できる形式で、ラベル形式の `fm_workbook_pivot_field_add_item()` に空文字列を渡しても指定できません。

`fm_workbook_create_for_profile(profile_id, &wb)` は、指定した Excel プロファイルの新規ワークブック既定値で 1 シートのワークブックを作成します。プロファイルを記録し、ロケールごとの本文用フォントとふりがな用フォント、`Normal` スタイルと最初のシート名、セル XF の配置、ふりがな設定、ページ余白、実測済みの Mac の行の高さと基本列幅を設定します。`fm_workbook_create()` は通常の Calibri 11 のワークブックを作成します。プロファイル用ファクトリはテーマパートを書き出さないため、既定の Office テーマとして扱われます。

外部ワークブック参照はメタデータとキャッシュ済み値を入力にします。XLSX と XLSB の読み込みは `[1]Sheet1!A1` のようなインデックス形式と、`[Book1.xlsx]Sheet1!A1` のような名前 / パス形式の両方を受け付けます。エンジンはパッケージに保存された値だけを使い、参照先のワークブックを開いたりネットワークへアクセスしたりしません。`fm_workbook_external_link_count()` と `fm_workbook_external_link_at()` でリンクレコードを取得し、ホスト側で互換性を確認できます。

`fm_workbook_paginate()` は、呼び出し側が所有する `fm_pagination_t` のスナップショットを返します。ページ数、宣言された印刷範囲、横方向 / 縦方向の改ページ位置に加えて、用紙サイズと向き、余白、印刷可能な矩形、倍率、ページ順、繰り返す印刷タイトル、物理ページごとのレイアウト、各改ページが手動かどうかを getter で取得できます。宣言された印刷範囲がない場合は範囲を空のまま返し、ページ分割は使用範囲へフォールバックします。結果は `fm_pagination_destroy()` で破棄してください。

公開レコードは固定レイアウトです。現在のヘッダーで `fm_cell_xf` は 128 バイト、`fm_row_layout_t` は 40 バイトです。`fm_locale_facts_t` の末尾には `collation_measured` があり、ほかのロケール情報とは別にテキスト照合の実測値を示します。このフィールドもレコードレイアウトの一部です。公開ヘッダー `formulon_c.h` を正とし、ヘッダーが変わるたびに C クライアントを再ビルドして FFI のレイアウト定義を再生成してください。フィールド順とパディングは ABI の一部です。

`fm_sheet_format_defaults` は 48 バイトの公開レコードで、`default_col_width`、`default_row_height`、`base_col_width`、`has_default_col_width`、`has_default_row_height`、`effective_default_col_width`、`effective_default_row_height` を持ちます。幅は文字単位、高さはポイント単位です。`fm_sheet_get_format_defaults()` は保存された既定値、または組み込みのフォールバック（8.43 文字、`102/7` ポイント）から effective フィールドを埋めます。`fm_sheet_set_format_defaults()` は effective フィールドを無視し、負数・NaN・無限大の既定値を拒否します。

関数メタデータは構造情報で、ロケールに依存しません。Excel の表示名を必要とするホストは、プロファイル単位の関数を使います。

```c
const char* localized = NULL;
const char* localized_name = "SUM";
const char* canonical = NULL;
const char* localized_formula = NULL;
const char* canonical_formula = NULL;
fm_locale_facts_t facts = {0};

fm_function_localize("SUM", "mac-365-de_DE", &localized);
fm_function_canonicalize(localized_name, "mac-365-de_DE", &canonical);
fm_formula_localize("=SUM(1.5,TRUE)", "mac-365-de_DE", &localized_formula);
fm_formula_canonicalize(localized_formula, "mac-365-de_DE", &canonical_formula);
fm_locale_facts("mac-365-de_DE", &facts);
```

関数名とロケール情報の文字列は `formulon_c.h` に記載されたプロセス静的な参照で、呼び出し側が解放する必要はありません。数式テキストの結果はスレッドローカルバッファを指し、そのスレッドで次に数式ローカライズ関数を呼ぶまで有効です。保持する場合はコピーしてください。5 つの関数は数値ロケールコードではなくプロファイル ID を受け取ります。`fm_locale_facts_t` は区切り文字、真偽値名、日付順、通貨、`measured`、テキスト照合の実測値を示す `collation_measured` を返します。テキスト照合の実測値を持つのは `mac-*` プロファイルだけです。

`fm_text_compare()` は `fm_collation_strength_t`（`FM_COLLATION_COMPARE`、`FM_COLLATION_DYNAMIC`、`FM_COLLATION_CLASSIC_EXACT`）で選んだ折りたたみ方に従って 2 つの UTF-8 テキストを比較し、`-1`、`0`、`1` の符号を書き込みます。`fm_collation_classes()` は `fm_value_t` ごとの密なクラス ID とクラス数を書き込みます。1 回の呼び出しの中で同じ ID になるのは値の種類も一致する場合だけで、テキストは選択した強度、数値は `-0` と `0` を同じ値、空白は 1 クラスとして扱います。ID は SORT の順序（数値、テキスト、真偽値、エラー、空白）に並び、呼び出しの外では意味を持たないため、保存済みの値と現在の値を同じ呼び出しで分類して選択を照合してください。

`fm_workbook_set_formula()` はセルを変更する前に数式全体を検証します。不正な数式は `kParserUnexpectedToken` ステータスを返し、既存の数式とキャッシュ状態を変更しません。XLSX または XLSB に保存済みの不正な数式は、保存されたテキストのまま読み込めます。再計算後はワークブックの読み込み失敗ではなく、セルの `#NAME?` エラー値として現れます。

名前付きスタイルは、`name`、`xf_id`、`builtin_id`、`i_level`、`hidden`、`custom_builtin` を持つ `fm_cell_style_record_t` で表します。`fm_styles_get_cell_style()` で読み取り、`fm_styles_set_cell_style()` で追加または置換します。`xf_id` は名前付きスタイルの `cellStyleXfs` テーブルを指します。`builtin_id` は `0..53`、カスタムスタイルでは `FM_CELL_STYLE_BUILTIN_ID_NONE` です。`i_level` は組み込みの `RowLevel_n` / `ColLevel_n` スタイルで `0..6`、それ以外では `0` です。読み取り結果の `name` はワークブックが所有し、setter は入力文字列をコピーします。

`fm_sheet_set_column_style()` / `fm_sheet_clear_column_style()` と `fm_sheet_set_row_style()` / `fm_sheet_clear_row_style()` は、幅、高さ、非表示、アウトラインなどの属性を残して軸範囲のセル書式 XF を設定または解除します。インデックス `0` は既定 XF です。`fm_cell_clear_xf_index()` はセルの明示的な割り当てを解除し、空白セルが行、列、ワークブックの既定値を継承できるようにします。セル XF を `0` に設定すると明示的な Normal の割り当てが残るため、解除とは異なります。`fm_sheet_range_style_bases()` で選択範囲のセルが実際に解決する XF を取得し、変更後のレコードを `fm_sheet_remap_range_style()` に渡すと、値と数式を保った属性だけの変更になります。`fm_sheet_snapshot_range_style()` と `fm_sheet_restore_range_style()` はスタイルの復元に使う不透明なスナップショットを提供します。選択範囲の規則と標準的な操作手順は [ワークブック操作](/ja/workbook/operations) を参照してください。

`fm_workbook_theme_script_font_count()` と `fm_workbook_theme_script_font_at()` は、テーマの major / minor フォントセットを公開します。テーマパートがない場合も既定の Office テーマにある 47 個のスクリプト項目を返します。`fm_workbook_set_theme_script_font()` は 1 つのスクリプトを変更または追加します。テーマの読み取り時は、`Jpan` の項目が対応する東アジア書体として使われるのは、そのフォントセットの `<a:ea typeface>` が空の場合だけです。`<a:ea typeface>` に明示値があれば、そちらが優先されます。テーマパートがない場合は変更前に既定の全項目を作成し、スクリプトは 4 個の ASCII 英字、書体名は空でない文字列にしてください。

同じヘッダーには、範囲スナップショット、表示文字列（`fm_workbook_get_display_text`、`fm_workbook_format_value`）、寸法、AutoFilter と入力規則、スレッドコメントと人物、画像と描画の API も含まれます。ポインターの寿命は各宣言の近くに記載されているため、別の成功した読み取りや変更の前に一時バッファの文字列をコピーしてください。

## 次に読むもの

- [ワークブック操作](/ja/workbook/operations) ─ 座標モデル、編集、レイアウト、メタデータ
- [表示とレイアウト](/ja/workbook/presentation) ─ 表示文字列、テーマ、スタイル、寸法、ページ分割
- [フィルターと入力規則](/ja/workbook/filters-validation) ─ AutoFilter と候補値の検証
- [コメントと画像](/ja/workbook/comments-images) ─ スレッドコメント、人物、描画オブジェクト、画像
- [再計算](/ja/workbook/recalculation) ─ 変更されたセル、反復計算、時計に依存する関数
- [ファイル形式](/ja/workbook/file-formats) ─ XLSX / XLSB の選択と保持境界
- [ソースからビルド](/ja/development/build-from-source) ─ ネイティブライブラリとツールのビルド
