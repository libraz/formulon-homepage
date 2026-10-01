# WASM Integration

The npm package ships two WASM entry points with the same API. `@libraz/formulon` is the default single-threaded build. It uses ordinary memory and loads in a browser without cross-origin isolation. `@libraz/formulon/threads` is the optional pthread build for parallel recalculation; its browser host needs `SharedArrayBuffer` and cross-origin isolation. The default `formulon-cell` loader uses the serial entry; use the threads entry explicitly when an integration needs workers.

The npm WASM build parses worksheet XML with a DOM parser. It parses one worksheet at a time, so peak parse memory follows the largest worksheet XML part rather than the whole package. The working set must fit within the 32-bit WASM address space. Native CLI parsing switches to streaming above 256 KiB.

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

## Load once

Initialize the module once per worker or process, then reuse workbook instances for related work.

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const result = Module.evalFormula('=SUM(1,2,3)')
```

`createFormulon()` is async. The default entry loads `formulon.wasm`; the threads entry loads `formulon_threads.wasm` and starts its worker pool. Keep the `Module` reference long-lived.

```ts
import createFormulon from '@libraz/formulon/threads'

const ThreadedModule = await createFormulon()
```

## Parallel recalculation

`Workbook.recalc()` remains the serial, caller-thread API. `Workbook.recalcParallel(threadCount)` is synchronous and returns `{ status, stats }`. The default `@libraz/formulon` entry accepts the call but evaluates serially with `stats.workerThreadsStarted === 0`. The `@libraz/formulon/threads` entry starts workers and returns after they have joined: a `threadCount` of `0` selects automatic detection capped at 8, `1` keeps evaluation on the caller thread and starts no workers, and `2..8` sets the maximum worker count. Missing, fractional, non-finite, negative, or above-8 values fail with `kInvalidArgument`.

```ts
const result = workbook.recalcParallel(0)
if (!result.status.ok) throw new Error(Module.lastErrorMessage())
```

The browser needs ES module workers and the COOP / COEP headers described above when the threads entry is used. `stats` reports the work completed and the workers actually started; the scheduler may use fewer workers than requested.

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
