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

For a new workbook, omit `workbook` and let `Spreadsheet.mount()` create one, or create it explicitly with `WorkbookHandle.createDefault()` when the host needs to seed data first. `setWorkbook(nextWorkbook)` replaces the active workbook without rebuilding the host element. [Install](/cell/install#host-sizing) explains which handles the instance disposes.

## What a saved file keeps {#saved-state}

The cell layer writes its workbook objects through the engine when the file is saved, so a file reopens as it was left:

- Tables with their style, header and total rows, banded rows and columns, first and last column flags, per-column totals, and their own AutoFilter; custom table and PivotTable styles.
- PivotTables, including edits made from the stored definition.
- Shapes, sparklines, and table slicers.
- Sheet protection, workbook structure protection, and allowed edit ranges, with salted password hashes.
- Each sheet's view: the active sheet, selection, scroll position, frozen and split panes, zoom, view mode, Show Formulas, outline symbols and collapsed groups.
- Calculation options: mode, recalculate before saving, R1C1 reference style, precision as displayed, and the 1904 date system.
- Notes with their shown state, hyperlinks, validation sources, filter colors and sorts, named styles, and tab colors.

When the installed engine lacks the matching API, that object stays in the session only. `summarizeSpreadsheetCompatibility(workbook)` reports which objects are writable, read-only, session-only, or unsupported. Draw ink is never saved. Typed protection passwords are hashed asynchronously; `await whenSheetPasswordsHashed()` before `save()` so the file carries the salted hash.

In Manual calculation mode, `save()` recalculates first unless the workbook turns off recalculate-before-save. Pass `{ snapshot: true }` for an internal copy that skips that step.

## Load and save loss reports {#file-loss-reports}

The engine counts what it could not read or write. `workbook.loadDiagnostics()` returns the counters from `loadBytes()` (undecoded formulas, defined names, and parts; skipped features; unknown content types), and `workbook.lastSaveDiagnostics()` returns those of the latest save (downgraded formulas, deferred features, dropped parts and relationships, renumbered parts). `saveWithDiagnostics(format)` saves and returns `{ bytes, diagnostics }`. All counters are zero on an engine without diagnostics.

```ts
import { fileLossEntries, hasLoadLosses } from '@libraz/formulon-cell'

const load = workbook.loadDiagnostics()
if (hasLoadLosses(load)) {
  for (const { id, phase, count } of fileLossEntries(load, workbook.lastSaveDiagnostics())) {
    console.warn(`${phase}: ${id} x${count}`)
  }
}
```

Each counter is its own row and rows are never summed, because dropped parts and dropped relationships overlap. `buildFileLossReport(workbook, instance.i18n.strings.workbookObjects)` returns the same rows as localized warnings, and `buildSpreadsheetCompatibilityReport()` includes them.

## Save as `.xlsb` {#save-as-xlsb}

`writeWorkbook(workbook, format)` writes `'xlsx'` or `'xlsb'` without delivering the file and returns `{ format, bytes, losses }`. The binary writer drops notes, threaded comments, and AutoFilters, and may drop drawings, PivotTables, slicers, tables, sparklines, protected ranges, and other settings; each loss has a `certain` flag and, where known, a count. `WORKBOOK_SAVE_FORMATS` gives each format's extension and MIME type. Saving `.xlsb` on an engine without binary support throws; check `workbook.capabilities.xlsbSave`, or use `workbookSaveFormats(workbook)` for the formats the engine can write.

The built-in prompts are exported for a host-owned Save As flow:

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

`saveWorkbookWithPrompts()` writes the file and, when it leaves content out, asks the user to confirm first. It resolves `null` when the user cancels.

## Live workbook name in Watch Window

Pass `getWorkbookName` when the Watch Window should show a host-owned filename. The callback is read when the panel renders, so the host can change the name without remounting the spreadsheet:

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

The optional `uploadStatus` mount option (a prop in React and Vue) and the `setUploadStatus()` method let the status bar reflect a host save state. The host decides when a save starts and whether it succeeded.

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

## Follow the user's role

Keep the interaction policy in application state and call `instance.setPolicy()` when the user's role changes, for example `viewerPolicy()` for a reviewer and `fixedFormPolicy(ranges)` for an editor. The helpers and the `InteractionPolicy` fields are described in [Options](/cell/options#interaction-policy).

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
