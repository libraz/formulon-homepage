# Formula Engine

The evaluator is designed to match Excel semantics for scalar values, ranges, arrays, errors, references, and locale-sensitive behavior. The function catalog is registered at startup; bindings expose enough of it to evaluate any registered function.

::: info Glossary: tree-walker
The evaluator interprets the parsed AST directly; every build uses this tree-walker.
:::

::: info Glossary: value kind
The discriminator on every cell or formula result. The kinds are `Blank`, `Number`, `Bool`, `Text`, `Error`, `Array`, `Ref`, and `Lambda`. Each binding exposes them as an enum (e.g. WASM `ValueKind.Number`, Python `ValueKind.NUMBER`).
:::

<DiagramFlow :steps="[
  { label: 'Formula text', note: '=SUM(A1:A10)' },
  { label: 'Lexer / parser' },
  { label: 'AST' },
  { label: 'Reference resolver', note: 'names · tables · ranges' },
  { label: 'Evaluator', note: 'tree-walker' },
  { label: 'Value', note: 'Number · Text · Bool · Error · Array · Ref · Lambda · Blank' }
]" />

## Function catalog

The catalog tracks 523 Excel function names across math, statistical, logical, text, date/time, lookup, financial, engineering, information, database, web, cube, and recent (LET / LAMBDA / dynamic array) families. That is the recognition catalog, not a claim that every Microsoft 365 service-backed function is locally implemented.

The catalog contains **508 real implementations, including 2 environment-bound functions (`CELL`, `INFO`), plus 15 unavailable stubs = 523 recognized names**. See [Formula coverage](/compatibility/formula-coverage) for the category and availability breakdown.

## Evaluation modes

All builds use the tree-walker. There is one evaluator and one evaluation path, so recalculation has no second evaluator or parity path.

## Ad-hoc evaluation

On top of the same evaluator, WASM and Native Node expose read-only scalar ad-hoc evaluation — `evaluateFormulaText()` and `evaluateConditionalFormula()`. Python exposes `evaluate_formula_array()` for whole-array results and `evaluate_cf_formula()`, but not general scalar `evaluate_formula_text()`.

Range-shaped defined names evaluate as arrays, spill-phantom cells are enumerated, 1900/1904 date systems are carried through the evaluator, and whole-row/column and 3-D ranges resolve against the workbook model. Array broadcasting follows the function's Excel rules.

### Reference-valued endpoints

Reference-valued expressions can be used where a range endpoint is expected. A defined name or a reference-returning function such as `INDEX`, `OFFSET`, `XLOOKUP`, `IFS`, or `SWITCH` can form an endpoint (`A1:MyName`, `A1:INDEX(...)`, `XLOOKUP(...):B3`), and `ROW` / `COLUMN` accept such dynamic ranges. Name bodies that evaluate to constants, ordinary expressions, or text are not references and return `#VALUE!` in this position; an undefined name returns `#NAME?`, and an endpoint on another sheet returns `#VALUE!`. Self-book names and functions use `[0]!Name`, `[0]!Fn(args)`, range forms such as `A1:[0]!Rng`, and intersections such as `[0]!Rng A1:A5`.

### Indexed cross-workbook references

External-link references use the index stored in the workbook's external-link table: `[1]Sheet1!A1`, `[1]Sheet1!A1:B2`, `[2]!Name`, and quoted sheet names such as `'[1]My Sheet'!A1` resolve against the cached values in that link part. A path-spelled reference such as `[Book1.xlsx]Sheet1!A1` remains unsupported because it has no link-table index to bind. The XLSB reader also decodes the supporting-book table, so an external sheet index is bound to the named supporting book rather than assumed to be this workbook. External references are evaluated from their cached values; they are not refreshed or written to XLSB on save.

### Formula edge cases

The evaluator follows the current Excel-compatible behavior for several easily confused text and blank states:

- `TRIM` collapses a run of trimmable spaces but preserves the character that started the run; an ideographic space (U+3000) is not rewritten as U+0020.
- `ISOMITTED` returns `TRUE` for an empty argument slot, including a leading, middle, or trailing omission in a `LAMBDA` call.
- A zero-length string is text, not a blank cell. `CELL("type", ...)` returns `"l"` for it, wildcard `COUNTIF(range, "*")` includes it, and `COUNTIF(range, "=")` uses the blank-cell probe that it does not satisfy.

`USDOLLAR` and `DOLLAR` both return text but have different compatibility rules. `USDOLLAR` always uses the US dollar presentation (`$`, two decimal places by default, and parentheses for negative values); `DOLLAR` follows the active locale's currency format and default decimals. For example, under `win-365-ja_JP`, `DOLLAR(1234.5)` uses the yen presentation with zero default decimals, while `USDOLLAR(1234.5)` remains `$1,234.50`. A negative value rounded to display zero keeps its sign, such as `USDOLLAR(-0.001, 2)` → `($0.00)` and `DOLLAR(-0.001, 2)` → `¥-0.00`.

## Error behavior

Excel errors are values, not host-language exceptions. The table below lists common values; [Error model](/compatibility/errors) contains the complete `ErrorCode` set:

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

The active profile currently controls text matching and coercion, `CODE` / `CHAR`, environment-sensitive `INFO` / `CELL` values, and PivotTable labels and layout defaults. Stored formulas use English function names and the invariant parser grammar; function-name helpers are separate presentation utilities. A profile does not by itself claim that every Excel locale difference, such as translated names or separator display, is implemented. The default profile is `win-365-ja_JP`; alternative profiles are exposed only when matching oracle data exists. See [Locale profiles](/compatibility/locale-profiles).

## Read next

- [Recalculation](/workbook/recalculation) — how the engine schedules formula evaluation.
- [Workbook operations](/workbook/operations#ad-hoc-formula-evaluation) — ad-hoc formula evaluation without mutating a cell.
- [Formula coverage](/compatibility/formula-coverage) — registered functions by family.
- [Error model](/compatibility/errors) — error values vs host failures in depth.
