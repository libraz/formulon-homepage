---
title: formulon-cell の埋め込み
description: ホスト側のポリシー、コマンド、ライフサイクルで表計算 UI を組み込む方法です。
---

# 埋め込みガイド

コア API は、スプレッドシートの表示と周囲のアプリケーションを分けて扱います。埋め込み先のアプリケーション（ホスト）で表示する UI、編集を許可するセル、メニューやダイアログなどの浮動 UI の配置、ワークブックのライフサイクルを選択します。

マウント前にパッケージのスタイルシートを読み込み、ホスト要素に高さを指定します。CSS の読み込み、サイズ指定、破棄方法は [インストール](/ja/cell/install) を参照してください。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: { profile: 'standard', theme: 'paper' },
  policy,
  viewport,
  contextMenu,
  overlays
})
```

これらのオプションで使うアドレスは 0 始まりです。セルは `{ sheet, row, col }`、範囲は `{ sheet, r0, c0, r1, c1 }` で表し、範囲の両端を含みます。

## 利用例: レポートビューアー

レポートページではグリッドをコンパクトにし、すべての変更操作を無効にします。

```ts
import {
  Spreadsheet,
  viewerPolicy,
  WorkbookHandle
} from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const workbook = await WorkbookHandle.loadBytes(reportBytes)
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: {
    profile: 'embedded',
    theme: 'paper',
    features: { clipboard: true, shortcuts: true }
  },
  toolbar: false,
  policy: viewerPolicy(),
  viewport: {
    range: { sheet: 0, r0: 0, c0: 0, r1: 40, c1: 8 },
    tabBoundary: 'stop'
  },
  contextMenu: { mode: 'disabled' }
})
```

`viewerPolicy()` は選択とコピーを許可し、編集を拒否します。エクスポートやページ移動のボタンはグリッドの周囲にホスト側で追加できます。

<CellEmbedDemo scenario="viewer" />

## 利用例: 入力セルを限定したフォーム

フォームでは入力セルを宣言し、Tab 移動をそのセルに合わせます。

```ts
import {
  fixedFormPolicy,
  Spreadsheet,
  WorkbookHandle
} from '@libraz/formulon-cell'

const workbook = await WorkbookHandle.createDefault()
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: {
    profile: 'embedded',
    features: { clipboard: true, shortcuts: true }
  },
  policy: fixedFormPolicy([
    { sheet: 0, r0: 2, c0: 1, r1: 20, c1: 3 }
  ]),
  viewport: {
    range: { sheet: 0, r0: 0, c0: 0, r1: 24, c1: 5 },
    tabNavigation: 'editable',
    tabBoundary: 'stop'
  }
})

// ホストが行う事前入力または更新です。ユーザーの編集操作ではありません。
instance.applyChanges([
  { addr: { sheet: 0, row: 2, col: 1 }, input: 'Ada Lovelace' }
])
```

`fixedFormPolicy()` は範囲の配列、`EditableCells` の判定関数、または `ranges` / `predicate` を持つオブジェクトを受け取ります。ヘルパーは宣言したセルへの値入力、値の消去、貼り付け、オートフィルを許可します。フォームに別の操作を許可する場合は `InteractionPolicy` を明示します。ポリシーが有効な間、組み込み UI は数式バー、クリップボード、ショートカット、ホイール操作、コンテキストメニューに限られます。ほかの組み込み機能は機能フラグが有効でも利用できません。詳しくは [オプション](/ja/cell/options#operation-policy) を参照してください。

<CellEmbedDemo scenario="form" />

## ホスト更新とユーザー操作

`instance.applyChanges()` はホストが信頼して実行する更新です。事前入力、サーバーからの更新、ホスト側で適用を許可したインポートに使います。現在のビューポートの外側にあるワークブック内のセルも対象にでき、成功時の既定の履歴モードではユーザーの履歴をリセットします。

ポリシーに従う必要があるユーザーのセル編集には `instance.commands.execute()` を使います。公開されている低レベルのコマンドヘルパーは信頼済みのホスト API として扱い、その利用可否はホスト側で判断してください。ホスト更新を元に戻せる操作として記録する場合は `history: 'record'` を渡し、拒否された `ChangeBatchResult` を処理します。

```ts
const result = instance.applyChanges(
  [{ addr: { sheet: 0, row: 4, col: 2 }, input: 'Approved' }],
  { history: 'record', origin: 'server-refresh' }
)

if (result.status === 'rejected') showUpdateError(result.rejected)
```

## 利用例: ホスト側のツールバーとメニュー

小さい UI プロファイルから始め、周囲のコントロールをアプリケーション側で管理します。

```ts
import {
  presets,
  Spreadsheet
} from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  workbook,
  features: presets.minimal(),
  toolbar: false,
  contextMenu: {
    mode: 'host',
    onOpen: ({ cell, selection, permission }) => {
      openCellMenu({
        cell,
        selection,
        canEdit: permission({
          operation: 'valueEdit',
          origin: 'contextMenu',
          effects: [{ kind: 'cells', cells: [cell] }]
        }).allowed
      })
    }
  }
})
```

`host` モードはブラウザと組み込みのメニューを抑止し、現在のセル、選択範囲、権限を問い合わせる関数をアプリケーションへ渡します。ホスト側のメニューから公開のコマンドヘルパーを呼ぶことも、ホストのモーダルを開くこともできます。

組み込みメニューにホストの項目を 1 つ追加する場合は、`mode: 'builtIn'` と `transform` コールバックを使います。

```ts
import type { ContextMenuOptions } from '@libraz/formulon-cell'

const contextMenu: ContextMenuOptions = {
  mode: 'builtIn' as const,
  transform: ({ defaultItems }) => [
    ...defaultItems,
    {
      id: 'host:details',
      label: 'Open details',
      action: ({ cell }) => openDetails(cell)
    }
  ]
}
```

ホスト側に別の操作面がある場合や、コンパクトなビューアーで右クリックメニューを出さない場合は `{ mode: 'disabled' }` を使います。

## 実行時の変更

ワークブックを置き換えずに、マウント後の設定を変更できます。

```ts
instance.setUi({ profile: 'minimal', theme: 'ink' })
instance.setPolicy(viewerPolicy())
instance.setViewportOptions({
  range: { sheet: 0, r0: 0, c0: 0, r1: 30, c1: 6 }
})
instance.setContextMenu({ mode: 'disabled' })
instance.setOverlayOptions({ root: modalSurface })
instance.setTheme('paper')
instance.setToolbar(false)
```

`FeatureFlags` を直接更新する場合は `setFeatures()` を使います。`setUi()` による更新でも、初回マウント時のトップレベルの `features`、`theme`、`toolbar` が再適用されます。これらを直接変更する場合は、対応する `setFeatures()`、`setTheme()`、`setToolbar()` を使います。優先順位とオプションの一覧は [オプション](/ja/cell/options) を参照してください。

<CellEmbedDemo scenario="host-sync" />

## ライフサイクル

インスタンスとワークブックを同じビューの所有者で管理し、ビューを外すときに両方を破棄します。

```ts
const instance = await Spreadsheet.mount(host, { workbook })

function closeView() {
  instance.dispose()
  workbook.dispose()
}
```

非同期マウントが失敗した場合も、ホストのアンマウント処理が安全に動くようにします。フレームワークアダプターでは、同じライフサイクルをコンポーネントのプロパティとイベントで扱えます。

初回の `mount()` に渡したワークブックは呼び出し元が管理します。`mount()` が作成したワークブックと、`setWorkbook()` に渡した差し替え先はインスタンスが管理し、不要になった時点で破棄します。最初に渡したワークブックは、差し替え後に呼び出し元で破棄してください。
