---
title: formulon-cell のオプション
description: 表示 UI、編集セル、ナビゲーション範囲、メニュー、オーバーレイの配置を設定します。
---

# オプション

`Spreadsheet.mount(host, options)` では、UI プロファイル、操作権限、ナビゲーション、コンテキストメニュー、浮動 UI を個別に設定できます。まずプロファイルを選び、必要な制限やホスト連携だけを追加します。

## UI プロファイルと機能スイッチ

`ui.profile` は UI の初期構成を選びます。

| プロファイル | 初期構成 |
| --- | --- |
| `embedded` | 周辺 UI をアプリケーション側で用意する場合のグリッド中心の構成です。 |
| `minimal` | 基本的な表計算操作に絞った構成です。 |
| `standard` | 日常的な表計算画面に必要な構成です。 |
| `excel365` | デスクトップ型の広い UI 構成です。 |
| `full` | `full` プリセットと同じ、すべての UI を含む構成です。 |

`ui.platform` は `ui.profile` とは独立して解決されます。既定の UI には `default`、Mac の UI を明示的に選ぶ場合は `mac`、ブラウザーから判定する場合は `auto` を使います。iPad と iPhone のユーザーエージェント、およびタッチ対応の `MacIntel` は `default` に解決されます。Mac リボンと制限は [プラットフォームと Mac UI](/ja/cell/platform) を参照してください。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: {
    profile: 'standard',
    theme: 'ink',
    features: {
      ribbon: true,
      sheetTabs: true,
      statusBar: false,
      comments: false,
      charts: false
    }
  }
})
```

`ui.features` では `ribbon`、`formulaBar`、`sheetTabs`、`statusBar`、`contextMenu`、`formatDialog`、`comments`、`charts`、`print`、`clipboard` などの UI スイッチを指定します。低レベルの機能フラグ名を指定する場合は `ui.advancedFeatures` またはトップレベルの `features` を使います。`openDataValidationDialog()` を使うには `formatDialog: true` が必要です。`validation` はセル入力の検証補助やリストのドロップダウンを制御します。

初回マウント時の解決順序は次のとおりです。

1. 選択した `ui.profile` が初期の機能構成を決めます。
2. `ui.advancedFeatures` が機能フラグを直接変更します。
3. `ui.features` が利用者向けのスイッチを変更します。
4. トップレベルの `features` が UI プロファイルより優先されます。

トップレベルの `theme` は `ui.theme` より優先されます。トップレベルの `toolbar` はプロファイルのリボン設定より優先されます。同じプロファイルを共有しながら、ホストごとにツールバーの配置を決められます。

`ui.profile` を指定しない場合、機能プロファイルは `excel365` に解決されます。リボンは `toolbar` で有効にするか、リボンを含む `ui` を渡した場合にだけマウントされます。機能フラグは組み込み拡張を選びますが、それだけで周辺のリボン構成は決まりません。

`setUi()` は現在のワークブックを保ったまま、プロファイル、プラットフォーム、テーマを再解決します。初回マウント時のトップレベルの `features`、`theme`、`toolbar` も再適用されます。プラットフォームを変更すると、開いている Mac の数式パレットを閉じ、保留中の下書きを破棄します。これらを直接変更する場合は、対応する `setFeatures()`、`setTheme()`、`setToolbar()` を使います。

組み込みテーマは `paper`、`ink`、`contrast` です。アプリケーションの外観が変わったときは、マウント後に `instance.setTheme()` を呼びます。

<CellEmbedDemo scenario="profiles" />

## プリセットと拡張

`presets.minimal()`、`presets.standard()`、`presets.full()` は `FeatureFlags` オブジェクトを返します。トップレベルの `features` に渡します。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  features: {
    ...presets.standard(),
    findReplace: false,
    formatDialog: true
  }
})
```

`extensions` には、`findReplace()` などのファクトリが返す拡張オブジェクトを渡します。組み込み機能の置き換えや追加の UI に使います。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  features: { ...presets.minimal(), findReplace: false },
  extensions: [findReplace()]
})
```

`features` は組み込み機能の有効化と無効化、`extensions` は拡張オブジェクトのマウントを担当します。2 つを別の設定として扱います。

## 操作ポリシー {#operation-policy}

`policy` はグリッド、キーボード、クリップボード、コンテキストメニュー、組み込みツールバーから利用者が実行できる操作を制御します。表示 UI のプロファイルとは独立しています。

選択とコピーができるビューアーには `viewerPolicy()` を使います。

```ts
const policy = {
  ...viewerPolicy(),
  operations: {
    export: true
  }
}
```

入力セルを宣言するフォームには `fixedFormPolicy()` を使います。

```ts
const policy = fixedFormPolicy([
  { sheet: 0, r0: 3, c0: 1, r1: 12, c1: 2 }
])
```

ポリシーヘルパーには範囲の配列、判定関数、`{ ranges }` / `{ predicate }` を渡せます。判定関数には `{ addr, operation, origin }` が渡されます。

```ts
const policy = fixedFormPolicy(({ addr, operation }) =>
  addr.sheet === 0 &&
  addr.col === 2 &&
  addr.row >= 3 &&
  addr.row <= 12 &&
  operation === 'valueEdit'
)
```

独自ポリシーは `defaultOperation: 'deny'` から始め、ホスト UI が提供する操作だけを許可すると管理しやすくなります。ビューを編集可能から読み取り専用へ変更する場合は `instance.setPolicy()` を使います。

保護と結合セルも認可の対象です。結合範囲に触れる書き込みは結合全体を確認し、アンカーセルに適用します。`validation` UI スイッチは入力補助とリストのドロップダウンを制御し、ポリシーの `validation` 操作は入力規則の変更を制御します。複数範囲の書式設定や Clear を含む複合操作は、実行時だけでなく Undo / Redo 時にも現在のポリシーで再認可されるため、ポリシー変更後の再実行が拒否されることがあります。

::: info ポリシーと組み込み UI
`policy` を指定したインスタンスでは、組み込み UI は数式バー、クリップボード、ショートカット、ホイール操作、コンテキストメニューに限られます。それ以外の組み込み機能は、機能フラグを有効にしても表示されません。操作を許可する設定だけでは対応 UI は有効になりません。ホスト側のコードから低レベルのヘルパーを呼ぶ場合は、別途その操作を許可してください。
:::

<CellEmbedDemo scenario="form" />

## ビューポートとキーボードナビゲーション

`viewport.range` は表示・移動できるセル範囲を制限します。ワークブックのデータ自体は削除しません。座標は 0 始まりで、両端を含みます。

```ts
const viewport = {
  range: { sheet: 0, r0: 0, c0: 0, r1: 30, c1: 6 },
  tabNavigation: 'editable' as const,
  tabBoundary: 'stop' as const
}
```

その他のオプションは次のとおりです。

- `selectable`: 選択可能なセルをさらに絞る範囲の配列、または判定関数です。
- `tabNavigation`: `normal` はグリッドの順序、`editable` は現在のポリシーで編集できるセルの順序です。
- `tabBoundary`: `stop` は設定範囲内でフォーカスを止め、`leave` は Tab で範囲の外へ移動します。
- `autoExpand`: シートに合わせてナビゲーション範囲を広げます。固定 `range` とは併用しません。

マウント後にレポート範囲やフォームのページを切り替える場合は `instance.setViewportOptions()` を使います。固定範囲は一度に 1 枚のシートを対象とするため、シートを変えるときは範囲のシート番号も変更します。

## コンテキストメニュー

次の 3 モードから選択します。

```ts
import type { ContextMenuOptions } from '@libraz/formulon-cell'

const noMenu: ContextMenuOptions = { mode: 'disabled' }

const builtInMenu: ContextMenuOptions = {
  mode: 'builtIn',
  items: ['copy', 'cut'],
  transform: ({ defaultItems }) => defaultItems
}

const hostMenu: ContextMenuOptions = {
  mode: 'host',
  onOpen: ({ cell, selection, canExecute }) => {
    openApplicationMenu({ cell, selection, canCopy: canExecute('copy').allowed })
  }
}
```

`builtIn` はパッケージのメニューを残し、項目を絞り込んだり、現在の項目一覧を変換したりできます。`transform` コールバックから、ホストのダイアログを開く `action` を追加できます。`host` はパッケージとブラウザのメニューを抑止し、現在のセルと選択範囲をホストへ渡します。`disabled` は右クリックメニューを表示しません。

組み込み項目の ID は、パッケージの公開型宣言に含まれます。ホスト独自の ID にはホスト名の接頭辞を付け、組み込み項目と分けます。

## オーバーレイの配置

浮動メニュー、ツールチップ、組み込みダイアログはオーバーレイポータルに配置されます。ホストのモーダルや全画面表示要素が表示境界を所有する場合は `overlays.root` を指定します。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  overlays: { root: modalSurface }
})
```

`root` には配置先を返す関数も指定できます。

```ts
instance.setOverlayOptions({
  root: () => document.querySelector<HTMLElement>('.modal-surface')!
})
```

`root` はマウント先と同じドキュメントの `HTMLElement` である必要があります。ネイティブ `<dialog>` と全画面表示の例は [モーダルとダイアログ](/ja/cell/modals) を参照してください。

## 実行時変更とエラー

次のメソッドで、ワークブックを置き換えずに組み込み設定を更新できます。

```ts
instance.setUi(nextUi)
instance.setFeatures(nextFeatures)
instance.setPolicy(nextPolicy)
instance.setViewportOptions(nextViewport)
instance.setContextMenu(nextContextMenu)
instance.setOverlayOptions(nextOverlays)
instance.setToolbar(nextToolbar)
instance.setTheme(nextTheme)
```

ラベルはマウント時の `locale` と `strings` で設定し、マウント後のロケール変更には `instance.i18n` を使います。ホスト側のエラー画面には `onError` を使い、ホストやフレームワーク側でフォールバックを描画する場合は `renderError: false` を指定します。

オプションの全項目は、配布パッケージの型宣言を参照してください。このページでは埋め込みでよく使う組み合わせを説明します。
