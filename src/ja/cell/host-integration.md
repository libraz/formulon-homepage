---
title: ホスト統合
description: 保存、信頼済み更新、ステータス表示、印刷、ネイティブ連携を formulon-cell へ接続します。
---

# ホスト統合

`formulon-cell` はスプレッドシートの UI を提供します。ファイル、認証、クラウド保存、ネイティブプリンター、モーダルのレイアウトは通常ホストアプリケーションが管理します。`SpreadsheetInstance` のメソッドとイベントをホストとの接続に使います。

## ワークブックを読み込み、保存する

ホストがファイルを持っている場合は、マウント前にバイト列を読み込みます。ユーザーがダウンロードまたはアップロードを要求したら、同じ `WorkbookHandle` を保存します。

```ts
import { Spreadsheet, WorkbookHandle } from '@libraz/formulon-cell'

const bytes = new Uint8Array(await file.arrayBuffer())
const workbook = await WorkbookHandle.loadBytes(bytes)
const instance = await Spreadsheet.mount(host, { workbook })

function downloadWorkbook() {
  const output = instance.workbook.save()
  download(new Blob([output.slice().buffer]), 'workbook.xlsx')
}
```

新しいワークブックでは `workbook` を省略して `Spreadsheet.mount()` に作成させるか、先にデータを投入するために `WorkbookHandle.createDefault()` を明示的に呼びます。`setWorkbook(nextWorkbook)` を使うと、ホスト要素を作り直さずにワークブックを差し替えられます。インスタンスがどのハンドルを破棄するかは [インストール](/ja/cell/install#host-sizing) を参照してください。

## 保存したファイルに残るもの {#saved-state}

cell 層は保存時にワークブックのオブジェクトをエンジン経由で書き込むため、ファイルは最後の状態のまま開き直せます。

- テーブル: スタイル、見出し行と集計行、縞模様（行・列）、最初と最後の列のフラグ、列ごとの集計、テーブル自身のオートフィルター。ユーザー設定のテーブルスタイルとピボットテーブルスタイルも保存されます。
- ピボットテーブル（保存された定義からの編集を含む）。
- 図形、スパークライン、テーブルのスライサー。
- シートの保護、ブック構造の保護、編集を許可する範囲。パスワードはソルト付きハッシュで保存されます。
- シートごとのビュー: アクティブなシート、選択範囲、スクロール位置、ウィンドウ枠の固定と分割、ズーム、表示モード、数式の表示、アウトライン記号、折りたたんだグループ。
- 計算方法の設定: 計算モード、保存前の再計算、R1C1 参照形式、表示桁数で計算、1904 年から計算。
- メモとその表示状態、ハイパーリンク、入力規則の参照元、フィルターの色と並べ替え、セルのスタイル、シートの見出し色。

インストールされているエンジンが対応する API を持たない場合、そのオブジェクトはセッション内だけに残ります。どのオブジェクトが書き込み可能、読み取り専用、セッション限定、未対応なのかは `summarizeSpreadsheetCompatibility(workbook)` で確認できます。描画タブのインクは保存されません。入力された保護パスワードは非同期でハッシュ化されるため、`save()` の前に `await whenSheetPasswordsHashed()` を呼ぶと、ソルト付きハッシュがファイルに入ります。

手動計算モードでは、ワークブックが保存前の再計算を無効にしていない限り、`save()` は先に再計算します。内部用のコピーでこの手順を省くには `{ snapshot: true }` を渡します。

## 読み込みと保存の損失レポート {#file-loss-reports}

エンジンは、読み込めなかったものと書き込めなかったものを数えます。`workbook.loadDiagnostics()` は `loadBytes()` 時のカウンター（デコードできなかった数式、定義名、パーツ、スキップした機能、未知のコンテンツタイプ）を、`workbook.lastSaveDiagnostics()` は直近の保存のカウンター（ダウングレードした数式、保留した機能、破棄したパーツと関係、番号を振り直したパーツ）を返します。`saveWithDiagnostics(format)` は保存して `{ bytes, diagnostics }` を返します。診断に対応しないエンジンでは、すべてのカウンターが 0 です。

```ts
import { fileLossEntries, hasLoadLosses } from '@libraz/formulon-cell'

const load = workbook.loadDiagnostics()
if (hasLoadLosses(load)) {
  for (const { id, phase, count } of fileLossEntries(load, workbook.lastSaveDiagnostics())) {
    console.warn(`${phase}: ${id} x${count}`)
  }
}
```

カウンターは 1 つずつ別の行になり、合算されません。破棄したパーツと破棄した関係は重なるためです。`buildFileLossReport(workbook, instance.i18n.strings.workbookObjects)` は同じ行をローカライズした警告として返し、`buildSpreadsheetCompatibilityReport()` にも含まれます。

## `.xlsb` で保存する {#save-as-xlsb}

`writeWorkbook(workbook, format)` は `'xlsx'` または `'xlsb'` でファイルを書き出し（ユーザーには渡さず）、`{ format, bytes, losses }` を返します。バイナリ形式のライターは、メモ、スレッド形式のコメント、オートフィルターを書き込まず、描画オブジェクト、ピボットテーブル、スライサー、テーブル、スパークライン、保護された範囲、その他の設定も書き込まない場合があります。各 loss には `certain` フラグがあり、分かる場合は件数も持ちます。`WORKBOOK_SAVE_FORMATS` は各形式の拡張子と MIME タイプを返します。バイナリ保存に対応しないエンジンで `.xlsb` を保存すると例外になります。`workbook.capabilities.xlsbSave` を確認するか、`workbookSaveFormats(workbook)` でエンジンが書き出せる形式を調べてください。

組み込みのプロンプトは、ホスト側の「名前を付けて保存」で使えるようにエクスポートされています。

```ts
import {
  chooseWorkbookSaveFormat,
  saveWorkbookWithPrompts,
  WORKBOOK_SAVE_FORMATS,
} from '@libraz/formulon-cell'

const strings = instance.i18n.strings
const format = await chooseWorkbookSaveFormat(instance.workbook, strings, instance.host)
if (format) {
  const saved = await saveWorkbookWithPrompts({ wb: instance.workbook, strings, format, host: instance.host })
  if (saved) download(saved.bytes, `workbook${WORKBOOK_SAVE_FORMATS[saved.format].extension}`)
}
```

`saveWorkbookWithPrompts()` はファイルを書き出し、内容が欠ける場合は先にユーザーへ確認します。ユーザーが取り消すと `null` で解決します。

## Watch Window のワークブック名を更新する

Watch Window にホスト側のファイル名を表示する場合は `getWorkbookName` を渡します。コールバックはパネルの描画時に読み取るため、スプレッドシートを再マウントせずに名前を変更できます。

```ts
let currentFilename: string | null = 'report.xlsx'
const instance = await Spreadsheet.mount(host, {
  workbook,
  getWorkbookName: () => currentFilename,
})

function renameWorkbook(name: string | null) {
  currentFilename = name
  instance.closeWatchWindow()
  instance.openWatchWindow()
}
```

## ステータスバー {#status-bar}

1 セルの編集には `cellChange`、適用済みのセル更新には `changeBatch` を使います。拒否や変更なしの結果も受け取る場合は、下の例のように `instance.commands.subscribe()` を使います。数式の再計算後にホスト側の集計表示を更新する場合は `recalc` が使えます。

```ts
const offBatch = instance.commands.subscribe((event) => {
  if (event.status === 'rejected') {
    showValidation(event.rejected)
    return
  }
  if (event.status === 'applied') queueSave()
})

const offCell = instance.on('cellChange', ({ addr, value, formula }) => {
  draftStore.update(addr, { value, formula })
})

const offRecalc = instance.on('recalc', () => updateCalculatedSummary())

function disposeHostBindings() {
  offBatch()
  offCell()
  offRecalc()
  instance.dispose()
  workbook.dispose()
}
```

マウントオプションの `uploadStatus`（React と Vue ではプロパティ）と `setUploadStatus()` は、ホストの保存状態をステータスバーへ表示するために使います。保存を開始したか、成功したかはホストが判断します。

```ts
const instance = await Spreadsheet.mount(host, { uploadStatus: 'saved' })

async function saveToCloud() {
  instance.setUploadStatus('saving')
  try {
    await api.save(instance.workbook.save())
    instance.setUploadStatus('saved')
  } catch (error) {
    instance.setUploadStatus('error')
    throw error
  }
}
```

`'saved'`、`'saving'`、`'error'` を表示でき、`null` でインジケータを隠せます。`macroRecording` も同様にホストが記録状態を指定します。`true` は記録中、`false` は利用可能だが停止中、`null` は非表示です。`setMacroRecording()` または React / Vue の対応するプロパティで更新します。

## 信頼済みの変更を適用する

サーバーからのパッチ、インポート結果、フォームの復元には `applyChanges()` を使います。各要素は 0 始まりのシート、行、列を指定し、`input` 文字列または型付き `value` を持ちます。

```ts
const result = instance.applyChanges(
  [
    { addr: { sheet: 0, row: 2, col: 1 }, input: 'Approved' },
    { addr: { sheet: 0, row: 2, col: 2 }, input: '=B3&" / "&TEXT(TODAY(),"yyyy-mm-dd")' },
  ],
  { history: 'record', origin: 'server-sync' },
)

if (result.status === 'rejected') reportRejectedChanges(result.rejected)
```

ユーザーが元に戻す操作に含める場合は `history: 'record'`、サーバーなどから取得した新しいデータ一式として扱う場合は `history: 'reset'` を使います。結果には `applied`、`rejected`、`status`、`revision` が含まれ、適用済みの結果は `changeBatch` でも通知されます。拒否の表示には戻り値か `instance.commands.subscribe()` を使ってください。

## ユーザーの権限に合わせる

操作ポリシーはアプリケーションの状態として保持し、ユーザーの権限が変わったら `instance.setPolicy()` を呼びます。たとえば閲覧者には `viewerPolicy()`、編集者には `fixedFormPolicy(ranges)` を渡します。ヘルパーと `InteractionPolicy` のフィールドは [オプション](/ja/cell/options#operation-policy) で説明しています。

<CellEmbedDemo scenario="host-sync" />

## プリンタープロファイル {#printer-profiles}

ブラウザの印刷 API からは、物理プリンターの印刷可能領域を取得できません。デスクトップまたは Electron のホストは、認識しているプリンターのプロファイルを渡し、プリンターの変更時に更新できます。

```ts
const instance = await Spreadsheet.mount(host, {
  printerProfiles: [
    {
      id: 'office-a4',
      name: 'Office printer',
      paperSize: 'A4',
      orientation: 'portrait',
      printableBounds: { top: 0.17, right: 0.17, bottom: 0.17, left: 0.17 },
    },
  ],
  refreshPrinterProfiles: () => window.desktopPrinters.list(),
})

instance.setPrinterProfileId('office-a4')
await instance.refreshPrinterProfiles()
instance.print('pdf')
```

`PrinterProfile.printableBounds` の単位はインチです。ネイティブ API が用紙オプションを返す場合は `printerProfilesFromHostDevices()` を使えます。プリンターの検出と更新のタイミングはホストが管理します。受け付ける用紙サイズと向きは公開された `PrinterProfile` 型で確認できます。

## ネイティブの画面キャプチャ {#native-screen-capture}

挿入 > スクリーンショット > 画面の領域の操作は、ホストが渡した `captureScreenClip` フックを呼び出せます。ブラウザでは省略でき、ネイティブシェルでは画像 URL または `{ src, alt }` を返します。

```ts
const instance = await Spreadsheet.mount(host, {
  captureScreenClip: async () => {
    const image = await window.desktopCapture.selectRegion()
    return image ? { src: image.dataUrl, alt: image.description } : null
  },
})

const image = await instance.captureScreenClip()
```

ユーザーがキャンセルした場合は `null` を返します。権限確認とキャプチャ処理はホストが実装します。

## 印刷とホストのレイアウト

組み込み印刷は `instance.print()`、PDF 出力は `instance.print('pdf')` で呼び出せます。ホスト側に印刷ボタンを置く場合は `openPageSetup()` でページ設定を開きます。グリッドの親に十分な高さを与え、浮動ダイアログをモーダルや全画面表示の境界内に置く場合は `overlays.root` にその要素を渡します。周囲のレイアウトは [埋め込み](/ja/cell/embedding)、配置の詳細は [モーダルとオーバーレイ](/ja/cell/modals) を参照してください。

## 次に読むページ

- [フックとコンポーザブル](/ja/cell/hooks) — 選択状態、変更通知、言語設定を利用する具体例です。
- [API 一覧](/ja/cell/api) ─ インスタンスとワークブックの入口
- [React / Vue アダプター](/ja/cell/frameworks) ─ 各フレームワークのプロパティとイベント
- [テーマ](/ja/cell/theming) ─ グリッドとホスト周辺 UI の調整
