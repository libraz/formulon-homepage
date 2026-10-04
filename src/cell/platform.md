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

`setUi()` keeps the current workbook and re-resolves the profile, platform, and theme. Pass the complete desired UI configuration: omitted fields return to their defaults. It also reapplies the top-level `features`, `theme`, and `toolbar` overrides supplied at mount. Changing away from Mac closes an open formula palette and discards its suspended draft; the workbook itself is not replaced. Use `setFeatures()`, `setTheme()`, or `setToolbar()` when only one top-level setting should change. See [Options](/cell/options) for precedence rules.

## Mac ribbon

The Mac platform supplies its own ribbon tabs, shortcuts, and dialog routes. A host that builds a separate toolbar can select the published ribbon model explicitly:

```ts
import { buildRibbonModel, type RibbonProfile } from '@libraz/formulon-cell'

const profile: RibbonProfile = 'excel365Mac'
const tabs = buildRibbonModel('en', { profile })
```

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

`getFunctionArgumentHelp` receives the canonical function name, a zero-based argument index, and the active locale. An omitted `label` uses the catalog argument label. Descriptions and reference links come from the host provider. The palette reads the help link from the result for argument index `0`; object property order has no effect.

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
    url: japanese ? '/ja/workbook/formula-engine' : '/workbook/formula-engine',
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

The Mac ribbon opens these dialogs. A host-owned toolbar can dispatch the listed command through `ToolbarInstance.applyCommand(id)`; framework adapters expose the toolbar instance through `onToolbarReady`. The boolean return value reports whether a handler matched. Goal Seek, Consolidate, and Subtotal check the instance policy before changing workbook data.

| Ribbon route | Command ID | Supported behavior and limits |
| --- | --- | --- |
| Data → What-If Analysis → Goal Seek | `mac.data.goalSeek` | Iterative solve with at most 100 iterations. |
| Data → Consolidate | `mac.data.consolidate` | `sum`, `average`, `count`, `min`, or `max`; the combined source area is limited to 100,000 cells. |
| Data → Subtotal | `mac.data.subtotal` | Active sheet only; up to 100,000 input rows, 100,000 output cells, and 1,000 groups. The engine must support `SUBTOTAL`, objects that the operation cannot process are rejected, and the output needs room. |
| Insert → Sparkline | `mac.insert.sparkline` | Rectangular source range, one-cell destination, and `line`, `column`, or `win-loss` kinds. |
| Insert → Slicer | `mac.insert.slicer` | Requires an existing workbook table and one of its columns. |
| Review → Workbook Statistics | `mac.review.stats` | Counts sheets, populated cells, formulas, numbers, text, booleans, errors, tables, comments, hyperlinks, used rows, and used columns; it recounts when opened. |

Subtotal and other Mac data changes remain policy-controlled and undoable. See [Options](/cell/options), [API surface](/cell/api), [Modals and dialogs](/cell/modals), and [Embedding](/cell/embedding) for host policy, overlay, and helper details.

## Related pages

- [Options](/cell/options) — profile, platform, feature, and policy resolution.
- [API surface](/cell/api) — resolver types, ribbon models, and host helpers.
- [React and Vue adapters](/cell/frameworks) — adapter props and event boundaries.
- [Hooks and composables](/cell/hooks) — multi-range state in host panels.
- [Demo](/cell/demo) — switch the demo header between Default, Mac, and Auto.
