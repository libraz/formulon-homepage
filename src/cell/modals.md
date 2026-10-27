---
title: Modals and dialogs
description: Place formulon-cell overlays in native dialogs, framework modals, and fullscreen surfaces.
---

# Modals and dialogs

`formulon-cell` places floating UI in an overlay portal. The portal keeps menus, tooltips, and built-in dialogs inside the presentation boundary chosen by the host. This matters when the spreadsheet is inside a native `<dialog>`, a framework modal, or fullscreen content.

<CellEmbedDemo scenario="overlay" />

## Native `<dialog>`

Mount the spreadsheet after opening the native dialog and pass the dialog as the overlay root:

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

The explicit root makes the boundary clear. When a mounted host is already inside an open native dialog, the default portal resolution also follows that dialog; `overlays.root` is useful when the host is created by a modal manager or is moved during the view lifetime.

## Framework modal

Framework modal components usually expose a surface element that stays in the same document as the spreadsheet host. Pass that element directly or use a resolver when the modal surface is recreated:

```ts
const instance = await Spreadsheet.mount(sheetHost, {
  workbook,
  overlays: {
    root: () => modalSurfaceElement
  }
})
```

Update the root when the modal changes:

```ts
instance.setOverlayOptions({ root: nextModalSurface })
```

The root must be an `HTMLElement` from the mounted host's `ownerDocument`. Keep the overlay root attached while a built-in dialog or menu is open.

## Fullscreen

When the sheet enters fullscreen, point the portal at the fullscreen element:

```ts
await fullscreenSurface.requestFullscreen()
instance.setOverlayOptions({ root: fullscreenSurface })
```

The portal can also follow a changing boundary with a resolver:

```ts
instance.setOverlayOptions({
  root: () => {
    const current = document.fullscreenElement
    return current instanceof HTMLElement ? current : fullscreenSurface
  }
})
```

Call `instance.setOverlayOptions(undefined)` when the host returns to its normal page layout and should use the default portal placement.

## Open a built-in dialog from host UI {#open-a-built-in-dialog-from-host-ui}

The mounted instance exposes direct entry points for built-in dialogs. An opener does nothing when the feature that owns its dialog is off:

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

| Opener | Feature that must be on |
| --- | --- |
| `openFormatDialog(tab?)`, `openDataValidationDialog()` | `formatDialog` |
| `openFindReplace(tab?)`, `closeFindReplace()` | `findReplace` |
| `openCommentDialog({ mode? })` | `commentDialog` (`ui.features.comments`) |
| `openNamedRangeDialog()`, `openDefineNameDialog()` | `namedRanges` |
| `openHyperlinkDialog()` | `hyperlink` |
| `openConditionalDialog()` | `conditional` (`ui.features.conditionalFormatting`) |
| `openPasteSpecial()`, `pasteSpecial(options)` | `pasteSpecial` |
| `openPageSetup(tab?)` | `pageSetup` |
| `openGoTo()`, `openGoToSpecial()` | `gotoSpecial` |
| `openIterativeDialog()` | `iterative` |
| `openFunctionArguments(name?, { category? })` | `fxDialog` |
| `openQuickAnalysis()` | `quickAnalysis` |
| `openChartSettings(tab?)` | `charts`. Returns `false` when no chart is selected. |
| `openWorkbookObjects()`, `openPivotFieldList(sheetIndex, pivotIndex)`, `openActivePivotFieldList()` | `workbookObjects` |
| `openPivotTableDialog({ placement? })` | `pivotTableDialog` (`ui.features.pivotTable`) |
| `openInsertCopiedCells()` | None. |
| `openEvaluateFormulaDialog()`, `openExternalLinksDialog()`, `openCfRulesDialog()`, `openCellStylesGallery()`, `openFilterDropdown()` | None. |

`openPivotFieldList(sheetIndex, pivotIndex)` opens the field list for the specified PivotTable. `openActivePivotFieldList()` looks for a PivotTable under the active cell and returns `false` when there is none.

While an interaction policy is active, most openers stay inert because their features are off; see [Options](/cell/options#interaction-policy). The Mac ribbon also opens Goal Seek, Consolidate, Subtotal, Sparkline, Slicer, and Workbook Statistics; [Platform and Mac UI](/cell/platform#mac-ribbon-dialogs) lists their command IDs for a host-owned toolbar.

If the matching feature is disabled, enable it in the profile or pass the corresponding feature flag:

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

Host-owned dialogs can use the same overlay root. Open them from a context-menu action, a toolbar callback, or an application command, and dispose the spreadsheet instance when the surrounding view closes.

When a dialog is replaced through `extensions`, most openers keep targeting the built-in; [Extensions](/cell/extensions#replace-a-built-in-surface) lists the exceptions and how to open a replacement.

## Dialog behavior {#dialog-behavior}

Behavior of the built-in dialogs that affect workbook data:

- **Name Manager** (`openNamedRangeDialog()`): names may contain Japanese and other non-ASCII text, and full-width ASCII is folded before the cell-reference, `TRUE`/`FALSE`, and punctuation checks. New Name refuses a name that already exists in its scope and words invalid and duplicate names differently. Renaming in Edit is one undo step, and the scope is read-only while editing. New Name pre-fills the selection as an absolute sheet reference. `openDefineNameDialog()` opens New Name alone. The Name Box accepts sheet-qualified and multi-area references, and formula autocomplete offers defined and table names next to functions.
- **Go To** (`openGoTo()`): lists range names and the last four jumps, and accepts names, sheet-qualified references, and multi-area references. Its Special button opens Go To Special.
- **Go To Special** (`openGoToSpecial()`): offers the desktop options, including current region, current array, row and column differences, precedents and dependents, last cell, visible cells, and the All/Same choices for conditional formats and data validation. A single selected cell searches the used range; a multi-cell selection searches only inside it. Matches merge into rectangles. No match, or more than 100,000 cells, raises an alert and leaves the selection unchanged. The ribbon's quick actions use the same search.
- **Phonetic Settings**: in the Home font group of both ribbons. The guide's kana form (hiragana, full-width katakana, or half-width katakana) and alignment (left, centered, or distributed) are stored per cell in the workbook; a cell with none uses full-width katakana aligned left. A guide is drawn, and row height reserved for it, only on cells whose Show Phonetic flag is on.
- **PivotTable**: the dialog edits an existing report from its stored definition (fields, order, data fields, number formats, item visibility, grand totals) and deletes a whole report as one undo step. Captions such as Row Labels and Grand Total follow the UI language, and typing, pasting, clearing, or deleting over a report is refused. A right click on a report cell opens the pivot menu. Creating a report on a new worksheet is one undo step.
- **Allow Edit Ranges** (Review → Protect): lists ranges that stay editable on a protected sheet; the manager is unavailable while the sheet is protected, and `addAllowedEditRange()` returns `null` in that case. A range with a password asks for it once per session, on every edit path that can write into it: paste, fill, Clear, sort, Find/Replace, format commands, merge, comments, and the formula bar, among others. An edit that also touches locked cells outside every allowed range is refused before any prompt.
- **Calculation options** (`openIterativeDialog()`, feature `iterative`): calculation mode, iteration, R1C1 reference style, precision as displayed, the 1904 date system, and recalculation before saving. These settings are stored in the workbook.
