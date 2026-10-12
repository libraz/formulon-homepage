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
| `openWorkbookObjects()`, `openPivotFieldList()`, `openActivePivotFieldList()` | `workbookObjects` |
| `openPivotTableDialog({ placement? })` | `pivotTableDialog` (`ui.features.pivotTable`) |
| `openInsertCopiedCells()` | None. |
| `openEvaluateFormulaDialog()`, `openExternalLinksDialog()`, `openCfRulesDialog()`, `openCellStylesGallery()`, `openFilterDropdown()` | None. |

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
