---
title: Custom cells and host functions
description: Change how matching cells are displayed with instance.cells, and register host functions for formula autocomplete and instance.formula.
---

# Custom cells and host functions

The cell registry changes the text used to draw a cell while leaving its stored value intact for formulas, editing, and saving. The host-function registry provides callbacks for application code and formula autocomplete; the calculation engine does not call those callbacks during workbook recalculation.

```ts
import { Spreadsheet } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  ui: { profile: 'standard' },
  functions: [
    {
      name: 'TAX',
      impl: (amount) => (amount.kind === 'number' ? amount.value * 0.1 : null),
      meta: { description: 'Returns 10% of the amount.', args: ['amount'] },
    },
  ],
  seed: (wb) => {
    wb.setText({ sheet: 0, row: 0, col: 0 }, 'Order')
    wb.setNumber({ sheet: 0, row: 1, col: 0 }, 42)
  },
})

// Paint order numbers in column A as INV-0042.
const removeFormatter = instance.cells.registerFormatter({
  id: 'invoice-number',
  match: ({ addr, value }) => addr.sheet === 0 && addr.col === 0 && value.kind === 'number',
  format: ({ value }) =>
    value.kind === 'number' ? `INV-${String(value.value).padStart(4, '0')}` : null,
})

instance.formula.evaluate('TAX', [{ kind: 'number', value: 1000 }])
// { kind: 'number', value: 100 }
```

Cell A2 holds the number `42` and is painted as `INV-0042`. `TAX` appears in formula autocomplete and runs when host code calls `instance.formula.evaluate()`. The engine does not call it during recalculation; see [Host functions](#host-functions).

Both registries belong to the mounted instance. `instance.cells` is a `CellRegistry`, and `instance.formula` is a `FormulaRegistry`. React and Vue expose them on the instance from `onReady` or the `ready` event.

## Display formatters

A formatter substitutes the text painted in matching cells. The grid still paints that text through its normal pipeline, so font, color, fill, and alignment come from the cell's format. Only the painted text changes: the cell value, the formula bar, and the in-cell editor keep the stored value, and saving writes the stored value.

`registerFormatter(entry)` takes a `CellFormatterEntry`:

| Field | Meaning |
| --- | --- |
| `id` | Stable identifier. Registering the same `id` again replaces the earlier entry. |
| `match(input)` | Return `true` to run `format` for this cell. |
| `format(input)` | Return the text to paint, or `null` to pass the cell to the next formatter. |
| `priority` | Lower values run first. The default is `50`. |

Both functions receive a `CellRenderInput`:

| Field | Type |
| --- | --- |
| `addr` | `{ sheet, row, col }`, all zero-based. |
| `value` | `CellValue`: `blank`, `number`, `bool`, `text`, or `error`. |
| `formula` | The stored formula text, or `null`. |
| `format` | The cell's `CellFormat`, or `undefined`. |

Formatters run in priority order and the first non-`null` result is painted. When none returns text, the cell shows its number-format text as usual. A formatter's result replaces the number-format text, so a formatter that matches dates or currency takes over their display.

`registerFormatter()` returns a function that removes that entry. `unregisterFormatter(id)` removes by identifier and returns whether one was found, and `formatterIds()` lists the registered identifiers. Registering or removing a formatter repaints the grid.

`match` and `format` run for each painted cell on every repaint, including scrolling. Keep them to a few comparisons, and look up any host data in a prepared `Map` rather than fetching it inside the callback.

```ts
const statusLabels = new Map([
  [1, 'Open'],
  [2, 'Shipped'],
  [3, 'Closed'],
])

instance.cells.registerFormatter({
  id: 'order-status',
  priority: 10,
  match: ({ addr }) => addr.sheet === 0 && addr.col === 3 && addr.row > 0,
  format: ({ value }) =>
    value.kind === 'number' ? (statusLabels.get(value.value) ?? null) : null,
})
```

A status code without a label returns `null`, so the cell falls back to its normal display.

## Host functions {#host-functions}

The `functions` mount option registers each `{ name, impl, meta }` entry in `instance.formula`. Register more later with `register()`:

```ts
const removeNet = instance.formula.register(
  'NET',
  (gross, rate) =>
    gross.kind === 'number' && rate.kind === 'number' ? gross.value / (1 + rate.value) : null,
  { description: 'Removes tax from a gross amount.', args: ['gross', 'rate'], returnType: 'number' },
)
```

| Member | Behavior |
| --- | --- |
| `register(name, impl, meta?)` | Add or replace a function. Returns a function that removes this registration only, so it does nothing after a later `register()` replaced the name. |
| `unregister(name)` | Remove a function. Returns whether one was registered. |
| `has(name)`, `get(name)` | Check for a function, or read its `{ name, impl, meta }`. |
| `list()` | Registered names, upper-cased and sorted. |
| `evaluate(name, args)` | Call the function synchronously and return a `CellValue`. Throws for an unknown name. |
| `subscribe(fn)`, `clear()` | Listen for registration changes; remove every function. |

Names are case-insensitive and stored in upper case. After upper-casing, a name must start with a letter and contain only letters, digits, and `_`; otherwise `register()` throws, and so does the mount.

`impl` receives `CellValue` arguments. It may return a `CellValue` or a plain value, which `evaluate()` converts: a number becomes `number`, a string becomes `text`, a boolean becomes `bool`, and `null` becomes `blank`.

### What reaches the formula bar and the engine

Registered names are offered in formula autocomplete as the user types after `=`, ahead of built-in functions with the same prefix. `meta` (`description`, `args`, `returnType`) is stored with the registration and returned by `get()`. Autocomplete and the argument helper show the `args` signature.

The formulon engine has no callback for user functions, so recalculation never calls `impl`. A cell formula such as `=TAX(A2)` does not get its value from the host function. Calculate the value in host code and write the result into a cell:

```ts
instance.on('cellChange', ({ addr, value }) => {
  if (addr.sheet !== 0 || addr.col !== 1 || addr.row === 0) return
  const tax = instance.formula.evaluate('TAX', [value])
  instance.applyChanges([{ addr: { ...addr, col: 2 }, value: tax }], { history: 'record' })
})
```

The handler writes column C whenever a value in column B changes. `history: 'record'` keeps the write on the undo stack; the default `'reset'` would clear the user's history after every edit.

### Seed a new workbook

`seed(wb)` receives the `WorkbookHandle` and runs once, before the first render. It runs only when the mount creates the workbook; a workbook passed through `workbook` is never seeded. The locale's calculation profile is already selected, so seeded formulas evaluate with the same settings as the first paint. `seed` is mostly useful for demos and tests.

React and Vue accept `functions` and `seed` as props and read them when the component mounts. Changing them later has no effect; call `instance.formula.register()` instead.

## Related pages

- [API surface](/cell/api) — the instance members and events.
- [Host integration](/cell/host-integration) — `applyChanges()`, save flows, and host callbacks.
- [Options](/cell/options) — feature switches, including `autocomplete`.
- [React and Vue adapters](/cell/frameworks) — the `functions` and `seed` props.
