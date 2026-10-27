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

## ホスト UI から組み込みダイアログを開く {#open-a-built-in-dialog-from-host-ui}

マウントしたインスタンスには、組み込みダイアログを起動するメソッドがあります。ダイアログを持つ機能が無効な場合、起動メソッドは何もしません。

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

| 起動メソッド | 有効にする機能 |
| --- | --- |
| `openFormatDialog(tab?)`、`openDataValidationDialog()` | `formatDialog` |
| `openFindReplace(tab?)`、`closeFindReplace()` | `findReplace` |
| `openCommentDialog({ mode? })` | `commentDialog`（`ui.features.comments`） |
| `openNamedRangeDialog()`、`openDefineNameDialog()` | `namedRanges` |
| `openHyperlinkDialog()` | `hyperlink` |
| `openConditionalDialog()` | `conditional`（`ui.features.conditionalFormatting`） |
| `openPasteSpecial()`、`pasteSpecial(options)` | `pasteSpecial` |
| `openPageSetup(tab?)` | `pageSetup` |
| `openGoTo()`、`openGoToSpecial()` | `gotoSpecial` |
| `openIterativeDialog()` | `iterative` |
| `openFunctionArguments(name?, { category? })` | `fxDialog` |
| `openQuickAnalysis()` | `quickAnalysis` |
| `openChartSettings(tab?)` | `charts`。グラフが選択されていなければ `false` を返します。 |
| `openWorkbookObjects()`、`openPivotFieldList(sheetIndex, pivotIndex)`、`openActivePivotFieldList()` | `workbookObjects` |
| `openPivotTableDialog({ placement? })` | `pivotTableDialog`（`ui.features.pivotTable`） |
| `openInsertCopiedCells()` | なし |
| `openEvaluateFormulaDialog()`、`openExternalLinksDialog()`、`openCfRulesDialog()`、`openCellStylesGallery()`、`openFilterDropdown()` | なし |

`openPivotFieldList(sheetIndex, pivotIndex)` は指定したピボットテーブルのフィールド一覧を開きます。`openActivePivotFieldList()` はアクティブセルの位置にあるピボットテーブルを探し、見つからない場合は `false` を返します。

操作ポリシーが有効な間は、対応する機能が無効になるため、ほとんどの起動メソッドは動作しません。詳しくは [オプション](/ja/cell/options#operation-policy) を参照してください。Mac リボンからは、ゴール シーク、統合、小計、スパークライン、スライサー、ブック統計も開けます。ホスト側のツールバーから呼ぶためのコマンド ID は [プラットフォームと Mac UI](/ja/cell/platform#mac-ribbon-dialogs) にあります。

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

`extensions` でダイアログを置き換えても、ほとんどの起動メソッドは組み込みのダイアログを対象にします。例外と、置き換えたダイアログの開き方は [拡張](/ja/cell/extensions#replace-a-built-in-surface) を参照してください。

## ダイアログの動作 {#dialog-behavior}

ワークブックのデータに影響する組み込みダイアログの動作です。

- **名前の管理**（`openNamedRangeDialog()`）: 名前には日本語などの ASCII 以外の文字を使えます。セル参照、`TRUE` / `FALSE`、句読点の判定の前に、全角 ASCII は半角へ揃えられます。新規作成では、同じスコープに既にある名前を拒否し、無効な名前と重複した名前で別のメッセージを出します。編集での名前の変更は 1 回の Undo で戻り、編集中はスコープを変更できません。新規作成には、選択範囲が絶対参照のシート参照として入力されます。`openDefineNameDialog()` は新規作成だけを開きます。名前ボックスはシート名付きの参照と複数領域の参照を受け付け、数式のオートコンプリートは関数と並べて定義名とテーブル名を候補にします。
- **ジャンプ**（`openGoTo()`）: 範囲名と直近 4 回のジャンプ先を一覧にし、名前、シート名付きの参照、複数領域の参照を受け付けます。「セル選択」ボタンから選択オプションを開けます。
- **選択オプション**（`openGoToSpecial()`）: アクティブセル領域、アクティブな配列、行内容の相違セル、列内容の相違セル、参照元、参照先、最後のセル、可視セル、条件付き書式と入力規則の「すべて」/「同じ」の選択など、デスクトップ版と同じ項目を備えます。単一セルを選択している場合は使用範囲を、複数セルを選択している場合はその内側だけを検索します。一致したセルは長方形にまとめられます。一致がない場合や 100,000 セルを超える場合は警告を表示し、選択は変わりません。リボンのクイック操作も同じ検索を使います。
- **ふりがなの設定**: 両方のリボンのホームタブにあるフォントグループから開きます。ふりがなの文字種（ひらがな、全角カタカナ、半角カタカナ）と配置（左揃え、中央揃え、均等割り付け）はセルごとにワークブックへ保存され、指定のないセルは全角カタカナの左揃えです。ふりがなの表示と、そのための行の高さの確保は、「ふりがなの表示」がオンのセルだけで行われます。
- **ピボットテーブル**: 既存のレポートを保存された定義（フィールド、順序、データフィールド、表示形式、アイテムの表示、総計）から編集でき、レポート全体の削除は 1 回の Undo で戻ります。「行ラベル」や「総計」などの見出しは UI の言語に従い、レポート上への入力、貼り付け、クリア、削除は拒否されます。レポートのセルを右クリックすると、ピボットテーブル用のメニューが開きます。新しいワークシートへのレポート作成は 1 回の Undo です。
- **範囲の編集を許可**（校閲 → 保護）: 保護したシートでも編集できる範囲を管理します。マネージャーはシートが保護されている間は使えず、その場合 `addAllowedEditRange()` は `null` を返します。パスワードを設定した範囲は、貼り付け、フィル、クリア、並べ替え、検索と置換、書式コマンド、セルの結合、コメント、数式バーなど、その範囲へ書き込み得るすべての編集経路で、セッションごとに 1 回パスワードを確認します。許可範囲の外にあるロック済みセルにも触れる編集は、確認の前に拒否されます。
- **計算方法の設定**（`openIterativeDialog()`、機能 `iterative`）: 計算モード、反復計算、R1C1 参照形式、表示桁数で計算、1904 年から計算、保存前の再計算を設定します。これらの設定はワークブックに保存されます。
