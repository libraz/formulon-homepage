---
title: formulon-cell platforms
description: Choose the default or Mac spreadsheet surface and connect Mac-only UI to a host application.
---

# Platform and Mac UI

The spreadsheet platform is selected with `ui.platform`. It is independent of `ui.profile`: the profile chooses the feature surface, while the platform chooses platform-specific interaction details and ribbon layout.

| Value | Behavior |
| --- | --- |
| `default` | Use the default spreadsheet surface. This is the default when `platform` is omitted. |
| `mac` | Opt in explicitly to the Mac ribbon and Mac interaction surface. |
| `auto` | Resolve from the browser platform. iPad and iPhone user agents, including touch-enabled `MacIntel`, fall back to `default`. |

Use the resolver when the host needs the result before mounting:

```ts
import {
  resolveSpreadsheetPlatform,
  Spreadsheet,
  type SpreadsheetPlatform,
} from '@libraz/formulon-cell'

const requested: SpreadsheetPlatform = 'auto'
const resolved = resolveSpreadsheetPlatform(requested)
const instance = await Spreadsheet.mount(host, {
  ui: { profile: 'excel365', platform: requested },
})

console.log(resolved) // 'mac' or 'default'
```

`ui.platform` does not change the selected `ui.profile`. For example, `{ profile: 'embedded', platform: 'mac' }` keeps an embedded surface while opting into the Mac platform behavior. A host can change both values after mount:

```ts
instance.setUi({ profile: 'excel365', platform: 'mac', theme: 'paper' })
```

`setUi()` does not replace the workbook. Pass the complete desired UI configuration, because omitted fields return to their defaults. Changing away from Mac closes an open formula palette and discards its suspended draft. See [Options](/cell/options#ui-profile-and-feature-switches) for how `setUi()` interacts with the top-level options.

## Sheet geometry and render scale {#sheet-geometry}

The platform also decides how the grid is sized. The grid is laid out at a screen scale that multiplies the sheet zoom: 1 on `default`, 0.75 on `mac` (one point per screen pixel). Column widths and row heights snap to whole screen pixels, a row can be at most 409 pt tall, and the row-header column is 32 px wide on `default` and 26 px on `mac`. The cell editor, charts, pictures, and shapes are placed at the same scale. `--fc-cell-text-size` sets the cell text size and defaults to `--fc-text-cell`; see [Theming](/cell/theming#public-grid-tokens).

A workbook created by the mount follows the platform. A Mac workbook comes from the engine's Mac profile (font, default row height, base column width); a `default` workbook states the locale font and the Windows default row height. Create the same workbook yourself with `WorkbookHandle.createDefault({ locale, platform })`, where `platform` is `default` or `mac`. A workbook you pass in or load keeps the sizes stored in the file, and the mount applies the platform's column-width model to it: Mac column widths follow the Mac digit-width rule, so the same stored width can differ in pixels between the two platforms.

`setUi()` re-reads row heights and column widths when the platform changes and clears the undo history, because recorded sizes were computed under the previous platform. A theme-only change keeps sizes and history.

## Mac ribbon

The Mac platform supplies its own ribbon tabs, shortcuts, and dialog routes. The Home tab follows the desktop Mac layout: Cut, Copy, and Format Painter are icon-and-text rows, and Insert, Delete, and Format are large tiles. The cell context menu is drawn as a Mac menu with Mac wording. [Ribbon toolbar](/cell/toolbar#platform-differences) covers the Mac tab set, `mac.` command IDs, and the `excel365Mac` ribbon model for a separate toolbar.

The built-in Mac ribbon is available through `ui.platform: 'mac'`. Its Draw tab exposes black and red pens, a pencil, a highlighter, an eraser, and trackpad controls. Ink is stored in the mounted session illustration layer, with at most 2,000 points per stroke; it is not written to workbook data or persisted in an `.xlsx` file. The active policy still authorizes the affected cells before a stroke is committed.

With the shortcuts feature enabled, the grid supports these Mac bindings:

| Shortcut | Action |
| --- | --- |
| `Control+U` | Edit the active cell using its existing content. |
| `Command+Control+V` | Open Paste Special when that feature is enabled. |
| `Option+Left` / `Option+Right` | Move to the previous or next sheet. |

## Function Arguments palette

The Mac Function Arguments palette is nonmodal. Opening it suspends an inline or formula-bar draft. Cancel restores the draft text, focus, and caret or selection, including when the caret is inside a function call in a compound formula. Editing a function argument changes that call while preserving the surrounding formula. The picker reads the live workbook catalog and groups functions into families. Recent records successfully inserted functions for the mounted spreadsheet store.

Use `openFunctionArguments(seedName?, { category })` to open it from host UI. `category` is ignored when `seedName` names a function; supported categories include `all`, `recent`, `logical`, `lookup`, `text`, `datetime`, `math`, `financial`, `dynamicArray`, `statistical`, `engineering`, `information`, `database`, `compatibility`, `cube`, and `web`.

`getFunctionArgumentHelp` receives the canonical function name, a zero-based argument index, and the active locale. An omitted `label` uses the catalog argument label. Descriptions and reference links come from the host provider. The palette reads the help link from the result for argument index `0`; object property order has no effect. Reference URLs must use an allowed scheme (`http:`, `https:`, `mailto:`, or `tel:`); relative paths are not shown as links.

```ts
import { Spreadsheet, type FunctionArgumentHelpProvider } from '@libraz/formulon-cell'

const getFunctionArgumentHelp: FunctionArgumentHelpProvider = (
  functionName,
  argumentIndex,
  locale,
) => {
  if (functionName.toUpperCase() !== 'SUM' || argumentIndex !== 0) return null
  const japanese = locale.toLowerCase().startsWith('ja')
  return {
    url: japanese
      ? 'https://formulon.libraz.net/ja/workbook/formula-engine'
      : 'https://formulon.libraz.net/workbook/formula-engine',
    label: japanese ? '数値' : 'numbers',
    description: japanese ? '加算する値または範囲です。' : 'The values or range to add.',
  }
}

const instance = await Spreadsheet.mount(host, {
  ui: { profile: 'excel365', platform: 'mac' },
  getFunctionArgumentHelp,
})
```

The React and Vue adapters export `FunctionArgumentHelp` and `FunctionArgumentHelpProvider` and pass the callback through to the core mount. The Vue example receives the callback as a component prop:

::: code-group

```tsx [React]
import { Spreadsheet } from '@libraz/formulon-cell-react'

<Spreadsheet
  ui={{ profile: 'excel365', platform: 'mac' }}
  getFunctionArgumentHelp={getFunctionArgumentHelp}
/>
```

```vue [Vue]
<script setup lang="ts">
import { Spreadsheet } from '@libraz/formulon-cell-vue'
import type { FunctionArgumentHelpProvider } from '@libraz/formulon-cell-vue'

defineProps<{ getFunctionArgumentHelp: FunctionArgumentHelpProvider }>()
</script>

<template>
  <Spreadsheet
    :ui="{ profile: 'excel365', platform: 'mac' }"
    :get-function-argument-help="getFunctionArgumentHelp"
  />
</template>
```

:::

## Mac ribbon dialogs

The Mac ribbon opens these dialogs. A host can open one by passing its command ID to `ToolbarInstance.applyCommand(id)`; see [Ribbon toolbar](/cell/toolbar#toolbarinstance). Goal Seek, Consolidate, and Subtotal check the instance policy before changing workbook data.

| Ribbon route | Command ID | Supported behavior and limits |
| --- | --- | --- |
| Data → What-If Analysis → Goal Seek | `mac.data.goalSeek` | Iterative solve with at most 100 iterations. |
| Data → What-If Analysis → Data Table | `mac.data.dataTable` | Row and column input cells; the engine must support data tables. Results are read-only `{=TABLE()}` cells, and edits into a result block are refused. `openDataTableDialog(instance)` opens the same dialog. |
| Data → Consolidate | `mac.data.consolidate` | `sum`, `average`, `count`, `min`, or `max`; the combined source area is limited to 100,000 cells. |
| Data → Subtotal | `mac.data.subtotal` | Active sheet only; up to 100,000 input rows, 100,000 output cells, and 1,000 groups. The engine must support `SUBTOTAL`, objects that the operation cannot process are rejected, and the output needs room. |
| Insert → Sparkline | `mac.insert.sparkline` | Rectangular source range, one-cell destination, and `line`, `column`, or `win-loss` kinds. |
| Insert → Slicer | `mac.insert.slicer` | Requires an existing workbook table and one of its columns. |
| Review → Workbook Statistics | `mac.review.stats` | Counts sheets, populated cells, formulas, numbers, text, booleans, errors, tables, comments, hyperlinks, used rows, and used columns; it recounts when opened. |

Subtotal and other Mac data changes remain policy-controlled and undoable. See [Options](/cell/options), [API surface](/cell/api), [Modals and dialogs](/cell/modals), and [Embedding](/cell/embedding) for host policy, overlay, and helper details.

## Related pages

- [Options](/cell/options) — profile, platform, feature, and policy resolution.
- [Ribbon toolbar](/cell/toolbar) — mounting the ribbon, tab sets, and command dispatch.
- [API surface](/cell/api) — resolver types and host helpers.
- [React and Vue adapters](/cell/frameworks) — adapter props and event boundaries.
- [Hooks and composables](/cell/hooks) — multi-range state in host panels.
- [Demo](/cell/demo) — switch the demo header between Default, Mac, and Auto.
