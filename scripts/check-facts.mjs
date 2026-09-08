// Verifies the shared numbers in src/data/facts.json against the artefacts they
// describe, so a stale figure fails the build instead of shipping.
//
// Two classes of drift are covered:
//
//   1. Counts this repo can derive. The MCP tool count is the number of tool
//      rows in the tool tables; if a tool is added and the constant is not
//      bumped, the count and the table disagree and this fails.
//   2. Ceilings the core repo owns. `tools/bench/wasm_size_report.sh` holds the
//      real budgets; the site only mirrors them. When the core repo is checked
//      out beside this one the two are compared, and when it is not (CI builds
//      the site alone) that half is skipped with a note rather than guessed at.
//
// It also sweeps the sources for a bare count written next to "tools" or
// "ツール", which is how the landing diagram kept saying 33 after every page
// had moved to 37.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const facts = JSON.parse(fs.readFileSync(path.join(root, 'src/data/facts.json'), 'utf-8'))

const problems = []
const notes = []

// --- 1. MCP tool count vs. the tool tables -----------------------------------

/** Rows whose first cell is a `formulon_*` tool name. */
function countToolRows(relPath) {
  const abs = path.join(root, relPath)
  if (!fs.existsSync(abs)) return null
  const rows = fs
    .readFileSync(abs, 'utf-8')
    .split('\n')
    .filter((line) => /^\|\s*`formulon_[a-z_]+`\s*\|/.test(line))
  return rows.length
}

for (const page of ['src/mcp/tools.md', 'src/ja/mcp/tools.md']) {
  const counted = countToolRows(page)
  if (counted === null) {
    problems.push(`${page} is missing — the MCP tool count cannot be verified.`)
    continue
  }
  if (counted !== facts.mcpToolCount) {
    problems.push(
      `${page} lists ${counted} tool rows but facts.json says mcpToolCount = ${facts.mcpToolCount}. ` +
        'Update whichever is behind.'
    )
  }
}

// --- 2. WASM size budgets vs. the core repo ----------------------------------

const CORE_SCRIPT = path.resolve(root, '../formulon/tools/bench/wasm_size_report.sh')

if (fs.existsSync(CORE_SCRIPT)) {
  const shell = fs.readFileSync(CORE_SCRIPT, 'utf-8')
  const readDefault = (name) => {
    const match = shell.match(new RegExp(`^${name}=(\\d+)`, 'm'))
    return match ? Number(match[1]) : null
  }
  const expected = {
    'wasmSizeBudget.uncompressed.softBytes': ['SOFT_CEILING', facts.wasmSizeBudget.uncompressed.softBytes],
    'wasmSizeBudget.uncompressed.hardBytes': ['HARD_CEILING', facts.wasmSizeBudget.uncompressed.hardBytes],
    'wasmSizeBudget.brotli.softBytes': ['BROTLI_SOFT_CEILING', facts.wasmSizeBudget.brotli.softBytes],
    'wasmSizeBudget.brotli.hardBytes': ['BROTLI_HARD_CEILING', facts.wasmSizeBudget.brotli.hardBytes]
  }
  for (const [field, [shellVar, ours]] of Object.entries(expected)) {
    const theirs = readDefault(shellVar)
    if (theirs === null) {
      problems.push(
        `Could not read ${shellVar} from ${CORE_SCRIPT}. The core script changed shape; ` +
          'update this check rather than dropping it.'
      )
    } else if (theirs !== ours) {
      problems.push(
        `facts.json ${field} = ${ours} but the core repo's ${shellVar} = ${theirs}. ` +
          'The core owns this number; follow it.'
      )
    }
  }
} else {
  notes.push(`Core repo not checked out beside this one — WASM budget comparison skipped.`)
}

// --- 3. No bare tool counts left in the sources ------------------------------

const SWEEP_DIRS = ['src', '.vitepress']
const SKIP = new Set(['node_modules', 'dist', 'cache', '.git'])
const BARE_COUNT = /\b(\d{2})\s*(tools|ツール)\b/

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(abs, out)
    else if (/\.(md|vue|ts)$/.test(entry.name)) out.push(abs)
  }
  return out
}

for (const dir of SWEEP_DIRS) {
  const abs = path.join(root, dir)
  if (!fs.existsSync(abs)) continue
  for (const file of walk(abs)) {
    const rel = path.relative(root, file)
    if (rel === 'src/data/facts.ts' || rel === 'scripts/check-facts.mjs') continue
    fs.readFileSync(file, 'utf-8')
      .split('\n')
      .forEach((line, i) => {
        const match = line.match(BARE_COUNT)
        if (!match) return
        problems.push(
          `${rel}:${i + 1} writes "${match[0].trim()}" as a literal. ` +
            'Import MCP_TOOL_COUNT from @/data/facts instead.'
        )
      })
  }
}

// --- report ------------------------------------------------------------------

for (const note of notes) console.log(`note: ${note}`)

if (problems.length) {
  console.error(`\nFact check failed (${problems.length} problem(s)):\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

console.log(`Fact check passed: mcpToolCount = ${facts.mcpToolCount}, WASM budgets in step.`)
