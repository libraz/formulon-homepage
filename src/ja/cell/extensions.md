---
title: 拡張
description: formulon-cell の任意 UI 機能を選択し、置き換え、合成する方法を説明します。
---

# 拡張

拡張は、グリッドの周囲に任意の UI を追加する単位です。プリセットまたは `ui.profile` で開始する UI を選び、`features` で組み込み機能を切り替え、`extensions` で組み込みファクトリやホスト側機能を追加します。

## 開始する UI を選ぶ

表示する周辺 UI を選ぶ場合は UI プロファイルを使います。

| プロファイル | 向いている用途 |
| --- | --- |
| `embedded` | 既存の画面内に置くフォームやビューアーです。 |
| `minimal` | 周辺 UI を最小限にした編集用グリッドです。 |
| `standard` | 一般的なスプレッドシート領域です。 |
| `full` または `excel365` | デスクトップ型の広い UI です。 |

```ts
const instance = await Spreadsheet.mount(host, {
  ui: {
    profile: 'embedded',
    features: { contextMenu: false, sheetTabs: false },
  },
})
```

`presets.minimal()`、`presets.standard()`、`presets.full()` は `FeatureFlags` オブジェクトが必要な場合に使います。プリセットへ明示的なフラグを追加して、1 つの機能を調整できます。

<CellEmbedDemo scenario="profiles" />

## 組み込み機能を切り替える

`ui.features` には、移動とレビュー、編集と書式、ワークブックの作成、ホスト側の状態表示に対応するスイッチがあります。低レベルの `FeatureFlags` では対応する組み込み ID を使います。スイッチの一覧は [オプション](/ja/cell/options) を参照してください。

```ts
import { presets, Spreadsheet } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  features: {
    ...presets.standard(),
    formatDialog: true,
    contextMenu: false,
  },
})

// 権限変更後も UI を更新できます。
instance.setFeatures({ ...presets.standard(), clipboard: false })
```

profile を使う場合は `ui.features`、すでに `FeatureFlags` を組み立てている場合は `features` が便利です。両方に同じキーを渡した場合は明示した `features` が優先されます。

インスタンスに `policy` を指定すると、ほかの機能フラグが有効でも組み込み UI はポリシーが対応する経路に限られます。ホスト側のコマンド用に拡張を追加する前に、[操作ポリシー](/ja/cell/options#operation-policy)を確認してください。

## 組み込み拡張を選んで追加する

置き換え可能な組み込み機能には、それぞれ拡張を作成する関数（ファクトリ）があります。標準の開始点は小さくし、必要なダイアログやパネルだけを追加できます。

```ts
import {
  Spreadsheet,
  findReplace,
  formatDialog,
  presets,
} from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  features: {
    ...presets.minimal(),
    findReplace: false,
    formatDialog: false,
  },
  extensions: [findReplace(), formatDialog()],
})
```

公開ファクトリは次のような利用者向けのグループに分かれます。

- 移動とレビュー: `contextMenu`、`findReplace`、`goToSpecialDialog`、`quickAnalysis`、`watchWindow`、`viewToolbar`
- 編集と書式: `clipboard`、`pasteSpecial`、`formatDialog`、`formatPainter`、`borderDraw`、`validationList`
- ワークブック作成: `conditionalDialog`、`namedRangeDialog`、`hyperlinkDialog`、`commentDialog`、`iterativeDialog`、`pageSetupDialog`
- オブジェクトと集計: `charts`、`illustrations`、`pivotTableDialog`、`slicer`、`workbookObjects`
- ホスト側のコントロール: `statusBar`、`wheel`

これらのファクトリはパッケージ直下と `@libraz/formulon-cell/extensions` から利用できます。

## 小さなホスト拡張を作る

スプレッドシートと同じ寿命でイベントやコントロールを登録したい場合は、ホスト側の拡張を作ります。

```ts
import type { Extension } from '@libraz/formulon-cell'

const saveShortcut: Extension = {
  id: 'hostSaveShortcut',
  setup({ host }) {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveFromHost()
      }
    }

    host.addEventListener('keydown', onKeyDown)
    return {
      dispose() {
        host.removeEventListener('keydown', onKeyDown)
      },
    }
  },
}

await Spreadsheet.mount(host, { extensions: [saveShortcut] })
```

`setup()` に渡される情報には、ホスト要素、ワークブックを取得する関数、ストア、操作履歴、i18n コントローラ、セル更新や他の拡張を取得するヘルパーがあります。登録したものは `dispose()` で解除します。返すハンドルには `open()` や `refresh()` のようなアプリケーション用メソッドも追加でき、`instance.features[id]` から取得できます。

## 組み込み UI を置き換える

アプリケーション固有の実装を使う場合は、組み込みフラグを無効にし、同じ id の拡張を登録します。

```ts
const customMenu: Extension = {
  id: 'contextMenu',
  setup({ host, store }) {
    const menu = attachApplicationMenu(host, store)
    return { dispose: () => menu.dispose() }
  },
}

await Spreadsheet.mount(host, {
  features: { ...presets.standard(), contextMenu: false },
  extensions: [customMenu],
})
```

メニュー項目だけを変更する場合は `contextMenu` マウントオプションを使います。既存のダイアログの配置は [モーダルとオーバーレイ](/ja/cell/modals) の `overlays` で調整します。

`openFindReplace()` などのインスタンスメソッドは組み込み機能を開きます。`extensions` で追加したダイアログは `instance.features[id]` のハンドルを使って開いてください。組み込み機能を無効にすると、その起動メソッドも動作しません。

## マウント後に更新・削除する

マウント済みのインスタンスにも機能を追加または削除できます。

```ts
instance.use(findReplace())
instance.remove('findReplace')
instance.setExtensions([formatDialog()])
```

`remove()` は該当するカスタム拡張があれば破棄して `true` を返します。組み込み機能の表示は `setFeatures()` で切り替えます。独自ハンドルのメソッドを使う場合だけ参照を保持し、外側の参照を破棄する前に拡張のライフサイクルから `dispose()` できるようにします。

## 次に読むページ

- [API 一覧](/ja/cell/api#extensions) ─ マウントオプションとプリセット
- [埋め込み](/ja/cell/embedding) ─ 実際の画面に合わせたオプションの組み合わせ
- [テーマ](/ja/cell/theming) ─ 有効にした機能のスタイル
