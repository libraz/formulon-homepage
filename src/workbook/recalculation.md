# Recalculation

Recalculation is the step that turns workbook edits into updated calculated values. Every host surface — WASM, Python, Native Node, CLI, MCP — flows through the same recalculation core, so behavior should not drift between runtimes.

::: info Glossary: dependency graph
A directed graph the engine builds from formulas. Each formula cell points to the cells (or named ranges, or external links) it reads from, so the recalc engine can compute things in the right order and recompute only what changed.
:::

::: info Glossary: dirty cell
A cell whose computed value is no longer known to be up to date because something it depends on changed. Recalculation visits dirty cells, evaluates them, and marks them clean again.
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
| Calc mode | Manual or automatic recalculation for hosts that expose the toggle |

<DiagramLayers :layers="[
  { title: 'Edit', nodes: [{ label: 'Edit / set_cell' }, { label: 'Volatile functions', note: 'NOW · RAND · INDIRECT · …' }] },
  { title: 'Dirty tracking', nodes: [{ label: 'Mark dirty', note: 'walk reverse edges in dependency graph' }] },
  { title: 'Recalc', nodes: [{ label: 'recalc / partialRecalc', note: 'evaluate all dirty cells or the requested dependency closure' }] },
  { title: 'Per cell', nodes: [{ label: 'Non-array result', note: 'write value' }, { label: 'Dynamic array', note: 'update spill shape, invalidate dependents' }] },
  { title: 'Done', nodes: [{ label: 'Mark clean', note: 'the requested cells are current; full recalc clears the whole dirty set' }] }
]" />

That graph can also be read back. On WASM and Native Node, `precedents(sheet, row, col, depth)` returns the cells an address reads from and `dependents(...)` the cells that read it. Pick a cell in the seeded sheet below and the arrows are drawn from nothing but the addresses those two calls returned. Raise the depth and the chain behind `D1` unwinds a column at a time, back to the literals in column A.

<TraceDemo />

## Full vs partial recalculation

`recalc()` walks every dirty cell in topological order. `partialRecalc()` — available on WASM, Native Node, and Python — recomputes dirty formula cells needed to make the requested viewport current, including their transitive precedents. Dirty cells outside that dependency closure remain pending. Pass the output cells you want to display; use `recalc()` to update the whole workbook.

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

::: info Glossary: volatile function
A function whose value depends on something other than its arguments (clock, randomness, external lookup) and so must be re-evaluated on every recalc, even when no input has changed. Volatiles drag their dependents into the dirty set every time.
:::

## Pinning clock-dependent calculations

When a workbook has no pinned clock, `NOW()`, `TODAY()`, and pivot relative-period filters read the host clock. Each read can observe a different instant, including across a midnight boundary. A pin gives all of them one local civil-time reading for a reproducible recalculation.

WASM exposes `pinnedNow()`, `setPinnedNow(year, month, day, hour, minute, second)`, and `clearPinnedNow()`. Python exposes the matching `pinned_now()`, `set_pinned_now(...)`, and `clear_pinned_now()` methods. The WASM getter returns `{ status, now }`; check `status` before reading `now`, which is a `CivilTime` object (`year`, `month`, `day`, `hour`, `minute`, `second`) or `null` when the host clock is active. Python returns the `CivilTime` value or `None` directly.

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

The pin uses local civil fields rather than a timestamp, so it has no residual timezone interpretation. `setPinnedNow()` rejects a year outside 1900–9999, a month outside 1–12, an invalid day for that month, an hour outside 0–23, or a minute / second outside 0–59; it does not roll invalid fields into another date. Setting or clearing the pin does not recompute cached formula values, so call `recalc()` after changing it. The pin is model state, not file state: saving does not record it and a reloaded workbook follows the host clock until pinned again.

## `INDIRECT` and R1C1 references

`INDIRECT(ref_text, FALSE)` parses `ref_text` as R1C1 text. Absolute references use forms such as `R5C2`; relative axes use forms such as `R[-1]C`, resolved from the cell containing the formula. A bare `R` or `C` means the current row or column, and an endpoint naming only one axis is unbounded along the other (`R5` is the whole of row 5, just as `5:5` is). The `a1` argument selects a grammar rather than adding a fallback: A1 text with `FALSE`, and R1C1 text with `TRUE`, return `#REF!`. Relative R1C1 text also returns `#REF!` when an ad-hoc evaluation entry point has no formula cell to use as its anchor.

## Iterative calculation

Workbooks with intentional cycles — interest accrual, goal-seek style fixed points — need iterative calculation. The engine evaluates the cyclic subgraph repeatedly until the change between iterations falls below the configured tolerance or the iteration cap is hit.

```ts
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

`setIterativeProgress()` registers a callback that fires after every Gauss-Seidel sweep over the cyclic subgraph; it does not take iteration-limit arguments — those are the second and third arguments to `setIterative()`. The callback is WASM- and Native-Node-only: Python's `set_iterative()` takes the same three arguments, but the per-sweep progress callback is not bound (it would need a native function pointer that the Python host cannot synthesize).

`getIterative()` is available on WASM and Native Node and returns `{ status, enabled, maxIterations, maxChange }`. Python exposes the same read-back as `get_iterative()`. `maxIterations` is capped at `32767` when it is set, and the getter reports the capped value; the cap also applies when a loaded workbook declares a larger `iterateCount`. Read the settings after a write when a host UI must show the value the engine will use.

::: warning Cycles outside iteration need inspection
If iterative calculation is **off**, an ordinary unresolved cycle produces `#REF!`. A cycle that closes through dynamic references such as `OFFSET` or `INDIRECT` may retain its prior cached values instead. Cycle statistics identify the affected cells; neither case is a host exception. Turn iteration on explicitly when cycles are intentional.
:::

The panel below solves a two-cell cycle with those same three arguments exposed. Tighten `maxChange` and the solve takes more sweeps to get under it; set an iteration cap below what the tolerance needs and the solve stops early, reporting the run as not converged with its last residual still above the guide line.

<IterativeDemo />

## Correctness over speed

All recalculation uses the tree-walker. Release, development, and test builds use one evaluator and one evaluation path. Goldens (committed Excel-derived reference values) gate compatibility changes, and speed work that would diverge from them is rejected.

## Read next

- [Formula engine](/workbook/formula-engine) — value kinds, coordinates, error propagation.
- [Dynamic arrays](/workbook/dynamic-arrays) — spill shape and recalc interaction.
- [Oracle testing](/compatibility/oracle-testing) — how reference values are captured.
