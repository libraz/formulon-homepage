/**
 * Shared access to the real Formulon WASM engine for the embedded doc demos.
 *
 * Raw-engine demos share `getEngine()`. The grid package manages its own
 * engine, which may be older than the documentation's release target.
 * The import is dynamic on purpose: `@libraz/formulon` pulls in the Emscripten
 * glue, and `@libraz/formulon-cell` touches `document` at module scope, so
 * neither may be evaluated during the SSR pass or on initial page load.
 *
 * The stub engine is never used here — a doc demo that silently computed with
 * a JS fake would be a lie about the product.
 */
import type { FormulonModule, Status, Value, Workbook } from '@libraz/formulon'
import enginePackage from '@libraz/formulon/package.json'

type FormulonNamespace = typeof import('@libraz/formulon')
type CellNamespace = typeof import('@libraz/formulon-cell')

/** Why the current browser context cannot run the engine. */
export type EngineBlocker = 'wasm' | 'shared-memory' | 'isolation'

/** Resolved engine plus the value constants that live on the package's ESM
 *  surface rather than on the WASM module object. */
export interface Engine {
  module: FormulonModule
  ValueKind: FormulonNamespace['ValueKind']
  WorkbookFormat: FormulonNamespace['WorkbookFormat']
  ErrorCode: FormulonNamespace['ErrorCode']
}

/** Catalog-locale ordinals accepted by `Workbook.functionMetadata(name, locale)`. */
export const METADATA_LOCALE = { enUS: 0, jaJP: 1 } as const

/** `precedents()` / `dependents()` cap the BFS at this depth. */
export const MAX_TRACE_DEPTH = 32

let enginePromise: Promise<Engine> | null = null
let cellPromise: Promise<CellNamespace> | null = null
let catalogPromise: Promise<Workbook> | null = null

/**
 * Reports the first hard blocker for running the engine, or `null` when the
 * context can run it. The 0.12 default entry only needs WebAssembly.
 */
export function engineBlocker(requiresIsolation = defaultRequiresIsolation): EngineBlocker | null {
  if (typeof WebAssembly === 'undefined') return 'wasm'
  if (!requiresIsolation) return null
  if (typeof SharedArrayBuffer === 'undefined') return 'shared-memory'
  if (!globalThis.crossOriginIsolated) return 'isolation'
  return null
}

// The default entry stopped requiring shared memory at 0.12.
const [engineMajor, engineMinor] = enginePackage.version.split('.').map(Number)
const defaultRequiresIsolation = engineMajor === 0 && engineMinor < 12

/** Reads numeric accessors from either the published or prepared API. */
export function numberResult(result: number | { status: Status; value: number }): number {
  if (typeof result === 'number') return result
  if (!result.status.ok) throw new Error(result.status.message)
  return result.value
}

/** Lists retain their array shape; the prepared API adds a call status. */
export function checkedList<T>(result: readonly T[] & { status?: Status }): readonly T[] {
  if (result.status && !result.status.ok) throw new Error(result.status.message)
  return result
}

/** Loads (once per page) and returns the real WASM engine. */
export function getEngine(): Promise<Engine> {
  if (enginePromise) return enginePromise
  const pending = import('@libraz/formulon').then(async (ns) => ({
    module: await ns.default(),
    ValueKind: ns.ValueKind,
    WorkbookFormat: ns.WorkbookFormat,
    ErrorCode: ns.ErrorCode
  }))
  // A failed boot must not poison later attempts, so drop the memo on reject.
  pending.catch(() => {
    if (enginePromise === pending) enginePromise = null
  })
  enginePromise = pending
  return pending
}

/**
 * Returns the workbook used to query the function catalog.
 *
 * `functionNames()` / `functionMetadata()` describe the engine's global
 * function registry, but they hang off the workbook surface rather than the
 * module, so one throwaway workbook can answer every lookup. It is memoized
 * and deliberately never deleted: it holds no user data, a lookup can happen
 * at any time while the page lives, and one shared handle is cheaper than a
 * per-demo workbook that each demo would have to release.
 */
export function getFunctionCatalog(): Promise<Workbook> {
  if (catalogPromise) return catalogPromise
  const pending = getEngine().then((engine) => engine.module.Workbook.createDefault())
  pending.catch(() => {
    if (catalogPromise === pending) catalogPromise = null
  })
  catalogPromise = pending
  return pending
}

/** Loads (once per page) the formulon-cell surface, used only for its
 *  display-metadata tables. Browser-only: importing it in Node throws. */
export function getCellApi(): Promise<CellNamespace> {
  if (cellPromise) return cellPromise
  const pending = import('@libraz/formulon-cell')
  pending.catch(() => {
    if (cellPromise === pending) cellPromise = null
  })
  cellPromise = pending
  return pending
}

/** Human-readable name of a `ValueKind` ordinal (`Number`, `Error`, ...). */
export function kindLabel(engine: Engine, kind: number): string {
  const kinds = engine.ValueKind as unknown as Record<string, number>
  return Object.keys(kinds).find((key) => kinds[key] === kind) ?? String(kind)
}

/** Formats a number the way a spreadsheet cell would show it: no exponent
 *  soup for ordinary values, no float noise from the last binary digits. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value)
  return String(Number(value.toPrecision(12)))
}

/** Renders a `Value` as display text. Excel errors are values, not throws, so
 *  they format to their display literal (`#DIV/0!`) like any other result. */
export function formatValue(engine: Engine, value: Value | undefined): string {
  if (!value) return ''
  const { ValueKind } = engine
  switch (value.kind) {
    case ValueKind.Number:
      return formatNumber(value.number)
    case ValueKind.Bool:
      return value.boolean ? 'TRUE' : 'FALSE'
    case ValueKind.Text:
      return value.text
    case ValueKind.Error:
      return engine.module.errorDisplayName(value.errorCode)
    case ValueKind.Blank:
      return ''
    default:
      return kindLabel(engine, value.kind)
  }
}

/** `true` when the value carries an Excel error literal. */
export function isErrorValue(engine: Engine, value: Value | undefined): boolean {
  return value?.kind === engine.ValueKind.Error
}

/** One-line diagnostic for a failed call: `kInvalidArgument: <message>`. */
export function statusText(engine: Engine, status: Status | undefined): string {
  if (!status || status.ok) return ''
  const name = engine.module.statusString(status.status)
  const detail = status.message || engine.module.lastErrorMessage()
  return detail ? `${name}: ${detail}` : name
}

/** 0-based column index to its spreadsheet letter (0 → `A`, 27 → `AB`). */
export function columnLabel(col: number): string {
  let label = ''
  let n = col
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

/** 0-based `(row, col)` to an A1 address. */
export function cellAddress(row: number, col: number): string {
  return `${columnLabel(col)}${row + 1}`
}

let iterativeOwner: symbol | null = null

/**
 * Claims the engine's single iterative-progress callback slot. Installing a
 * callback displaces the previous one process-wide, so two demos solving at
 * once would silently steal each other's residual stream.
 */
export function acquireIterativeLock(owner: symbol): boolean {
  if (iterativeOwner !== null && iterativeOwner !== owner) return false
  iterativeOwner = owner
  return true
}

/** Releases the iterative-progress slot claimed by `owner`. */
export function releaseIterativeLock(owner: symbol): void {
  if (iterativeOwner === owner) iterativeOwner = null
}
