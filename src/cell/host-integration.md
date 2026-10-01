---
title: Host integration
description: Connect saving, trusted updates, status indicators, printing, and native host actions to formulon-cell.
---

# Host integration

`formulon-cell` supplies the spreadsheet surface. The surrounding application usually owns files, authentication, cloud saves, native printers, and modal layout. The `SpreadsheetInstance` methods and events provide the boundary between those responsibilities.

## Load and save a workbook

Load bytes before mounting when the host already has a file. Save the same `WorkbookHandle` when the user requests a download or an upload.

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

For a new workbook, omit `workbook` and let `Spreadsheet.mount()` create one, or create it explicitly with `WorkbookHandle.createDefault()` when the host needs to seed data first. `setWorkbook(nextWorkbook)` replaces the active workbook without rebuilding the host element.

A workbook supplied to the initial mount remains caller-owned. The instance owns its default-created workbook and any replacement passed to `setWorkbook()`. After replacement, dispose the original caller-owned handle once it is no longer used; the instance disposes its current replacement.

## Status bar {#status-bar}

Use `cellChange` for individual cell edits and `changeBatch` for applied cell batches. To receive rejected and unchanged results as well, use `instance.commands.subscribe()` as in this example. `recalc` is useful when the host displays a derived status after formulas are recalculated.

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

The optional `uploadStatus` prop and `setUploadStatus()` method let the status bar reflect a host save state. The host decides when a save starts and whether it succeeded.

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

`'saved'`, `'saving'`, and `'error'` show a host-controlled state. Pass `null` to hide the indicator. `macroRecording` follows the same boundary: `true` means recording, `false` means available but stopped, and `null` hides the indicator. Update it with `setMacroRecording()` or the matching React/Vue prop.

## Apply trusted changes

Use `applyChanges()` when the host imports a form result, receives a server patch, or restores a draft. Each item identifies a zero-based sheet, row, and column and can contain either an `input` string or a typed `value`.

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

Use `history: 'record'` when the update belongs in the user's undo flow. Use `history: 'reset'` for a fresh trusted snapshot from a server or another host source. The result reports `applied`, `rejected`, `status`, and `revision`; applied results also trigger `changeBatch`. Handle rejection using the returned result or `instance.commands.subscribe()`.

## Update a read-only or form embed

`viewerPolicy()` is suitable for a viewer that still allows selection and copying. `fixedFormPolicy()` starts with value entry, clear, paste, and fill in the ranges supplied by the host. Both are exported from the core package and can be passed through the React/Vue adapters.

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

For a different permission model, provide an `InteractionPolicy` with `operations`, `editable`, `selection`, and `copy` settings. Keep the policy in application state and call `setPolicy()` when the user's role changes.

<CellEmbedDemo scenario="host-sync" />

## Printer profiles {#printer-profiles}

Browser print APIs do not expose a physical printer's printable area. A desktop or Electron host can pass the printer profiles it knows about and refresh them when the user changes printers.

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

`PrinterProfile.printableBounds` is expressed in inches. `printerProfilesFromHostDevices()` is available when the native API returns devices with paper options. The host remains responsible for discovering printers and deciding when to refresh the list. See the exported `PrinterProfile` type for the accepted paper sizes and orientation values.

## Native screen capture

The Insert > Screenshot > Screen Clipping action can call a host-provided `captureScreenClip` hook. A browser host can omit it; a native shell can return an image URL or `{ src, alt }`.

```ts
const instance = await Spreadsheet.mount(host, {
  captureScreenClip: async () => {
    const image = await window.desktopCapture.selectRegion()
    return image ? { src: image.dataUrl, alt: image.description } : null
  },
})

const image = await instance.captureScreenClip()
```

Return `null` when the user cancels. The host owns the permission prompt and the capture implementation.

## Print and host layout

Call `instance.print()` for the built-in print flow or `instance.print('pdf')` for PDF output. Open Page Setup through `openPageSetup()` when the host supplies its own print button. Keep the spreadsheet's parent large enough to display the grid and give the parent modal or fullscreen element to `overlays.root` when floating dialogs must stay inside that boundary. The [Embedding guide](/cell/embedding) and [Modal and overlay guide](/cell/modals) show the surrounding layout.

## Read next

- [Hooks and composables](/cell/hooks) — selection, edit notifications, and shared language controls.
- [API surface](/cell/api) — the instance and workbook entry points.
- [React and Vue adapters](/cell/frameworks) — host props and events in each framework.
- [Theming](/cell/theming) — coordinate the grid and host controls.
