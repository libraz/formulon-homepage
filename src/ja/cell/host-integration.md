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

新しいワークブックでは `workbook` を省略して `Spreadsheet.mount()` に作成させるか、先にデータを投入するために `WorkbookHandle.createDefault()` を明示的に呼びます。`setWorkbook(nextWorkbook)` を使うと、ホスト要素を作り直さずにワークブックを差し替えられます。

初回の `mount()` に渡したワークブックは呼び出し元が管理します。`mount()` が作成したワークブックと、`setWorkbook()` に渡した差し替え先はインスタンスが管理し、不要になった時点で破棄します。最初に渡したワークブックは、差し替え後に呼び出し元で破棄してください。

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

`uploadStatus` プロパティと `setUploadStatus()` は、ホストの保存状態をステータスバーへ表示するために使います。保存を開始したか、成功したかはホストが判断します。

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

## 閲覧専用または入力フォームを更新する

`viewerPolicy()` は選択とコピーを許可する閲覧用に向いています。`fixedFormPolicy()` は、ホストが渡した範囲で値入力、値の消去、貼り付け、オートフィルを開始時から許可します。両方ともコアパッケージから公開され、React / Vue アダプターのプロパティにも渡せます。

```ts
import { fixedFormPolicy } from '@libraz/formulon-cell'

const editable = [{ sheet: 0, r0: 1, c0: 1, r1: 12, c1: 3 }]
const instance = await Spreadsheet.mount(host, {
  policy: fixedFormPolicy(editable),
  viewport: {
    range: { sheet: 0, r0: 0, c0: 0, r1: 14, c1: 4 },
    tabNavigation: 'editable',
    tabBoundary: 'stop',
  },
})
```

別の権限モデルでは `operations`、`editable`、`selection`、`copy` を持つ `InteractionPolicy` を指定します。ユーザーの権限が変わったら `setPolicy()` を呼びます。

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

## ネイティブの画面キャプチャ

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
