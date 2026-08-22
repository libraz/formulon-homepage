# Formula Engine

The evaluator is designed to match Excel semantics for scalar values, ranges, arrays, errors, references, and locale-sensitive behavior. The function catalog is registered at startup; bindings expose enough of it to evaluate any registered function.

::: info Glossary: tree-walker and experimental bytecode VM
Release CLI, WASM, and binding binaries use the tree-walker, which interprets the parsed AST directly; they do not carry the experimental bytecode compiler, optimizer, or VM. Developer and test builds may compile that VM when `FORMULON_BUILD_VM=ON`.
:::

::: info Glossary: value kind
The discriminator on every cell or formula result. The kinds are `Blank`, `Number`, `Bool`, `Text`, `Error`, `Array`, `Ref`, and `Lambda`. Each binding exposes them as an enum (e.g. WASM `ValueKind.Number`, Python `ValueKind.NUMBER`).
:::

<DiagramFlow :steps="[
  { label: 'Formula text', note: '=SUM(A1:A10)' },
  { label: 'Lexer / parser' },
  { label: 'AST' },
  { label: 'Reference resolver', note: 'names · tables · ranges' },
  { label: 'Evaluator', note: 'production tree-walker; optional experimental VM in explicit developer/test parity builds' },
  { label: 'Value', note: 'Number · Text · Bool · Error · Array · Ref · Lambda · Blank' }
]" />

## Function catalog

The catalog tracks 522 Excel function names across math, statistical, logical, text, date/time, lookup, financial, engineering, information, database, web, cube, and recent (LET / LAMBDA / dynamic array) families. That is the recognition catalog, not a claim that every Microsoft 365 service-backed function is locally implemented.

The catalog contains **507 real implementations, including 2 environment-bound functions (`CELL`, `INFO`), plus 15 unavailable stubs = 522 recognized names**. See [Formula coverage](/compatibility/formula-coverage) for the category and availability breakdown.

## Evaluation modes

Production evaluation uses the tree-walker. A developer or test build may compile the experimental bytecode VM with `FORMULON_BUILD_VM=ON`; only an explicit `FORMULON_VM_PARITY_CHECK=ON` build runs both evaluators and compares their values. Default tests do not double-evaluate formulas.

## Ad-hoc evaluation

On top of the same evaluator, WASM and Native Node expose read-only scalar ad-hoc evaluation — `evaluateFormulaText()` and `evaluateConditionalFormula()`. Python exposes `evaluate_formula_array()` for whole-array results and `evaluate_cf_formula()`, but not general scalar `evaluate_formula_text()`.

Range-shaped defined names evaluate as arrays, spill-phantom cells are enumerated, 1900/1904 date systems are carried through the evaluator, and whole-row/column and 3-D ranges resolve against the workbook model. Array broadcasting follows the function's Excel rules.

### Indexed cross-workbook references

External-link references use the index stored in the workbook's external-link table: `[1]Sheet1!A1`, `[1]Sheet1!A1:B2`, `[2]!Name`, and quoted sheet names such as `'[1]My Sheet'!A1` resolve against the cached values in that link part. A path-spelled reference such as `[Book1.xlsx]Sheet1!A1` remains unsupported because it has no link-table index to bind. The XLSB reader also decodes the supporting-book table, so an external sheet index is bound to the named supporting book rather than assumed to be this workbook. External references are evaluated from their cached values; they are not refreshed or written to XLSB on save.

### Formula edge cases

The evaluator follows the current Excel-compatible behavior for several easily confused text and blank states:

- `TRIM` collapses a run of trimmable spaces but preserves the character that started the run; an ideographic space (U+3000) is not rewritten as U+0020.
- `ISOMITTED` returns `TRUE` for an empty argument slot, including a leading, middle, or trailing omission in a `LAMBDA` call.
- A zero-length string is text, not a blank cell. `CELL("type", ...)` returns `"l"` for it, wildcard `COUNTIF(range, "*")` includes it, and `COUNTIF(range, "=")` uses the blank-cell probe that it does not satisfy.

## Error behavior

Excel errors are values, not host-language exceptions:

| Excel error | Meaning |
| --- | --- |
| `#DIV/0!` | Division by zero or empty divisor |
| `#VALUE!` | Type mismatch in operands or arguments |
| `#REF!` | Reference no longer resolvable (deleted sheet, broken range) |
| `#NAME?` | Unrecognized function or defined name |
| `#NUM!` | Numeric overflow or invalid numeric input |
| `#N/A` | Value not available, typically from `MATCH` / `VLOOKUP` style functions |
| `#NULL!` | Intersection produced an empty range |
| `#SPILL!` | Dynamic array could not spill (collision or out-of-bounds) |
| `#CALC!` | Engine could not produce a result (recursion, unfinished evaluation) |
| `#GETTING_DATA` | Asynchronous external lookup in progress |

::: tip Cell error vs host error
A formula returning `#DIV/0!` is not an API failure. The host call succeeded; it produced an error *value*. After confirming a `getValue()` result's `status`, inspect `result.value.kind === ValueKind.Error` to handle it. Host-side failures (bad bytes, missing handle, IO error) flow through status envelopes / exceptions / non-zero exits instead.
:::

## Coordinates

Bindings use zero-based numeric coordinates to avoid locale-specific address parsing:

| Excel address | Binding tuple `(sheet, row, col)` |
| --- | --- |
| `Sheet1!A1` | `(0, 0, 0)` |
| `Sheet1!B4` | `(0, 3, 1)` |
| `Sheet2!C10` | `(1, 9, 2)` |

A1 text is accepted only where a CLI argument, formula string, or MCP tool input explicitly expects it.

## Locale-sensitive behavior

Some functions (text formatting, date parsing, currency, list separators) read from the active compatibility profile. The default profile is `win-365-ja_JP`; alternative profiles are exposed only when matching oracle data exists. See [Locale profiles](/compatibility/locale-profiles).

## Read next

- [Recalculation](/workbook/recalculation) — how the engine schedules formula evaluation.
- [Workbook operations](/workbook/operations#ad-hoc-formula-evaluation) — ad-hoc formula evaluation without mutating a cell.
- [Formula coverage](/compatibility/formula-coverage) — registered functions by family.
- [Error model](/compatibility/errors) — error values vs host failures in depth.
