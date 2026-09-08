/**
 * Numbers that appear on more than one page.
 *
 * Each of these used to be typed out per page and per locale, which is how the
 * site ended up claiming 33 MCP tools on the landing diagram and 37 everywhere
 * else, and how the size budgets kept the pre-2.75 MiB figures after the core
 * raised them. Pages and components import from here instead, so a value can
 * only be wrong in one place.
 *
 * The values themselves live in `facts.json` so `scripts/check-facts.mjs` can
 * read them without a TypeScript loader. That check runs from `yarn build` and
 * fails when a value disagrees with the artefact it describes — the tool tables
 * in this repo, and the ceilings in the core repo when it is checked out
 * beside this one.
 */
import facts from './facts.json'

export interface Budget {
  /** Stretch goal. Exceeding it is a warning. */
  softBytes: number
  /** Ceiling. Exceeding it fails CI. */
  hardBytes: number
}

/** Tools exposed by `@libraz/formulon-mcp`, counted from `src/mcp/tools.md`. */
export const MCP_TOOL_COUNT: number = facts.mcpToolCount

/** WASM size budgets, mirroring the core repo's `tools/bench/wasm_size_report.sh`. */
export const WASM_SIZE_BUDGET: { uncompressed: Budget; brotli: Budget } = {
  uncompressed: facts.wasmSizeBudget.uncompressed,
  brotli: facts.wasmSizeBudget.brotli
}

const MIB = 1024 * 1024
const KIB = 1024

/** `2883584` → `2.75 MiB`. Two decimals, matching the core repo's README. */
export function formatMiB(bytes: number): string {
  return `${(bytes / MIB).toFixed(2)} MiB`
}

/** `753664` → `736 KiB`. */
export function formatKiB(bytes: number): string {
  return `${Math.round(bytes / KIB)} KiB`
}
