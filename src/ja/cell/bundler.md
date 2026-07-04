---
title: バンドラ設定
description: formulon-cell と Formulon WASM エンジンに必要な Vite / ブラウザ設定。
---

# バンドラ設定

`formulon-cell` は pthread 有効版の `@libraz/formulon` WASM モジュールを
再利用します。そのため UI パッケージにも、エンジン本体と同じブラウザ向け
バンドル条件が必要です。

## Vite

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps: {
    exclude: ['@libraz/formulon-cell', '@libraz/formulon']
  },
  build: {
    target: 'es2022'
  },
  worker: {
    format: 'es'
  }
})
```

## なぜ必要か

上の `server` / `preview` ヘッダは、ローカルの Vite 配信だけを対象にします。
本番ホストでも spreadsheet エンジンを動かすページには同じ COOP / COEP
ヘッダを付けてください。

Worker は ES module として出力してください。Formulon の再計算スケジューラは
Emscripten 由来の module worker として起動します。

メインと worker の build target は ES2022 にします。エンジン wrapper が
top-level await と条件付き dynamic import を使うためです。

依存 pre-bundling からは `@libraz/formulon-cell` と `@libraz/formulon` の両方を
外します。Worker / WASM アセット解決を Emscripten wrapper とアプリの
バンドラに任せるためです。

COOP / COEP ヘッダは `SharedArrayBuffer` のために必要です。ヘッダが無い場合、
`WorkbookHandle.createDefault()` はデフォルトで **reject します** ─ 簡易エンジンへ
自動でフォールバックすることはありません。ローカル開発やテストで代わりの
エンジンが欲しいホストは、`preferStub: true` を明示的に渡してオプトインして
ください。reject はそれ以外の場面では修正すべき設定不備として扱い、UI 側で
穏便に吸収しないでください。[SharedArrayBuffer が無いと reject する](/ja/cell/index#sharedarraybuffer-が無いと-reject-する) 参照。
