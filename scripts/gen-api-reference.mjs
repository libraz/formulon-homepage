// Generates src/data/api-reference.json from one immutable engine commit, so
// the WASM / Python / C reference tables cannot drift from the source.
//
// Inputs, each parsed by a focused reader for the file's known shape:
//   wasm    src/wasm/formulon.d.ts (Workbook, the static factories, the module
//           object, top-level exported functions)
//   python  $FORMULON_SRC/packages/python/formulon/__init__.pyi for signatures,
//           docstrings from workbook.py / __init__.py / metadata.py
//   c       $FORMULON_SRC/src/c_api/formulon_c.h (every FM_API declaration)
//
// Every symbol is assigned to exactly one family by the ordered FAMILIES table.
// `--check` regenerates all surfaces from the recorded commit when that commit
// is available. The checkout is optional (Cloudflare builds the site alone),
// so without it the committed snapshot and its page-family coverage are still
// validated. Use `--ref <full commit>` to generate a new release snapshot.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT = path.join(root, 'src/data/api-reference.json')
const FACTS = path.join(root, 'src/data/facts.json')
const SRC = path.resolve(root, process.env.FORMULON_SRC ?? '../formulon')
const REPOSITORY = 'https://github.com/libraz/formulon'
const WASM_DTS = 'src/wasm/formulon.d.ts'
const PY_DIR = 'packages/python/formulon'
const C_HEADER = 'src/c_api/formulon_c.h'
const SOURCE_FILES = {
  wasm: [WASM_DTS],
  python: [
    `${PY_DIR}/__init__.pyi`,
    `${PY_DIR}/workbook.py`,
    `${PY_DIR}/__init__.py`,
    `${PY_DIR}/metadata.py`
  ],
  c: [C_HEADER]
}
const REQUIRED_SURFACES = Object.keys(SOURCE_FILES)
const docsVersion = JSON.parse(fs.readFileSync(FACTS, 'utf-8')).docsVersion
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

function parseWasm(commit) {
  const lines = readSource(commit, WASM_DTS).split('\n')
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
function pyDocstrings(commit, file, className, indent) {
  const lines = readSource(commit, file).split('\n')
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

function parsePython(commit) {
  const lines = readSource(commit, `${PY_DIR}/__init__.pyi`).split('\n')
  const classDocs = pyDocstrings(commit, `${PY_DIR}/workbook.py`, 'Workbook', 4)
  const moduleDocs = new Map()
  for (const f of ['__init__.py', 'metadata.py', 'workbook.py']) {
    for (const [k, v] of pyDocstrings(commit, `${PY_DIR}/${f}`, null, 0))
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

function parseC(commit) {
  const lines = readSource(commit, C_HEADER).split('\n')
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

/** Read one file from the sibling checkout at an immutable commit. */
function readSource(commit, relPath) {
  return execFileSync('git', ['-C', SRC, 'show', `${commit}:${relPath}`], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  })
}

function isCommit(ref) {
  return typeof ref === 'string' && /^[a-f0-9]{40}$/.test(ref)
}

function commitExists(ref) {
  if (!fs.existsSync(SRC) || !isCommit(ref)) return false
  try {
    const resolved = execFileSync(
      'git',
      ['-C', SRC, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim()
    return resolved === ref
  } catch {
    return false
  }
}

function sourceVersion(commit) {
  return JSON.parse(readSource(commit, 'packages/npm/package.json')).version
}

function generate(commit) {
  const version = sourceVersion(commit)
  if (version !== docsVersion) {
    throw new Error(
      `Source ${commit} is v${version}, but src/data/facts.json docsVersion is ${docsVersion}.`
    )
  }
  return {
    $comment:
      'Generated by scripts/gen-api-reference.mjs from the engine declarations; do not edit.',
    version,
    source: {
      repository: REPOSITORY,
      version,
      commit,
      files: SOURCE_FILES
    },
    surfaces: {
      wasm: finish(parseWasm(commit)),
      python: finish(parsePython(commit)),
      c: finish(parseC(commit))
    }
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

function validateSnapshot(doc) {
  const problems = []
  const familyIds = new Set(FAMILIES.map((family) => family.id))
  const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    return ['snapshot root must be an object.']

  if (doc.version !== docsVersion)
    problems.push(`snapshot version is ${doc.version}; facts.json docsVersion is ${docsVersion}.`)

  const source = doc.source
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    problems.push('snapshot has no source provenance object.')
  } else {
    if (source.repository !== REPOSITORY) problems.push(`source repository must be ${REPOSITORY}.`)
    if (typeof source.version !== 'string' || !versionPattern.test(source.version))
      problems.push('source version must be a semantic version string.')
    else if (source.version !== doc.version)
      problems.push(
        `source version ${source.version} does not match snapshot version ${doc.version}.`
      )
    if (!isCommit(source.commit))
      problems.push('source commit must be a full 40-character git commit hash.')
    if (JSON.stringify(source.files) !== JSON.stringify(SOURCE_FILES))
      problems.push('source file provenance does not match the API parser inputs.')
  }

  if (!doc.surfaces || typeof doc.surfaces !== 'object' || Array.isArray(doc.surfaces)) {
    problems.push('snapshot has no surfaces object.')
    return problems
  }
  const surfaces = Object.keys(doc.surfaces)
  for (const surface of REQUIRED_SURFACES) {
    if (!Array.isArray(doc.surfaces[surface]))
      problems.push(`snapshot surface "${surface}" is missing or is not an array.`)
  }
  for (const surface of surfaces) {
    if (!REQUIRED_SURFACES.includes(surface)) {
      problems.push(`snapshot has unknown surface "${surface}".`)
      continue
    }
    if (!Array.isArray(doc.surfaces[surface])) continue
    for (const entry of doc.surfaces[surface]) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        problems.push(`${surface} contains an invalid API entry.`)
        continue
      }
      if (typeof entry.name !== 'string' || typeof entry.signature !== 'string')
        problems.push(`${surface} contains an entry without a name or signature.`)
      if (typeof entry.summary !== 'string')
        problems.push(`${surface} ${entry.name ?? '(unnamed)'} has no summary string.`)
      if (!familyIds.has(entry.family))
        problems.push(
          `${surface} ${entry.name ?? '(unnamed)'} has unknown family "${entry.family}".`
        )
    }
  }
  return problems
}

/** Each page must embed every non-empty family of its surface exactly once, and nothing else. */
function checkPages(doc, surfaces) {
  const problems = []
  for (const surface of surfaces) {
    if (!Array.isArray(doc.surfaces?.[surface])) continue
    const used = new Set(
      doc.surfaces[surface]
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => entry.family)
    )
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

const json = (doc) =>
  `${JSON.stringify(doc, null, 2).replace(/\[\n\s+("(?:[^"\\]|\\.)*")\n\s+\]/g, '[$1]')}\n`

function parseArgs() {
  const args = process.argv.slice(2)
  let check = false
  let ref
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check' && !check) check = true
    else if (args[i] === '--ref' && ref === undefined && args[i + 1]) ref = args[++i]
    else throw new Error(`Unknown or repeated argument: ${args[i]}`)
  }
  if (check && ref) throw new Error('Use --ref when generating a snapshot, not with --check.')
  if (ref !== undefined && !isCommit(ref))
    throw new Error('--ref requires a full 40-character lowercase commit hash.')
  return { check, ref }
}

function runCheck() {
  if (!fs.existsSync(OUT)) {
    console.error(`${path.relative(root, OUT)} is missing. Run \`yarn gen:api\`.`)
    process.exit(1)
  }
  const committed = JSON.parse(fs.readFileSync(OUT, 'utf-8'))
  const problems = validateSnapshot(committed)
  const sourceCommit = committed.source?.commit
  const haveSource = isCommit(sourceCommit) && commitExists(sourceCommit)
  if (haveSource) {
    try {
      const fresh = generate(sourceCommit)
      for (const surface of REQUIRED_SURFACES) {
        problems.push(
          ...diffSurface(
            surface,
            fresh.surfaces[surface],
            Array.isArray(committed.surfaces?.[surface]) ? committed.surfaces[surface] : []
          )
        )
      }
      if (JSON.stringify(fresh.source) !== JSON.stringify(committed.source))
        problems.push('source provenance differs from the recorded source commit.')
    } catch (error) {
      problems.push(`could not regenerate from ${sourceCommit}: ${error.message}`)
    }
  } else {
    console.log(
      `note: ${SRC} does not contain recorded source commit ${sourceCommit ?? '(missing)'}; source comparison skipped.`
    )
  }
  problems.push(
    ...checkPages(
      committed,
      REQUIRED_SURFACES.filter((surface) => Array.isArray(committed.surfaces?.[surface]))
    )
  )
  if (problems.length) {
    const shown = problems.slice(0, 40)
    console.error(`\nAPI reference check failed (${problems.length} problem(s)):\n`)
    for (const p of shown) console.error(`  ${p}`)
    if (problems.length > shown.length)
      console.error(`  … and ${problems.length - shown.length} more`)
    console.error('\nRun `yarn gen:api` and commit src/data/api-reference.json.\n')
    process.exit(1)
  }
  const counts = REQUIRED_SURFACES.map(
    (surface) => `${surface} ${committed.surfaces[surface].length}`
  )
  console.log(`API reference check passed (v${committed.version}: ${counts.join(', ')}).`)
}

function runGenerate(ref) {
  let commit = ref
  if (!commit) {
    if (!fs.existsSync(OUT)) {
      console.error(
        `${path.relative(root, OUT)} has no source commit. Pass --ref <full commit> to generate it.`
      )
      process.exit(1)
    }
    const previous = JSON.parse(fs.readFileSync(OUT, 'utf-8'))
    commit = previous.source?.commit
    if (!isCommit(commit)) {
      console.error(
        'The current API snapshot has no valid source commit. Pass --ref <full commit> to generate it.'
      )
      process.exit(1)
    }
  }
  if (!commitExists(commit)) {
    console.error(
      `${SRC} does not contain source commit ${commit}. Set FORMULON_SRC to the formulon checkout with that commit.`
    )
    process.exit(1)
  }
  const doc = generate(commit)
  fs.writeFileSync(OUT, json(doc))
  const counts = Object.entries(doc.surfaces).map(([s, e]) => `${s} ${e.length}`)
  console.log(`Wrote ${path.relative(root, OUT)} (v${doc.version}: ${counts.join(', ')}).`)
}

try {
  const { check, ref } = parseArgs()
  if (check) runCheck()
  else runGenerate(ref)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
