# ブラウザでワークブックを開く

ユーザーが `.xlsx` をアップロードし、アプリがブラウザ内で再計算し、値または変更済みワークブックを返すパターンです。ファイルをサーバーに送らずに完結します。

::: warning ブラウザホスティングの要件
WASM ビルドは Web Worker と pthread を使います。pthread worker が有効な状態で動かすには、本番ホストでも cross-origin isolation ヘッダを返す必要があります ─ [バンドラ設定](/ja/cell/bundler) と [トラブルシュート](/ja/start/troubleshooting) を参照。
:::

::: info 用語: ArrayBuffer / Uint8Array
Formulon がワークブックバイト列として受け取る、ブラウザ標準の API。`File.arrayBuffer()` は `ArrayBuffer` を返し、`new Uint8Array(buffer)` でラップしてから `loadBytes()` に渡します。`loadBytes()` が戻るまで両者は生存している必要があります。
:::

## 流れ

```mermaid
flowchart LR
  A[User selects .xlsx] --> B[Read ArrayBuffer]
  B --> C[Module.Workbook.loadBytes]
  C --> D[Mutate inputs]
  D --> E[recalc]
  E --> F[Read values or save bytes]
```

## 最小実装

```ts
import createFormulon, { ValueKind } from '@libraz/formulon'

const Module = await createFormulon()

export async function recalcUpload(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const wb = Module.Workbook.loadBytes(bytes)

  try {
    if (!wb.isValid()) {
      throw new Error(Module.lastErrorMessage())
    }

    wb.recalc()
    const cell = wb.getValue(0, 0, 0)
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

`try / finally` の形が重要です。recalc 中に throw しても `wb.delete()` が WASM heap を解放します。

## メインスレッドの外で engine を動かす

大規模ワークブックは recalc 中に UI を止めがちです。専用 Worker に engine を切り出します。

```ts
// worker.ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()

self.onmessage = async (event) => {
  const bytes = new Uint8Array(event.data)
  const wb = Module.Workbook.loadBytes(bytes)
  try {
    wb.recalc()
    const saved = wb.save()
    self.postMessage({ ok: true, bytes: saved.bytes }, [saved.bytes!.buffer])
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
worker.postMessage(await file.arrayBuffer(), [await file.arrayBuffer()])
```

transferable `ArrayBuffer` を使うとコピーが 1 回で済みます。`postMessage` 以降、メインスレッド側からはバッファに触れなくなりますが、所有権は worker に移っているので問題ありません。

## エラーの分岐

| 失敗 | 検出箇所 | 対応 |
| --- | --- | --- |
| `.xlsx` として不正 | `wb.isValid() === false`、`lastErrorMessage()` | 「対応していない Excel ファイルです」と表示 |
| セルの Excel エラー | `value.kind === ValueKind.Error` | 行内にエラー値を描画。アップロード自体は成功扱い |
| 保存失敗 | `saved.status.ok === false` | メッセージを出し、元の bytes を保持 |
| stub engine フォールバック | （cell パッケージで）`isUsingStub()` が true | 計算機能が無効である旨をユーザーに通知 |

::: tip 保存に成功するまで元の bytes を捨てない
アプリが再計算後の出力を永続化できるまでは、入力の `File` / `ArrayBuffer` を信頼すべき情報源として保持します。保存失敗時にユーザーのアップロードを失わずに済みます。
:::

## UX チェックリスト

- 読み込み前にファイルタイプ / サイズをクライアント側で検証
- 未対応関数の失敗はアップロード失敗ではなく互換性問題として見せる
- 保存成功までは元 bytes を保持
- UI 応答性が必要なら worker で計算
- cross-origin isolation の欠落を明示する（stub engine への黙ったフォールバックはユーザーを混乱させます）

## 適合性の確認

データをブラウザ内に留めたい、プライバシーやオフライン挙動を重視する場面に最適です。大規模ワークブックや中央集権で計算したい場合は Native Node / Python のサーバーサイド経路を検討してください。

## 次に読むもの

- [WASM 連携](/ja/runtimes/wasm) ─ ホスティングと bundler 要件
- [ワークブックの流れ](/ja/workbook/lifecycle) ─ シナリオを裏で支える engine フロー
- [formulon-cell](/ja/cell/) ─ 同じ engine をスプレッドシート UI 付きで使いたい場合
