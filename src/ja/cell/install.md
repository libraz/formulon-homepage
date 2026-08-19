---
title: formulon-cell のインストール
description: Formulon のブラウザ結合試験向け参考 UI ライブラリの導入方法。
---

# インストール

`formulon-cell` は、このサイトで Formulon のブラウザ版結合試験に使っている
参考 UI ライブラリです。公開はしていますが、Excel 互換の完成 UI ではありません。
機能網羅は部分的で、UI/UX も Excel に完全には寄せておらず、UI 側のバグが残る
可能性もあります。`@libraz/formulon` の WASM エンジンに、検証用・参考用の
ワークブック風ブラウザ画面を載せたい場合に使います。

::: warning Excel の代替ではありません
基本的なワークブック操作は使えますが、詳細な UI 互換性はこのパッケージの対象外です。Excel 相当の UI/UX をエンドユーザーへ約束する製品には使わないでください。
:::

```sh
npm install @libraz/formulon-cell zustand
```

`zustand` は peer dependency です。組み込み UI が購読しているストアを、
ホストアプリ側からも読めるように公開しています。

UI パッケージは参考実装として公開しています。アプリケーションの再現性は
パッケージマネージャの lockfile で管理し、新しいリリースは意図して取り込んでください。

## クイックスタート

```ts
import { Spreadsheet, WorkbookHandle, presets } from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const host = document.getElementById('sheet')!

try {
  const workbook = await WorkbookHandle.createDefault()

  const sheet = await Spreadsheet.mount(host, {
    workbook,
    features: presets.full(),
    locale: 'ja'
  })

  sheet.i18n.setLocale('en')
  sheet.setTheme('ink')
} catch (err) {
  // SharedArrayBuffer が無い（COOP/COEP 未設定）か、WASM の初期化に失敗した
  showConfigurationError(err)
}
```

## 実行時要件

Formulon の WASM パッケージは pthread を使います。ブラウザで
`SharedArrayBuffer` を有効にするには、ページを cross-origin isolated にする
必要があります。

```txt
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

これらのヘッダが無い場合、`WorkbookHandle.createDefault()` はデフォルトで
**reject します** ─ 劣化したエンジンへ黙ってフォールバックすることはありません。
reject を捕捉して（あるいは `Spreadsheet.mount()` に `MountOptions.onError` を渡して）、
いつまでも再計算されないスプレッドシートの代わりに設定エラーをホストへ表示してください。

テストと明示的なデモに限り、`preferStub: true` でインメモリの簡易エンジンへ
明示的にオプトインできます。

```ts
const wb = await WorkbookHandle.createDefault({ preferStub: true })
wb.isStub // true ─ 評価できる数式は SUM・AVERAGE・IF などごく小さい
          // サブセットに限られ（それ以外は #ERR! を返す）、
          // .xlsx / .xlsb の読み書きは一切できない
```

判定フローの詳細は [簡易エンジン](/ja/cell/index#sharedarraybuffer-が無いと-reject-する)、
必要なヘッダの配信方法は [バンドラ設定](/ja/cell/bundler) を参照してください。
