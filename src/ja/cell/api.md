---
title: formulon-cell API 一覧
description: formulon-cell UI パッケージが公開する主な API。
---

# API 一覧

`formulon-cell` は、合成可能なピース ─ engine をラップする `WorkbookHandle`、`SpreadsheetInstance` を作る `Spreadsheet.mount()`、型付きイベントバス、zustand backed store、command helper、i18n コントローラ、テーマコントローラ ─ で構成されています。主役のエンジンは `@libraz/formulon` のまま、これらは spreadsheet surface を作るための API です。

::: info 用語: WorkbookHandle
`@libraz/formulon` の workbook インスタンスと engine ステータスを包む薄いラッパー。`Spreadsheet.mount()` とホストコードがネイティブメモリを直接管理せずに同じワークブックを共有するためにあります。
:::

## WorkbookHandle

```ts
import { WorkbookHandle, isUsingStub } from '@libraz/formulon-cell'

const wb = await WorkbookHandle.createDefault()
// または
const wb = await WorkbookHandle.createEmpty()
// または
const wb = await WorkbookHandle.fromBytes(arrayBufferOrUint8Array)

if (isUsingStub()) {
  // SharedArrayBuffer が無効 ─ recalc は no-op
}
```

`WorkbookHandle` は engine 参照を所有します。`Spreadsheet.mount({ workbook })` に渡し、UI と engine が同じ状態を共有するようにします。

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
| `store` | chrome が使う zustand リアクティブストア |
| `history` | undo / redo スタック |
| `i18n` | ランタイムロケールコントローラ |
| `setTheme(name)` | `paper` / `ink` / 独自テーマの切替 |
| `on(event, fn)` | 型付きイベント購読 |
| `dispose()` | マウント解除 / リスナ解放 |

## Presets

preset は機能のまとまりを「UI 密度」で束ねたものです。

| Preset | 用途 |
| --- | --- |
| `presets.minimal()` | グリッド、数式バー、ステータスバー、基本キーマップ |
| `presets.standard()` | View toolbar、Quick Analysis、workbook object inspector、context menu、検索 / 置換、clipboard、format painter、wheel scroll |
| `presets.full()` | デフォルトの full chrome。format dialog、paste special、conditional formatting、iterative calculation、Go To Special、page setup、named ranges、hyperlink、PivotTable 作成、validation、autocomplete、hover comment、spreadsheet keymap |

::: tip 必要最小の preset を選ぶ
preset は DOM とバンドルを増やします。ホストが既に独自ダイアログを持っているなら `presets.minimal()` まで下げ、[command helper](#command-helpers) を直接呼ぶのが軽量です。
:::

## Extensions

preset 以外に、置換可能な UI ピースは extension factory として `features` に渡せます。

```ts
import {
  Spreadsheet,
  presets,
  formatDialogExtension,
  findReplaceExtension,
  hoverCommentsExtension
} from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  workbook,
  features: [
    ...presets.minimal(),
    findReplaceExtension(),
    hoverCommentsExtension({ delayMs: 200 }),
    formatDialogExtension({ accent: 'orange' })
  ]
})
```

カタログとライフサイクルは [埋め込みガイド](/ja/cell/embedding) を参照。

## Events

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
| `recalc` | engine の再計算が完了した |

## Store

chrome と extension は zustand store を読みます。ホストも同じ store にそのまま接続できます。

```ts
import { useSpreadsheetStore } from '@libraz/formulon-cell'

const selection = useSpreadsheetStore.getState().selection
const unsubscribe = useSpreadsheetStore.subscribe(
  (state) => state.selection,
  (sel) => console.log(sel)
)
```

## Command Helpers

ビルトイン UI を使わず、ホスト独自の chrome から呼べる command helper も export しています。

- clipboard / paste-special
- formatting
- named ranges、comments、hyperlinks、validation
- status bar 向け selection aggregates
- workbook object / 互換性サマリ
- sheet view、page setup、protection、trace arrow、slicer、session chart

この分離は意図的です。同梱 playground はこれらを使って spreadsheet UI を構成しますが、アプリ側は playground chrome を採用せず engine 連携済み command だけを再利用できます。

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

- [埋め込みガイド](/ja/cell/embedding) ─ preset / extension / headless
- [i18n](/ja/cell/i18n) ─ 辞書登録 / 上書き / 切替
- [バンドラ設定](/ja/cell/bundler) ─ ホストに必要な配信設定
