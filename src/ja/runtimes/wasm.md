# WASM 連携

WASM パッケージは Formulon の実行入口の中で最も適用範囲が広いものです。ブラウザ・Web Worker・Node から、JS API も `formulon-cell` も同じ `@libraz/formulon` バイナリで動かします。

npm の WASM ビルドは worksheet XML を DOM として読み込みます。シートを 1 枚ずつ処理するため、パース時のピークメモリは最大の worksheet XML に比例し、32-bit WASM アドレス空間内に収める必要があります。Native CLI は 256 KiB を超える XML で streaming に切り替えます。

::: warning ホスティングが重要
ブラウザでの成功はサーバーのヘッダー、Worker 形式、バンドラ挙動に依存します。ローカル開発環境だけでなく、デプロイ先で必ず確認してください。
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

どちらかでも欠けると、`createFormulon()` はそのままインスタンス化に失敗します ── pthread プール用の `SharedArrayBuffer` 生成が例外を投げ、Promise は reject されます。生の WASM ローダー自体にフォールバックはなく、`createFormulon()` を直接呼ぶコードは reject を自分で処理しなければなりません。`formulon-cell` のような上位ラッパーは、失敗する代わりに簡易エンジンへフォールバックすることを選べます（`preferStub: true`）が、それは `formulon-cell` 側の挙動であって `@libraz/formulon` の挙動ではありません。opt-in のフォールバック経路は [formulon-cell](/ja/cell/) を参照してください。
:::

<DiagramFlow steps="ページ読み込み → COOP/COEP ヘッダー確認 → createFormulon() → SharedArrayBuffer / pthread プール → Workbook.loadBytes()" />

## Module は 1 度だけ初期化する

Worker / プロセスごとに 1 度 `createFormulon()` を呼び、関連処理で workbook インスタンスを再利用します。

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const result = Module.evalFormula('=SUM(1,2,3)')
```

`createFormulon()` は非同期です。ブラウザでは `.wasm` の取得と pthread プールの起動を伴うため、`Module` 参照は長寿命にしてください。

## 並列再計算

`Workbook.recalc()` はシリアルに呼び出し側スレッドで実行する API のままです。`Workbook.recalcParallel(threadCount)` は同期 API で、すべての worker が終了したあとに `{ status, stats }` を返します。`threadCount` が `0` の場合は最大 8 の自動検出、`1` の場合は worker を起動せず呼び出し側スレッドだけで実行し、`2..8` の場合は worker 数の上限を指定します。未指定、小数、有限でない値、負数、8 超の値は `kInvalidArgument` で失敗します。

```ts
const result = workbook.recalcParallel(0)
if (!result.status.ok) throw new Error(Module.lastErrorMessage())
```

ブラウザで並列再計算を使う場合も、前述の ES module worker と COOP / COEP ヘッダーが必要です。`stats` には実行した処理と実際に起動した worker 数が入り、要求値より少ない worker 数で完了する場合があります。

## バイト列を明示的に渡す

ワークブックの入出力はバイト列で行います。UI 層・アップロード層・永続化層と計算層を切り離す設計です。

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

WASM ビルドには厳しいサイズ予算があります。ブラウザに乗るパスへの依存追加は測定したうえで行ってください。実数値は [サイズ予算](/ja/development/size-budgets) を参照。

## Bundler 設定

Vite では ES module worker を指定します。

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@libraz/formulon'] },
  build: {
    target: 'es2022',
    rollupOptions: { external: [/^node:/] }
  }
})
```

ブラウザでは、pthread worker を有効にする場合は上記の COOP / COEP ヘッダを配信してください。`formulon-cell` 側の同じ設定は [バンドラ設定](/ja/cell/bundler)、bundler のよくあるメッセージは [トラブルシュート](/ja/start/troubleshooting) を参照。

## 次に読むもの

- [WASM API](/ja/api/wasm) ─ API の詳細
- [ワークブックの流れ](/ja/workbook/lifecycle) ─ open / edit / recalc / save
- [ブラウザでアップロード](/ja/scenarios/browser-upload) ─ end-to-end の例
