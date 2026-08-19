# エラーモデル

スプレッドシートのエラーは **値** です。`#DIV/0!` を返した数式はクラッシュしておらず、エラー値を生成しただけです。それを取得したホスト API 呼び出しは成功しています。この区別はすべてのバインディングで保たれます。

::: info 用語: セルエラーとホスト失敗
*セルエラー* は `kind = Error` の値であり、バインディングを通じてデータとして流れます。*ホスト失敗* はホスト操作自体の失敗（バイト列の不正・ハンドル失効・入出力エラー・エンジン内部失敗）であり、別チャネル（`Status` envelope / 例外 / 非ゼロ終了 / `fm_status_t`）で報告されます。
:::

<DiagramLayers :layers="[
  { title: 'ホスト呼び出し', nodes: ['getValue / recalc / save'] },
  { title: '呼び出し自体は成功したか', nodes: [
    { label: 'いいえ → ホスト失敗経路', note: 'status envelope · 例外 · 非ゼロ終了 · fm_status_t' },
    { label: 'はい → value.kind を確認' }
  ] },
  { title: 'value.kind', nodes: [
    { label: 'Error → セルエラー値', note: '#DIV/0! · #VALUE! · #REF! · … — インラインに表示し、throw しない' },
    { label: 'Number / Text / Bool / …', note: '値をそのまま使う' }
  ] }
]" />

ホスト失敗（不正なバイト列・ハンドル失効・IO エラー）は統合コード側を直す必要があり、セルエラーはインラインに表示してそのまま処理を続けます。

| Error | 意味 |
| --- | --- |
| `#DIV/0!` | 0 除算 |
| `#VALUE!` | 型または値の不一致 |
| `#REF!` | 無効な参照（削除されたシート、壊れた range） |
| `#NAME?` | 未知の名前または関数 |
| `#NUM!` | 数値オーバーフロー / 不正な数値 domain |
| `#N/A` | 値が利用できない |
| `#NULL!` | 範囲交差が空 |
| `#SPILL!` | 動的配列の spill 衝突 |
| `#CALC!` | engine が結果を返せない |
| `#GETTING_DATA` | 外部参照の取得中 |
| `#FIELD!` | リッチデータ型のフィールド参照が無効 |
| `#BLOCKED!` | ワークブックまたはデータ型ポリシーにより操作がブロックされた |
| `#CONNECT!` | 外部データ接続の失敗 |
| `#EXTERNAL!` | 外部関数または外部依存のエラー |
| `#BUSY!` | 処理が実行中（Real-Time-Data プロバイダーなど） |
| `#PYTHON!` | `PY` セルの評価中に発生したエラー |
| `#UNKNOWN!` | 認識できない、または対応付けのないエラーコード |

これが結線済みの `ErrorCode` の全体です（`src/value.h` の `kErrorTable`）。ホスト側で対応表を作る場合は、古典的な 10 種だけでなく 17 種すべてを対象にしてください。

バインディングはこれらをホスト言語の例外に変換せず、値として保持してください（API 誤用・入出力失敗を報告する場合を除く）。

下のパネルは、この一覧を実行中のエンジンから読み出したうえで、2 つの経路を並べて実行します。片方は呼び出しが成功したまま値としてエラーが返る数式、もう片方は 16 バイトのノイズを渡した `loadBytes()` で、こちらは値そのものが返りません。

<ErrorsDemo />

## ホスト側の失敗経路

| 実行入口 | ホスト側の失敗経路 |
| --- | --- |
| WASM | `status.ok === false` または invalid workbook handle + `lastErrorMessage()` |
| Python | `FormulonError` |
| CLI | 非ゼロ終了コード + stderr 診断 |
| C ABI | 非ゼロ `fm_status_t` + `fm_last_error_message()` / `fm_last_error_context()` |
| MCP | 構造化 payload を持つ MCP エラー応答 |
| Native Node | 返却 envelope の `status.ok === false` |

## C ABI の値種別

| Kind | 意味 |
| --- | --- |
| `FM_VAL_BLANK` | 空セル |
| `FM_VAL_NUMBER` | IEEE-754 double |
| `FM_VAL_BOOL` | 真偽値 |
| `FM_VAL_TEXT` | UTF-8 のワークブック所有テキストビュー |
| `FM_VAL_ERROR` | Excel エラーコードの序数 |
| `FM_VAL_ARRAY` | 予約済み payload |
| `FM_VAL_REF` | 予約済み payload |
| `FM_VAL_LAMBDA` | 予約済み payload |

## 処理パターン

```ts
const result = wb.getValue(0, 0, 0)
if (!result.status.ok) throw new Error(result.status.message)

const value = result.value
if (value.kind === ValueKind.Error) {
  // セルエラー ─ ユーザーに表示するだけで throw しない。
  // value.errorCode は formulon.ErrorCode の序数。表示文字列
  // （例: "#DIV/0!"）への変換は自前の対応表で行う。
  showInline(value.errorCode)
} else if (value.kind === ValueKind.Number) {
  consume(value.number)
}
```

```python
v = wb.get_value(0, 0, 0)
if v.kind is ValueKind.ERROR:
    # v.error_code は int の ErrorCode 序数。変換は自前で行う。
    show_inline(v.error_code)
elif v.kind is ValueKind.NUMBER:
    consume(v.number)
```

## 次に読むもの

- [数式エンジン](/ja/workbook/formula-engine) ─ error の伝播
- [トラブルシュート](/ja/start/troubleshooting) ─ よくあるホスト失敗
