# Formula Engine

The evaluator is designed to match Excel semantics for scalar values, ranges, arrays, errors, references, and locale-sensitive behavior. The function catalog is registered at startup; bindings expose enough of it to evaluate any registered function.

::: info Glossary: tree-walker vs bytecode VM
Formulon ships two evaluators. The tree-walker interprets the parsed AST directly; the bytecode VM lowers formulas to a compact instruction stream that runs faster on hot paths. Both must produce the same values — tests run them in parallel so the optimized path stays honest.
:::

::: info Glossary: value kind
The discriminator on every cell or formula result. The kinds are `Blank`, `Number`, `Bool`, `Text`, `Error`, `Array`, `Ref`, and `Lambda`. Each binding exposes them as an enum (e.g. WASM `ValueKind.Number`, Python `ValueKind.NUMBER`).
:::

<DiagramFlow :steps="[
  { label: 'Formula text', note: '=SUM(A1:A10)' },
  { label: 'Lexer / parser' },
  { label: 'AST' },
  { label: 'Reference resolver', note: 'names · tables · ranges' },
  { label: 'Evaluator', note: 'tree-walker + bytecode VM in parity, checked against the function catalog (505/522 local) and the active compatibility profile' },
  { label: 'Value', note: 'Number · Text · Bool · Error · Array · Ref · Lambda · Blank' }
]" />

## Function catalog

The catalog tracks 522 Excel function names across math, statistical, logical, text, date/time, lookup, financial, engineering, information, database, web, cube, and recent (LET / LAMBDA / dynamic array) families. That is the recognition catalog, not a claim that every Microsoft 365 service-backed function is locally implemented.

Currently, **505 / 522** catalog entries have real local engine implementations, 2 are environment-bound (`CELL`, `INFO`), and 15 are deliberate unavailable stubs for features that require external services or live connections. See [Formula coverage](/compatibility/formula-coverage) for the category and availability breakdown.

## Evaluation modes

The tree-walker and bytecode VM can run in parallel for parity checks. That keeps optimization work honest: the faster path must produce the same values as the simpler path, on the same workbook, under the same profile.

## Ad-hoc evaluation

On top of the same evaluator, WASM and Native Node (C API) expose read-only ad-hoc formula evaluation — `evaluateFormulaText()` and `evaluateConditionalFormula()` answer "what would this formula return here?" without writing anything into a cell. See [Workbook operations — ad-hoc formula evaluation](/workbook/operations#ad-hoc-formula-evaluation) for the API shape, the WASM/Native-Node-only scope, and the top-left-scalar-reduction caveat for array/spill results.

## v0.9.3 evaluation updates

v0.9.3 shipped evaluator-level fixes directly relevant to this page:

- `date1904` is threaded through both the tree-walker and the bytecode VM, so 1900- and 1904-date-system workbooks evaluate consistently across either evaluator.
- Defined-name resolution now detects circular references instead of hanging or silently returning a stale value.
- Whole-column and whole-row references (`A:A`, `3:3`) expand against the sheet's used range instead of a fixed cap.
- Implicit broadcasting between mismatched array shapes follows Excel's actual array-broadcast rule (see [Dynamic arrays](/workbook/dynamic-arrays)).
- 3-D range tails (`Sheet1:Sheet3!A1:B2`), not just 3-D single-cell references, are resolved correctly.

## v0.9.2 evaluation updates

v0.9.2 made several Excel-parity fixes that can change edge-case results:

- numeric literals are truncated to Excel's 15-significant-digit representation during parsing;
- `ARRAYTOTEXT` propagates a scalar error argument instead of formatting around it;
- `FREQUENCY` follows Excel's bin-ordering behavior more closely;
- `PERCENTILE.EXC` returns `#NUM!` at the upper boundary (`pos == n`) instead of returning the largest sample value.

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
A formula returning `#DIV/0!` is not an API failure. The host call succeeded; it produced an error *value*. Inspect `value.kind === ValueKind.Error` to handle it. Host-side failures (bad bytes, missing handle, IO error) flow through status envelopes / exceptions / non-zero exits instead.
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
