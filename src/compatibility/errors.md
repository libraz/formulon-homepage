# Error Model

Spreadsheet errors are **first-class values**. A formula returning `#DIV/0!` did not crash — it produced an error value, and the host API call that retrieved it succeeded. This separation is preserved across every binding.

::: info Glossary: cell error vs host failure
A *cell error* is a value with `kind = Error`. It travels through the binding as data. A *host failure* means the host operation itself failed (bad bytes, missing handle, IO error, internal engine failure) and is reported through a separate channel — `Status` envelope, exception, non-zero exit, or `fm_status_t`.
:::

<DiagramLayers :layers="[
  { title: 'Host call', nodes: ['getValue / recalc / save'] },
  { title: 'Did the call itself succeed?', nodes: [
    { label: 'No → host failure path', note: 'status envelope · exception · non-zero exit · fm_status_t' },
    { label: 'Yes → check value.kind' }
  ] },
  { title: 'value.kind', nodes: [
    { label: 'Error → cell error value', note: '#DIV/0! · #VALUE! · #REF! · … — surface inline, never throw' },
    { label: 'Number / Text / Bool / …', note: 'use the value directly' }
  ] }
]" />

Handle a host failure through its channel, then retry or fix the integration. A cell error is data: show it inline and keep going.

| Error | Meaning |
| --- | --- |
| `#DIV/0!` | Division by zero |
| `#VALUE!` | Wrong type or incompatible value |
| `#REF!` | Invalid reference (deleted sheet, broken range) |
| `#NAME?` | Unknown name or function |
| `#NUM!` | Numeric overflow or invalid numeric domain |
| `#N/A` | Value not available |
| `#NULL!` | Range intersection produced empty range |
| `#SPILL!` | Dynamic-array spill conflict |
| `#CALC!` | Engine could not produce a result |
| `#GETTING_DATA` | Asynchronous external lookup in progress |
| `#FIELD!` | Invalid rich-data-type field reference |
| `#BLOCKED!` | Action blocked by workbook or data-type policy |
| `#CONNECT!` | External data connection failure |
| `#EXTERNAL!` | External function or dependency error |
| `#BUSY!` | Operation currently busy (e.g. a real-time-data provider) |
| `#PYTHON!` | Error raised while evaluating a `PY` cell |
| `#UNKNOWN!` | Unrecognized or unmapped error code |

This is the full, wired `ErrorCode` set (`src/value.h`'s `kErrorTable`). The display helpers in each binding cover all 17 codes, including names that may be preserved from an input workbook. `#PYTHON!` does not mean Formulon executes Python, and `#GETTING_DATA` does not mean it performs a live network lookup.

Bindings should preserve these values instead of converting them into host exceptions unless the host API is reporting an API misuse or IO failure.

The panel below reads that set out of the running engine and runs both channels next to each other: a formula whose error comes back as a value on a call that succeeded, and a `loadBytes()` given sixteen bytes of noise, which produces no value at all.

<ErrorsDemo />

## Host failure paths

| Surface | Host failure path |
| --- | --- |
| WASM | `status.ok === false` or invalid workbook handle plus `lastErrorMessage()` |
| Python | `FormulonError` |
| CLI | non-zero exit code and diagnostic on stderr |
| C ABI | non-zero `fm_status_t` plus `fm_last_error_message()` / `fm_last_error_context()` |
| MCP | MCP error response with structured payload |
| Native Node | `status.ok === false` on the returned envelope |

## Binding argument validation

The WASM and Native Node JavaScript bindings check every positional argument before any engine call, identically on both packages. A missing required argument, a value of the wrong type, and a primitive or `null` where an object is declared raise `TypeError`; a non-finite, fractional, or out-of-range integer raises `RangeError`. Neither package substitutes `0`, `""`, `false`, or an empty object for a missing argument. The checks cover nested records as well and run before a workbook mutation. Positional 64-bit cursor and offset arguments are limited to `Number.MAX_SAFE_INTEGER`; omitted or nullish optional fields keep their declared defaults. A string field holding a lone UTF-16 surrogate is stored with U+FFFD in its place.

A malformed argument that a method reports through its status, such as an array of the wrong length or a callback that is not a function, returns `kInvalidArgument` (2) on both packages. Python raises `ValueError` for an integer that is fractional or out of range, and `Value` raises `ValueError` or `TypeError` when its payload does not match its kind.

Byte inputs such as `loadBytes` and image APIs require a `Uint8Array`. A Node `Buffer` qualifies because it is a `Uint8Array`; a string does not. Nested string fields accept a JavaScript string or a one-byte buffer, including a `Buffer` on Native Node. These binding-input results are separate from the `Status` envelopes and from Excel cell-error values. When an entry point reports a binding-rejected shape through its documented status result, inspect that status before reading the result fields.

## Statuses returned by argument and structure checks

| Status | Returned when |
| --- | --- |
| `kInvalidArgument` (2) | An index, count, or outline level (above 7) is out of range, an `xf_index` lies outside the cell-XF table, the only visible sheet would be hidden or removed, or a callback is not a function. |
| `kPreconditionFailed` (9) | A row or column insert or delete cuts through a data table, a legacy array block, or a PivotTable, or would push one of them or a table past the grid edge; a cell write targets a data table's result range. |
| `kInvalidSheetName` (5051) | A sheet name is empty, too long, contains a forbidden character, begins or ends with an apostrophe, or collides with another name under case folding; under `win-*` profiles, `History` in any case. |
| `kIoSheetCorrupt` (5012) | A loaded `.xlsx` or `.xlsb` carries a sheet name that begins or ends with an apostrophe. |
| `kIoFileTooLarge` (5002) | A size read from a file exceeds its load bound, such as a pivot cache above 2^25 record slots. |
| `kGraphRecalcReentrant` (4005) | A `Workbook` method is called from its own iterative progress callback; the JS packages surface it as a `TypeError` naming the code. |
| `kBindingUtf8EncodingError` (7002) | A C ABI text argument is not well-formed UTF-8. |

## Formula text entry paths

Malformed formula text has different outcomes depending on where it enters the engine. Keep these paths separate when reporting an error:

| Entry path | Result | Workbook mutation |
| --- | --- | --- |
| `setFormula()` / `set_formula()` | Host status `kParserUnexpectedToken` | The existing cell formula and cached value remain unchanged. |
| Imported workbook containing malformed stored formula text | The stored text is retained; after `recalc()`, the cell evaluates to `#NAME?` | Loading preserves the workbook record so it can be inspected or rewritten. |
| `evaluateFormulaText()` / `evalFormula()` / `eval_formula()` | A successful evaluation envelope whose value is `#NAME?` | Read-only; no cell or dependency graph is changed. |

A formula that nests more than 65 function calls is refused with the parse diagnostic `NestedFormulaTooDeep`, as Excel refuses it, and the cell keeps its previous formula. Up to 256 grouping parentheses and 1024 unary signs parse and evaluate.

For example, `=SUM(` is rejected by a strict formula setter with `kParserUnexpectedToken`. The same malformed text can be retained when it arrives in an imported file, and an ad-hoc evaluation reports the cell error `#NAME?`; neither case should be converted into a generic host exception. The setter status is a host-side failure because the requested mutation did not happen, while `#NAME?` is a cell value returned by the imported or ad-hoc evaluation path.

The setter, imported-formula, and ad-hoc cases are covered by `tests/c_api/formulon_c_formula_entry_test.cpp` and the evaluator in `src/eval/adhoc_eval.cpp` in the Formulon source tree.

## C ABI value kinds

| Kind | Meaning |
| --- | --- |
| `FM_VAL_BLANK` | Blank cell |
| `FM_VAL_NUMBER` | IEEE-754 double |
| `FM_VAL_BOOL` | Boolean |
| `FM_VAL_TEXT` | UTF-8 workbook-owned text view |
| `FM_VAL_ERROR` | Excel error code ordinal |
| `FM_VAL_ARRAY` | Reserved payload |
| `FM_VAL_REF` | Reserved payload |
| `FM_VAL_LAMBDA` | Reserved payload |

## Handling pattern

::: code-group

```ts [WASM]
const result = wb.getValue(0, 0, 0)
if (!result.status.ok) throw new Error(result.status.message)

const value = result.value
if (value.kind === ValueKind.Error) {
  // cell error — surface to the user, do not throw.
  showInline(Module.errorDisplayName(value.errorCode))
} else if (value.kind === ValueKind.Number) {
  consume(value.number)
}
```

```ts [Native Node]
import { errorDisplayName, ValueKind } from '@libraz/formulon-native'

const result = wb.getValue(0, 0, 0)
if (!result.status.ok) throw new Error(result.status.message)
const value = result.value
if (value.kind === ValueKind.Error) showInline(errorDisplayName(value.errorCode))
```

```python [Python]
from formulon import ValueKind, error_display_name

v = wb.get_value(0, 0, 0)
if v.kind is ValueKind.ERROR:
    show_inline(error_display_name(v.error_code))
elif v.kind is ValueKind.NUMBER:
    consume(v.number)
```

:::

## Read next

- [Formula engine](/workbook/formula-engine) — how errors propagate.
- [Troubleshooting](/start/troubleshooting) — common host failures.
