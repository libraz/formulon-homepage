---
title: Host integration boundary
description: The status bar upload/macro-recording state and printer profile APIs a host application drives through formulon-cell's SpreadsheetInstance.
---

# Host Integration

A few pieces of Excel-365-style chrome need data that only the host application can provide — cloud sync/save state, macro-recording state, and physical printer capabilities. `formulon-cell` core owns the display and the wiring; it never invents this state itself. This page documents that boundary as a reference for hosts building on the integration-test harness, not as a production-support contract.

::: info Glossary: core vs host
*Core* is `@libraz/formulon-cell` and its React/Vue adapters — the chrome, the store, the engine binding. *Host* is your application: the code that knows whether a save actually succeeded, whether a macro recorder is running, or what printers are physically attached. Core reads state the host hands it; core never queries the outside world on its own.
:::

## Status bar: upload status & macro recording

The status bar can show two host-driven badges — an Upload Status indicator and a Macro Recording indicator — both hidden by default until the host supplies a value.

```ts
type StatusBarUploadStatus = 'saved' | 'saving' | 'error' | null
// macroRecording has no separate exported type alias — it is `boolean | null`
// wherever it appears (MountOptions.macroRecording, setMacroRecording's parameter).
```

| Value | Meaning |
| --- | --- |
| `'saved'` | The most recent save/sync succeeded |
| `'saving'` | A save/sync is in progress |
| `'error'` | The most recent save/sync failed |
| `null` / `undefined` | Host has no upload state to report — badge hidden |

| Value | Meaning |
| --- | --- |
| `true` | Macro recording is active |
| `false` | Recording is available but currently stopped — shown as "Record Macro" |
| `null` / `undefined` | Host doesn't expose macro recording — badge hidden |

### Entry points

Both are set at mount time and updated at runtime through the same two methods:

```ts
const instance = await Spreadsheet.mount(host, {
  uploadStatus: 'saving',
  macroRecording: false
})

instance.setUploadStatus('saved')
instance.setUploadStatus('error')
instance.setUploadStatus(null)

instance.setMacroRecording(true)
instance.setMacroRecording(false)
instance.setMacroRecording(null)
```

React and Vue expose the same state as props — see [Framework adapters](/cell/frameworks) — and forward prop changes to these same setters; neither framework package implements its own status bar:

```tsx
<Spreadsheet uploadStatus={syncState} macroRecording={isRecordingMacro} />
```

```vue
<Spreadsheet :upload-status="syncState" :macro-recording="isRecordingMacro" />
```

### Responsibility split

| Core | Host |
| --- | --- |
| Renders `uploadStatus` / `macroRecording` in the status bar | Converts real cloud-save / autosave / co-editing state into `uploadStatus` |
| Lets the status bar chooser show/hide each badge | Converts a real macro recorder / native automation / script recorder into `macroRecording` |
| Hides a badge whenever its value is `null`/`undefined` | Calls the setters at workbook swap, save-start, save-complete, save-fail, and record-start/stop |

```ts
const sheet = await Spreadsheet.mount(host, {
  uploadStatus: cloudSave.currentStatus(),
  macroRecording: macroRecorder.isAvailable() ? macroRecorder.isRecording() : null
})

cloudSave.on('saving', () => sheet.setUploadStatus('saving'))
cloudSave.on('saved', () => sheet.setUploadStatus('saved'))
cloudSave.on('error', () => sheet.setUploadStatus('error'))

macroRecorder.on('start', () => sheet.setMacroRecording(true))
macroRecorder.on('stop', () => sheet.setMacroRecording(false))
macroRecorder.on('unavailable', () => sheet.setMacroRecording(null))
```

`cloudSave` and `macroRecorder` are host-owned in this example; nothing like them ships in core.

## Printer Profile API

Browser print APIs don't expose a physical printer's non-printable margins, so Page Setup and the built-in print/PDF flow rely on the host to supply `PrinterProfile` data for the printers it knows about.

```ts
interface PrinterProfile {
  id?: string
  name?: string
  paperSize?: 'A4' | 'A3' | 'A5' | 'letter' | 'legal' | 'tabloid'
  orientation?: 'portrait' | 'landscape'
  printableBounds: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}
```

`printableBounds` is in inches and represents the minimum non-printable inset from each paper edge (e.g. `left: 0.17` means the leftmost 0.17 inch can't be printed to).

### Entry points

```ts
const instance = await Spreadsheet.mount(host, {
  printerProfiles,
  printerProfileId,
  refreshPrinterProfiles
})

instance.setPrinterProfiles(nextProfiles)
instance.setPrinterProfileId(nextPrinterId)
await instance.refreshPrinterProfiles()
```

React and Vue expose matching `printerProfiles`, `printerProfileId`, and `refreshPrinterProfiles` props — see [Framework adapters](/cell/frameworks) — that forward to these same setters; there is no separate framework-level printer API.

`refreshPrinterProfiles` returns `PrinterProfile[] | undefined`, synchronously or via `Promise`. `undefined` means "could not refresh, keep the existing profiles"; an empty array means "the host has confirmed there are no profiles."

### Normalization

Core normalizes whatever the host provides — trims `id`/`name` (blank becomes unset), drops unrecognized `paperSize`/`orientation` values, fills `printableBounds` with non-negative numbers, and de-duplicates profiles (by `id` when present, otherwise by `name` + `paperSize` + `orientation`). Hosts that want the same normalization can call it directly instead of re-implementing it: `normalizePrinterProfile()`, `normalizePrinterProfileId()`, `normalizePrinterProfiles()`.

### Profile selection

`resolvePrinterProfileBounds(setup, profiles, preferredId)` picks a profile in this order:

1. Matches `preferredId` **and** the current paper size/orientation
2. Matches `preferredId`
3. Matches both the current paper size and orientation
4. Matches the current paper size
5. Matches the current orientation
6. The first candidate

If nothing matches, core does not apply any host-provided bounds — it falls back to the sheet's saved `PageSetup.printableBounds`, or a `0` inset if there is none.

### Electron / native host example

```ts
import { type PrinterProfile, printerProfilesFromHostDevices } from '@libraz/formulon-cell'

async function loadPrinterProfiles(): Promise<readonly PrinterProfile[]> {
  const devices = await window.nativePrinters.list()
  return (
    printerProfilesFromHostDevices(
      devices.map((device) => ({
        id: device.id,
        name: device.name,
        paperOptions: device.paperOptions.map((paper) => ({
          id: paper.id,
          label: paper.label,
          paperSize: paper.size,
          orientation: paper.orientation,
          hardwareMarginsInches: paper.hardwareMarginsInches
        }))
      }))
    ) ?? []
  )
}

const instance = await Spreadsheet.mount(host, {
  printerProfiles: await loadPrinterProfiles(),
  refreshPrinterProfiles: loadPrinterProfiles
})
```

`window.nativePrinters` is a host-owned boundary; core does not enumerate printers itself. `printerProfilesFromHostDevices()` converts device/paper-option id, name/label, paper size, orientation, and `hardwareMarginsInches` (or `printableBounds`) into `PrinterProfile[]`, applying the same de-duplication and bounds normalization as `normalizePrinterProfiles()`.

### Responsibility split

| Core | Host |
| --- | --- |
| Normalizes incoming `PrinterProfile` data | Enumerates printers and their printable area via OS/Electron/native APIs |
| Picks the best-matching profile for the current paper size/orientation | Converts that data into `PrinterProfile` shape |
| Reflects the chosen profile into Page Setup display, warnings, and print/PDF output | Calls `setPrinterProfiles`/`setPrinterProfileId` when the user changes printer, paper, or orientation |
| Falls back to sheet-saved bounds or `0` inset when no profile matches | Represents "driver values unavailable" as a missing profile, not a fabricated one |

### UI fallback behavior

Without a matching profile: the Page Setup printer selector is hidden (unless `refreshPrinterProfiles` is available, in which case a refresh affordance can still show), and the Margins tab's "Printer minimum margins" shows `0` unless the sheet has saved `printableBounds`. With a profile: the selector prefers the host-provided `name`, falling back to `id` or a paper/orientation label; changing paper, orientation, or profile re-resolves `printableBounds` into the sheet's Page Setup; and print output uses whichever is larger of the user's margins and the printable bounds.

## Read next

- [Framework adapters](/cell/frameworks) — the React/Vue props that forward to these setters.
- [API surface](/cell/api) — the rest of `SpreadsheetInstance`.
- [Embedding guide](/cell/embedding) — mounting shapes and lifecycle hooks.
