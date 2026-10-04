---
title: モーダルとダイアログ
description: formulon-cell のオーバーレイをネイティブダイアログ、フレームワークのモーダル、全画面表示に配置します。
---

# モーダルとダイアログ

`formulon-cell` の浮動 UI はオーバーレイポータルに配置されます。メニュー、ツールチップ、組み込みダイアログを、ホストが選んだ表示境界の内側に置けます。スプレッドシートをネイティブ `<dialog>`、フレームワークのモーダル、全画面表示要素に入れる場合に使います。

<CellEmbedDemo scenario="overlay" />

## ネイティブ `<dialog>`

ネイティブダイアログを開いた後にスプレッドシートをマウントし、ダイアログをオーバーレイの配置先（`overlays.root`）に指定します。

```html
<dialog id="sheet-dialog">
  <div data-sheet-host style="height: 520px"></div>
</dialog>
<button id="open-sheet">Open workbook</button>
```

```ts
import {
  Spreadsheet,
  WorkbookHandle
} from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const dialog = document.querySelector<HTMLDialogElement>('#sheet-dialog')!
const host = dialog.querySelector<HTMLElement>('[data-sheet-host]')!
let opening = false

async function openSheet() {
  if (opening || dialog.open) return
  opening = true
  dialog.showModal()
  let workbook: WorkbookHandle | undefined
  let instance: Awaited<ReturnType<typeof Spreadsheet.mount>> | undefined
  let mounting = false
  let closed = false
  const disposeWorkbook = () => {
    const current = workbook
    workbook = undefined
    current?.dispose()
  }
  const onClose = () => {
    closed = true
    instance?.dispose()
    instance = undefined
    if (!mounting) disposeWorkbook()
  }
  dialog.addEventListener('close', onClose, { once: true })

  try {
    const nextWorkbook = await WorkbookHandle.createDefault()
    workbook = nextWorkbook
    if (closed) {
      disposeWorkbook()
      return
    }
    mounting = true
    instance = await Spreadsheet.mount(host, {
      workbook: nextWorkbook,
      ui: { profile: 'standard' },
      overlays: { root: dialog }
    })
    mounting = false
    if (closed || !dialog.open) {
      instance.dispose()
      instance = undefined
      disposeWorkbook()
    }
  } catch (error) {
    mounting = false
    disposeWorkbook()
    if (!closed) {
      dialog.close()
      showSpreadsheetError(error)
    }
  } finally {
    opening = false
  }
}

document.querySelector('#open-sheet')!.addEventListener('click', () => {
  void openSheet()
})
```

明示的な配置先により表示境界を固定できます。マウント先がすでに開いているネイティブダイアログの中にある場合、既定の配置先もそのダイアログになります。モーダル管理機能がホスト要素を生成する場合や、ビューの途中でホストが移動する場合は `overlays.root` を指定します。

## フレームワークのモーダル

フレームワークのモーダルコンポーネントは、スプレッドシートと同じドキュメント内に残るモーダル表示要素を提供することが一般的です。要素を直接渡すか、モーダル要素が作り直される場合は、その要素を返す関数を渡します。

```ts
const instance = await Spreadsheet.mount(sheetHost, {
  workbook,
  overlays: {
    root: () => modalSurfaceElement
  }
})
```

モーダルが変わったときは配置先を更新します。

```ts
instance.setOverlayOptions({ root: nextModalSurface })
```

`root` はマウント先の `ownerDocument` に属する `HTMLElement` である必要があります。組み込みダイアログやメニューが開いている間は、オーバーレイの配置先を DOM に残します。

## 全画面表示

シートを全画面表示にするときは、ポータルを全画面表示要素へ向けます。

```ts
await fullscreenSurface.requestFullscreen()
instance.setOverlayOptions({ root: fullscreenSurface })
```

配置先を返す関数を使うと、境界の変化にも追従できます。

```ts
instance.setOverlayOptions({
  root: () => {
    const current = document.fullscreenElement
    return current instanceof HTMLElement ? current : fullscreenSurface
  }
})
```

通常のページレイアウトへ戻り、既定のポータル配置を使う場合は `instance.setOverlayOptions(undefined)` を呼びます。

## ホスト UI から組み込みダイアログを開く

マウントしたインスタンスには、組み込みダイアログを起動するメソッドがあります。選択したプロファイルまたは機能フラグで、対応する機能を有効にしてください。

```ts
openFormatButton.addEventListener('click', () => {
  instance.openFormatDialog('number')
})

findButton.addEventListener('click', () => {
  instance.openFindReplace('find')
})

commentButton.addEventListener('click', () => {
  instance.openCommentDialog()
})

validationButton.addEventListener('click', () => {
  instance.openDataValidationDialog()
})

namesButton.addEventListener('click', () => {
  instance.openNamedRangeDialog()
})
```

ほかに `openHyperlinkDialog()`、`openPageSetup()`、`openConditionalDialog()`、`openPasteSpecial()`、`openEvaluateFormulaDialog()`、`openPivotTableDialog()` があります。各メソッドの現在のオプション引数は、配布パッケージの型宣言を参照してください。

Mac リボンからは、ゴール シーク、統合、小計、スパークライン、スライサー、ブック統計のダイアログを開けます。ホストが独自のツールバーを用意する場合の起動方法と制限は [プラットフォームと Mac UI](/ja/cell/platform) を参照してください。

`openDataValidationDialog()` を使うには `formatDialog: true` が必要です。`validation` はセル入力の検証補助やリストのドロップダウンを制御します。ほかの起動メソッドには、それぞれ対応する組み込みダイアログの機能フラグが必要です。

対応する機能が無効な場合は、プロファイルまたは機能フラグで有効にします。

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: {
    profile: 'embedded',
    features: {
      formatDialog: true,
      comments: true
    }
  }
})
```

ホスト側で作るダイアログにも同じオーバーレイの配置先を使えます。コンテキストメニューの `action`、ツールバーのコールバック、アプリケーションのコマンドから開き、周囲のビューが閉じるときにスプレッドシートのインスタンスを破棄します。

`openFindReplace()` などのインスタンスメソッドは組み込み機能を開きます。`extensions` で追加したダイアログは `instance.features[id]` のハンドルを使って開いてください。組み込み機能を無効にすると、その起動メソッドも動作しません。[拡張](/ja/cell/extensions) も参照してください。
