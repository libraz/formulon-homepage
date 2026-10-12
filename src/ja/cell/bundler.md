---
title: バンドラ設定
description: formulon-cell と WASM アセットをブラウザで読み込むための設定です。
---

# バンドラ設定

`formulon-cell` はブラウザ向けの ESM パッケージです。エンジンパッケージ `@libraz/formulon` は Emscripten でビルドされており、自身の JavaScript と同じ場所にある `.wasm` ファイルを `import.meta.url` から探します。そのためバンドラ側では、このパッケージを加工せずにアセットを出力するだけで済みます。

## Vite

Vite アプリケーションでは、次の設定から始められます。

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    exclude: ['@libraz/formulon-cell', '@libraz/formulon']
  },
  build: {
    target: 'es2022'
  }
})
```

除外を指定すると、開発サーバーの事前バンドルによってエンジンの JavaScript が `.wasm` ファイルと別の場所へ移されることを防げます。エンジンの初期化関数がトップレベル `await` を使うため、ターゲットは ES2022 が必要です。

```ts
// ブラウザのエントリーポイント
import '@libraz/formulon-cell/styles.css'
```

## その他のバンドラ

webpack、esbuild などを使う場合も、パッケージをブラウザ向け ESM として扱い、生成されたアプリケーションから Formulon の WASM アセットを配信できるようにします。標準の `formulon-cell` ローダーに特別なクロスオリジン分離（COOP/COEP）ヘッダーは必要ありません。

デプロイしたアプリケーションの初期化に失敗した場合は、まずブラウザのネットワークパネルを確認します。パッケージの JavaScript と `.wasm` アセットが出力先に存在し、ページから到達できる必要があります。

## 確認項目

- `@libraz/formulon-cell/styles.css` を 1 回読み込みます。
- Vite の依存関係の事前バンドルから `@libraz/formulon-cell` と `@libraz/formulon` を除外します。
- ES2022 など、現行ブラウザ向けのターゲットでビルドします。
- 生成された `.wasm` アセットがコピーされ、配信されることを確認します。
- マウント先の要素に高さを指定します。バンドラ設定だけではレイアウトの高さは決まりません。

標準ローダーは単一スレッドで動作し、ワーカーを起動せず、`SharedArrayBuffer` も使いません。`@libraz/formulon/threads` を直接読み込むアプリケーションだけが、Vite 設定の `worker: { format: 'es' }` とクロスオリジン分離ヘッダー（`Cross-Origin-Opener-Policy: same-origin`、`Cross-Origin-Embedder-Policy: require-corp`）を必要とします。
