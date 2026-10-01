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
| 表示する周辺 UI を選択 | `@libraz/formulon-cell` → `presets`、`resolveSpreadsheetUiOptions` |
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

保存や信頼済み更新は [ホスト統合](/ja/cell/host-integration) を参照してください。

## コマンドヘルパー

パッケージ直下からは、独自のボタンやダイアログを作るアプリケーション向けに、機能ごとのヘルパーを利用できます。書式、クリップボードと CSV / TSV、検索と置換、コメント、ハイパーリンク、入力規則、フィルター、テーブル、シートビュー、ページ設定、グラフ、スライサー、保護などが含まれます。各ヘルパーの引数は、インスタンスのストアまたはワークブックの状態に対応しています。

組み込みダイアログを開く場合は `openFormatDialog()` や `openPageSetup()` などのインスタンスメソッドを使います。周囲の UI をホストが所有する場合はコマンドヘルパーを使います。

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
- [React / Vue アダプター](/ja/cell/frameworks) ─ コンポーネントのプロパティ、イベント、フック、コンポーザブル
- [ホスト統合](/ja/cell/host-integration) ─ ファイル、保存状態、印刷、ネイティブフック
- [拡張](/ja/cell/extensions) ─ 任意 UI の追加、置換、削除
- [テーマ](/ja/cell/theming) ─ 組み込みテーマと CSS トークンの上書き
- [国際化](/ja/cell/i18n) ─ ロケール辞書とラベルの上書き
- [モーダルとダイアログ](/ja/cell/modals) ─ オーバーレイの配置とダイアログの入口
