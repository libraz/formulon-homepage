---
title: formulon-cell のインストール
description: Formulon WASM エンジン向けベータ版スプレッドシート UI パッケージの導入方法。
---

# インストール

`formulon-cell` は、このサイトで Formulon のブラウザ版デモホストとして使って
いるベータ版スプレッドシート UI パッケージです。`@libraz/formulon` の WASM
エンジンに、ブラウザ上で動く表計算ソフト風 UI を載せたい場合に使います。

```sh
npm install @libraz/formulon-cell zustand
```

`zustand` は peer dependency です。組み込み UI が購読しているストアを、
ホストアプリ側からも読めるように公開しています。

UI パッケージは安定化途上です。アプリケーションの再現性はパッケージマネージャの
lockfile で管理し、新しいリリースは意図して取り込んでください。

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
再計算、ワークブックの読み書きは実エンジンの挙動ではなくなります。
