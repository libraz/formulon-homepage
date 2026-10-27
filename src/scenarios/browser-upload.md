# Browser Workbook Upload

Use this pattern when a user uploads an `.xlsx`, your app recalculates it locally, and the browser returns values or a modified workbook — without ever sending the file to a server.

::: warning Browser hosting requirement
The default `@libraz/formulon` WASM entry is single-threaded and does not require cross-origin isolation. The optional `@libraz/formulon/threads` entry needs the COOP / COEP headers — see [Bundler setup](/cell/bundler) and [Troubleshooting](/start/troubleshooting).
:::

::: info Glossary: ArrayBuffer / Uint8Array
The browser represents file bytes with an `ArrayBuffer`, which a `Uint8Array` can read. Wrap the result of `File.arrayBuffer()` in `new Uint8Array(buffer)` before passing it to `loadBytes()`. Keep that buffer available until loading finishes; transferring it to another worker detaches it from the sender.
:::

## Flow

<DiagramFlow
  :steps="[
    { label: 'User selects .xlsx', note: 'The file stays in the browser' },
    { label: 'Read ArrayBuffer', note: 'file.arrayBuffer() into a Uint8Array' },
    { label: 'Module.Workbook.loadBytes', note: 'Check wb.isValid() before use' },
    { label: 'Mutate inputs', note: 'Write the input cells' },
    { label: 'recalc()', note: 'Check status.ok before reading' },
    { label: 'Read or save', note: 'Cell values, or bytes from save()' }
  ]"
  label="Browser upload flow: the user selects an .xlsx, the page reads its ArrayBuffer, loads it, mutates inputs, recalculates, then reads values or saves bytes"
  caption="The file is recalculated in the browser, so nothing is uploaded to a server."
/>

## Minimal implementation

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const check = (status: { ok: boolean; message: string; context: string }) => {
  if (!status.ok) throw new Error(`${status.message}: ${status.context}`)
}

export async function recalcUpload(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const wb = Module.Workbook.loadBytes(bytes)

  try {
    if (!wb.isValid()) {
      throw new Error(Module.lastErrorMessage())
    }

    check(wb.recalc())
    const cell = wb.getValue(0, 0, 0)
    if (!cell.status.ok) {
      throw new Error(cell.status.message)
    }
    const saved = wb.save()

    if (!saved.status.ok || saved.bytes === null) {
      throw new Error(saved.status.message)
    }

    return { cell, bytes: saved.bytes }
  } finally {
    wb.delete()
  }
}
```

The `try / finally` is the important shape — `wb.delete()` releases WASM heap memory even when the helper or application throws during recalculation.

The panel below is that function with a file picker and a live sheet attached. Choosing a workbook reads it with `File.arrayBuffer()`, hands the bytes to `loadBytes()`, renders the recalculated result in an embedded `formulon-cell` grid, and offers the saved bytes as a download. A file that is not a workbook stops at `isValid()` and shows `lastErrorMessage()`, the first row of the [error table](#error-surfaces) below.

<RecalcDemo />

## Running the engine off the main thread

Large workbooks can stall UI rendering during recalc. Move the engine into a dedicated worker:

```ts
// worker.ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()

self.onmessage = async (event) => {
  const bytes = new Uint8Array(event.data)
  const wb = Module.Workbook.loadBytes(bytes)
  try {
    if (!wb.isValid()) {
      throw new Error(Module.lastErrorMessage())
    }
    const recalculated = wb.recalc()
    if (!recalculated.ok) throw new Error(recalculated.message)
    const saved = wb.save()
    if (!saved.status.ok || saved.bytes === null) {
      self.postMessage({ ok: false, message: saved.status.message })
      return
    }
    self.postMessage({ ok: true, bytes: saved.bytes }, [saved.bytes.buffer])
  } catch (e) {
    self.postMessage({ ok: false, message: (e as Error).message })
  } finally {
    wb.delete()
  }
}
```

```ts
// main.ts
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
worker.onmessage = (event) => updateUi(event.data)

const buffer = await file.arrayBuffer()
worker.postMessage(buffer, [buffer])
```

Listing a buffer in the transfer list moves it to the receiver instead of copying it; the sender's buffer is detached and cannot be used afterward. Read the buffer once and pass the same reference as both the payload and the transfer list. A second `file.arrayBuffer()` call creates a different buffer, and whichever one is not in the transfer list is copied.

<DiagramFlow
  :steps="[
    { label: 'Read ArrayBuffer', note: 'Main thread, read once' },
    { label: 'Transfer to worker', note: 'postMessage(buffer, [buffer])' },
    { label: 'Recalculate', note: 'The worker owns the buffer now', tone: 'alt' },
    { label: 'Transfer back', note: 'postMessage(bytes, [bytes.buffer])', tone: 'alt' },
    { label: 'Result ready', note: 'Main thread owns the output bytes' }
  ]"
  label="Main thread reads the ArrayBuffer, transfers ownership to the worker via postMessage with a transfer list, the worker recalculates and transfers the result buffer back, and the main thread regains ownership of the output bytes"
  caption="A transferred buffer is moved, not copied, so the sender cannot use it afterward."
/>

## Error surfaces

| Failure | Where it shows up | How to handle |
| --- | --- | --- |
| File is not a valid `.xlsx` | `wb.isValid() === false`, `lastErrorMessage()` | Show "this file is not a supported Excel workbook" |
| Cell-level Excel error | `cell.status.ok === true` and `cell.value.kind === ValueKind.Error` | Render `Module.errorDisplayName(cell.value.errorCode)`; the upload itself succeeded |
| Save failed | `saved.status.ok === false` | Surface the message; keep the original bytes available |
| Stub engine active (only when using `formulon-cell`'s `WorkbookHandle` with `preferStub: true`) | `isUsingStub()` returns true | Warn the user that calculations are disabled |

## UX checklist

- Validate file type and size client-side before loading.
- Show unsupported-function failures as workbook compatibility issues, not as upload failures.
- Keep the original `File` / `ArrayBuffer` until the recalculated output is stored somewhere durable, so a failed save does not lose the upload.
- Run the calculation in a worker if the UI must stay responsive.
- If you import `@libraz/formulon/threads`, serve COOP / COEP headers and handle a browser without `SharedArrayBuffer`.

## Fit check

This scenario works best when all data can remain local and users value privacy or offline behavior. If the workbook is very large or calculation must be centralized, evaluate Native Node or Python server-side paths instead.

## Read next

- [WASM Integration](/runtimes/wasm) — hosting and bundler requirements.
- [Workbook lifecycle](/workbook/lifecycle) — the engine flow behind this scenario.
- [formulon-cell](/cell/) — spreadsheet UI kit built on the same engine.
