import type { FunctionMetadataResult } from '@libraz/formulon'
import { checkedList, getCellApi, getFunctionCatalog } from './engine'
import type { FormulaDescription } from './formulaHelp'

export interface FormulaCatalog {
  names: readonly string[]
  signatures: Readonly<Record<string, readonly string[]>>
  descriptions: Readonly<Record<string, FormulaDescription>>
  metadata: Readonly<Record<string, FunctionMetadataResult>>
  warning?: string
}

export interface FunctionSuggestion {
  token: string
  tokenStart: number
  tokenEnd: number
  matches: readonly string[]
}

export interface ActiveSignature {
  name: string
  args: readonly string[]
  activeArgIndex: number
}

interface FormulaCatalogOptions {
  names?: readonly string[]
  signatures?: Readonly<Record<string, readonly string[]>>
  resolveKnownName?: (rawName: string) => string | null
}

type CellApi = Awaited<ReturnType<typeof getCellApi>>

let cellSuggestFunctions: CellApi['suggestFunctions'] | null = null
let cellFindActiveSignature: CellApi['findActiveSignature'] | null = null
let catalogPromise: Promise<FormulaCatalog> | null = null

const fallbackArguments = (metadata: FunctionMetadataResult | undefined): readonly string[] => {
  if (!metadata?.ok) return ['arg1', '...']
  const min = Math.max(0, metadata.minArity ?? 0)
  const max = metadata.maxArity
  if (max === 0) return []
  if (max === null || max === undefined) {
    return [...Array.from({ length: min }, (_, index) => `arg${index + 1}`), '...']
  }
  return Array.from({ length: max }, (_, index) => {
    const key = `arg${index + 1}`
    return index < min ? key : `[${key}]`
  })
}

const descriptionMap = (input: unknown): Readonly<Record<string, FormulaDescription>> => {
  if (!input || typeof input !== 'object') return {}
  const output: Record<string, FormulaDescription> = {}
  for (const [rawName, rawDescription] of Object.entries(input)) {
    if (!rawDescription || typeof rawDescription !== 'object') continue
    const record = rawDescription as Record<string, unknown>
    const en = typeof record.en === 'string' ? record.en : ''
    const ja = typeof record.ja === 'string' ? record.ja : en
    if (en || ja) output[rawName.toUpperCase()] = { en, ja }
  }
  return output
}

const signatureMap = (
  input: unknown,
  names: readonly string[],
  metadata: Readonly<Record<string, FunctionMetadataResult>>
): Readonly<Record<string, readonly string[]>> => {
  const output: Record<string, readonly string[]> = {}
  if (input && typeof input === 'object') {
    for (const [rawName, rawArgs] of Object.entries(input)) {
      if (!Array.isArray(rawArgs)) continue
      output[rawName.toUpperCase()] = rawArgs.filter(
        (arg): arg is string => typeof arg === 'string'
      )
    }
  }
  for (const name of names) {
    const upper = name.toUpperCase()
    if (!output[upper]) output[upper] = fallbackArguments(metadata[name] ?? metadata[upper])
  }
  return output
}

const localeAwareNames = (names: readonly string[]): Map<string, string> => {
  const result = new Map<string, string>()
  for (const name of names) result.set(name.toLocaleUpperCase(), name)
  return result
}

const quotedAt = (text: string, end: number): boolean => {
  let doubleQuote = false
  let singleQuote = false
  for (let i = 0; i < end; i += 1) {
    const ch = text[i] ?? ''
    const next = text[i + 1] ?? ''
    if (doubleQuote) {
      if (ch === '"') {
        if (next === '"') i += 1
        else doubleQuote = false
      }
      continue
    }
    if (singleQuote) {
      if (ch === "'") {
        if (next === "'") i += 1
        else singleQuote = false
      }
      continue
    }
    if (ch === '"') doubleQuote = true
    else if (ch === "'") singleQuote = true
  }
  return doubleQuote || singleQuote
}

const identifier = (value: string | undefined): boolean =>
  value !== undefined && /[\p{L}\p{N}_.]/u.test(value)

/**
 * Load the live engine registry and published cell display tables. The two
 * imports begin together. A cell-package failure still leaves a useful input:
 * function names and numbered arguments come from the engine itself.
 */
export function loadFormulaCatalog(): Promise<FormulaCatalog> {
  if (catalogPromise) return catalogPromise
  const pending = Promise.allSettled([getFunctionCatalog(), getCellApi()]).then((results) => {
    const engineResult = results[0]
    const cellResult = results[1]
    if (engineResult.status === 'rejected') throw engineResult.reason
    const workbook = engineResult.value
    const names = Array.from(checkedList(workbook.functionNames()))
      .map(String)
      .sort((a, b) => a.localeCompare(b))
    const metadata: Record<string, FunctionMetadataResult> = {}
    for (const name of names) metadata[name] = workbook.functionMetadata(name)

    let signatures: Readonly<Record<string, readonly string[]>>
    let descriptions: Readonly<Record<string, FormulaDescription>>
    let warning: string | undefined
    if (cellResult.status === 'fulfilled') {
      const cell = cellResult.value
      cellSuggestFunctions = cell.suggestFunctions
      cellFindActiveSignature = cell.findActiveSignature
      signatures = signatureMap(cell.FUNCTION_SIGNATURES, names, metadata)
      descriptions = descriptionMap(cell.FUNCTION_DESCRIPTIONS)
    } else {
      cellSuggestFunctions = null
      cellFindActiveSignature = null
      signatures = signatureMap(undefined, names, metadata)
      descriptions = {}
      warning = String(cellResult.reason)
    }
    return { names, signatures, descriptions, metadata, warning }
  })
  void pending.then(
    (loaded) => {
      if (loaded.warning && catalogPromise === pending) catalogPromise = null
    },
    () => undefined
  )
  pending.catch(() => {
    if (catalogPromise === pending) catalogPromise = null
    cellSuggestFunctions = null
    cellFindActiveSignature = null
  })
  catalogPromise = pending
  return pending
}

/** Empty until the real engine has loaded; no local copy of the function table
 * is shipped with this page. */
export const fallbackCatalog: FormulaCatalog = {
  names: [],
  signatures: {},
  descriptions: {},
  metadata: {}
}

/**
 * The cell package owns the parser. This wrapper only suppresses proposals in
 * quoted literals/sheet names and adds the complete token end needed to splice
 * a completion into a cursor that sits in the middle of a token.
 */
export function suggestFunctions(
  text: string,
  caret: number,
  max = 8,
  options: { names?: readonly string[] } = {}
): FunctionSuggestion | null {
  if (!cellSuggestFunctions || !text.startsWith('=') || quotedAt(text, caret)) return null
  const result = cellSuggestFunctions(text, caret, max, options)
  if (!result) return null
  let tokenEnd = caret
  while (tokenEnd < text.length && identifier(text[tokenEnd])) tokenEnd += 1
  if (/^\s*!/.test(text.slice(tokenEnd))) return null
  return { ...result, tokenEnd }
}

/** The public surface intentionally contains only this signature helper; the
 * cell package's lower-level function-call span helper stays private here. */
export function findActiveSignature(
  text: string,
  caret: number,
  options: FormulaCatalogOptions = {}
): ActiveSignature | null {
  if (!cellFindActiveSignature) return null
  const names = options.names ?? []
  const known = localeAwareNames(names)
  const resolveKnownName =
    options.resolveKnownName ?? ((raw: string) => known.get(raw.toLocaleUpperCase()) ?? null)
  const args = options.signatures ?? {}
  const result = cellFindActiveSignature(text, caret, {
    resolveKnownName,
    getCustomFunctionArgs: (name: string) => args[name.toUpperCase()]
  })
  return result
    ? { name: result.name, args: result.args, activeArgIndex: result.activeArgIndex }
    : null
}
