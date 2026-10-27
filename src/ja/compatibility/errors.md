# エラーモデル

スプレッドシートのエラーは **値** です。`#DIV/0!` を返した数式はクラッシュしておらず、エラー値を生成しただけです。それを取得したホスト API 呼び出しは成功しています。この区別はすべてのバインディングで保たれます。

::: info 用語: セルエラーとホスト失敗
*セルエラー* は `kind = Error` の値であり、バインディングを通じてデータとして流れます。*ホスト失敗* はホスト操作自体の失敗（バイト列の不正・ハンドル失効・入出力エラー・エンジン内部失敗）であり、別の経路（`Status` エンベロープ、例外、非ゼロの終了コード、`fm_status_t`）で報告されます。
:::

<DiagramLayers
  label="ホスト呼び出しはまず成功か失敗かに分かれます。失敗した呼び出しはホスト失敗の経路で扱い、成功した呼び出しは値を返します。値の種類が Error ならセルエラー値としてインラインに表示し、それ以外はそのまま使います。"
  caption="セルエラーは成功した呼び出しが返すデータであり、ホスト失敗になるのは呼び出し自体が失敗したときだけです。"
  :layers="[
  { title: 'ホスト API の呼び出し', nodes: [{ label: 'getValue / recalc / save', note: '結果かホスト失敗を返す' }] },
  { title: '呼び出しは失敗したか', nodes: [
    { label: 'はい: ホスト失敗', note: 'Status・例外・終了コード', tone: 'alt' },
    { label: 'いいえ: value.kind を確認', note: '呼び出し自体は成功' }
  ] },
  { title: 'value.kind', nodes: [
    { label: 'Error', note: '#DIV/0! · #VALUE! · #REF! · … をそのまま表示' },
    { label: 'Number / Text / Bool / …', note: '値をそのまま使う' }
  ] }
]" />

ホスト失敗はその経路で受け取り、再試行するか統合コードを直します。セルエラーはデータなので、インラインに表示して処理を続けます。

| Error | 意味 |
| --- | --- |
| `#DIV/0!` | 0 除算 |
| `#VALUE!` | 型または値の不一致 |
| `#REF!` | 無効な参照（削除されたシート、壊れた範囲） |
| `#NAME?` | 未知の名前または関数 |
| `#NUM!` | 数値オーバーフロー / 不正な数値範囲 |
| `#N/A` | 値が利用できない |
| `#NULL!` | 範囲交差が空 |
| `#SPILL!` | 動的配列の spill 衝突 |
| `#CALC!` | エンジンが結果を返せない |
| `#GETTING_DATA` | 外部参照の取得中 |
| `#FIELD!` | リッチデータ型のフィールド参照が無効 |
| `#BLOCKED!` | ワークブックまたはデータ型ポリシーにより操作がブロックされた |
| `#CONNECT!` | 外部データ接続の失敗 |
| `#EXTERNAL!` | 外部関数または外部依存のエラー |
| `#BUSY!` | 処理が実行中（Real-Time-Data プロバイダーなど） |
| `#PYTHON!` | `PY` セルの評価中に発生したエラー |
| `#UNKNOWN!` | 認識できない、または対応付けのないエラーコード |

これが `ErrorCode` の全 17 種です（`src/value.h` の `kErrorTable`）。各バインディングの表示ヘルパーは、入力ワークブックから引き継いだだけのものも含めて 17 種すべてを扱います。`#PYTHON!` が出ても Formulon が Python を実行するわけではなく、`#GETTING_DATA` が出てもネットワークに接続するわけではありません。

バインディングはこれらをホスト言語の例外に変換せず、値として保持してください（API 誤用・入出力失敗を報告する場合を除く）。

下のパネルは、この一覧を実行中のエンジンから読み出したうえで、2 つの経路を並べて実行します。片方は呼び出しが成功したまま値としてエラーが返る数式、もう片方は 16 バイトのノイズを渡した `loadBytes()` で、こちらは値そのものが返りません。

<ErrorsDemo />

## ホスト側の失敗経路

| 実行入口 | ホスト側の失敗経路 |
| --- | --- |
| WASM | `status.ok === false`、または無効なワークブックハンドルと `lastErrorMessage()` |
| Python | `FormulonError` |
| CLI | 非ゼロ終了コード + stderr 診断 |
| C ABI | 非ゼロ `fm_status_t` + `fm_last_error_message()` / `fm_last_error_context()` |
| MCP | 構造化データを含む MCP エラー応答 |
| Native Node | 戻り値エンベロープの `status.ok === false` |

## バインディング引数の検証

WASM と Native Node の JavaScript バインディングは、どちらもエンジン呼び出しの前にすべての位置引数を同じ規則で検査します。必須引数の欠落、型の誤り、オブジェクトが宣言された位置へのプリミティブまたは `null` は `TypeError`、有限でない値・小数・範囲外の整数は `RangeError` になります。どちらのパッケージも、欠落した引数を `0`、`""`、`false`、空オブジェクトで補いません。ネストしたレコードも検査し、ワークブックを変更する前に失敗します。位置引数の 64 bit カーソルやオフセットは `Number.MAX_SAFE_INTEGER` 以下に制限され、省略または null のオプション項目は宣言された既定値を使います。孤立した UTF-16 サロゲートを含む文字列フィールドは、その位置に U+FFFD を格納します。

長さの違う配列や関数でないコールバックなど、メソッドがステータスで報告する不正な引数は、どちらのパッケージでも `kInvalidArgument`（2）を返します。Python は、小数または範囲外の整数に `ValueError` を送出し、`Value` はペイロードが種類に合わないとき `ValueError` または `TypeError` を送出します。

`loadBytes` や画像 API などのバイト入力には `Uint8Array` が必要です。Node の `Buffer` は `Uint8Array` なので使えますが、文字列は使えません。ネストした文字列項目は JavaScript の文字列または 1 バイトバッファーを受け取り、Native Node では `Buffer` も該当します。これらのバインディング入力の結果は `Status` の戻り値と Excel のセルエラー値とは別のものです。引数の形をバインディングがステータス結果で返す API では、結果フィールドを読む前にそのステータスを確認してください。

## 引数と構造の検査が返すステータス {#statuses-returned-by-argument-and-structure-checks}

| ステータス | 返る場合 |
| --- | --- |
| `kInvalidArgument`（2） | インデックス、個数、アウトラインレベル（7 超）が範囲外、`xf_index` がセル XF テーブルの外、表示中の唯一のシートを非表示または削除しようとした、コールバックが関数でない。 |
| `kPreconditionFailed`（9） | 行・列の挿入と削除がデータテーブル、従来の配列ブロック、ピボットテーブルを横切る、またはそれらやテーブルをグリッドの端より先へ押し出す。データテーブルの結果範囲へセルを書き込む。 |
| `kInvalidSheetName`（5051） | シート名が空、長すぎる、使えない文字を含む、アポストロフィで始まるまたは終わる、大文字小文字を同一視すると別の名前と重なる。`win-*` プロファイルでは、大文字小文字を問わず `History` も該当する。 |
| `kIoSheetCorrupt`（5012） | 読み込んだ `.xlsx` または `.xlsb` に、アポストロフィで始まるまたは終わるシート名がある。 |
| `kIoFileTooLarge`（5002） | ファイルから読んだサイズが読み込み時の上限を超える（たとえば 2^25 レコードスロットを超えるピボットキャッシュ）。 |
| `kGraphRecalcReentrant`（4005） | `Workbook` のメソッドを、そのワークブック自身の反復計算の進捗コールバックから呼んだ。JS パッケージでは、このコードを名指しした `TypeError` になる。 |
| `kBindingUtf8EncodingError`（7002） | C ABI のテキスト引数が整形式の UTF-8 でない。 |

## 数式テキストの入力経路 {#formula-text-entry-paths}

不正な数式テキストは、エンジンへ入る経路によって結果が異なります。エラーを報告するときは、次の経路を分けて扱ってください。

| 入力経路 | 結果 | ワークブックの変更 |
| --- | --- | --- |
| `setFormula()` / `set_formula()` | ホストステータス `kParserUnexpectedToken` | 既存セルの数式とキャッシュ値は変わりません。 |
| 不正な保存済み数式を含むインポート済みワークブック | 保存テキストは保持され、`recalc()` 後にセルは `#NAME?` になります | ワークブック記録を保持するため、内容を確認して書き換えられます。 |
| `evaluateFormulaText()` / `evalFormula()` / `eval_formula()` | 評価は成功し、エンベロープの値として `#NAME?` が返ります | 読み取り専用で、セルや依存グラフは変わりません。 |

関数呼び出しが 65 段を超えてネストした数式は、Excel と同じく解析診断 `NestedFormulaTooDeep` で拒否され、セルは以前の数式を保ちます。丸括弧 256 段、単項符号 1024 個までは解析と評価ができます。

たとえば `=SUM(` は、厳密な数式 setter では `kParserUnexpectedToken` で拒否されます。同じ不正テキストがインポートファイルから入ると保持され、アドホック評価ではセルエラー `#NAME?` が返ります。どちらも一般的なホスト例外へまとめないでください。setter のステータスは要求した変更が起きなかったためホスト側の失敗であり、`#NAME?` はインポートまたはアドホック評価経路が返すセル値です。

setter、インポート済み数式、アドホック評価のケースは、Formulon ソースツリーの `tests/c_api/formulon_c_formula_entry_test.cpp` と `src/eval/adhoc_eval.cpp` で検証しています。

## C ABI の値種別

| Kind | 意味 |
| --- | --- |
| `FM_VAL_BLANK` | 空セル |
| `FM_VAL_NUMBER` | IEEE-754 double |
| `FM_VAL_BOOL` | 真偽値 |
| `FM_VAL_TEXT` | UTF-8 のワークブック所有テキストビュー |
| `FM_VAL_ERROR` | Excel エラーコードの序数 |
| `FM_VAL_ARRAY` | 予約済みペイロード |
| `FM_VAL_REF` | 予約済みペイロード |
| `FM_VAL_LAMBDA` | 予約済みペイロード |

## 処理パターン

::: code-group

```ts [WASM]
const result = wb.getValue(0, 0, 0)
if (!result.status.ok) throw new Error(result.status.message)

const value = result.value
if (value.kind === ValueKind.Error) {
  // セルエラー ─ ユーザーに表示するだけで throw しない。
  showInline(Module.errorDisplayName(value.errorCode))
} else if (value.kind === ValueKind.Number) {
  consume(value.number)
}
```

```ts [Native Node]
import { errorDisplayName, ValueKind } from '@libraz/formulon-native'

const result = wb.getValue(0, 0, 0)
if (!result.status.ok) throw new Error(result.status.message)
const value = result.value
if (value.kind === ValueKind.Error) showInline(errorDisplayName(value.errorCode))
```

```python [Python]
from formulon import ValueKind, error_display_name

v = wb.get_value(0, 0, 0)
if v.kind is ValueKind.ERROR:
    show_inline(error_display_name(v.error_code))
elif v.kind is ValueKind.NUMBER:
    consume(v.number)
```

:::

## 次に読むもの

- [数式エンジン](/ja/workbook/formula-engine) ─ エラーの伝播
- [トラブルシュート](/ja/start/troubleshooting) ─ よくあるホスト失敗
