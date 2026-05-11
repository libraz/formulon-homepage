---
title: formulon-cell のインストール
description: Formulon WASM エンジン向けベータ版 spreadsheet UI パッケージの導入方法。
---

# インストール

`formulon-cell` は、このサイトで Formulon のブラウザ版デモホストとして使って
いるベータ版 spreadsheet UI パッケージです。`@libraz/formulon` の WASM
エンジンに desktop-spreadsheet-style なブラウザ surface を載せたい場合に
使います。

```sh
npm install @libraz/formulon-cell zustand
```

`zustand` は peer dependency です。ビルトイン chrome が購読している store を、
ホストアプリ側からも読むために公開しています。

UI surface は安定化途上です。アプリケーションの再現性は package manager の
lockfile で管理し、新しい release は意図して取り込んでください。

## クイックスタート

```ts
import { Spreadsheet, WorkbookHandle, presets } from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const host = document.getElementById('sheet')!
const workbook = await WorkbookHandle.createDefault()

const sheet = await Spreadsheet.mount(host, {
  workbook,
  features: presets.full(),
  locale: 'ja'
})

sheet.i18n.setLocale('en')
sheet.setTheme('ink')
```

## 実行時要件

Formulon の WASM パッケージは pthread を使います。ブラウザで
`SharedArrayBuffer` を有効にするには、ページを cross-origin isolated にする
必要があります。

```txt
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

これらのヘッダが無い場合、`formulon-cell` はインメモリのスタブエンジンへ
フォールバックします。UI のレイアウトや操作確認には使えますが、数式評価、
再計算、ワークブック round-trip は実エンジンの挙動ではなくなります。
