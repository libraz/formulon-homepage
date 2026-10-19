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

新しいワークブックには `createDefault()`、ファイルや API から受け取った `.xlsx` のバイト列には `loadBytes()` を使います。先にデータを準備する場合は `Spreadsheet.mount()` にハンドルを渡します。`save()` は、ホストがダウンロードまたはアップロードできる `.xlsx` のバイト列を返します。複数のセルにまとめて書き込む場合は `workbook.withBatchedRecalc(() => { … })` で囲むと、セルごとではなく最後に 1 回だけ再計算します。インスタンスがどのハンドルを破棄するかは [インストール](/ja/cell/install#host-sizing) を参照してください。

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

パッケージ直下からは、独自のボタンやダイアログを作るアプリケーション向けに、機能ごとのヘルパーを利用できます。書式、クリップボードと CSV / TSV、検索と置換、コメント、ハイパーリンク、入力規則、フィルター、テーブル、シートビュー、ページ設定、グラフ、スライサー、保護などが含まれます。各ヘルパーの引数は、インスタンスのストアまたはワークブックの状態に対応しています。

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

`CellFormat.fontSize`、`WorkbookHandle.setRowHeight()`、`WorkbookHandle.setColumnWidth()`、オートフィットの結果は CSS ピクセルを使います。ネイティブの `FontRecord.size` とリボンのフォントサイズは組版上のポイントを使います。変換式は `px = pt * 96 / 72` です。Formulon は行の高さをポイント、列の幅を文字数で保存し、cell 層がエンジンとの境界で変換します。

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

セルを選択し、挿入リボンからグラフを選びます。縦棒、横棒、折れ線、面、円、ドーナツ、散布図は、参照元のセル変更に合わせて更新されます。「要素」の「グラフの種類」で既存グラフの種類を変更でき、ドーナツも選択できます。おすすめグラフは選択範囲の形状から種類を選んで作成します。グラフは移動、サイズ変更、削除ができ、作成・編集コマンドは元に戻す操作とやり直しに対応します。

グラフはブックに保存されます。読み込んだ XLSX ファイルのグラフは表示・編集でき、UI で作成・編集したグラフもブックと一緒に保存されます。グラフのコマンドは `WorkbookHandle` を `wb` として受け取ります。エンジンがグラフに対応していない場合、シートが保護されている場合、ホストのポリシーが編集を拒否した場合、エンジンが処理を受け付けなかった場合は何も変更せず、`null`（削除用のヘルパーでは `false` または `0`）を返します。`createSessionChart` で省略した設定には、Excel のグラフテンプレートが書き込む値を使います。`title` を省略すると Excel の自動タイトルになり、`''` を指定するとタイトルを表示しません。

このモジュールで描画できないグラフは、タイトルを示すプレースホルダーとして表示します。対象は 3D、バブル、レーダー、株価、等高線、補助円グラフ付き円グラフ、複数のプロットを持つ複合グラフ、ウォーターフォールやヒストグラムなどの新しいグラフの種類です。プレースホルダーは移動、サイズ変更、削除ができますが、設定は編集できません。ピボットグラフの系列とデータ範囲はピボットテーブルに従うため、系列の方向、系列の一覧、フィルターは変更できません。

### 種類変更とドーナツグラフ

種類や系列の方向を変えると、その下書きに合わせて系列・点・フィルターの選択欄を更新します。「適用」は種類と設定をまとめて履歴1件に記録し、「キャンセル」はグラフを変更しません。円グラフの軸や縦棒グラフの穴サイズのように、選んだ種類で使わない設定はブック内のグラフに残りません。配色や凡例の暗黙の既定値は種類に合わせて変わり、明示的な設定として固定されません。

ドーナツは表示する系列ごとに同心円のリングを描き、最初の系列を内側に配置します。各リングの扇形と割合ラベルには、その系列の合計を使います。系列フィルターはリングを、項目フィルターは全リングの該当する扇形を非表示にします。`holeSize` は 10〜90% で、このモジュールの既定値は 50 です。`firstSliceAngle` は全リングをまとめて回転します。扇形が1つのリングでも中央の穴は透明です。ドーナツのラベルは各扇形のリング幅の中央に自動配置します。円とドーナツには軸がありません。ラベルは重なりを減らす位置に自動配置しますが、内側のリングが小さい場合や文字が大きい場合は重なることがあります。グラフを広げるか、ラベルの文字サイズを小さくしてください。

```ts
createSessionChart(store, range, {
  wb,
  kind: 'doughnut',
  seriesDirection: 'columns',
  holeSize: 65,
  firstSliceAngle: 90,
  dataLabels: { visible: true, showPercentage: true },
}, history);
```

穴サイズの範囲は Excel の [DoughnutHoleSize](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.doughnutholesize)に従います。

### データと系列

エンジンが Excel の規則に従って参照範囲をカテゴリと系列に分けます。文字列の見出しを系列名やカテゴリ名として使います。`headerRow` と `headerColumn` で見出しの有無を明示できます。数値の年を見出しとして指定しても、通常の数値データを名前として扱わずに済みます。系列は現在のセル値を読み取り、再計算のたびに読み直します。

先頭列にカテゴリ、残りの列に系列が並ぶ表には `seriesDirection: 'columns'` を指定します。転置した表には `'rows'` を指定します。既定の `'auto'` は、データの行数が列数より多い場合に列方向を選び、それ以外は行方向にします。行数と列数が同じ場合や、見出し列があり見出し行がすべて日付の場合も行方向です。既定では 1 行または 1 列だけの場合は 1 系列になります。表の形状と意図した系列方向が異なる場合は、方向を明示してください。

たとえば、列方向を指定した次の表では、カテゴリは January と February、系列は Sales と Costs になります。

| Month | Sales | Costs |
| --- | --- | --- |
| January | 10 | 6 |
| February | 15 | 8 |

散布図は最初の列（行方向では最初の行）を共通の X 値、残りの列をそれぞれ Y 系列として扱います。系列の見出しは、列方向では `headerRow`、行方向では `headerColumn` で指定します。X 値が 1、10、100 の場合は、数値の差に応じた間隔になります。参照元に X 値の列がない場合は、点を 1、2、3… の位置に置きます。円グラフは最初の系列を使い、値の絶対値で扇形の大きさを決めます。

### グラフの設定

設定は `createSessionChart(store, range, options, history)` に渡すか、`updateSessionChart(store, id, patch, history, wb)` の patch として渡します。patch には、別の範囲から系列を分け直す `source` や、グラフを移動・サイズ変更する `anchor` も指定できます。`kind` で種類を選びます。縦棒、横棒、折れ線、面では `grouping` に `'clustered'`、`'stacked'`、`'percent-stacked'` を指定できます。円、ドーナツ、散布図では grouping を使いません。積み上げは正と負の値を別々に加算し、100% 積み上げは符号ごとの合計で正規化します。

`scatterStyle` には `'marker'`（既定値）、`'line'`、`'lineMarker'` を指定できます。「要素」では「マーカーのみ」「直線」「直線とマーカー」として選択できます。線はフィルター適用後の参照元の順序で接続し、X 値では並べ替えません。各線分はプロット領域で切り取り、両端が軸範囲外でも領域を横切る部分を描画します。系列の線設定で色・幅・透明度・線種を変更でき、幅 0 では接続線を非表示にします。系列・点に明示したマーカーの表示設定は、種類の既定値より優先します。点の線設定は引き続きマーカーの枠線に使います。3種類の意味は Microsoft の[散布図スタイルの定義](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/eb0dca58-7fcf-45be-88cd-b3b50aa91020)に従います。`seriesStyles` で `smooth: true` を指定した系列は Excel の平滑線で描画します。「スタイル」では「スムージング」として設定できます。

通常の積み上げで合計が JavaScript の有限数値の範囲を超える場合は、`±Number.MAX_VALUE` で描画を切り詰めます。100% 積み上げでは加算前に正規化し、大きな有限値の比率を保持します。

`emptyCells` には `'gap'`、`'zero'`、`'span'` を指定します。標準の折れ線は3種類に対応し、gap は線を途切れさせ、zero は欠測値を 0 として描画し、span は値のある点をつなぎます。積み上げ・100% 積み上げの折れ線と面は、Office の空セル規則に従って常に zero を使います。標準の面、横棒、縦棒、円、ドーナツで span を指定した場合は gap として扱います。散布図は zero では欠けた座標を 0 として扱います。線付きでは gap は座標が欠けた点で線を途切れさせ、span は前後の有効な点を接続します。点のみの散布図では span を gap として扱います。有限でない座標は常に省略し、接続線も途切れさせます。

`gapWidth` は棒の幅に対するカテゴリ間の間隔率で、0〜500 を指定できます。既定値は 150 です。`overlap` は集合グラフの系列間の重なり率で、-100 は棒1本分の間隔、0 は隙間なし、100 は同じ位置への重なりを表します。積み上げの系列は同じ位置に描画します。`firstSliceAngle` は円とドーナツの開始境界を12時の位置から時計回りに回転させる角度で、0〜360 度を指定できます。範囲外の有限値は上下限に収め、有限でない設定値には既定値を使います。

円の扇形の大きさには、最初の系列の有限値の絶対値を使います。0 と欠測値には扇形がありません。加算前に正規化するため、大きな有限値でも比率を保持します。

`palette` で系列の色を指定します。`legend` で凡例の表示と位置を設定します。`xAxis` と `yAxis` はタイトルと数値の範囲を受け取り、カテゴリ軸にはカテゴリ名を表示します。描画時には目盛りとグリッド線も生成します。

### 軸とグラフの設定

「要素」では積み上げ、系列の読み取り方向、空セルの扱いを変更できます。「スタイル」では棒の間隔、集合系列の重なり、円とドーナツの開始角度、ドーナツの穴サイズも設定できます。設定欄は、その項目を使うグラフの種類で有効になります。

各軸の表示、タイトル、逆順を設定できます。数値軸には最小値・最大値、正の `majorUnit`、`numberFormat`、`majorGridlines` も指定できます。数値軸は横棒では X、縦棒・折れ線・面では Y、散布図では X と Y の両方です。円とドーナツには軸がありません。設定画面で最小値・最大値・目盛間隔を空欄にすると、自動に戻ります。カテゴリ軸は項目名を表示し、数値の範囲設定を使いません。

`visible: false` は軸線・ラベル・タイトルを非表示にします。グリッド線の表示は独立しています。目盛間隔を指定した場合、実効最小値を起点に目盛を作ります。例えば範囲が 3〜13、間隔が 5 なら、3・8・13 です。極小の間隔は描画する目盛数を制限するため間引きます。数値ラベルが重なる場合も、グリッド線とは独立して表示するラベルを間引きます。数値書式を指定しない場合は従来の自動書式を維持し、100% 積み上げでは割合を表示します。書式コードを指定すると、データラベルと同じロケールとフォーマッターを使います。Excel の [目盛間隔](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.majorunit)と[目盛ラベルの数値書式](https://learn.microsoft.com/en-us/office/vba/api/excel.ticklabels.numberformat)も参照してください。

`reverseOrder: true` は1本の軸を逆順にします。横棒を含め、`xAxis` は横軸、`yAxis` は縦軸です。項目軸を逆順にしても、集合グラフの各項目内の系列順は維持します。値、元のID、フィルター、点のスタイルの対応は変わりません。数値の上下限と目盛値は、モデル内では昇順を保ちます。横棒は従来どおり最初の項目を上に配置し、Y 軸を逆順にすると下に配置します。既定では目盛ラベルとタイトルを下側・左側の余白に配置し、項目軸の逆順設定で直交する軸を自動移動することはありません。Excel の [ReversePlotOrder](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.reverseplotorder)に対応する設定です。

`crossing` は、その軸のどこで直交する軸が交差するかを指定します。`xAxis.crossing` で縦軸、`yAxis.crossing` で横軸を移動します。設定画面では「自動」「最小値」「最大値」「指定値」を選べます。数値軸には `'min'`、`'max'`、有限の数値を指定でき、数値は実効範囲内に収めます。逆順の設定は交点の位置にも反映します。未指定と `'auto'` は従来の自動位置を維持し、実行時に不正な値が渡された場合も自動位置を使います。

項目軸では、このモジュールの項目間の配置を使います。`'min'` は最初の表示項目の手前、`'max'` は最後の表示項目の後ろです。数値を指定すると、1から始まる表示項目番号の手前に交点を置きます。番号は四捨五入し、表示項目数の範囲内に収めます。明示した交点には逆順を反映しますが、自動位置は縦棒・折れ線・面では左端、横棒では下端のままです。交点を変えると軸線が移動し、`labelPosition: 'nextTo'` のラベルも追従します。それ以外のラベル位置、タイトル、グリッド線、描画領域の余白、データ描画に使うゼロの基準線は維持します。Excel の [Crosses](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.crosses)と[CrossesAt](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.crossesat)を1つのプロパティで指定します。

`labelPosition` で、各軸の数値目盛ラベルと項目ラベルの位置を指定します。`'low'` は X 軸では描画領域の下、Y 軸では左、`'high'` は上と右です。値や項目を逆順にしても、この配置側は変わりません。`'nextTo'` は実際の軸線に追従し、直交する軸に設定した交点も反映します。このモジュールでは横軸の下、縦軸の左に隣接ラベルを置きます。`'none'` はラベルだけを隠し、軸線・タイトル・グリッド線を維持します。未指定や不正な値は従来の下側・左側の配置を使い、設定画面の「自動」は指定を削除します。

上側のラベルはタイトルや凡例の下、右側のラベルは右の凡例の手前に余白を確保します。軸タイトルは下側・左側に配置します。それ以外のラベル位置では、非表示の場合も含めて従来の描画領域の余白を維持します。長い数値ラベルと上側・右側の項目ラベルは省略する場合があり、`aria-label` に全文を保持します。軸に隣接するラベルは描画領域内でデータと重なることがあります。Excel の[目盛ラベルの位置](https://learn.microsoft.com/en-us/office/vba/api/excel.xlticklabelposition)に対応する選択肢です。

`logBase` に2〜1000の有限値を指定すると、数値軸を対数目盛にします。設定画面の「対数目盛」を有効にすると底10で始まり、「底」で変更できます。チェックを外すと指定を削除します。横棒では X 軸、縦棒・折れ線・面では Y 軸、散布図では両軸を独立して設定できます。この実装では集合の項目グラフと散布図に適用します。積み上げと100%積み上げでは設定を保持しますが、描画には使いません。項目軸では使いません。

対数軸には有限の正の値を描画します。ゼロと負数のマークやデータラベルは描画せず、空セルを線で結ぶ設定でも、その値で折れ線を分断します。散布図では両軸の値が描画条件を満たす点を使います。線の接続は、値と範囲を対数座標に変換してから切り取ります。元の ID、フィルター、点のスタイル、表示するデータの値の対応は維持します。

自動の範囲は正のデータを底の累乗まで広げ、描画できる正の値がない場合は1〜底を使います。正の有限値の上下限は、有効な区間を作れる場合に自動範囲より優先します。同じ値の上下限や、有限の区間を作れない極端な上下限は、正の有限値の範囲に広げます。正でない上下限は無視します。主目盛は底の累乗を使い、極端に広い範囲では間引きます。`majorUnit` は線形目盛用の値として保持し、対数目盛の設定画面では無効になります。自動交点は1を実効範囲内に収めた位置で、正でない指定交点も同じ位置を使います。棒と面の塗りつぶしは正の実効最小値を基準にします。不正な底は線形目盛として描画します。Excel の [LogBase プロパティ](https://learn.microsoft.com/en-us/office/vba/api/excel.axis.logbase)と[数値軸の目盛設定](https://support.microsoft.com/en-us/office/change-the-scale-of-the-vertical-value-axis-in-a-chart)も参照してください。

### フィルター、ラベル、色

グラフのヘッダーから「要素」「スタイル」「フィルター」を開きます。変更は「適用」するまで下書きとして保持し、「キャンセル」または Escape で破棄します。「適用」は履歴1件として記録され、元に戻す・やり直しに対応します。再描画や言語の変更でも下書きを保持し、シート保護やホストのポリシーでグラフ編集が禁止されると読み取り専用になります。

フィルターで系列や項目の表示を切り替えます。`filter.hiddenSeriesIds` に系列ID、`filter.hiddenCategoryIds` に項目または XY 点のIDを指定します。ブック内のグラフの系列IDは `series-0`、`series-1` などで、番号はグラフが各系列に保存しているインデックスです。項目IDは `category-0`、`category-1`、XY 点のIDは `point-0`、`point-1` です。データを直接渡す場合は `categoryIds` または点の `id` を指定できます。非表示のデータは軸・凡例・積み上げ・割合の計算から除外し、残る点の元ID・インデックス・配色を保持します。

`dataLabels` で表示の有無、系列名・項目名・値・割合・凡例キー、区切り文字、位置、数値書式、テキスト色、フォントサイズを設定します。割合は円・ドーナツ・100%積み上げで使えます。散布図の項目名には X 値、値には Y 値を表示します。位置の選択肢と既定値は種類・積み上げ設定に応じて [Office のデータラベル位置規則](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/e2b1697c-7adc-463d-9081-3daef72f656f)に従います。面とドーナツは自動の中央配置を使います。長い表示を省略した場合も、`aria-label` に全文を保持します。

スタイルでは配色プリセットと個別の色を指定できます。`varyColors` は点ごとに配色を変える設定で、円とドーナツでは既定で有効です。`seriesStyles` の `seriesId` で系列を選び、`points` の `pointId` で個別の点を上書きします。塗りと線には色・透明度（0〜100%）、線には幅・線種、マーカーには表示・形・サイズ・塗り・線を指定できます。系列ごとの `dataLabels` は、グラフ全体のラベル設定より優先します。点の設定は系列から継承する設定より優先します。系列の凡例は系列のスタイル、円・ドーナツの凡例は最初の表示系列の各点のスタイルを使います。

```ts
createSessionChart(store, range, {
  wb,
  kind: 'column',
  filter: { hiddenSeriesIds: ['series-1'] },
  yAxis: { min: 0, max: 100, majorUnit: 20, numberFormat: '0.0', majorGridlines: true },
  dataLabels: { visible: true, showValue: true, numberFormat: '#,##0.00' },
  seriesStyles: [{
    seriesId: 'series-0',
    fill: { color: '#4472c4' },
    points: [{ pointId: 'category-2', fill: { color: '#ed7d31' } }],
  }],
}, history);
```

これらの設定はブックに保存されます。`palette` は各系列の色として書き込むため、ブックから読み直したグラフでは色を `palette` ではなく `seriesStyles` で返します。React と Vue は共通のコマンドと設定UIを使います。

### 系列の追加と削除

「スタイル」の「系列の追加」を押すと、系列名、系列の値、軸ラベルの範囲をセル参照で入力するフォームを開きます。散布図では代わりに Y の値と X の値を入力します。必須なのは値だけです。「系列の削除」は選択中の系列を削除します。どちらも「適用」を待たずにブック内のグラフをすぐに変更し、それぞれ履歴1件として記録します。下書きでグラフの種類や系列の方向を変更している間は使えず、系列は最低1つ残ります。

ホストのコードからは `addSessionChartSeries` と `removeSessionChartSeries` で同じ操作ができます。各範囲は別のシートにあっても構いません。どちらも更新後のグラフを返します。グラフがプレースホルダーの場合、編集が拒否された場合、エンジンが参照を受け付けなかった場合は `null` を返し、最後の系列を削除しようとした場合も `null` です。React と Vue のパッケージもこの2つを再エクスポートします。

```ts
addSessionChartSeries(store, chart.id, {
  name: nameCell,        // optional
  values: valueRange,    // Y values on a scatter chart
  categories: labelRange // optional; scatter charts take `x` instead
}, history, wb);

removeSessionChartSeries(store, chart.id, 'series-1', history, wb);
```

### グラフモジュールを単独で使う

`@libraz/formulon-cell/charts` から `layoutChart`、`layoutUnsupportedChart`、値の書式と目盛の補助関数、グラフの型を読み込めます。この入口はスプレッドシートのストア、計算エンジン、React、Vue、ブラウザに依存しません。

`layoutChart({ spec, data, width, height })` はカテゴリまたは XY のグラフデータと `ChartSpec` を受け取り、SVG に対応する要素の一覧を返します。各要素には属性、テキスト、系列・点の識別情報があります。省略可能な `accents` には、系列の自動配色に使うテーマの色を渡します。`layoutUnsupportedChart` は、描画できないグラフに使うプレースホルダーの枠を生成します。

`layoutChart` は `locale` と `formatValue(value, formatCode, locale)` コールバックも受け取ります。単独のフォーマッターは General と一般的な小数・桁区切り・割合の書式に対応し、コールバックが null または undefined を返すと既定処理を使います。セッションUIではスプレッドシートのフォーマッターで Excel のカスタム書式を処理します。関数を `ChartSpec` の外で渡すため、設定を JSON として扱え、グラフモジュールが計算エンジンに依存しません。

エンジンはグラフのモデルと保存内容を担当します。スプレッドシート側はそれを `ChartSpec` に対応付け、保護、履歴、オブジェクトの位置を担当します。DOM 側は要素一覧を SVG に変換し、操作を担当します。

### Excel 互換の範囲

実装範囲は上記の 2D グラフ 7 種類、カテゴリと系列の解釈、散布図の数値軸、積み上げ、欠測値の扱い、系列・項目のフィルター、データラベル、系列・点のスタイルです。日付軸は項目軸として描画し、近似曲線は描画しません。3D、複合グラフ、株価・等高線・レーダー・統計などの追加の種類はプレースホルダーとして表示します。Excel とピクセル単位で同じ描画は保証しません。

データの配置は [Microsoft のグラフ作成ガイド](https://support.microsoft.com/en-us/excel/get-started/create-a-chart-from-start-to-finish?ad=us&rs=en-us&ui=en-us)を参照しています。空セルの扱いは [Display Blanks As](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/b5c5c694-21d9-437c-9a4a-21e0e843eed8) に従います。描画設定には Excel の [GapWidth](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.gapwidth)、[Overlap](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.overlap)、[FirstSliceAngle](https://learn.microsoft.com/en-us/office/vba/api/excel.chartgroup.firstsliceangle) の定義を使います。

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
