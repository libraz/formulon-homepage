---
title: formulon-cell API 一覧
description: パッケージの入口、スプレッドシートのマウント、アプリケーションとの接続に使うインスタンスを説明します。
---

# API 一覧

多くのアプリケーションは `@libraz/formulon-cell` の `WorkbookHandle`、`Spreadsheet.mount()`、戻り値の `SpreadsheetInstance` を使います。React と Vue はコアの型を再エクスポートし、フレームワーク用コンポーネントを追加します。

## インポート先の選び方

| 用途 | インポート先 |
| --- | --- |
| フレームワークを使わず DOM にマウント | `@libraz/formulon-cell` → `Spreadsheet` |
| ワークブックを読み書き | `@libraz/formulon-cell` → `WorkbookHandle` |
| 表示する UI プロファイルまたはプラットフォームを選択 | `@libraz/formulon-cell` → `presets`、`resolveSpreadsheetUiOptions`、`resolveSpreadsheetPlatform` |
| ホスト側のリボンを作る | `@libraz/formulon-cell` → `buildRibbonModel`、`RibbonProfile` |
| 閲覧専用または入力フォームの制限 | `@libraz/formulon-cell` → `viewerPolicy`、`fixedFormPolicy` |
| 組み込み UI の追加・置換 | `@libraz/formulon-cell` → 拡張ファクトリと `Extension` 型 |
| React コンポーネントとフック | `@libraz/formulon-cell-react` |
| Vue コンポーネントとコンポーザブル | `@libraz/formulon-cell-vue` |
| スタイルシート | `@libraz/formulon-cell/styles.css` と、独立したツールバーを使う場合のアダプター用スタイルシート |

パッケージ直下からはコマンドヘルパーと公開型も利用できます。完全なシンボル一覧は、インストールしたバージョンの型宣言を参照してください。このページでは主な部品の使い分けを説明します。

## WorkbookHandle

`WorkbookHandle` は、ファイル層とスプレッドシート UI が共有するワークブックのハンドルです。

```ts
import { WorkbookHandle, Spreadsheet } from '@libraz/formulon-cell'

const workbook = await WorkbookHandle.createDefault()
const instance = await Spreadsheet.mount(host, { workbook })

const bytes = instance.workbook.save()
const loaded = await WorkbookHandle.loadBytes(new Uint8Array(fileBytes))
await instance.setWorkbook(loaded)
workbook.dispose()

function closeView() {
  instance.dispose()
}
```

新しいワークブックには `createDefault()`、ファイルや API のバイト列には `loadBytes()` を使います。先にデータを準備する場合は `Spreadsheet.mount()` にハンドルを渡します。`WorkbookHandle.save()` は、ホストがダウンロードまたはアップロードできるバイト列を返します。

初回の `mount()` に渡したワークブックは呼び出し元が管理します。`mount()` が作成したワークブックと、`setWorkbook()` に渡した差し替え先はインスタンスが管理し、不要になった時点で破棄します。最初に渡したワークブックは、差し替え後に呼び出し元で破棄してください。

## マウントと実行中のインスタンス

```ts
import { Spreadsheet, presets } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  ui: {
    profile: 'standard',
    theme: 'paper',
    features: { comments: true },
  },
  locale: 'ja',
})

instance.setTheme('ink')
instance.openFindReplace('find')
instance.dispose()
```

マウントはホスト要素の子要素を管理します。周囲のレイアウトで高さを与え、`@libraz/formulon-cell/styles.css` を読み込みます。マウントオプションには UI プロファイル、機能スイッチ、ポリシー、ビューポート、コンテキストメニュー、オーバーレイの配置先、ロケール、拡張、ツールバー、ホスト側のコールバックがあります。[埋め込み](/ja/cell/embedding) では用途ごとの組み合わせを説明します。

`SpreadsheetInstance` がホスト向けの主な API です。

| メンバ | 用途 |
| --- | --- |
| `workbook` | ワークブックの読み書き、再計算、保存を行います。 |
| `applyChanges()` | サーバー、インポート、フォームから信頼済みの変更を適用します。 |
| `setPolicy()`、`setViewportOptions()` | マウント後の権限または埋め込み範囲を変更します。 |
| `setContextMenu()`、`setOverlayOptions()` | メニューやダイアログをホストのレイアウトに合わせます。 |
| `setUi()`、`setFeatures()`、`setExtensions()` | マウント中の UI を調整します。 |
| `openFunctionArguments()` | 関数ピッカーまたは Mac の関数の引数パレットを開きます。 |
| `i18n`、`setTheme()` | ラベルとテーマを切り替えます。 |
| `on()` | 型付きの名前付きイベントを購読します。 |
| `print()`、`captureScreenClip()` | 印刷とキャプチャのホスト処理を呼び出します。 |
| `dispose()` | UI とイベント購読を解放します。 |

## プリセット

`presets` は複数の機能フラグをまとめたショートカットです。

| プリセット | 開始点 |
| --- | --- |
| `presets.minimal()` | コンパクトなグリッドと基本編集、ステータス表示です。 |
| `presets.standard()` | 一般的な移動、クリップボード、選択、分析機能です。 |
| `presets.full()` | 組み込みスプレッドシート UI を広く有効にします。 |

埋め込みコンポーネントでは、リボンや印刷の表示もまとめて制御できる `ui: { profile: 'embedded' }` が開始点として分かりやすくなります。個別のスイッチは `ui.features` に指定します。`ui.features` と `features` の両方に同じキーを渡した場合は、明示した `features` が優先されます。

```ts
const instance = await Spreadsheet.mount(host, {
  ui: {
    profile: 'embedded',
    theme: 'paper',
    features: { contextMenu: false, sheetTabs: false },
  },
  features: { clipboard: true },
})
```

## 拡張 {#extensions}

拡張は、特定の UI 機能やホスト連携を追加します。組み込みファクトリはパッケージ直下と `@libraz/formulon-cell/extensions` から利用できます。組み込みを置き換える場合は対応する機能フラグを無効にしてから、同じ ID の拡張を渡します。

```ts
import { Spreadsheet, findReplace, presets } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  features: { ...presets.minimal(), findReplace: false },
  extensions: [findReplace()],
})
```

合成パターンと組み込み機能のグループは [拡張](/ja/cell/extensions) を参照してください。

`openFindReplace()` などのインスタンスメソッドは組み込み機能を開きます。`extensions` で追加したダイアログは `instance.features[id]` のハンドルを使って開いてください。組み込み機能を無効にすると、その起動メソッドも動作しません。

## イベント

`instance.on(name, handler)` は解除関数を返します。イベントのデータは TypeScript で型付けされています。

| イベント | 用途 |
| --- | --- |
| `changeBatch` | 適用されたセル更新に反応します。 |
| `cellChange` | 値または数式をホスト側へ反映します。 |
| `selectionChange` | インスペクターやホスト操作の状態を更新します。 |
| `workbookChange` | ワークブックの差し替えに反応します。 |
| `localeChange` | ロケールの選択を保存します。 |
| `themeChange` | テーマの選択を保存または同期します。 |
| `recalc` | 再計算に依存するホスト表示を更新します。 |

```ts
const unsubscribe = instance.on('selectionChange', ({ active, range }) => {
  inspector.show({ active, range })
})

unsubscribe()
```

`selectionChange` イベントには `active`、`anchor`、主選択範囲の `range` が含まれます。非連続の追加範囲は含まれません。ホストパネルで追加範囲を読む場合は、フレームワークの `useSelection()` / `useSpreadsheet()` 購読、または `instance.store.getState().selection.extraRanges` を使います。

保存や信頼済み更新は [ホスト統合](/ja/cell/host-integration) を参照してください。

## コマンドヘルパー

パッケージ直下からは、独自のボタンやダイアログを作るアプリケーション向けに、機能ごとのヘルパーを利用できます。書式、クリップボードと CSV / TSV、検索と置換、コメント、ハイパーリンク、入力規則、フィルター、テーブル、シートビュー、ページ設定、グラフ、スライサー、保護などが含まれます。各ヘルパーの引数は、インスタンスのストアまたはワークブックの状態に対応しています。

組み込みダイアログを開く場合は `openFormatDialog()` や `openPageSetup()` などのインスタンスメソッドを使います。周囲の UI をホストが所有する場合はコマンドヘルパーを使います。Mac では `openFunctionArguments(seedName?, { category })` でモーダルではないピッカーを開けます。関数名を指定した場合、`category` は無視されます。

```ts
instance.openFunctionArguments()
instance.openFunctionArguments(undefined, { category: 'math' })
instance.openFunctionArguments('SUM', { category: 'text' }) // category は無視されます
```

公開されている `RibbonProfile` は `default` と `excel365Mac` です。ホスト側のツールバーに対応するリボンモデルを作れます。

```ts
import { buildRibbonModel, type RibbonProfile } from '@libraz/formulon-cell'

const profile: RibbonProfile = 'excel365Mac'
const tabs = buildRibbonModel('ja', { profile })
```

書式コマンドは主選択範囲と `selection.extraRanges` のすべてを対象にします。名前付きスタイルは、`includedGroups` に含まれる書式グループを選択したすべての範囲に適用します。セルの書式設定ダイアログには下線スタイルのセレクターがあります。書式変更前にすべての範囲をポリシーで確認し、拒否された場合は操作全体を中止します。セルの保護によって、書式を適用できるセルが別途制限されることがあります。

`formatA1Cell()` は 0 始まりの行と列をホスト表示用の A1 形式にします。

```ts
import { formatA1Cell } from '@libraz/formulon-cell'

const label = formatA1Cell(3, 1) // B4
```

`autofitColWidth()` と `autofitRowHeight()` は、表示に使うフォントで 1 列または 1 行を計測します。戻り値はピクセル単位の計測値で、シートのサイズは変更しません。列幅の計測では、フィルターやテーブル見出しのボタン用の余白も確保します。インスタンス用の計測ヘルパーには、次のように位置引数を渡します。計測範囲は 0 始まりで両端を含みます。

```ts
import { autofitColWidth, autofitRowHeight } from '@libraz/formulon-cell'

const width = autofitColWidth(instance, 1, 0, 8, instance.i18n.locale)
const height = autofitRowHeight(instance, 3, 0, 3, instance.i18n.locale)
```

`autofitColsWidth()` と `autofitRowsHeight()` は、指定した列または行のサイズを変更します。公開型 `AutofitOptions` の `span` で、列幅の計測対象となる行、または行高の計測対象となる列を両端を含む範囲で指定できます。`locale` は数値の表示形式、`theme` はセルの既定フォントを選びます。サイズをエンジンにも反映するにはワークブックを渡し、元に戻せるようにするにはインスタンスの履歴を渡します。これらの低レベルのサイズ変更はホスト側で認可してください。[埋め込み](/ja/cell/embedding#ホスト更新とユーザー操作) で認可の境界を説明しています。

```ts
import { autofitColsWidth, type AutofitOptions } from '@libraz/formulon-cell'

const options: AutofitOptions = {
  span: { from: 0, to: 8 },
  locale: instance.i18n.locale,
}
autofitColsWidth(instance.store, instance.history, 1, 3, instance.workbook, options)
```

## ストアへのアクセス

`instance.store` は、選択範囲、レイアウト、セル状態を購読する必要があるホスト連携で使えます。ストアはインスタンスごとに作られます。React / Vue ではコンポーネントの寿命と購読解除が連動する `useSelection()` や `useSpreadsheet()` が使いやすくなります。

## i18n コントローラ {#i18n-controller}

```ts
instance.i18n.setLocale('ja')
instance.i18n.extend('ja', {
  contextMenu: { copy: 'コピー' },
})
```

`i18n` は `setLocale()`、`extend()`、`register()`、`subscribe()`、解決済みの `strings` を公開します。実行時の切り替えは [国際化](/ja/cell/i18n) を参照してください。

## テーマコントローラ {#theme-controller}

```ts
instance.setTheme('paper')
instance.setTheme('ink')
instance.setTheme('contrast')
instance.setTheme('brand') // 独自パレットの定義が必要です
```

組み込みテーマは `paper`、`ink`、`contrast` です。任意の名前を `data-fc-theme` に対応するホスト側 CSS で使えます。組み込みテーマの色は自動で引き継がれないため、完全なカスタムパレットが必要です。トークンは [テーマ](/ja/cell/theming) を参照してください。

## 次に読むページ

- [フックとコンポーザブル](/ja/cell/hooks) — 選択状態、変更通知、言語設定を利用する具体例です。
- [埋め込み](/ja/cell/embedding) ─ full、minimal、embedded の使い分け
- [プラットフォームと Mac UI](/ja/cell/platform) ─ プラットフォーム解決、Mac ダイアログ、引数ヘルプ
- [React / Vue アダプター](/ja/cell/frameworks) ─ コンポーネントのプロパティ、イベント、フック、コンポーザブル
- [ホスト統合](/ja/cell/host-integration) ─ ファイル、保存状態、印刷、ネイティブフック
- [拡張](/ja/cell/extensions) ─ 任意 UI の追加、置換、削除
- [テーマ](/ja/cell/theming) ─ 組み込みテーマと CSS トークンの上書き
- [国際化](/ja/cell/i18n) ─ ロケール辞書とラベルの上書き
- [モーダルとダイアログ](/ja/cell/modals) ─ オーバーレイの配置とダイアログの入口
