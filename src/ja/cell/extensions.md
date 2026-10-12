---
title: 拡張
description: formulon-cell の任意 UI 機能を選択し、置き換え、合成する方法を説明します。
---

# 拡張

拡張は、`id` と `setup()` 関数を持つオブジェクトです。スプレッドシートはマウント時に `setup()` を呼び、返されたハンドルをスプレッドシートと一緒に破棄します。組み込みのダイアログやパネルも拡張として実装されているため、同じ仕組みで追加、置き換え、削除ができます。

3 つのオプションを組み合わせて使います。`ui.profile` またはプリセットで開始時の構成を選び、`features` で組み込み機能を切り替え、`extensions` で拡張オブジェクトを追加します。プロファイルとスイッチの一覧は [オプション](/ja/cell/options#ui-profile-and-feature-switches) を参照してください。

## 組み込み機能を切り替える

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

`setFeatures()` はフラグ全体を置き換えます。変更したいキーだけを渡すのではなく、プリセットを展開し直してください。プロファイルを読みやすく設定するなら `ui.features`、組み立て済みの `FeatureFlags` があるなら `features` が便利です。両方に同じキーを渡した場合は `features` が優先されます。[操作ポリシー](/ja/cell/options#operation-policy) が有効な間は、これらのフラグにかかわらずほとんどの組み込み機能が無効になります。

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

多くのファクトリーは、置き換える機能フラグと同じ名前です。公開ファクトリーは次のとおりです。

- 移動とレビュー: `contextMenu`、`findReplace`、`goToSpecialDialog`、`quickAnalysis`、`watchWindow`、`viewToolbar`
- 編集と書式: `clipboard`、`pasteSpecial`、`formatDialog`、`formatPainter`、`borderDraw`、`validationList`
- ワークブック作成: `conditionalDialog`、`namedRangeDialog`、`hyperlinkDialog`、`commentDialog`、`hoverComment`、`iterativeDialog`、`pageSetupDialog`
- オブジェクトと集計: `charts`、`illustrations`、`pivotTableDialog`、`slicer`、`workbookObjects`
- ホスト側のコントロール: `statusBar`、`wheel`

`allBuiltIns()` は、既定で有効なファクトリーを 1 つの配列で返します。すべてのフラグを無効にして、拡張だけで画面を組み立てる場合に使います。数式バー、シート見出し、言語セレクター、入力候補、エラーインジケーターには機能フラグがありますが、ファクトリーはありません。ファクトリーはパッケージ直下と `@libraz/formulon-cell/extensions` から読み込めます。

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

`setup()` のコンテキストには、ホスト要素とその内部要素（`grid`、`formulabar`、`statusbar`、`canvas`、読み上げ用の `a11y` ライブリージョン）、`getWb()`、`store`、`history`、`i18n`、`refreshCells()`、`invalidate()`、ほかの拡張のハンドルを取得する `resolve(id)`、`onWorkbookChange()` が含まれます。`setWorkbook()` でワークブックが差し替わるため、ワークブックは常に `getWb()` から取得してください。拡張が登録したものは `dispose()` で解除します。ハンドルには、`setWorkbook()` の後に呼ばれる `rebindWorkbook()` と、ロケール変更後に呼ばれる `setStrings()` も実装できます。`open()` のようなアプリケーション用メソッドを追加することもでき、ハンドルは `instance.features[id]` から取得できます。任意の `priority` で `setup()` の実行順を指定できます（小さいほど先、既定は 50）。

## 組み込み UI を置き換える {#replace-a-built-in-surface}

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

`openFindReplace()` など多くの起動メソッドは組み込み機能を対象にしており、組み込み機能を無効にすると何もしません。置き換えた拡張は、そのハンドル `instance.features[id]` から開いてください。例外は 3 つです。`openQuickAnalysis()`、`openWorkbookObjects()`（`openPivotFieldList()` も同様）、`openPivotTableDialog()` は、ID が `quickAnalysis`、`workbookObjects`、`pivotTableDialog` の拡張が登録されていれば、その `open()`（または `openPivotFieldList()`）を先に呼びます。

## マウント後に更新・削除する

マウント済みのインスタンスにも機能を追加または削除できます。

```ts
instance.use(findReplace())
instance.remove('findReplace')
instance.setExtensions([formatDialog()])
```

`use()` は拡張を 1 つ追加します。同じ ID の拡張がすでにある場合は置き換えます。`remove(id)` は該当する拡張を破棄して `true` を返し、その ID の拡張がなければ `false` を返します。`setExtensions()` は `extensions` または `use()` で追加したすべての拡張を破棄してから、新しい一覧をマウントします。どのメソッドも組み込み機能の有効・無効は変えません。組み込み機能は `setFeatures()` で切り替えます。

## 次に読むページ

- [API 一覧](/ja/cell/api#extensions) ─ マウントオプションとプリセット
- [埋め込み](/ja/cell/embedding) ─ 実際の画面に合わせたオプションの組み合わせ
- [テーマ](/ja/cell/theming) ─ 有効にした機能のスタイル
- [言語を切り替える](/ja/cell/language-switching) ─ セレクター拡張とホスト側のロケールコントロール
