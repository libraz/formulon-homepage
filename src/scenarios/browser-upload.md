# Browser Workbook Upload

Use this pattern when a user uploads an `.xlsx`, your app recalculates it locally, and the browser returns values or a modified workbook — without ever sending the file to a server.

::: warning Browser hosting requirement
The WASM build uses Web Workers and pthreads. Production hosts must serve the page with cross-origin isolation headers when those workers are enabled — see [Bundler setup](/cell/bundler) and [Troubleshooting](/start/troubleshooting).
:::

::: info Glossary: ArrayBuffer / Uint8Array
The browser APIs Formulon takes as workbook bytes. `File.arrayBuffer()` returns an `ArrayBuffer`; wrap it in `new Uint8Array(buffer)` before passing it to `loadBytes()`. Both must live until `loadBytes()` returns.
:::

## Flow

```mermaid
flowchart LR
  A[User selects .xlsx] --> B[Read ArrayBuffer]
  B --> C[Module.Workbook.loadBytes]
  C --> D[Mutate inputs]
  D --> E[recalc]
  E --> F[Read values or save bytes]
```

## Minimal implementation

```ts
import createFormulon, { ValueKind } from '@libraz/formulon'

const Module = await createFormulon()

export async function recalcUpload(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const wb = Module.Workbook.loadBytes(bytes)

  try {
    if (!wb.isValid()) {
      throw new Error(Module.lastErrorMessage())
    }

    wb.recalc()
    const cell = wb.getValue(0, 0, 0)
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

The `try / finally` is the important shape — `wb.delete()` releases WASM heap memory even when the recalc step throws.

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
    wb.recalc()
    const saved = wb.save()
    self.postMessage({ ok: true, bytes: saved.bytes }, [saved.bytes!.buffer])
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
worker.postMessage(await file.arrayBuffer(), [await file.arrayBuffer()])
```

The transferable `ArrayBuffer` keeps the copy from happening twice; the main thread loses access to it after `postMessage`, which is fine because the worker now owns the bytes.

## Error surfaces

| Failure | Where it shows up | How to handle |
| --- | --- | --- |
| File is not a valid `.xlsx` | `wb.isValid() === false`, `lastErrorMessage()` | Show "this file is not a supported Excel workbook" |
| Cell-level Excel error | `value.kind === ValueKind.Error` | Render the error code inline; the upload itself succeeded |
| Save failed | `saved.status.ok === false` | Surface the message; keep the original bytes available |
| Stub engine fallback | `isUsingStub()` returns true (cell package) | Warn the user that calculations are disabled |

::: tip Keep original bytes until save succeeds
Treat the input `File` / `ArrayBuffer` as the source of truth until your app has successfully written the recalculated output somewhere durable. That way a failed save does not lose the user's upload.
:::

## UX checklist

- Validate file type and size client-side before loading.
- Show unsupported-function failures as workbook compatibility issues, not as upload failures.
- Keep original bytes until save succeeds.
- Run the calculation in a worker if the UI must stay responsive.
- Surface cross-origin isolation problems explicitly — silent stub-engine fallback confuses users.

## Fit check

This scenario works best when all data can remain local and users value privacy or offline behavior. If the workbook is very large or calculation must be centralized, evaluate Native Node or Python server-side paths instead.

## Read next

- [WASM Integration](/runtimes/wasm) — hosting and bundler requirements.
- [Workbook lifecycle](/workbook/lifecycle) — the engine flow behind this scenario.
- [formulon-cell](/cell/) — if you want the same engine *plus* a spreadsheet UI.
