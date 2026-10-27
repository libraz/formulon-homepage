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
| 独立したリボンのマウント、リボンモデルの取得 | `@libraz/formulon-cell` → `Spreadsheet.mountToolbar`、`buildRibbonModel`、`RibbonProfile`。[リボンツールバー](/ja/cell/toolbar) を参照 |
| 閲覧専用または入力フォームの制限 | `@libraz/formulon-cell` → `viewerPolicy`、`fixedFormPolicy` |
| 組み込み UI の追加・置換 | `@libraz/formulon-cell` または `@libraz/formulon-cell/extensions` → 拡張ファクトリーと `Extension` 型 |
| ロケール辞書を 1 つだけ読み込む | `@libraz/formulon-cell/i18n/ja`（`en`、`de`、`fr`、`zh`、`ko`、`th` も同様） |
| スプレッドシートに依存せずグラフの描画要素を配置 | `@libraz/formulon-cell/charts` → `layoutChart`。[グラフ](#charts) を参照 |
| React コンポーネントとフック | `@libraz/formulon-cell-react` |
| Vue コンポーネントとコンポーザブル | `@libraz/formulon-cell-vue` |
| スタイルシート | `@libraz/formulon-cell/styles.css`（グリッド、ダイアログ、リボン、全テーマ） |

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

新しいワークブックには `createDefault()`、ファイルや API から受け取った `.xlsx` のバイト列には `loadBytes()` を使います。先にデータを準備する場合は `Spreadsheet.mount()` にハンドルを渡します。`save()` は、ホストがダウンロードまたはアップロードできる `.xlsx` のバイト列を返します。ファイルに残るもの、読み込みと保存の損失レポートの読み方、`.xlsb` の書き出しは [ホスト統合](/ja/cell/host-integration#saved-state) を参照してください。`createDefault({ locale, platform })` は、`default` または `mac` プラットフォームの既定値でワークブックを作成します。[プラットフォームと Mac UI](/ja/cell/platform#sheet-geometry) を参照してください。複数のセルにまとめて書き込む場合は `workbook.withBatchedRecalc(() => { … })` で囲むと、セルごとではなく最後に 1 回だけ再計算します。インスタンスがどのハンドルを破棄するかは [インストール](/ja/cell/install#host-sizing) を参照してください。

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
| `workbook`、`setWorkbook()` | ワークブックの読み書き、再計算、保存を行い、別のワークブックに差し替えます。 |
| `applyChanges()` | サーバー、インポート、フォームから信頼済みの変更を適用します。 |
| `commands` | ポリシーに従うユーザー編集の実行（`execute()`）、可否の確認（`canExecute()`）、拒否を含むすべての結果の購読（`subscribe()`）。 |
| `undo()`、`redo()`、`history` | ホスト側のボタンから元に戻す・やり直しを実行します。どちらも適用できる操作がなければ `false` を返します。 |
| `recalc()` | ワークブックを再計算して再描画します。 |
| `setPolicy()`、`setViewportOptions()`、`setContextMenu()`、`setOverlayOptions()`、`setUi()`、`setFeatures()`、`setExtensions()`、`setToolbar()`、`setTheme()` | マウント後にオプションを変更します。[オプション](/ja/cell/options#runtime-changes) を参照してください。 |
| `locale`、`setLocale()`、`i18n` | UI のロケールと計算プロファイルの取得・変更、辞書の登録と上書き。`setLocale()` は切り戻したときに `false` を返します。 |
| `open…Dialog()`、`openFindReplace()`、`openFormatDialog()`、`openPageSetup()` など | ホスト UI から組み込みダイアログを開きます。[モーダルとダイアログ](/ja/cell/modals#open-a-built-in-dialog-from-host-ui) を参照してください。 |
| `openChartSettings(tab?)` | 選択中のグラフの設定を開きます。グラフが選択されていなければ `false` を返します。 |
| `followActiveHyperlink()` | Ctrl / Cmd+クリックと同じように、アクティブセルのハイパーリンクを開きます。リンクがなければ `false` を返します。 |
| `openWatchWindow()`、`closeWatchWindow()`、`toggleWatchWindow()` | ウォッチ ウィンドウのパネルを表示します。 |
| `tracePrecedents()`、`traceDependents()`、`clearTraces()` | アクティブセルから参照元・参照先のトレース矢印を描画または消去します。トレース系のメソッドは追加した矢印の数を返します。 |
| `setSheetProtected()`、`toggleSheetProtection()`、`isSheetProtected()` | アクティブシートを保護します。パスワードと許可する操作も指定できます。 |
| `addSlicer()`、`removeSlicer()` | テーブルの列にスライサーを追加します。オプトインの `slicer` 機能が必要です。 |
| `print()`、`captureScreenClip()`、`setUploadStatus()`、`setMacroRecording()` | 印刷、キャプチャ、ステータス表示のホスト処理。[ホスト統合](/ja/cell/host-integration) を参照してください。 |
| `formula`、`cells` | ホスト関数のレジストリと、セルの独自表示の登録先。[セルの独自表示とホスト関数](/ja/cell/custom-cells) を参照してください。 |
| `toolbar`、`features`、`use()`、`remove()` | マウント済みのリボン（[リボンツールバー](/ja/cell/toolbar#toolbarinstance) を参照）、拡張のハンドル、拡張の登録と削除。 |
| `store` | インスタンスごとのリアクティブな状態（選択、レイアウト、セル）。 |
| `on()`、`off()` | 名前付きイベントを購読・解除します。 |
| `dispose()` | UI とイベント購読を解放します。 |

## プリセットと拡張 {#extensions}

`presets.minimal()`、`presets.standard()`、`presets.full()` は、トップレベルの `features` オプションに渡す `FeatureFlags` オブジェクトを返します。UI プロファイルの `minimal`、`standard`、`full` も同じ構成です。それぞれで有効になる機能と、`ui.features` と `features` の組み合わせ方は [オプション](/ja/cell/options#ui-profile-and-feature-switches) を参照してください。ファクトリー、独自の拡張、組み込み機能の置き換えは [拡張](/ja/cell/extensions) で説明しています。

## ホスト関数 {#host-functions}

マウントオプションの `functions` と `seed`、`instance.formula` のレジストリは [セルの独自表示とホスト関数](/ja/cell/custom-cells#host-functions) で説明しています。

## イベント

`instance.on(name, handler)` は解除関数を返します。イベントのデータは TypeScript で型付けされています。

| イベント | データ | 用途 |
| --- | --- | --- |
| `changeBatch` | `ChangeBatchResult`（`status`、`applied`、`rejected`、`revision`） | 適用されたセル更新に反応します。拒否されたユーザー編集は `instance.commands.subscribe()` に届きます。 |
| `cellChange` | `{ addr, value, formula }` | 値または数式をホスト側へ反映します。 |
| `selectionChange` | `{ active, anchor, range }` | インスペクターやホスト操作の状態を更新します。 |
| `workbookChange` | `{ workbook }` | ワークブックの差し替えに反応します。 |
| `localeChange` | `{ locale, strings }` | ロケールの選択を保存します。 |
| `themeChange` | `{ theme }` | テーマの選択を保存または同期します。 |
| `recalc` | `{ dirty }`（前回の再計算以降に編集されたセルの `sheet:row:col` キー） | 再計算に依存するホスト表示を更新します。再計算された参照先のセルは含まれません。 |

```ts
const unsubscribe = instance.on('selectionChange', ({ active, range }) => {
  inspector.show({ active, range })
})

unsubscribe()
```

`selectionChange` イベントには `active`、`anchor`、主選択範囲の `range` が含まれます。非連続の追加範囲は含まれません。ホストパネルで追加範囲を読む場合は、フレームワークの `useSelection()` / `useSpreadsheet()` 購読、または `instance.store.getState().selection.extraRanges` を使います。

保存や信頼済み更新は [ホスト統合](/ja/cell/host-integration) を参照してください。

## コマンドヘルパー

パッケージ直下からは、独自のボタンやダイアログを作るアプリケーション向けに、機能ごとのヘルパーを利用できます。書式、クリップボードと CSV / TSV、検索と置換、コメント、ハイパーリンク、入力規則、フィルター、テーブル（テーブル デザインの `renameActiveTable()`、`toggleTableOption()`、`setTableColumnFunction()` を含む）、シートビュー、ページ設定、グラフ（グラフのデザイン、グラフのコピー、貼り付け、複製を含む）、図形と図（図形の塗りつぶしと枠線を含む）、スライサー、ふりがなの設定、選択オプション、保護（編集を許可する範囲とパスワード確認を含む）などが含まれます。各ヘルパーの引数は、インスタンスのストアまたはワークブックの状態に対応しています。

組み込みダイアログを開く場合は `openFormatDialog()` や `openPageSetup()` などのインスタンスメソッドを使います。周囲の UI をホストが所有する場合はコマンドヘルパーを使います。Mac では `openFunctionArguments(seedName?, { category })` でモーダルではないピッカーを開けます。関数名を指定した場合、`category` は無視されます。

```ts
instance.openFunctionArguments()
instance.openFunctionArguments(undefined, { category: 'math' })
instance.openFunctionArguments('SUM', { category: 'text' }) // category は無視されます
```

リボンのコマンドは `ToolbarInstance.applyCommand(id)` で実行でき、コマンド ID は `buildRibbonModel()` で一覧できます。[リボンツールバー](/ja/cell/toolbar#tabs-and-display) を参照してください。

書式コマンドは主選択範囲と `selection.extraRanges` のすべてを対象にします。名前付きスタイルは、`includedGroups` に含まれる書式グループを選択したすべての範囲に適用します。セルの書式設定ダイアログには下線スタイルのセレクターがあります。書式変更前にすべての範囲をポリシーで確認し、拒否された場合は操作全体を中止します。セルの保護によって、書式を適用できるセルが別途制限されることがあります。

リボンのオートフィットは、`selection.extraRanges` を含む非連続の選択範囲全体を使います。各範囲は固有の反対軸のスパンを保ちます。同じ行または列が複数の範囲に含まれる場合は、測定値が最大のサイズを採用します。操作全体が 1 つの Undo 単位になります。

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

`autofitColsWidth()` と `autofitRowsHeight()` は、指定した列または行のサイズを変更します。公開型 `AutofitOptions` の `span` で、列幅の計測対象となる行、または行高の計測対象となる列を両端を含む範囲で指定できます。`locale` は数値の表示形式、`theme` はセルの既定フォントを選びます。サイズをエンジンにも反映するにはワークブックを渡し、元に戻せるようにするにはインスタンスの履歴を渡します。これらの低レベルのサイズ変更はホスト側で認可してください。[埋め込み](/ja/cell/embedding#host-updates-and-user-actions) で認可の境界を説明しています。

```ts
import { autofitColsWidth, type AutofitOptions } from '@libraz/formulon-cell'

const options: AutofitOptions = {
  span: { from: 0, to: 8 },
  locale: instance.i18n.locale,
}
autofitColsWidth(instance.store, instance.history, 1, 3, instance.workbook, options)
```

## セルとシートのレイアウト単位

`CellFormat.fontSize`、`WorkbookHandle.setRowHeight()`、`WorkbookHandle.setColumnWidth()`、オートフィットの結果は CSS ピクセルを使います。ネイティブの `FontRecord.size` とリボンのフォントサイズは組版上のポイントを使います。変換式は `px = pt * 96 / 72` です。Formulon は行の高さをポイント、列の幅を文字数で保存し、cell 層がエンジンとの境界で、ワークブックの `geometryPlatform`（`default` または `mac`）の列幅モデルを使って変換します。ここでのピクセルは、シート上の基準ピクセルです。画面上ではシートのズーム（10% から 400%）とプラットフォームの画面スケールが掛かります。[プラットフォームと Mac UI](/ja/cell/platform#sheet-geometry) を参照してください。リボンの「行の高さ」と「列の幅」はポイントと文字数で指定します。

## CSV のインポートとエクスポート

パッケージ直下から `exportCSV()`、`importCSV()` と、`ExportOptions`、`ImportCSVOptions` の型を利用できます。

```ts
import {
  exportCSV,
  importCSV,
  type ExportOptions,
  type ImportCSVOptions,
} from '@libraz/formulon-cell'

const exportOptions: ExportOptions = { locale: 'de-DE', delimiter: ';' }
const csv = exportCSV(instance.store.getState(), exportOptions)
const importOptions: ImportCSVOptions = { locale: 'de-DE', delimiter: ';' }
importCSV(instance.store.getState(), instance.workbook, csv, undefined, instance.history, importOptions)
```

`delimiter` は `,` または `;` を受け取り、既定値は `,` です。`locale` を省略したインポートでは、ワークブックのアクティブなプロファイルを使います。エクスポートで `locale` を省略すると正規のテキストを保持します。地域向けの CSV で数値と真偽値を整形する場合は `locale` を指定します。

## ストアへのアクセス

`instance.store` は、選択範囲、レイアウト、セル状態を購読する必要があるホスト連携で使えます。ストアはインスタンスごとに作られます。React / Vue ではコンポーネントの寿命と購読解除が連動する `useSelection()` や `useSpreadsheet()` が使いやすくなります。

## i18n コントローラ {#i18n-controller}

```ts
if (!instance.setLocale('ja')) {
  showLanguageError()
}
instance.i18n.extend('ja', {
  contextMenu: { copy: 'コピー' },
})
```

`instance.locale` は確定済みのロケールです。`instance.setLocale()` はホスト側から使う実行時 API で、ワークブックのプロファイルも同期し、変更を受け付けたかを返します。`i18n` は低レベルの辞書操作として `setLocale()`、`extend()`、`register()`、`subscribe()`、解決済みの `strings` を提供します。プロファイルの結果が不要な辞書や拡張のコードから使ってください。セレクター、数式文字列、編集の確定、切り戻しは [言語を切り替える](/ja/cell/language-switching)、辞書の登録と購読は [国際化](/ja/cell/i18n) を参照してください。

## テーマコントローラ {#theme-controller}

```ts
instance.setTheme('paper')
instance.setTheme('ink')
instance.setTheme('contrast')
instance.setTheme('brand') // 独自パレットの定義が必要です
```

組み込みテーマは `paper`、`ink`、`contrast` です。任意の名前を `data-fc-theme` に対応するホスト側 CSS で使えます。組み込みテーマの色は自動で引き継がれないため、完全なカスタムパレットが必要です。トークンは [テーマ](/ja/cell/theming) を参照してください。

## グラフ {#charts}

formulon-cell はワークブックのセルから系列データを読み、対応する種類のグラフを描画します。グラフの設定と参照範囲はワークブックに保存され、ブラウザーでの操作画面を formulon-cell が提供します。実際に操作するには[フルデモ](/ja/cell/demo)を開き、`A1:C9` を選択して挿入リボンからグラフを選びます。データの配置、設定、対応範囲は[グラフガイド](/ja/cell/charts)を参照してください。

## 次に読むページ

- [フックとコンポーザブル](/ja/cell/hooks) — 選択状態、変更通知、言語設定を利用する具体例です。
- [言語を切り替える](/ja/cell/language-switching) — セレクター、実行時 API、ワークブックプロファイル、数式、拒否される場合を説明します。
- [埋め込み](/ja/cell/embedding) ─ full、minimal、embedded の使い分け
- [プラットフォームと Mac UI](/ja/cell/platform) ─ プラットフォーム解決、Mac ダイアログ、引数ヘルプ
- [リボンツールバー](/ja/cell/toolbar) ─ インラインと独立したリボン、タブ構成、コマンドの実行
- [セルの独自表示とホスト関数](/ja/cell/custom-cells) ─ 表示フォーマッターとホスト関数のレジストリ
- [React / Vue アダプター](/ja/cell/frameworks) ─ コンポーネントのプロパティ、イベント、フック、コンポーザブル
- [ホスト統合](/ja/cell/host-integration) ─ ファイル、保存状態、印刷、ネイティブフック
- [拡張](/ja/cell/extensions) ─ 任意 UI の追加、置換、削除
- [テーマ](/ja/cell/theming) ─ 組み込みテーマと CSS トークンの上書き
- [国際化](/ja/cell/i18n) ─ ロケール辞書とラベルの上書き
- [モーダルとダイアログ](/ja/cell/modals) ─ オーバーレイの配置とダイアログの入口
