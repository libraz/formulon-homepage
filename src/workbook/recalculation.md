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
| Volatile functions | Functions like `NOW`, `TODAY`, `RAND`, `INDIRECT`, `OFFSET`, `INFO` that are always treated as dirty |
| Iterative settings | Iteration enabled / disabled, max iterations, max change for cyclic models |
| Dynamic-array spill shapes | Per-anchor result shapes so dependents can be re-shaped or invalidated correctly |
| Calc mode | Manual or automatic recalculation for hosts that expose the toggle |

<DiagramLayers :layers="[
  { title: 'Edit', nodes: [{ label: 'Edit / set_cell' }, { label: 'Volatile functions', note: 'NOW · RAND · INDIRECT · …' }] },
  { title: 'Dirty tracking', nodes: [{ label: 'Mark dirty', note: 'walk reverse edges in dependency graph' }] },
  { title: 'Recalc', nodes: [{ label: 'recalc / partialRecalc', note: 'evaluate the dirty set in topological order' }] },
  { title: 'Per cell', nodes: [{ label: 'Non-array result', note: 'write value' }, { label: 'Dynamic array', note: 'update spill shape, invalidate dependents' }] },
  { title: 'Done', nodes: [{ label: 'Mark clean', note: 'repeat until no dirty cells remain, then reads are valid' }] }
]" />

That graph can also be read back. On WASM and Native Node, `precedents(sheet, row, col, depth)` returns the cells an address reads from and `dependents(...)` the cells that read it. Pick a cell in the seeded sheet below and the arrows are drawn from nothing but the addresses those two calls returned. Raise the depth and the chain behind `D1` unwinds a column at a time, back to the literals in column A.

<TraceDemo />

## Full vs partial recalculation

`recalc()` walks every dirty cell in topological order. `partialRecalc()` — available on WASM, Native Node, and Python — recomputes only the cells inside a specified viewport range (plus their dependents) instead of the whole dirty set. Use it when you know exactly which cells changed — typically a single user edit or a small batch — and want the dependent fan-out only.

::: info Glossary: volatile function
A function whose value depends on something other than its arguments (clock, randomness, external lookup) and so must be re-evaluated on every recalc, even when no input has changed. Volatiles drag their dependents into the dirty set every time.
:::

## Iterative calculation

Workbooks with intentional cycles — interest accrual, goal-seek style fixed points — need iterative calculation. The engine evaluates the cyclic subgraph repeatedly until the change between iterations falls below the configured tolerance or the iteration cap is hit.

```ts
wb.setIterative(/*enabled*/ true, /*maxIterations*/ 100, /*maxChange*/ 0.001)
wb.setIterativeProgress((iteration, maxResidual) => {
  console.log(`iteration ${iteration}, max residual ${maxResidual}`)
  return true // false aborts the solve
})
wb.recalc()
```

`setIterativeProgress()` registers a callback that fires after every Gauss-Seidel sweep over the cyclic subgraph; it does not take iteration-limit arguments — those are the second and third arguments to `setIterative()`. The callback is WASM- and Native-Node-only: Python's `set_iterative()` takes the same three arguments, but the per-sweep progress callback is not bound (it would need a native function pointer that the Python host cannot synthesize).

::: warning Cycles outside iteration are still errors
If iterative calculation is **off** and the workbook contains a cycle, the involved cells return `#REF!` / `#NUM!` style Excel errors rather than throwing a host exception. Turn iteration on explicitly when cycles are intentional.
:::

The panel below solves a two-cell cycle with those same three arguments exposed. Tighten `maxChange` and the solve takes more sweeps to get under it; set an iteration cap below what the tolerance needs and the solve stops early, reporting the run as not converged with its last residual still above the guide line.

<IterativeDemo />

## Correctness over speed

Production recalculation uses the tree-walker; release CLI, WASM, and binding binaries do not carry the experimental bytecode compiler, optimizer, or VM. A developer or test build may compile the VM with `FORMULON_BUILD_VM=ON`, but only an explicit `FORMULON_VM_PARITY_CHECK=ON` build runs both evaluators for comparison. Default tests do not double-evaluate. Goldens (committed Excel-derived reference values) gate compatibility changes, and speed work that would diverge from them is rejected.

## Read next

- [Formula engine](/workbook/formula-engine) — value kinds, coordinates, error propagation.
- [Dynamic arrays](/workbook/dynamic-arrays) — spill shape and recalc interaction.
- [Oracle testing](/compatibility/oracle-testing) — how reference values are captured.
