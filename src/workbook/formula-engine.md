# Formula Engine

The evaluator is designed to match Excel semantics for scalar values, ranges, arrays, errors, references, and locale-sensitive behavior. The function catalog is registered at startup; bindings expose enough of it to evaluate any registered function.

For example, if `A1` contains the number `10` and `B1` contains `=A1*2`, evaluating `B1` produces the number `20`. The formula text, its result kind, and its cached value are distinct: a formula can return a number, text, a Boolean, an error, or an array. The engine supplies these values to the host; a UI such as [formulon-cell](/cell/) decides how to display the grid.

::: info Glossary: tree-walker
The evaluator walks the parsed formula's syntax tree (AST) directly instead of compiling it to bytecode. Every build uses this one evaluator; there is no second fast path that results could drift from.
:::

::: info Glossary: value kind
The discriminator on every cell or formula result. The kinds are `Blank`, `Number`, `Bool`, `Text`, `Error`, `Array`, `Ref`, and `Lambda`. Each binding exposes them as an enum (e.g. WASM `ValueKind.Number`, Python `ValueKind.NUMBER`).
:::

<DiagramFlow :steps="[
  { label: 'Formula text', note: '=SUM(A1:A10)' },
  { label: 'Lexer / parser', note: 'produces the syntax tree (AST)' },
  { label: 'Reference resolver', note: 'names · tables · ranges' },
  { label: 'Evaluator', note: 'walks the AST directly' },
  { label: 'Value', note: 'one of eight value kinds' }
]" label="Formula text is parsed into an AST, references are resolved, and the tree-walking evaluator produces a Value" caption="One tree-walking evaluator serves every build, so there is no second fast path for results to drift from." />

## Function catalog

The catalog tracks 526 Excel function names across math, statistical, logical, text, date/time, lookup, financial, engineering, information, database, web, cube, and recent (LET / LAMBDA / dynamic array) families. That is the recognition catalog, not a claim that every Microsoft 365 service-backed function is locally implemented.

The catalog contains **511 real implementations, including 2 environment-bound functions (`CELL`, `INFO`), plus 15 unavailable stubs = 526 recognized names**. See [Formula coverage](/compatibility/formula-coverage) for the category and availability breakdown.

## References and arrays

Range-shaped defined names evaluate as arrays, spill-phantom cells are enumerated, 1900/1904 date systems are carried through the evaluator, and whole-row/column and 3-D ranges resolve against the workbook model. Array broadcasting follows the function's Excel rules. To evaluate a formula without writing it into a cell, see [Ad-hoc formula evaluation](/workbook/operations#ad-hoc-formula-evaluation).

### Reference-valued endpoints

Reference-valued expressions can be used where a range endpoint is expected. A defined name or a reference-returning function such as `INDEX`, `OFFSET`, `XLOOKUP`, `IFS`, or `SWITCH` can form an endpoint (`A1:MyName`, `A1:INDEX(...)`, `XLOOKUP(...):B3`), and `ROW` / `COLUMN` accept such dynamic ranges. Name bodies that evaluate to constants, ordinary expressions, or text are not references and return `#VALUE!` in this position; an undefined name returns `#NAME?`, and an endpoint on another sheet returns `#VALUE!`. Self-book names and functions use `[0]!Name`, `[0]!Fn(args)`, range forms such as `A1:[0]!Rng`, and intersections such as `[0]!Rng A1:A5`.

### External workbook references and cached values

Formula-bar references can name an external workbook by book name or path: `=[Book.xlsx]Sheet1!A1`, `='/Users/x/[Book.xlsx]Sheet1'!A1`, `=SUM([Book.xlsx]Sheet1:Sheet2!A1)`, and `=Book.xlsx!Name`. The same forms are accepted in cells, defined names, conditional-format formulas, and data-validation formulas. Entering a reference to a book that is not already in the external-link table appends a link record; later references reuse that record case-insensitively. The storage writer uses the link's index, while formula getters show the book or path spelling.

Loaded index-spelled forms such as `[1]Sheet1!A1`, `[2]!Name`, and `'[1]My Sheet'!A1` resolve against the same external-link cache; formula getters expose the corresponding book or path rather than the storage index.

External references read cached cells and defined names from the external-link part. Formulon does not open the source workbook, fetch over a network, or refresh external data. XLSX and XLSB preserve the link table and formula on save and reload, while the evaluated result still comes only from the cached values.

### Function values and trimmed references

A bare registered builtin such as `SUM` is a function value. `TYPE(SUM)` returns `128`, and `LET(f,ABS,f(-2))` returns `2`; lexical `LET` bindings and defined names can shadow a builtin. Function values can also flow through `CHOOSE`, `IF`, and `REDUCE` before being called.

The reference forms `A1:.A10`, `A1.:A10`, and `A1.:.A10` trim blank rows or columns from the trailing edge, leading edge, or both edges of a range. `TRIMRANGE(...)` has the same reference semantics. These values remain references and follow edits. Formula-bar spelling is converted to Excel storage (`_xleta.` for function values and `_xlfn._TRO_TRAILING`, `_xlfn._TRO_LEADING`, or `_xlfn._TRO_ALL` for trim operators) and restored when read, including through XLSX/XLSB round-trips.

### Formula edge cases

The evaluator follows the current Excel-compatible behavior for several easily confused text and blank states:

- `TRIM` collapses a run of trimmable spaces but preserves the character that started the run; an ideographic space (U+3000) is not rewritten as U+0020.
- `ISOMITTED` returns `TRUE` for an empty argument slot, including a leading, middle, or trailing omission in a `LAMBDA` call.
- A zero-length string is text, not a blank cell. `CELL("type", ...)` returns `"l"` for it, wildcard `COUNTIF(range, "*")` includes it, and `COUNTIF(range, "=")` uses the blank-cell probe that it does not satisfy.

`USDOLLAR` and `DOLLAR` both return text but have different compatibility rules. `USDOLLAR` uses the profile's explicit US-dollar style when one is defined; otherwise it falls back to that locale's `DOLLAR` currency style. `DOLLAR` always follows the active locale's currency format and default decimals. For example, under `win-365-ja_JP`, `DOLLAR(1234.5)` uses the yen presentation with zero default decimals, while the profile's explicit `USDOLLAR` style remains `$1,234.50`; a profile without a US-dollar override follows its locale currency instead. A negative value rounded to display zero keeps its sign, such as `USDOLLAR(-0.001, 2)` → `($0.00)` and `DOLLAR(-0.001, 2)` → `¥-0.00`.

### Aggregate references and row visibility

`SUBTOTAL` and `AGGREGATE` inspect the formula stored in each referenced cell. A cell is excluded when its own formula contains `SUBTOTAL` or `AGGREGATE`; the check descends into `LET` and `LAMBDA` bodies and into inactive `IF` branches. Every cell of a spilled or CSE array follows its qualifying anchor. A defined-name alias, `INDIRECT`, or a plain reference to that cell does not create a nested call. This nested-formula rule applies to every `SUBTOTAL` function number and to `AGGREGATE` options 0–3, including its array forms 14–19; `AGGREGATE` options 4–7 retain nested cells.

For `SUBTOTAL` 1–11, hidden rows count as filtered only when an AutoFilter on the sheet or one of its tables has a criterion; once a criterion exists, every hidden row on that sheet is skipped. Function numbers 101–111 always skip hidden rows. If all referenced cells are excluded, `SUBTOTAL` returns its empty-set result rather than `#VALUE!`.

### Number formats and date/time values

Number-format validation follows Excel's section rules: there are at most four sections, conditions are allowed only in the first two, `@` cannot be mixed with numeric or date tokens, and an unterminated quote, bracket, escape, `_`, or `*` is rejected. Conditional sections use Excel's implicit positive and negative sign arms; when no arm accepts a numeric value, `TEXT` returns `#VALUE!` and display text is `########`. A numeric value selected by a text-only section is rendered with `General`.

`TEXT` and display formatting use continued-fraction search for fractions, including fixed and zero-prefixed denominators, and apply `%` before fraction conversion. Scientific formats support engineering grouping, while commas before the decimal point scale the value. Whole-number fraction padding, `[DBNum1]` with `General`, serial 0 as `1900/1/0`, negative 1904 dates and times, and the 1904 upper serial bound follow Excel. Date fields are rendered from one rounded second, with a carry into the next day at midnight.

After truncation, `TIME` limits each hour, minute, and second component to 32767 before day wrapping; a larger component returns `#NUM!`. Non-finite or out-of-range date/time inputs also return `#NUM!`.

### Nesting limits

Formula text follows Excel's entry limits: grouping parentheses nest up to 256 deep (a call's own parentheses do not count), a run of unary signs such as `---1` up to 1024, and function calls up to 65 deep, the outermost call plus 64 nested ones, whatever operators or parentheses sit between them. A formula past any limit is refused whole with `NestedFormulaTooDeep`, as Excel refuses it, rather than being truncated.

### Qualified built-in calls

Formula entry rejects sheet- or workbook-qualified calls to built-in functions, such as `Sheet1!SUM(...)` or `[0]!LET(...)`. The rejection applies at every entry point, including cells, conditional formats, defined names, and validation formulas. Qualified calls to user-defined functions remain allowed.

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
| `#GETTING_DATA` | Excel's asynchronous lookup placeholder; Formulon does not fetch external data |

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

The active profile controls number, boolean and error text and parsing, `TEXT` format letters and names, text matching and coercion, `CODE` / `CHAR` and double-byte code pages, R1C1 letters, `CELL` codes, `FORMULATEXT` function names and separators, `GROUPBY` / `PIVOTBY` labels, and PivotTable labels and layout defaults. Formulas are always entered with English function names and the stored separators; CLI output is locale-invariant. The default profile is `win-365-en_US`. There are 28 profile IDs across 14 locales, in the form `mac-365-<locale>` and `win-365-<locale>` for `ja_JP`, `en_US`, `de_DE`, `fr_FR`, `zh_CN`, `ko_KR`, `th_TH`, `es_ES`, `es_MX`, `pt_BR`, `ru_RU`, `zh_TW`, `it_IT`, and `nl_NL`. Every `mac-*` profile and `win-365-ja_JP` is measured against Excel; the other `win-*` profiles are estimated from the Mac measurements. Mac profiles use their measured Excel text collation for comparisons, sorting, lookups, grouping, and AutoFilters, while Windows profiles use the Windows word sort measured on Windows Excel 365 ja-JP. The profile is not saved in the workbook, so apply it again after loading. See [Locale profiles](/compatibility/locale-profiles) and [Text collation](/compatibility/text-collation).

## Read next

- [Recalculation](/workbook/recalculation) — how the engine schedules formula evaluation.
- [Workbook operations](/workbook/operations#ad-hoc-formula-evaluation) — ad-hoc formula evaluation without mutating a cell.
- [Formula coverage](/compatibility/formula-coverage) — registered functions by family.
- [Error model](/compatibility/errors) — error values vs host failures in depth.
