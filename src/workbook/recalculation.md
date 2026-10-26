# Recalculation

Recalculation is the step that turns workbook edits into updated calculated values. Every host surface — WASM, Python, Native Node, CLI, MCP — flows through the same recalculation core, so behavior should not drift between runtimes.

::: info Glossary: dependency graph
A directed graph the engine builds from formulas. Each formula cell points to the cells (or named ranges, or external links) it reads from, so the recalc engine can compute things in the right order and recompute only what changed.
:::

::: info Glossary: dirty cell
A cell whose computed value is no longer known to be up to date because something it depends on changed. Recalculation visits dirty cells, evaluates them, and marks them clean again.
:::

::: info Glossary: volatile function
A function whose value depends on something other than its arguments (clock, randomness, workbook structure) and so must be re-evaluated on every recalc, even when no input has changed. Volatiles drag their dependents into the dirty set every time.
:::

## What the engine tracks

The recalculation engine keeps state across edits:

| State | Purpose |
| --- | --- |
| Dependency graph | Forward / reverse edges between formula cells, defined names, tables, and external links |
| Dirty set | Cells whose value must be recomputed before reads are valid |
| Volatile functions | `NOW`, `TODAY`, `RAND`, `RANDBETWEEN`, `RANDARRAY`, `OFFSET`, `INDIRECT`, `INFO`, `CELL`, `FORMULATEXT`, `SHEET`, and `SHEETS`, which are always treated as dirty |
| Workbook clock | An optional local civil-time reading shared by `NOW`, `TODAY`, and pivot relative-period filters |
| Iterative settings | Iteration enabled / disabled, max iterations, max change for cyclic models |
| Dynamic-array spill shapes | Per-anchor result shapes so dependents can be re-shaped or invalidated correctly |
| Calc mode | Excel's automatic / manual / automatic-except-tables setting, kept for round-trip; the engine recalculates only when the host calls `recalc()` or `partialRecalc()`, whatever the mode. Only `AutoNoTable` changes what `recalc()` computes: it skips [data tables](#what-if-data-tables) |
| Data tables | What-If `TABLE()` ranges, recomputed by `recalc()` after a pass that had work to do |

<DiagramLayers :layers="[
  { title: 'Edit', nodes: [{ label: 'Edit / set_cell' }, { label: 'Volatile functions', note: 'NOW · RAND · INDIRECT · …' }] },
  { title: 'Dirty tracking', nodes: [{ label: 'Mark dirty', note: 'walk reverse edges in dependency graph' }] },
  { title: 'Recalc', nodes: [{ label: 'recalc / partialRecalc', note: 'evaluate all dirty cells or the requested dependency closure' }] },
  { title: 'Per cell', nodes: [{ label: 'Non-array result', note: 'write value' }, { label: 'Dynamic array', note: 'update spill shape, invalidate dependents' }] },
  { title: 'Done', nodes: [{ label: 'Mark clean', note: 'the requested cells are current; full recalc clears the whole dirty set' }] }
]" />

That graph can also be read back. `precedents(sheet, row, col, depth)` (the same name in Python) returns the cells an address reads from and `dependents(...)` the cells that read it. Pick a cell in the seeded sheet below and the arrows are drawn from nothing but the addresses those two calls returned. Raise the depth and the chain behind `D1` unwinds a column at a time, back to the literals in column A.

<TraceDemo />

## Full vs partial recalculation

`recalc()` walks every dirty cell in topological order, and visits cells in a deterministic order, so spill winners and legacy array blocks resolve the same way on every run. `partialRecalc()` — available on WASM, Native Node, and Python — recomputes dirty formula cells needed to make the requested viewport current, including their transitive precedents. Dirty cells outside that dependency closure, including dependents of cells just recomputed, remain dirty and keep their previous cached values. A later full recalc or a partial recalc whose closure includes them refreshes them. Pass the output cells you want to display; use `recalc()` to update the whole workbook.

The viewport bounds are inclusive. For example, if `B1` refers to `A1` and `C1` refers to `B1`, pass `B1:C1` after changing `A1` so both displayed results become current:

::: code-group

```ts [WASM / Native Node]
const result = wb.partialRecalc({
  sheet: 0, firstRow: 0, lastRow: 0, firstCol: 1, lastCol: 2,
})
if (!result.status.ok) throw new Error(result.status.message)
console.log(`recomputed ${result.recomputed} cell(s)`)
```

```python [Python]
recomputed = wb.partial_recalc(
    sheet=0, first_row=0, last_row=0, first_col=1, last_col=2,
)
print(f"recomputed {recomputed} cell(s)")
```

:::

## Pinning clock-dependent calculations

When a workbook has no pinned clock, `NOW()`, `TODAY()`, and pivot relative-period filters read the host clock. Each read can observe a different instant, including across a midnight boundary. A pin gives all of them one local civil-time reading for a reproducible recalculation.

WASM and Native Node expose `pinnedNow()`, `setPinnedNow(year, month, day, hour, minute, second)`, and `clearPinnedNow()`. Python exposes the matching `pinned_now()`, `set_pinned_now(...)`, and `clear_pinned_now()` methods, and the CLI takes `--now <date[Thh:mm:ss]>`. The JavaScript getter returns `{ status, now }`; check `status` before reading `now`, which is a `CivilTime` object (`year`, `month`, `day`, `hour`, `minute`, `second`) or `null` when the host clock is active. Python returns the `CivilTime` value or `None` directly.

```ts
const checkStatus = (status: { ok: boolean; message: string }) => {
  if (!status.ok) throw new Error(status.message)
}
checkStatus(wb.setPinnedNow(2026, 8, 19, 12, 0, 0))
checkStatus(wb.recalc())
const pin = wb.pinnedNow()
if (!pin.status.ok) throw new Error(pin.status.message)
const now = pin.now
checkStatus(wb.clearPinnedNow())
```

The pin uses local civil fields rather than a timestamp, so it has no residual timezone interpretation. `setPinnedNow()` rejects a year outside 1900–9999, a month outside 1–12, an invalid day for that month, an hour outside 0–23, or a minute / second outside 0–59; it does not roll invalid fields into another date. Setting or clearing the pin marks every formula cell dirty and clears affected derived PivotTable results, but does not recompute cached values until `recalc()` runs. The pin is model state, not file state: saving does not record it and a reloaded workbook follows the host clock until pinned again.

## Workbook-wide invalidation

Changing iterative-calculation options, the Excel compatibility profile, or the pinned clock marks every formula cell dirty. Context-dependent changes also clear derived PivotTable results that depend on them. Call `recalc()` to refresh the formulas and any dependent pivot results; setting an identical effective value is a no-op.

## Calculation settings and file persistence

Calc mode (`calcMode()` / `setCalcMode()`, with `CalcMode.Auto`, `Manual`, or `AutoNoTable`; `calc_mode()` / `set_calc_mode()` in Python) and iterative settings are workbook state while the workbook is open. A host UI can show the mode, but apart from `AutoNoTable` the engine does not act on it.

The other `<calcPr>` settings have typed accessors too, and every attribute of the element is kept across a resave:

| Setting | WASM / Native Node | Python |
| --- | --- | --- |
| Set precision as displayed (`fullPrecision`; metadata only) | `fullPrecision()` / `setFullPrecision(value)` | `full_precision()` / `set_full_precision(value)` |
| Recalculate before saving (`calcOnSave`, default on) | `calcOnSave()` / `setCalcOnSave(value)` | `calc_on_save()` / `set_calc_on_save(value)` |
| Reference notation (`refMode`) | `refMode()` / `setRefMode(RefMode.A1 \| RefMode.R1C1)` | `ref_mode()` / `set_ref_mode(mode)` |
| 1904 date system (`<workbookPr date1904>`) | `date1904()` / `setDate1904(value)` | `date1904()` / `set_date1904(value)` |

The JavaScript getters return `{ status, value }` with `0` / `1` for the flags; Python returns `bool` and `RefMode`. `setDate1904()` switches the date system without converting stored serials, so every date shifts by 1462 days.

XLSX stores these in `<calcPr>` and `<workbookPr>`. The XLSB writer emits them as `BrtCalcProp` and `BrtWbProp`, so manual calculation and iteration settings survive a binary save. See [File formats](/workbook/file-formats) for what XLSB leaves out.

## What-If data tables

A What-If data table (`<f t="dataTable">`) is modelled, not frozen into values. The sheet keeps each table's result range, its orientation and its input cells, and a save writes the formula back on the anchor cell. Substitution values sit in the row above the result range and the column to its left. A one-variable table has a row or a column input cell; a two-variable table has both.

A full `recalc()` fills the result cells by substituting each value into the input cell(s), recalculating the cells that read them, and restoring the inputs. Under `CalcMode.AutoNoTable` it leaves them alone until `recalcDataTables()` (`recalc_data_tables()`), which computes every table on demand whatever the mode. `partialRecalc()` never computes data tables.

::: code-group

```ts [WASM / Native Node]
const checkStatus = (status: { ok: boolean; message: string }) => {
  if (!status.ok) throw new Error(status.message)
}
// Column input B1 receives the values in A3:A5; B3:B5 holds =B1*2 results.
checkStatus(wb.setNumber(0, 0, 1, 10)) // B1
checkStatus(wb.setFormula(0, 1, 1, '=B1*2')) // B2, the formula row
for (const [i, v] of [1, 2, 3].entries()) checkStatus(wb.setNumber(0, 2 + i, 0, v))
checkStatus(wb.addDataTable(0, {
  firstRow: 2, lastRow: 4, firstCol: 1, lastCol: 1,
  colInput: { row: 0, col: 1 },
}))
checkStatus(wb.recalc())
const found = wb.getDataTable(0, 3, 1)
console.log(found.dataTable?.twoDimensional) // false
```

```python [Python]
wb.set_number(0, 0, 1, 10)  # B1, the column input cell
wb.set_formula(0, 1, 1, "=B1*2")  # B2, the formula row
for i, v in enumerate([1, 2, 3]):
    wb.set_number(0, 2 + i, 0, v)
wb.add_data_table(0, 2, 1, 4, 1, col_input=(0, 1))  # first_row, first_col, last_row, last_col
wb.recalc()
print(wb.get_data_table(0, 3, 1).two_dimensional)  # False
```

:::

- `addDataTable(sheet, spec)` / `add_data_table(...)` creates a table over the result range; the range needs a row above and a column to its left, and the inputs must lie outside it. Otherwise it fails with `kDataTableInvalid` (8005), as it does for a range that overlaps another table. The result cells read `0` until the next recalc.
- `getDataTable(sheet, row, col)` / `get_data_table(...)` reads the table whose result range contains the cell (`dataTable` is `null`, Python returns `None`, when none does). `removeDataTable(...)` removes it and blanks its result cells.
- The result range refuses cell writes with `kPreconditionFailed` ("cannot change part of a data table"). Row and column inserts and deletes that cut into a table, either its result range or the header row and column, are refused with the same status; deleting the whole block removes the table. Edits outside shift the range and its input cells.
- Deleting an input cell marks that input `deleted`, and the table evaluates to `#REF!`.
- Result cells report `=TABLE(row_input,col_input)` through the formula getters. `FORMULATEXT` returns `{=TABLE(...)}` as it does for an array formula, and `ISFORMULA` is `TRUE`.

XLSX and XLSB both round-trip data tables; XLSB writes them as `BrtTable`.

## Recovering a missing-sheet reference

A formula entered while a referenced sheet is absent initially evaluates to `#REF!`. Adding that sheet, or renaming an existing sheet into the referenced name, reparses the affected formulas and rebuilds their dependencies. After values are written, the next `recalc()` produces the result and later edits continue to propagate. Recovery covers direct references, ranges, 3-D spans, defined-name aliases, and spill references; unrelated spills remain intact.

## `INDIRECT` and R1C1 references

`INDIRECT(ref_text, FALSE)` parses `ref_text` as R1C1 text. Absolute references use forms such as `R5C2`; relative axes use forms such as `R[-1]C`, resolved from the cell containing the formula. A bare `R` or `C` means the current row or column, and an endpoint naming only one axis is unbounded along the other (`R5` is the whole of row 5, just as `5:5` is). The `a1` argument selects a grammar rather than adding a fallback: A1 text with `FALSE`, and R1C1 text with `TRUE`, return `#REF!`. Relative R1C1 text also returns `#REF!` when an ad-hoc evaluation entry point has no formula cell to use as its anchor.

## Iterative calculation

Workbooks with intentional cycles — interest accrual, goal-seek style fixed points — need iterative calculation. The solver sweeps independent cyclic components together and applies a workbook-wide change test, stopping when the maximum change falls below the configured tolerance or the iteration cap is hit.

::: code-group

```ts [WASM / Native Node]
const checkStatus = (status: { ok: boolean; message: string }) => {
  if (!status.ok) throw new Error(status.message)
}
checkStatus(wb.setIterative(/*enabled*/ true, /*maxIterations*/ 100, /*maxChange*/ 0.001))
checkStatus(wb.setIterativeProgress((iteration, maxResidual) => {
  console.log(`iteration ${iteration}, max residual ${maxResidual}`)
  return true // false aborts the solve
}))
checkStatus(wb.recalc())
```

```python [Python]
wb.set_iterative(True, 100, 0.001)  # enabled, max iterations, max change
wb.recalc()
print(wb.get_iterative())
```

:::

`setIterativeProgress()` registers a callback that fires after every sweep over the cyclic cells; the limits themselves are the second and third arguments to `setIterative()`. The callback is WASM- and Native-Node-only. It runs while the solver holds the workbook mid-sweep, so it must not call any method on that workbook: such a call, a read included, throws `TypeError` naming `kGraphRecalcReentrant` (4005) and changes nothing. Python's `set_iterative()` takes the same three arguments, and `set_iterative_enabled(enabled)` toggles iteration while keeping the stored limits.

`getIterative()` is available on WASM and Native Node and returns `{ status, enabled, maxIterations, maxChange }`. Python exposes `get_iterative()` as an `IterativeSettings` record with `enabled`, `max_iterations`, and `max_change`; failures raise `FormulonError`. `maxIterations` is capped at `32767` when it is set, and the getter reports the capped value; the cap also applies when a loaded workbook declares a larger `iterateCount`. Read the settings after a write when a host UI must show the value the engine will use.

`maxChange` must be finite and non-negative; otherwise the API returns `kInvalidArgument` (Python raises `FormulonError`). Both JavaScript bindings pass `maxIterations` as a signed 32-bit integer and reject fractional, non-finite, or out-of-range values with `RangeError`; accepted values are then clamped to `[1, 32767]`. Python raises `ValueError` for fractional, non-finite, or out-of-range `max_iterations`, and `TypeError` for non-numeric values such as numeric strings.

::: warning Cycles outside iteration need inspection
If iterative calculation is **off**, a cycle containing a single formula cell (for example, `=A1+1` in `A1`) holds `0`; a cycle involving multiple cells produces `#REF!`. A cycle that closes through dynamic references such as `OFFSET` or `INDIRECT` may retain its prior cached values instead. These results are not host exceptions: `recalc()` still returns an OK status. Turn iteration on explicitly when cycles are intentional.
:::

The panel below solves a two-cell cycle with those same three arguments exposed. Tighten `maxChange` and the solve takes more sweeps to get under it; set an iteration cap below what the tolerance needs and the solve stops early, reporting the run as not converged with its last residual still above the guide line.

<IterativeDemo />

## Correctness over speed

All recalculation uses the tree-walker. Release, development, and test builds use one evaluator and one evaluation path. Goldens (committed Excel-derived reference values) gate compatibility changes, and speed work that would diverge from them is rejected.

## Read next

- [Formula engine](/workbook/formula-engine) — value kinds, coordinates, error propagation.
- [Dynamic arrays](/workbook/dynamic-arrays) — spill shape and recalc interaction.
- [Oracle testing](/compatibility/oracle-testing) — how reference values are captured.
