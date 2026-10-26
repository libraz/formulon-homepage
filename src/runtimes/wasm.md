# WASM Integration

`@libraz/formulon` runs the engine as WebAssembly in browsers, workers, and Node.

## Install and first call

```sh
yarn add @libraz/formulon@0.18.0
```

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const result = Module.evalFormula('=SUM(1,2,3)')
if (result.status.ok) console.log(result.value.number) // 6
```

The package is ESM-only and needs Node 22 or newer outside the browser. `createFormulon()` is async and loads `formulon.wasm`; call it once per worker or process and keep the `Module` reference.

## Choose an entry point

The package ships two entry points with the same API. `@libraz/formulon` is the default single-threaded build. It uses ordinary memory and loads in a browser without cross-origin isolation. `@libraz/formulon/threads` is the optional pthread build for parallel recalculation; it loads `formulon_threads.wasm`, starts a worker pool, and in a browser needs `SharedArrayBuffer` and cross-origin isolation. The default `formulon-cell` loader uses the serial entry.

```ts
import createFormulon from '@libraz/formulon/threads'

const ThreadedModule = await createFormulon()
```

::: warning Hosting matters
Browser success depends on server headers, worker format, and bundler behavior. Verify the deployed environment, not only local development.
:::

::: info Glossary: pthread workers
Only the `@libraz/formulon/threads` entry is built with `-pthread`. Its recalc scheduler spawns Web Workers via Emscripten, and each worker uses `SharedArrayBuffer` to share the WASM heap. The default `@libraz/formulon` entry is single-threaded.
:::

::: info Glossary: COOP / COEP (Cross-Origin Isolation)
These HTTP response headers are needed before browsers expose `SharedArrayBuffer`. Set both when loading `@libraz/formulon/threads` or another pthread-backed integration:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without them, the `@libraz/formulon/threads` factory fails to instantiate because its pthread pool cannot create the required `SharedArrayBuffer`. The default `@libraz/formulon` factory does not need these headers. The raw WASM loader has no fallback; code calling a pthread-backed factory directly must handle the rejected promise. `formulon-cell` can opt into a stub engine with `preferStub: true` for tests and demos; that behavior belongs to `formulon-cell`. See [formulon-cell](/cell/) for its setup.
:::

<DiagramFlow steps="Page load → choose @libraz/formulon or /threads → default memory, or COOP/COEP + worker pool → Workbook.loadBytes()" />

## Parallel recalculation

`Workbook.recalc()` is the serial, caller-thread API. `Workbook.recalcParallel(threadCount)` is synchronous and returns `{ status, stats }`. On the default entry it evaluates serially and reports `stats.workerThreadsStarted === 0`; on `@libraz/formulon/threads` it starts up to `threadCount` workers (`0` for automatic detection, at most 8) and returns after they have joined. [WASM API](/api/wasm#method-notes) lists the accepted values.

```ts
const result = workbook.recalcParallel(0)
if (!result.status.ok) throw new Error(Module.lastErrorMessage())
```

In a browser the threads entry needs ES module workers and the COOP / COEP headers described above. The scheduler may use fewer workers than requested; `stats` reports how many it started.

## Keep bytes explicit

Pass workbook bytes in and receive workbook bytes out. That keeps the UI layer, upload layer, and persistence layer separate from calculation.

Always call `workbook.delete()` when done. WASM `Workbook` handles wrap native memory; they are not ordinary garbage-collected JavaScript objects.

```ts
const workbook = Module.Workbook.loadBytes(bytes)
try {
  if (!workbook.isValid()) throw new Error(Module.lastErrorMessage())
  const recalculated = workbook.recalc()
  if (!recalculated.ok) throw new Error(recalculated.message)
} finally {
  workbook.delete()
}
```

::: tip Lifetime patterns
Wrap the try / finally in a helper (`withWorkbook(bytes, fn)`) so every call site is consistent. The cost of forgetting `delete()` is a memory leak inside the WASM heap that survives until the page reloads.
:::

## Memory limits

The WASM build parses worksheet XML with a DOM parser, one worksheet at a time, so peak parse memory follows the largest worksheet XML part rather than the whole package, and the working set must fit in the 32-bit WASM address space. The Python wheel also runs the engine as WebAssembly and has the same limit. The native CLI switches to a streaming parser above 256 KiB of worksheet XML. Every surface first inflates each worksheet part into memory whole (the zip reader caps this at 100 MiB per entry and 256 MiB per load), so streaming saves the DOM tree but not that buffer.

## Watch the size budget

The WASM build has a strict size budget. Avoid adding dependencies to browser-facing paths unless they are necessary and measured. The actual numbers live in [Size budgets](/development/size-budgets).

## Bundler requirements

For Vite, configure ES module workers when importing `@libraz/formulon/threads`:

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@libraz/formulon'] },
  build: {
    target: 'es2022',
    rollupOptions: { external: [/^node:/] }
  }
})
```

The default `@libraz/formulon` entry does not require ES module workers or COOP / COEP headers. For browsers, serve with the headers shown above when the threads entry is enabled. The default `formulon-cell` loader is serial; see [Bundler setup](/cell/bundler) and [Troubleshooting](/start/troubleshooting) when an integration explicitly uses pthread workers.

## Read next

- [WASM API](/api/wasm) — the surface details.
- [Workbook lifecycle](/workbook/lifecycle) — the open / edit / recalc / save loop.
- [Browser workbook upload scenario](/scenarios/browser-upload) — end-to-end browser example.
