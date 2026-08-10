# WASM Integration

The WASM package is the broadest Formulon surface. It runs in browsers, web workers, and Node — the same `@libraz/formulon` binary used by the JS API and by `formulon-cell`.

The npm WASM build parses worksheet XML with a DOM parser. It parses one worksheet at a time, so peak parse memory follows the largest worksheet XML part rather than the whole package. The working set must fit within the 32-bit WASM address space. Native CLI parsing switches to streaming above 256 KiB.

::: warning Hosting matters
Browser success depends on server headers, worker format, and bundler behavior. Verify the deployed environment, not only local development.
:::

::: info Glossary: pthread workers
The WASM module is built with `-pthread`. Internally, the recalc scheduler spawns Web Workers via Emscripten. Each worker uses `SharedArrayBuffer` to share the WASM heap, which is why browsers require cross-origin isolation.
:::

::: info Glossary: COOP / COEP (Cross-Origin Isolation)
Two HTTP response headers needed before browsers expose `SharedArrayBuffer`. Both must be set on the page:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without them, `createFormulon()` fails to instantiate — constructing the `SharedArrayBuffer` backing the pthread pool throws, and the promise rejects. The raw WASM loader has no fallback; code calling `createFormulon()` directly must catch that rejection itself. Higher-level wrappers such as `formulon-cell` can opt into a stub engine instead of failing (`preferStub: true`), but that behavior belongs to `formulon-cell`, not to `@libraz/formulon`. See [formulon-cell](/cell/) for the opt-in stub path.
:::

<DiagramFlow steps="Page load → COOP/COEP header check → createFormulon() → SharedArrayBuffer / pthread pool → Workbook.loadBytes()" />

## Load once

Initialize the module once per worker or process, then reuse workbook instances for related work.

```ts
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const result = Module.evalFormula('=SUM(1,2,3)')
```

`createFormulon()` is async; in browsers, instantiation pulls the `.wasm` binary and spins up the pthread pool. Keep the `Module` reference long-lived.

## Keep bytes explicit

Pass workbook bytes in and receive workbook bytes out. That keeps the UI layer, upload layer, and persistence layer separate from calculation.

Always call `workbook.delete()` when done. WASM `Workbook` handles wrap native memory; they are not ordinary garbage-collected JavaScript objects.

```ts
const workbook = Module.Workbook.loadBytes(bytes)
try {
  if (!workbook.isValid()) throw new Error(Module.lastErrorMessage())
  workbook.recalc()
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

For Vite, configure ES module workers:

```ts
export default defineConfig({
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@libraz/formulon'] },
  build: {
    target: 'es2022',
    rollupOptions: { external: [/^node:/] }
  }
})
```

For browsers, serve with the COOP / COEP headers shown above when pthread workers are enabled. See [Bundler setup](/cell/bundler) for the same configuration applied to `formulon-cell`, and [Troubleshooting](/start/troubleshooting) for common bundler messages.

## Read next

- [WASM API](/api/wasm) — the surface details.
- [Workbook lifecycle](/workbook/lifecycle) — the open / edit / recalc / save loop.
- [Browser workbook upload scenario](/scenarios/browser-upload) — end-to-end browser example.
