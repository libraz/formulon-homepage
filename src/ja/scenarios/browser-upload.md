# ブラウザでワークブックを開く

ユーザーが `.xlsx` をアップロードし、アプリがブラウザ内で再計算し、値または変更済みワークブックを返すパターンです。ファイルをサーバーに送らずに完結します。

::: warning ブラウザホスティングの要件
既定の `@libraz/formulon` WASM 入口はシリアルで、オリジン間分離を必要としません。`@libraz/formulon/threads` 入口を使う場合は COOP / COEP ヘッダーが必要です。[バンドラ設定](/ja/cell/bundler) と [トラブルシュート](/ja/start/troubleshooting) を参照してください。
:::

::: info 用語: ArrayBuffer / Uint8Array
ブラウザでは、ファイルのバイト列を `ArrayBuffer` で受け取り、`Uint8Array` として読み出せます。`File.arrayBuffer()` の戻り値を `new Uint8Array(buffer)` で包み、`loadBytes()` に渡します。読み込みが終わるまで、そのバッファを別のワーカーへ転送しないでください。
:::

## 流れ

<DiagramFlow steps="ユーザーが .xlsx を選択 → ArrayBuffer を読み込む → Module.Workbook.loadBytes → 入力値を変更 → recalc → 値を読む / バイト列を保存" />

## 最小実装

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const check = (status: { ok: boolean; message: string; context: string }) => {
  if (!status.ok) throw new Error(`${status.message}: ${status.context}`)
}

export async function recalcUpload(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const wb = Module.Workbook.loadBytes(bytes)

  try {
    if (!wb.isValid()) {
      throw new Error(Module.lastErrorMessage())
    }

    check(wb.recalc())
    const cell = wb.getValue(0, 0, 0)
    if (!cell.status.ok) {
      throw new Error(cell.status.message)
    }
    const saved = wb.save()

    if (!saved.status.ok || saved.bytes === null) {
      throw new Error(saved.status.message)
    }

    return { cell, bytes: saved.bytes }
  } finally {
    wb.delete()
  }
}
```

`try / finally` の形が重要です。ヘルパーやアプリケーションが再計算中に例外を送出しても、`wb.delete()` が WASM ヒープを解放します。

下のパネルでは、この関数にファイル選択と編集用のグリッドを組み合わせています。ワークブックを選ぶと `File.arrayBuffer()` で読み取ったバイト列を `loadBytes()` に渡し、再計算後の結果を埋め込みの `formulon-cell` グリッドに表示して、書き出したバイト列をダウンロードできます。ワークブックとして読めないファイルは `isValid()` で止まり、`lastErrorMessage()` の内容が表示されます。後述のエラー表の 1 行目にあたる挙動を、サーバーへの往復なしにその場で確認できます。

<RecalcDemo />

## メインスレッドの外でエンジンを動かす

大規模ワークブックは再計算中に UI を止めがちです。専用ワーカーにエンジンを切り出します。

```ts
// worker.ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()

self.onmessage = async (event) => {
  const bytes = new Uint8Array(event.data)
  const wb = Module.Workbook.loadBytes(bytes)
  try {
    if (!wb.isValid()) {
      throw new Error(Module.lastErrorMessage())
    }
    const recalculated = wb.recalc()
    if (!recalculated.ok) throw new Error(recalculated.message)
    const saved = wb.save()
    if (!saved.status.ok || saved.bytes === null) {
      self.postMessage({ ok: false, message: saved.status.message })
      return
    }
    self.postMessage({ ok: true, bytes: saved.bytes }, [saved.bytes.buffer])
  } catch (e) {
    self.postMessage({ ok: false, message: (e as Error).message })
  } finally {
    wb.delete()
  }
}
```

```ts
// main.ts
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
worker.onmessage = (event) => updateUi(event.data)

const buffer = await file.arrayBuffer()
worker.postMessage(buffer, [buffer])
```

バッファは 1 回だけ読み込み、そのまま送信データと転送リストの両方に渡します。`file.arrayBuffer()` を 2 回呼ぶと別々のバッファが 2 つできてしまい、転送リストに載らない方（実際の送信データ）はディープコピーされてしまいます。これでは転送可能オブジェクトを使う意味がなくなります。

<DiagramFlow steps="メインスレッド: ArrayBuffer を読み込む → postMessage(buffer, [buffer]) で所有権をワーカーへ転送 → ワーカーがバッファを所有し再計算 → postMessage(bytes, [bytes.buffer]) で結果を転送し返す → メインスレッドが結果を所有" label="メインスレッドが ArrayBuffer を読み込み、転送リスト付きの postMessage でワーカーに所有権を渡す。ワーカーが再計算してから結果のバッファをメインスレッドへ転送し返し、メインスレッドが出力バイト列の所有権を取り戻す図" />

転送リストを指定すると、`postMessage` によるバッファのコピーを避けられます。送信側のバッファは切り離され、以後は使えません。受信側がバイト列の所有権を持ちます。

## エラーの分岐

| 失敗 | 検出箇所 | 対応 |
| --- | --- | --- |
| `.xlsx` として不正 | `wb.isValid() === false`、`lastErrorMessage()` | 「対応していない Excel ファイルです」と表示 |
| セルの Excel エラー | `cell.status.ok === true` かつ `cell.value.kind === ValueKind.Error` | `Module.errorDisplayName(cell.value.errorCode)` で `#DIV/0!` などの表示文字列に変換して表示。アップロード自体は成功扱い |
| 保存失敗 | `saved.status.ok === false` | メッセージを出し、元のバイト列を保持 |
| 簡易エンジンが有効（`formulon-cell` の `WorkbookHandle` を `preferStub: true` で使った場合） | `isUsingStub()` が true | 計算機能が無効である旨をユーザーに通知 |

::: tip 保存に成功するまで元のバイト列を捨てない
アプリが再計算後の出力を永続化できるまでは、入力の `File` / `ArrayBuffer` を信頼すべき情報源として保持します。保存失敗時にユーザーのアップロードを失わずに済みます。
:::

## UX チェックリスト

- 読み込み前にファイルタイプ / サイズをクライアント側で検証
- 未対応関数の失敗はアップロード失敗ではなく互換性問題として見せる
- 保存成功までは元のバイト列を保持
- UI 応答性が必要ならワーカーで計算
- `@libraz/formulon/threads` を読み込む場合は COOP / COEP ヘッダーを配信し、`SharedArrayBuffer` が使えない状態を明示的に扱います。上のコードが使う生の `@libraz/formulon` 入口はシリアルで、これらのヘッダーを必要としません。`formulon-cell` の標準ローダーもシリアルです。`preferStub: true` はテストやデモで明示的に選ぶ場合だけ使います。

## 適合性の確認

データをブラウザ内に留めたい、プライバシーやオフライン挙動を重視する場面に適しています。大規模ワークブックを扱う場合やサーバー側でまとめて計算したい場合は Native Node / Python のサーバー側経路を検討してください。

## 次に読むもの

- [WASM 連携](/ja/runtimes/wasm) ─ ホスティングとバンドラ要件
- [ワークブックの流れ](/ja/workbook/lifecycle) ─ シナリオを支えるエンジンの流れ
- [formulon-cell](/ja/cell/) ─ 同じエンジンを使ったブラウザ向け表計算 UI キット
