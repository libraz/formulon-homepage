// Generates src/data/api-reference.json from the engine's public declarations,
// so the WASM / Python / C reference tables cannot drift from the source.
//
// Inputs, each parsed by a focused reader for the file's known shape:
//   wasm    node_modules/@libraz/formulon/dist/formulon.d.ts (Workbook, the
//           static factories, the module object, top-level exported functions)
//   python  $FORMULON_SRC/packages/python/formulon/__init__.pyi for signatures,
//           docstrings from workbook.py / __init__.py / metadata.py
//   c       $FORMULON_SRC/src/c_api/formulon_c.h (every FM_API declaration)
//
// Every symbol is assigned to exactly one family by the ordered FAMILIES table.
// `--check` regenerates in memory and fails on drift. Python and C are read from
// the sibling checkout's `v<installed version>` tag, not its working tree, so a
// mid-release checkout cannot drift the docs. The checkout is optional
// (Cloudflare builds the site alone): without it or the tag, only the WASM
// surface and the version are compared. Doc pages must embed every family.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT = path.join(root, 'src/data/api-reference.json')
const PKG_DIR = path.join(root, 'node_modules/@libraz/formulon')
const DTS = path.join(PKG_DIR, 'dist/formulon.d.ts')
const SRC = path.resolve(root, process.env.FORMULON_SRC ?? '../formulon')
const PY_DIR = 'packages/python/formulon'
const C_HEADER = 'src/c_api/formulon_c.h'
const PAGES = {
  wasm: ['src/api/wasm.md', 'src/ja/api/wasm.md'],
  python: ['src/api/python.md', 'src/ja/api/python.md'],
  c: ['src/api/c.md', 'src/ja/api/c.md']
}

// Family ids in page order. `match` runs against the normalized snake_case name
// (surface prefixes such as `fm_`, `sheet_`, `Module.` removed).
const FAMILIES = [
  {
    id: 'library',
    match:
      /^(create_formulon|version|version_string|library_version|status_string|error_display_name|last_error_\w+|set_log_\w+|buffer_free)$/
  },
  {
    id: 'lifecycle',
    match:
      /^(create|create_default|create_empty|create_for_profile|load|load_bytes|destroy|delete|close|is_valid|memory_usage|save|save_as|save_with_diagnostics|read_diagnostics|iter_passthrough|passthrough_\w+)$/
  },
  {
    id: 'sheets',
    match: /^(add|remove|rename|move)_sheet$|^sheet_(count|name)$|^(insert|delete)_(rows|cols)$/
  },
  {
    id: 'cells',
    match:
      /^(set|get)_(number|bool|error|text|blank|formula|value)|formula_r1_?c1|^get_formula$|cell_count|cell_at|^iter_cells$|lambda_text|phonetic|cells_in_range|^cell_range_/
  },
  { id: 'calculation', match: /recalc|iterative|calc_mode|pinned_now/ },
  {
    id: 'evaluation',
    match: /^eval_formula$|^evaluate_(formula|conditional_formula|cf_formula)/
  },
  {
    id: 'profiles',
    match:
      /excel_profile_id|locali[sz]e|canonicali[sz]e|locale_|compare_text|text_compare|collation|^function_|function_metadata|function_names/
  },
  { id: 'names', match: /defined_name/ },
  { id: 'tables', match: /^(iter_)?tables?(_|$)|_table$/ },
  {
    id: 'dependencies',
    match: /precedents|dependents|cell_nodes|spill_info|external_link/
  },
  {
    id: 'view',
    match: /view|zoom|freeze|tab_hidden|tab_selected|visibility|show_|right_to_left|protection/
  },
  {
    id: 'rows-columns',
    match: /column|row|_col_|cols?$|width|height|format_defaults|rect_pt|chars_to_pt|pt_to_chars/
  },
  { id: 'display', match: /display_text|format_value/ },
  {
    id: 'styles',
    match:
      /^styles_|xf|font|fill|border|num_fmt|dxf|cell_style|range_style|effective_style|add_batch|range_xf_index/
  },
  { id: 'themes', match: /theme|resolve_color/ },
  { id: 'merges', match: /merge/ },
  { id: 'comments-links', match: /comment|hyperlink/ },
  {
    id: 'threaded-comments',
    match: /threaded_comment|thread_resolved|person/
  },
  { id: 'filters', match: /auto_filter/ },
  { id: 'validation', match: /validation|validate_value|invalid_cells/ },
  {
    id: 'conditional-formats',
    match: /conditional_format|^cf_|_cf_range$|^evaluate_cf_range$/
  },
  { id: 'images', match: /image|drawing/ },
  { id: 'charts', match: /chart/ },
  {
    id: 'print',
    match:
      /paginat|page_setup|page_margins|print_|header_footer|fit_to_page|_break|^clear_breaks$|sheet_pr_xml/
  },
  { id: 'pivots', match: /pivot/ },
  { id: 'pivot-caches', match: /pivot_cache/ },
  { id: 'misc', match: /.*/ }
]

// Match precedence: the first family in this order whose pattern matches wins.
const MATCH_ORDER = [
  'library',
  'pivot-caches',
  'pivots',
  'filters',
  'threaded-comments',
  'comments-links',
  'validation',
  'conditional-formats',
  'charts',
  'images',
  'print',
  'evaluation',
  'calculation',
  'profiles',
  'names',
  'tables',
  'dependencies',
  'merges',
  'themes',
  'styles',
  'display',
  'view',
  'sheets',
  'rows-columns',
  'cells',
  'lifecycle',
  'misc'
].map((id) => FAMILIES.find((f) => f.id === id))
if (MATCH_ORDER.includes(undefined) || new Set(MATCH_ORDER).size !== FAMILIES.length) {
  throw new Error('MATCH_ORDER must list every family exactly once')
}

// --- shared text helpers -----------------------------------------------------

const ABBREVIATIONS = /(?:^|[\s(])(?:e\.g|i\.e|vs|etc|cf)$/i

/** First sentence of a paragraph, ignoring periods inside `code` spans. */
function firstSentence(text) {
  const t = text.replace(/\s+/g, ' ').trim()
  let inCode = false
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '`') inCode = !inCode
    else if (!inCode && t[i] === '.' && (i + 1 === t.length || t[i + 1] === ' ')) {
      if (!ABBREVIATIONS.test(t.slice(0, i))) return t.slice(0, i + 1)
    }
  }
  return t
}

/** Collapse a multi-line declaration into one line. */
function oneLine(sig) {
  return sig
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/,\s*\)/g, ')')
    .replace(/\s+\)/g, ')')
    .trim()
}

/** Read lines from `start` until a `;` (or `terminator`) closes the declaration at paren depth 0. */
function readDeclaration(lines, start, terminator = /;\s*$/) {
  let depth = 0
  const parts = []
  for (let i = start; i < lines.length; i++) {
    parts.push(lines[i])
    for (const ch of lines[i]) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
    }
    if (depth <= 0 && terminator.test(lines[i])) return { text: parts.join('\n'), end: i }
  }
  throw new Error(`Unterminated declaration starting at line ${start + 1}`)
}

/** Text of the block comment ending on line `end` (exclusive of markers), or ''. */
function commentAbove(lines, end) {
  if (end < 0 || !/\*\/\s*$/.test(lines[end])) return ''
  let start = end
  while (start >= 0 && !/^\s*\/\*/.test(lines[start])) start--
  if (start < 0) return ''
  return lines
    .slice(start, end + 1)
    .join('\n')
    .replace(/^\s*\/\*\*?/, '')
    .replace(/\*\/\s*$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join('\n')
}

/** First sentence of the first paragraph of a doc comment, stopping at block tags. */
function summarize(doc) {
  const body = doc
    .replace(/@brief\s*/g, '')
    .replace(/\{@link\s+([^}\s]+)\s*\}/g, '`$1`')
    .split('\n')
  const para = []
  for (const line of body) {
    if (/^\s*@\w/.test(line) || (!line.trim() && para.length)) break
    if (line.trim()) para.push(line.trim())
  }
  return para.length ? firstSentence(para.join(' ')) : ''
}

const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

function familyOf(normalized) {
  return MATCH_ORDER.find((f) => f.match.test(normalized)).id
}

// --- WASM: formulon.d.ts -----------------------------------------------------

/** Methods of `export interface <name> { ... }`, two-space indented members. */
function tsInterfaceMethods(lines, name) {
  const start = lines.findIndex((l) => l.startsWith(`export interface ${name} {`))
  if (start < 0) throw new Error(`formulon.d.ts has no interface ${name}`)
  const out = []
  for (let i = start + 1; i < lines.length && !/^\}/.test(lines[i]); i++) {
    const m = lines[i].match(/^ {2}([A-Za-z_$][\w$]*)\??\s*[(<]/)
    if (!m) continue
    const decl = readDeclaration(lines, i)
    out.push({
      name: m[1],
      signature: oneLine(decl.text).replace(/;$/, ''),
      doc: commentAbove(lines, i - 1)
    })
    i = decl.end
  }
  return out
}

function parseWasm() {
  const lines = fs.readFileSync(DTS, 'utf-8').split('\n')
  const symbols = []
  const add = (prefix, m) =>
    symbols.push({ name: prefix + m.name, signature: m.signature, doc: m.doc, key: snake(m.name) })
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^export (?:default )?function ([A-Za-z_$][\w$]*)/)
    if (!m) continue
    const decl = readDeclaration(lines, i)
    const signature = oneLine(decl.text)
      .replace(/^export (default )?function /, '')
      .replace(/;$/, '')
    add('', { name: m[1], signature, doc: commentAbove(lines, i - 1) })
    i = decl.end
  }
  for (const m of tsInterfaceMethods(lines, 'FormulonModule')) add('Module.', m)
  for (const m of tsInterfaceMethods(lines, 'WorkbookCtor')) add('Workbook.', m)
  for (const m of tsInterfaceMethods(lines, 'Workbook')) add('', m)
  return symbols
}

// --- Python: __init__.pyi + docstrings ---------------------------------------

/** Cleans reStructuredText markup out of a docstring summary. */
function rstToPlain(s) {
  return s.replace(/:[a-z]+:`~?([^`]+)`/g, '`$1`').replace(/``([^`]+)``/g, '`$1`')
}

/** Docstrings of `def`s at `indent` inside `className` (or at module level when null). */
function pyDocstrings(file, className, indent) {
  const lines = readSource(file).split('\n')
  const docs = new Map()
  const pad = ' '.repeat(indent)
  let inScope = className === null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (className !== null && /^\S/.test(line)) inScope = line.startsWith(`class ${className}`)
    if (!inScope) continue
    const alias = indent === 0 && line.match(/^([a-z_][\w]*) = ([a-z_][\w]*)\s*$/)
    if (alias) docs.set(alias[1], `Alias of \`${alias[2]}()\`.`)
    const m = line.match(new RegExp(`^${pad}def ([A-Za-z_]\\w*)\\(`))
    if (!m || docs.has(m[1])) continue
    const decl = readDeclaration(lines, i, /:\s*(#.*)?$/)
    const first = lines[decl.end + 1]?.trim() ?? ''
    const q = first.match(/^r?("""|''')/)
    if (!q) continue
    const text = []
    for (let j = decl.end + 1; j < lines.length; j++) {
      text.push(j === decl.end + 1 ? first.slice(q[0].length) : lines[j])
      if ((j > decl.end + 1 || first.length > q[0].length) && lines[j].includes(q[1])) break
    }
    const body = text.join('\n').split(q[1])[0]
    docs.set(m[1], rstToPlain(summarize(body)))
  }
  return docs
}

function parsePython() {
  const lines = readSource(`${PY_DIR}/__init__.pyi`).split('\n')
  const classDocs = pyDocstrings(`${PY_DIR}/workbook.py`, 'Workbook', 4)
  const moduleDocs = new Map()
  for (const f of ['__init__.py', 'metadata.py', 'workbook.py']) {
    for (const [k, v] of pyDocstrings(`${PY_DIR}/${f}`, null, 0))
      if (!moduleDocs.has(k)) moduleDocs.set(k, v)
  }
  const symbols = []
  let inWorkbook = false
  let decorators = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\S/.test(line)) inWorkbook = line.startsWith('class Workbook')
    const deco = line.match(/^ *@(\w+)/)
    if (deco) {
      decorators.push(deco[1])
      continue
    }
    const m = line.match(/^( *)def ([A-Za-z_]\w*)\(/)
    if (!m) {
      if (line.trim()) decorators = []
      continue
    }
    const decl = readDeclaration(lines, i, /:\s*\.\.\.\s*$/)
    i = decl.end
    const isMember = m[1].length === 4 && inWorkbook
    const name = m[2]
    const kinds = decorators
    decorators = []
    if (!(m[1].length === 0 || isMember) || name.startsWith('_')) continue
    let signature = oneLine(decl.text)
      .replace(/^def /, '')
      .replace(/:\s*\.\.\.$/, '')
      .replace(/\((self|cls),?\s*/, '(')
      .replace(/"([A-Z]\w*)"/g, '$1')
    if (kinds.includes('property')) signature = signature.replace(/^(\w+)\(\)\s*->\s*/, '$1: ')
    const qualified = !isMember
      ? `formulon.${name}`
      : kinds.some((k) => k === 'classmethod' || k === 'staticmethod')
        ? `Workbook.${name}`
        : name
    const summary = (isMember ? classDocs : moduleDocs).get(name) ?? ''
    symbols.push({ name: qualified, signature, summary, key: name })
  }
  return symbols
}

// --- C: formulon_c.h ---------------------------------------------------------

function parseC() {
  const lines = readSource(C_HEADER).split('\n')
  const symbols = []
  let prevEnd = -2
  let prevDoc = ''
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('FM_API ')) continue
    const decl = readDeclaration(lines, i)
    const signature = oneLine(decl.text)
      .replace(/^FM_API /, '')
      .replace(/;$/, '')
    const name = signature.match(/([A-Za-z_]\w*)\s*\(/)[1]
    // A declaration directly under another shares that group's comment.
    const doc = commentAbove(lines, i - 1) || (prevEnd === i - 1 ? prevDoc : '')
    symbols.push({
      name,
      signature,
      doc,
      key: name.replace(/^fm_/, '').replace(/^(workbook|sheet)_/, '')
    })
    prevEnd = decl.end
    prevDoc = doc
    i = decl.end
  }
  return symbols
}

// --- assemble ----------------------------------------------------------------

function finish(symbols) {
  const entries = symbols.map((s, order) => ({
    name: s.name,
    signature: s.signature,
    summary: s.summary ?? summarize(s.doc ?? ''),
    family: familyOf(s.key),
    order
  }))
  const rank = new Map(FAMILIES.map((f, i) => [f.id, i]))
  entries.sort((a, b) => rank.get(a.family) - rank.get(b.family) || a.order - b.order)
  return entries.map(({ order, ...e }) => e)
}

const installedVersion = JSON.parse(
  fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf-8')
).version
const TAG = `v${installedVersion}`

/** A file from the sibling checkout as of the release tag. */
function readSource(relPath) {
  return execFileSync('git', ['-C', SRC, 'show', `${TAG}:${relPath}`], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  })
}

function tagExists() {
  try {
    execFileSync('git', ['-C', SRC, 'rev-parse', '--verify', '--quiet', `${TAG}^{commit}`], {
      stdio: 'ignore'
    })
    return true
  } catch {
    return false
  }
}

const haveSource = fs.existsSync(SRC) && tagExists()

function generate(withSource) {
  const surfaces = { wasm: finish(parseWasm()) }
  if (withSource) {
    surfaces.python = finish(parsePython())
    surfaces.c = finish(parseC())
  }
  return {
    $comment:
      'Generated by scripts/gen-api-reference.mjs from the engine declarations; do not edit.',
    version: installedVersion,
    surfaces
  }
}

/** Human-readable differences between two entry lists. */
function diffSurface(surface, ours, theirs) {
  const byName = (list) => new Map(list.map((e) => [`${e.name} ${e.signature}`, e]))
  const a = byName(theirs)
  const b = byName(ours)
  const out = []
  for (const [k, e] of b) if (!a.has(k)) out.push(`+ ${surface}: ${e.signature}`)
  for (const [k, e] of a) if (!b.has(k)) out.push(`- ${surface}: ${e.signature}`)
  for (const [k, e] of b) {
    const old = a.get(k)
    if (!old) continue
    if (old.family !== e.family)
      out.push(`~ ${surface}: ${e.name} family ${old.family} -> ${e.family}`)
    if (old.summary !== e.summary) out.push(`~ ${surface}: ${e.name} summary changed`)
  }
  if (!out.length && JSON.stringify(ours) !== JSON.stringify(theirs))
    out.push(`~ ${surface}: order changed`)
  return out
}

/** Each page must embed every non-empty family of its surface exactly once, and nothing else. */
function checkPages(doc, surfaces) {
  const problems = []
  for (const surface of surfaces) {
    const used = new Set(doc.surfaces[surface].map((e) => e.family))
    for (const page of PAGES[surface]) {
      const text = fs.readFileSync(path.join(root, page), 'utf-8')
      const tags = [
        ...text.matchAll(/<ApiReferenceTable\s+surface="(\w+)"(?:\s+family="([\w-]+)")?/g)
      ]
      const seen = new Map()
      for (const [, s, f] of tags) {
        if (s !== surface) problems.push(`${page} embeds surface "${s}"; expected "${surface}".`)
        else if (f === undefined) for (const id of used) seen.set(id, (seen.get(id) ?? 0) + 1)
        else if (!used.has(f))
          problems.push(`${page} embeds family "${f}", which has no ${surface} symbols.`)
        else seen.set(f, (seen.get(f) ?? 0) + 1)
      }
      for (const id of used) {
        const n = seen.get(id) ?? 0
        if (n !== 1)
          problems.push(`${page} embeds the ${surface} family "${id}" ${n} times; expected once.`)
      }
    }
  }
  return problems
}

const json = (doc) => `${JSON.stringify(doc, null, 2)}\n`

if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUT)) {
    console.error(`${path.relative(root, OUT)} is missing. Run \`yarn gen:api\`.`)
    process.exit(1)
  }
  const committed = JSON.parse(fs.readFileSync(OUT, 'utf-8'))
  const fresh = generate(haveSource)
  const problems = []
  if (committed.version !== installedVersion) {
    problems.push(
      `version is ${committed.version} but @libraz/formulon ${installedVersion} is installed.`
    )
  }
  for (const surface of Object.keys(fresh.surfaces)) {
    problems.push(
      ...diffSurface(surface, fresh.surfaces[surface], committed.surfaces?.[surface] ?? [])
    )
  }
  problems.push(...checkPages(committed, Object.keys(committed.surfaces)))
  if (!haveSource) console.log(`note: ${SRC} at ${TAG} not found — Python and C surfaces not compared.`)
  if (problems.length) {
    const shown = problems.slice(0, 40)
    console.error(`\nAPI reference check failed (${problems.length} problem(s)):\n`)
    for (const p of shown) console.error(`  ${p}`)
    if (problems.length > shown.length)
      console.error(`  … and ${problems.length - shown.length} more`)
    console.error('\nRun `yarn gen:api` and commit src/data/api-reference.json.\n')
    process.exit(1)
  }
  const counts = Object.entries(fresh.surfaces).map(([s, e]) => `${s} ${e.length}`)
  console.log(`API reference check passed (v${installedVersion}: ${counts.join(', ')}).`)
} else {
  if (!haveSource) {
    console.error(
      `${SRC} at ${TAG} not found. Set FORMULON_SRC to a formulon checkout that has the ${TAG} tag.`
    )
    process.exit(1)
  }
  const doc = generate(true)
  fs.writeFileSync(OUT, json(doc))
  const counts = Object.entries(doc.surfaces).map(([s, e]) => `${s} ${e.length}`)
  console.log(`Wrote ${path.relative(root, OUT)} (v${installedVersion}: ${counts.join(', ')}).`)
}
