# WASM 連携

`@libraz/formulon` は、ブラウザ、ワーカー、Node でエンジンを WebAssembly として動かします。

## インストールと最初の呼び出し

```sh
yarn add @libraz/formulon@0.18.0
```

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const result = Module.evalFormula('=SUM(1,2,3)')
if (result.status.ok) console.log(result.value.number) // 6
```

パッケージは ESM 専用で、ブラウザ以外では Node 22 以降が必要です。`createFormulon()` は非同期で `formulon.wasm` を読み込みます。ワーカーまたはプロセスごとに 1 回だけ呼び、`Module` の参照を保持してください。

## 入口を選ぶ

パッケージは同じ API を持つ 2 つの入口を公開します。`@libraz/formulon` は単一スレッドの既定ビルドです。通常のメモリを使うため、ブラウザでオリジン間分離なしに読み込めます。`@libraz/formulon/threads` は並列再計算用の pthread ビルドで、必要な場合だけ使います。`formulon_threads.wasm` を読み込んでワーカープールを起動し、ブラウザでは `SharedArrayBuffer` とオリジン間分離が必要です。`formulon-cell` の標準ローダーは単一スレッドの入口を使います。

```ts
import createFormulon from '@libraz/formulon/threads'

const ThreadedModule = await createFormulon()
```

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

<DiagramFlow
  :steps="[
    { label: 'ページ読み込み', note: 'COOP / COEP はこの応答で決まる' },
    { label: '入口を選ぶ', note: '@libraz/formulon か /threads' },
    { label: 'モジュールを作成', note: '既定は逐次、/threads はワーカープール' },
    { label: 'Workbook.loadBytes()', note: 'バイト列を渡す。終了時に delete()' }
  ]"
  label="ブラウザでの起動順。ページの応答がヘッダーを決め、既定の入口か threads の入口を選び、モジュールが逐次またはワーカープールで起動し、Workbook.loadBytes() がバイト列を受け取る"
  caption="クロスオリジン分離が必要なのは /threads の入口だけで、既定の入口は COOP / COEP なしで動作します。"
/>

## 並列再計算

`Workbook.recalc()` は呼び出し元スレッドで直列に実行する API です。`Workbook.recalcParallel(threadCount)` は同期 API で `{ status, stats }` を返します。既定の入口では直列に評価して `stats.workerThreadsStarted === 0` を返し、`@libraz/formulon/threads` では最大 `threadCount` 個のワーカー（`0` は自動検出で最大 8）を起動して、すべて終了してから返ります。指定できる値は [WASM API](/ja/api/wasm#method-notes) を参照してください。

```ts
const result = workbook.recalcParallel(0)
if (!result.status.ok) throw new Error(Module.lastErrorMessage())
```

ブラウザで threads 入口を使う場合は、ES module ワーカーと前述の COOP / COEP ヘッダーが必要です。スケジューラは要求より少ないワーカーで済ませることがあり、実際に起動した数は `stats` で確認できます。

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

::: tip ライフタイムをヘルパーで包む
try / finally を `withWorkbook(bytes, fn)` のようなヘルパーに閉じ込めると、毎回の呼び出しが揃います。`delete()` を忘れるとリロードまで WASM ヒープ内に残るリークになります。
:::

## メモリの上限 {#memory-limits}

WASM ビルドはワークシート XML を DOM として、1 枚ずつ解析します。そのため解析時のピークメモリはパッケージ全体ではなく最大のワークシート XML で決まり、作業領域は 32-bit の WASM アドレス空間に収める必要があります。Python の wheel もエンジンを WebAssembly で動かすため、同じ上限があります。ネイティブの CLI は、ワークシート XML が 256 KiB を超えるとストリーミング解析に切り替えます。どの実行環境でも、まず各ワークシートのパートを丸ごとメモリに展開します（zip の展開上限は 1 エントリ 100 MiB、1 回の読み込みで 256 MiB）。ストリーミング解析で省けるのは DOM ツリーだけで、展開したバッファは残ります。

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
