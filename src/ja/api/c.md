# C API

安定した C11 ABI は、独自の言語バインディングやネイティブホストから使うための API です。内部構造を公開しない `fm_workbook_t` ハンドルを中心とするフラットな API で、配布中の Python、CLI、WASM も同じモデルを使います。

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

保存 API は失敗時に出力ポインターと長さを初期値へ戻し、`fm_buffer_free(NULL)` は安全です。そのため、例のように無条件で後処理できます。テキスト取得結果は次の一時バッファを使う読み取りや変更で無効になるため、必要なら呼び出し側でコピーしてください。

## エラーとスレッド

`#DIV/0!` のようなセルレベルの Excel エラーは `FM_VAL_ERROR` という値であり、ステータスの失敗ではありません。非 0 の `fm_status_t` は、不正な入力、無効なハンドル、I/O エラーなどのホスト側の失敗を表します。`fm_last_error_message()` と `fm_last_error_context()` は同じスレッドの次の API 呼び出しで上書きされるため、その前に読み取ってください。

1 つのワークブックハンドルは、同時には 1 つの外部呼び出しスレッドから使います。同じハンドルを並行して読み取り、変更、再計算してはいけません。`fm_workbook_recalc_parallel()` は 1 回の呼び出しの内部でワーカースレッドを作る場合がありますが、別々の API 呼び出しを安全にはしません。別々のハンドルは並行して使えます。

## ワークブック操作

C ABI では、各バインディングで使うワークブック操作を直接呼び出せます。`fm_workbook_get_iterative()` は `enabled`、`max_iterations`、`max_change` を読み出します。`fm_workbook_set_iterative()` は反復回数の上限を `32767` に制限し、getter は制限後の値を返します。`fm_sheet_set_visibility()` は `FM_SHEET_VISIBLE`、`FM_SHEET_HIDDEN`、`FM_SHEET_VERY_HIDDEN` を受け取り、`fm_sheet_get_view()` は従来の `tab_hidden` と正規の 3 状態 `visibility` を返します。

ワークシートの印刷設定 API は、ページ設定、余白、印刷オプション、ヘッダー / フッター、印刷範囲、印刷タイトル、手動の行 / 列改ページを扱います（`fm_sheet_set_page_setup`、`fm_sheet_set_page_margins`、`fm_sheet_set_print_options`、`fm_sheet_set_header_footer`、`fm_sheet_set_print_area`、`fm_sheet_set_print_titles`、`fm_sheet_add_row_break`、`fm_sheet_add_col_break`）。未モデル化の XML 設定 API は、保存前に整形式でサイズ制限内の断片かを検証します。`fm_sheet_set_range_xf_index()` はセル書式（XF）インデックスを両端を含む矩形へ適用し、書式付きの空セルを作成します。

`fm_workbook_pivot_field_add_item_at()` はキャッシュの共有項目インデックスで手動フィルター項目を指定します。空白のピボット項目を表現できる形式で、ラベル形式の `fm_workbook_pivot_field_add_item()` に空文字列を渡しても指定できません。外部リンクの読み込み処理は `[1]Sheet1!A1` のようなインデックス形式をキャッシュ済みリンク値から解決します。`[Book1.xlsx]Sheet1!A1` のようなパス形式は未対応です。

## 次に読むもの

- [ワークブック操作](/ja/workbook/operations) ─ 座標モデル、編集、レイアウト、メタデータ
- [再計算](/ja/workbook/recalculation) ─ 変更されたセル、反復計算、時計に依存する関数
- [ファイル形式](/ja/workbook/file-formats) ─ XLSX / XLSB の選択と保持境界
- [ソースからビルド](/ja/development/build-from-source) ─ ネイティブライブラリとツールのビルド
