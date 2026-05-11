# WASM 連携

WASM パッケージは Formulon の最も広い surface です。ブラウザ・Web Worker・Node から、JS API も `formulon-cell` も同じ `@libraz/formulon` バイナリで動かします。

::: warning ホスティングが重要
ブラウザでの成功は server ヘッダ・worker 形式・bundler 挙動に依存します。ローカル dev だけでなく、デプロイ先で必ず確認してください。
:::

::: info 用語: pthread worker
WASM モジュールは `-pthread` 付きでビルドされており、recalc scheduler が内部で Emscripten 由来の Web Worker を起動します。Worker 間で WASM heap を共有するために `SharedArrayBuffer` を使うため、ブラウザでは cross-origin isolation が必要になります。
:::

::: info 用語: COOP / COEP（Cross-Origin Isolation）
ブラウザが `SharedArrayBuffer` を公開するために必要な 2 つの HTTP レスポンスヘッダです。両方をページに付ける必要があります。

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

どちらかでも欠けると `createFormulon()` は stub engine にフォールバックします。
:::

## Module は 1 度だけ初期化する

Worker / プロセスごとに 1 度 `createFormulon()` を呼び、関連処理で workbook インスタンスを再利用します。

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const result = Module.evalFormula('=SUM(1,2,3)')
```

`createFormulon()` は非同期です。ブラウザでは `.wasm` の取得と pthread プールの起動を伴うため、`Module` 参照は長寿命にしてください。

## bytes を明示的に渡す

ワークブックの入出力は bytes で行います。UI 層・アップロード層・永続化層と計算層を切り離す設計です。

WASM `Workbook` ハンドルはネイティブメモリを持ち、JS の GC 対象ではありません。使い終わったら必ず `delete()` してください。

```ts
const workbook = Module.Workbook.loadBytes(bytes)
try {
  if (!workbook.isValid()) throw new Error(Module.lastErrorMessage())
  workbook.recalc()
} finally {
  workbook.delete()
}
```

::: tip ライフタイムをヘルパで包む
try / finally を `withWorkbook(bytes, fn)` のようなヘルパに閉じ込めると、毎回の呼び出しが揃います。`delete()` を忘れるとリロードまで WASM heap 内で残るリークになります。
:::

## サイズ予算

WASM ビルドには厳しいサイズ予算があります。ブラウザに乗るパスへの依存追加は測定したうえで行ってください。実数値は [Size budgets](/ja/development/size-budgets) を参照。

## Bundler 設定

Vite では ES module worker を指定します。

```ts
export default defineConfig({
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@libraz/formulon'] },
  build: {
    target: 'es2022',
    rollupOptions: { external: [/^node:/] }
  }
})
```

ブラウザでは pthread worker を有効にする前に COOP / COEP ヘッダを配信してください。`formulon-cell` 側の同じ設定は [バンドラ設定](/ja/cell/bundler)、bundler のよくあるメッセージは [トラブルシュート](/ja/start/troubleshooting) を参照。

## 次に読むもの

- [WASM API](/ja/api/wasm) ─ surface の詳細
- [ワークブックの流れ](/ja/workbook/lifecycle) ─ open / edit / recalc / save
- [ブラウザでアップロード](/ja/scenarios/browser-upload) ─ end-to-end の例
