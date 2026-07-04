---
title: formulon-cell API 一覧
description: formulon-cell 参考 UI パッケージが公開する主な API。
---

# API 一覧

`formulon-cell` は、合成可能な部品で構成されています。エンジンをラップする `WorkbookHandle`、`SpreadsheetInstance` を作る `Spreadsheet.mount()`、型付きイベントバス、zustand ベースのストア、コマンドヘルパー、i18n コントローラ、テーマコントローラを提供します。主役のエンジンは `@libraz/formulon` のまま、これらは結合試験と実装例のための参考 UI API です。Excel 互換の完成 UI レイヤではありません。

::: info 用語: WorkbookHandle
`@libraz/formulon` のワークブックインスタンスとエンジン状態を包む薄いラッパーです。`Spreadsheet.mount()` とホストコードがネイティブメモリを直接管理せずに同じワークブックを共有するためにあります。
:::

## WorkbookHandle

```ts
import { WorkbookHandle } from '@libraz/formulon-cell'

// WASM エンジンで動く新規の空ワークブック
const wb = await WorkbookHandle.createDefault()

// 既存の .xlsx / .xlsb / .xls / .csv をバイト列から読み込む
const bytes = new Uint8Array(await file.arrayBuffer())
const loaded = await WorkbookHandle.loadBytes(bytes)

if (wb.isStub) {
  // preferStub: true を明示的に渡した場合のみ発生。インメモリの簡易エンジンが
  // 代わりに動いており、評価できる数式はごく小さいサブセットに限られる
}
```

`WorkbookHandle` が公開する static ファクトリは `createDefault(opts)` と `loadBytes(bytes, opts)` の 2 つだけです。`createEmpty()` や `fromBytes()` は存在しません。いずれも `SharedArrayBuffer` が無い場合はデフォルトで reject します。`preferStub` オプトインについては [SharedArrayBuffer が無いと reject する](/ja/cell/index#sharedarraybuffer-が無いと-reject-する) を参照してください。`Spreadsheet.mount({ workbook })` に渡し、UI とエンジンが同じ状態を共有するようにします。

## マウント

```ts
import { Spreadsheet, WorkbookHandle, presets } from '@libraz/formulon-cell'

const workbook = await WorkbookHandle.createDefault()
const instance = await Spreadsheet.mount(host, {
  workbook,
  features: presets.standard(),
  locale: 'ja',
  theme: 'paper'
})
```

`Spreadsheet.mount()` は `SpreadsheetInstance` を返します。公開メンバ:

| フィールド / メソッド | 役割 |
| --- | --- |
| `workbook` | `WorkbookHandle` |
| `store` | 組み込み UI が使う zustand リアクティブストア |
| `history` | undo / redo スタック |
| `i18n` | ランタイムロケールコントローラ |
| `setTheme(name)` | `paper` / `ink` / 独自テーマの切替 |
| `on(event, fn)` | 型付きイベント購読 |
| `dispose()` | マウント解除 / リスナ解放 |

## プリセット

プリセットは機能のまとまりを「UI 密度」で束ねたものです。

| プリセット | 用途 |
| --- | --- |
| `presets.minimal()` | グリッド、数式バー、ステータスバー、基本キーマップ |
| `presets.standard()` | 表示ツールバー、クイック分析、ワークブックオブジェクト調査、コンテキストメニュー、検索 / 置換、クリップボード、書式コピー、ホイールスクロール |
| `presets.full()` | デフォルトのフル UI。書式ダイアログ、形式を選択して貼り付け、条件付き書式、反復計算、ジャンプ機能、ページ設定、名前定義、ハイパーリンク、ピボットテーブル作成、入力規則、自動補完、ホバーコメント、スプレッドシート用キーマップ |

::: tip 必要最小のプリセットを選ぶ
プリセットは DOM とバンドルを増やします。ホストが既に独自ダイアログを持っているなら `presets.minimal()` まで下げ、[コマンドヘルパー](#コマンドヘルパー) を直接呼ぶのが軽量です。
:::

## 拡張

プリセット以外に、置換可能な UI 部品は引数を取らないファクトリとして、`features` とは別の `extensions` 配列に渡します。

```ts
import { Spreadsheet, presets, findReplace, formatDialog, hoverComment } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  workbook,
  features: { ...presets.minimal(), findReplace: false },
  extensions: [findReplace(), formatDialog(), hoverComment()]
})
```

全ファクトリのカタログ、`features` と `extensions` の使い分け、ライフサイクルは [埋め込みガイド](/ja/cell/embedding#選択的な拡張) を参照。

## イベント

```ts
const off = instance.on('selectionChange', (event) => {
  console.log(event.active)
})

off()
```

主なイベント:

| Event | 発火タイミング |
| --- | --- |
| `cellChange` | セル値 / 数式が編集された |
| `selectionChange` | アクティブセルや選択矩形が変わった |
| `workbookChange` | sheet 追加・削除・改名 / defined name 変更 |
| `localeChange` | `i18n.setLocale()` が辞書を切り替えた |
| `themeChange` | `setTheme()` がテーマを切り替えた |
| `recalc` | エンジンの再計算が完了した |

## Store

組み込み UI と拡張は、マウントごとに作られる [zustand](https://github.com/pmndrs/zustand) の vanilla ストアを読みます。これは `instance.store` として公開されます。グローバルな `useSpreadsheetStore` フックは存在しません ─ `Spreadsheet.mount()` を呼ぶたびに専用のストアが作られ、ホストはそのインスタンスに直接接続します。

```ts
const selection = instance.store.getState().selection

const unsubscribe = instance.store.subscribe((state) => {
  console.log(state.selection)
})
```

`subscribe` はセレクタではなく、state 全体を受け取るリスナ（`(state, prevState) => void`）を取ります。`State` の一部だけに関心がある場合は、コールバック内でフィルタしてください。

## コマンドヘルパー

組み込み UI を使わず、ホスト独自の UI から呼べるコマンドヘルパーも export しています。

- クリップボード / 形式を選択して貼り付け
- 書式設定
- 定義名、コメント、ハイパーリンク、入力規則
- ステータスバー向けの選択範囲集計
- ワークブックオブジェクト / 互換性サマリ
- シート表示、ページ設定、保護、参照元 / 参照先トレース、スライサー、セッション内チャート

この分離は意図的です。同梱プレイグラウンドはこれらを使って参考 UI を構成しますが、アプリ側はプレイグラウンドの UI を採用せず、エンジン連携済みコマンドだけを再利用できます。

## i18n コントローラ

```ts
instance.i18n.setLocale('ja')
instance.i18n.extend('ja', { contextMenu: { copy: 'コピーする' } })

import fr from './fr.js'
instance.i18n.register('fr', fr)
instance.i18n.setLocale('fr')
```

辞書の形と上書きパターンは [i18n](/ja/cell/i18n) を参照。

## テーマコントローラ

`setTheme('paper' | 'ink' | string)` で同梱テーマ / カスタムテーマを切り替えます。CSS 変数で独自テーマを定義できます。

```css
.fc-theme-mine {
  --fc-grid-bg: #faf6e8;
  --fc-grid-line: #b09870;
  /* styles/paper.css に全トークンが定義されています */
}
```

```ts
instance.setTheme('mine')
```

## 次に読むもの

- [埋め込みガイド](/ja/cell/embedding) ─ プリセットと拡張のアーキテクチャ、ヘッドレスモード
- [i18n](/ja/cell/i18n) ─ 辞書登録 / 上書き / 切替
- [バンドラ設定](/ja/cell/bundler) ─ ホストに必要な配信設定
