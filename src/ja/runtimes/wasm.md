# WASM 連携

WASM パッケージは、同じ API を持つ 2 つのエントリーポイントを公開します。`@libraz/formulon` は単一スレッドの既定ビルドです。通常のメモリを使うため、ブラウザでオリジン間分離なしに読み込めます。`@libraz/formulon/threads` は並列再計算用の任意選択の pthread ビルドで、ブラウザ側では `SharedArrayBuffer` とオリジン間分離が必要です。`formulon-cell` の標準ローダーはシリアル入口を使います。ワーカーが必要な統合だけが threads 入口を明示的に読み込みます。

npm の WASM ビルドはワークシート XML を DOM として読み込みます。シートを 1 枚ずつ処理するため、解析時のピークメモリは最大のワークシート XML に比例し、32-bit WASM アドレス空間内に収める必要があります。Native CLI は 256 KiB を超える XML でストリーミングに切り替えます。

::: warning ホスティングが重要
ブラウザでの成功はサーバーのヘッダー、Worker 形式、バンドラ挙動に依存します。ローカル開発環境だけでなく、デプロイ先で必ず確認してください。
:::

::: info 用語: pthread ワーカー
`-pthread` 付きでビルドされるのは `@libraz/formulon/threads` 入口だけです。この再計算スケジューラは Emscripten 経由で Web ワーカーを起動し、ワーカー間で WASM ヒープを共有するために `SharedArrayBuffer` を使います。既定の `@libraz/formulon` 入口は単一スレッドです。
:::

::: info 用語: COOP / COEP（Cross-Origin Isolation）
ブラウザが `SharedArrayBuffer` を公開するための HTTP レスポンスヘッダーです。`@libraz/formulon/threads` や別の pthread 統合を読み込む場合は、両方をページに付けます。

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

ヘッダーがない場合、`@libraz/formulon/threads` は pthread プール用の `SharedArrayBuffer` を作成できず、ファクトリの Promise が失敗します。既定の `@libraz/formulon` ファクトリにこのヘッダーは必要ありません。生の WASM ローダー自体にフォールバックはないため、pthread 入口を直接呼ぶコードは失敗を処理してください。`formulon-cell` の `preferStub: true` はテストやデモで簡易エンジンを選ぶためのオプションです。この挙動は `formulon-cell` 側のものです。設定は [formulon-cell](/ja/cell/) を参照してください。
:::

<DiagramFlow steps="ページ読み込み → @libraz/formulon または /threads を選択 → 通常メモリ、または COOP/COEP + ワーカープール → Workbook.loadBytes()" />

## Module は 1 度だけ初期化する

ワーカー / プロセスごとに 1 度 `createFormulon()` を呼び、関連処理でワークブックのインスタンスを再利用します。

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const result = Module.evalFormula('=SUM(1,2,3)')
```

`createFormulon()` は非同期です。既定入口は `formulon.wasm` を取得し、threads 入口は `formulon_threads.wasm` を取得してワーカープールを起動します。`Module` 参照は長寿命にしてください。

```ts
import createFormulon from '@libraz/formulon/threads'

const ThreadedModule = await createFormulon()
```

## 並列再計算

`Workbook.recalc()` はシリアルに呼び出し側スレッドで実行する API のままです。`Workbook.recalcParallel(threadCount)` は同期 API で `{ status, stats }` を返します。既定の `@libraz/formulon` 入口はこの呼び出しを受け付けますが、シリアルに評価し、`stats.workerThreadsStarted === 0` を報告します。`@libraz/formulon/threads` 入口はワーカーを起動し、全ワーカーの終了後に返ります。`threadCount` が `0` の場合は最大 8 の自動検出、`1` の場合はワーカーを起動せず呼び出し側スレッドだけで実行し、`2..8` の場合はワーカー数の上限を指定します。未指定、小数、有限でない値、負数、8 超の値は `kInvalidArgument` で失敗します。

```ts
const result = workbook.recalcParallel(0)
if (!result.status.ok) throw new Error(Module.lastErrorMessage())
```

threads 入口をブラウザで使う場合は、前述の ES module ワーカーと COOP / COEP ヘッダーが必要です。`stats` には実行した処理と実際に起動したワーカー数が入り、要求値より少ないワーカー数で完了する場合があります。

## バイト列を明示的に渡す

ワークブックの入出力はバイト列で行います。UI 層・アップロード層・永続化層と計算層を切り離す設計です。

WASM `Workbook` ハンドルはネイティブメモリを持ち、JS の GC 対象ではありません。使い終わったら必ず `delete()` してください。

```ts
const workbook = Module.Workbook.loadBytes(bytes)
try {
  if (!workbook.isValid()) throw new Error(Module.lastErrorMessage())
  const recalculated = workbook.recalc()
  if (!recalculated.ok) throw new Error(recalculated.message)
} finally {
  workbook.delete()
}
```

::: tip ライフタイムをヘルパで包む
try / finally を `withWorkbook(bytes, fn)` のようなヘルパーに閉じ込めると、毎回の呼び出しが揃います。`delete()` を忘れるとリロードまで WASM ヒープ内に残るリークになります。
:::

## サイズ上限

WASM ビルドにはサイズ上限があります。ブラウザ向けのコードに依存関係を追加するときは、サイズへの影響を測定してください。具体的な上限は [サイズ上限](/ja/development/size-budgets) を参照してください。

## バンドラ設定

`@libraz/formulon/threads` を読み込む場合、Vite では ES module ワーカーを指定します。

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

既定の `@libraz/formulon` 入口には ES module ワーカーも COOP / COEP ヘッダーも必要ありません。ブラウザで threads 入口を有効にする場合は上記のヘッダーを配信してください。`formulon-cell` の標準ローダーはシリアルです。pthread ワーカーを明示的に使う場合は [バンドラ設定](/ja/cell/bundler) と [トラブルシュート](/ja/start/troubleshooting) を参照してください。

## 次に読むもの

- [WASM API](/ja/api/wasm) ─ API の詳細
- [ワークブックの流れ](/ja/workbook/lifecycle) ─ 開く / 編集 / 再計算 / 保存
- [ブラウザでアップロード](/ja/scenarios/browser-upload) ─ 一連の処理例
