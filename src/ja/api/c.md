# C API

stable C11 ABI は、独自の言語バインディングやネイティブホストから使うための実行入口です。opaque な `fm_workbook_t` handle を中心とするフラットな API で、配布中の Python、CLI、WASM も同じ model を使っています。

ソースからビルドした成果物の `formulon_c.h` を include し、Formulon core library と link してください。public header が完全なリファレンスです。このページでは、バインディング実装で守るべき所有権と寿命のルールを説明します。

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

既存の `.xlsx` または `.xlsb` から始める場合は、`fm_workbook_create()` の代わりに `fm_workbook_load(input_bytes, input_len, &wb)` を呼びます。reader はバイト列からコンテナを判別します。

## 所有権と view

| 値 | 所有者 | ルール |
| --- | --- | --- |
| `fm_workbook_t *` | 呼び出し側 | `fm_workbook_destroy()` で解放します。`NULL` でも構いません。 |
| save bytes | save 成功後の呼び出し側 | `fm_buffer_free()` だけで解放します。`free()` や `delete[]` は使いません。 |
| `fm_value_t.u.text` と text getter | workbook | 次の scratch-backed read 成功、mutation、handle の破棄より前にコピーします。 |
| error message / context | 現在の thread | 同じ thread で次の API を呼ぶ前にコピーします。 |

save API は失敗時に output pointer と length を初期値へ戻し、`fm_buffer_free(NULL)` は安全です。そのため、例のように無条件で cleanup できます。

## エラーと thread

`#DIV/0!` のようなセルレベルの Excel error は `FM_VAL_ERROR` という値であり、失敗 status ではありません。非 0 の `fm_status_t` は、不正な入力、無効な handle、I/O error などのホスト側失敗を表します。`fm_last_error_message()` と `fm_last_error_context()` は同じ thread の次の API 呼び出しで上書きされるため、その前に読み取ってください。

1 つの workbook handle は、同時には 1 つの外部 caller thread が所有します。同じ handle を並行して read、mutation、recalc してはいけません。`fm_workbook_recalc_parallel()` は 1 回の呼び出しの内部で worker thread を作る場合がありますが、別々の API 呼び出しを安全にはしません。別々の handle は並行して使えます。

## 次に読むもの

- [ワークブック操作](/ja/workbook/operations) ─ 座標モデル、編集、レイアウト、metadata
- [再計算](/ja/workbook/recalculation) ─ dirty cell、反復計算、時計に依存する関数
- [ファイル形式](/ja/workbook/file-formats) ─ XLSX / XLSB の選択と保持境界
- [ソースからビルド](/ja/development/build-from-source) ─ ネイティブ library と tool のビルド
