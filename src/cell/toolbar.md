---
title: Ribbon toolbar
description: Mount the formulon-cell ribbon inside the spreadsheet host or in a separate element, and connect its tabs, dropdowns, and commands to the host application.
---

# Ribbon toolbar

Pass `toolbar` to `Spreadsheet.mount()` and the ribbon is mounted in the same call, above the formula bar:

```ts
import '@libraz/formulon-cell/styles.css'
import { EXCEL365_STANDARD_RIBBON_TABS, Spreadsheet, type RibbonTab } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(host, {
  ui: { profile: 'excel365' },
  toolbar: {
    ribbonTabs: EXCEL365_STANDARD_RIBBON_TABS,
    activeTab: (localStorage.getItem('ribbon-tab') as RibbonTab | null) ?? 'home',
    onTabChange: (tab) => localStorage.setItem('ribbon-tab', tab),
  },
})

instance.toolbar?.setActiveTab('data')
```

`toolbar: true` uses the defaults. An options object is a `MountToolbarOptions`, the same type `Spreadsheet.mountToolbar()` takes. The mounted ribbon is available as `instance.toolbar`, a `ToolbarInstance`; it is `null` when no ribbon is mounted. When `toolbar` is omitted, the `ui` profile decides whether a ribbon appears; see [Options](/cell/options#ui-profile-and-feature-switches).

Like the rest of formulon-cell, the ribbon is beta. Its tabs follow a desktop spreadsheet, but individual commands, dropdowns, and keyboard behavior are not guaranteed to match one. Evaluate it as an integration surface for your application rather than a finished end-user toolbar.

## Inline or separate ribbon

| | Inline: `toolbar` mount option | Separate: `Spreadsheet.mountToolbar()` |
| --- | --- | --- |
| Placement | First child of the spreadsheet host, above the formula bar. | Any element the host owns, such as a title bar or an application header. |
| Handle | `instance.toolbar` | The returned `ToolbarInstance`. |
| Runtime changes | `instance.setToolbar(next)` disposes the ribbon and mounts it again; `false` removes it. | Call `dispose()` and mount again. |
| Dropdown menus | On while no interaction policy is active; `setPolicy()` rebuilds the ribbon to match. | Off until you pass `dynamicDropdowns`. |
| Accent color | Follows the grid's `--fc-accent`. | Uses the toolbar defaults; set `--fc-tb-*` on a wrapper. |
| Disposal | Released by `instance.dispose()`. | Call `toolbar.dispose()` before disposing the instance. |

Use the separate form when the ribbon belongs somewhere else in the layout:

```ts
import { EXCEL365_STANDARD_RIBBON_TABS, Spreadsheet } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(sheetHost, { ui: { profile: 'excel365' }, toolbar: false })
const toolbar = Spreadsheet.mountToolbar(toolbarHost, instance, {
  ribbonTabs: EXCEL365_STANDARD_RIBBON_TABS,
  dynamicDropdowns: true,
  onCommand: (id, applied) => {
    if (!applied) handleHostCommand(id)
  },
})

function close() {
  toolbar.dispose()
  instance.dispose()
}
```

`mountToolbar(host, instance, options)` throws when `host` or `instance` is missing. The second argument may also be a getter, `() => SpreadsheetInstance | null`, so the ribbon can render before an asynchronous mount finishes. The getter is read on every dispatch; call `toolbar.rerender()` once it starts returning the instance so the ribbon subscribes to that instance's state.

The ribbon shell is a flex item. The framework components render a `display: contents` wrapper so the ribbon takes part in the parent's flex column; give a vanilla `toolbarHost` the same treatment, or make it a flex column itself.

## React and Vue components

React exports `SpreadsheetToolbar` from `@libraz/formulon-cell-react`. Vue publishes it as a single-file component under the `@libraz/formulon-cell-vue/toolbar.vue` subpath, so it compiles with the application's own Vue pipeline. Both wrap `Spreadsheet.mountToolbar()` and take the instance from `onReady` or the `ready` event.

::: code-group

```ts [Vanilla]
import { EXCEL365_STANDARD_RIBBON_TABS, Spreadsheet } from '@libraz/formulon-cell'

const instance = await Spreadsheet.mount(sheetHost, { ui: { profile: 'excel365' }, toolbar: false })
const toolbar = Spreadsheet.mountToolbar(toolbarHost, instance, {
  activeTab: 'home',
  ribbonTabs: EXCEL365_STANDARD_RIBBON_TABS,
  dynamicDropdowns: { applyProtectAction: (action) => openProtectDialog(action) },
  hooks: { review: { spelling: () => openSpellChecker() } },
  onTabChange: (tab) => saveActiveTab(tab),
})
```

```tsx [React]
import { useState } from 'react'
import {
  EXCEL365_STANDARD_RIBBON_TABS,
  Spreadsheet,
  SpreadsheetToolbar,
  type RibbonTab,
  type SpreadsheetInstance,
  type ToolbarInstance,
} from '@libraz/formulon-cell-react'

// Module constants keep the references stable; a new object re-mounts the ribbon.
const ui = { profile: 'excel365' } as const
const dropdownActions = {
  applyProtectAction: (action: string) => openProtectDialog(action),
}

export function Editor() {
  const [instance, setInstance] = useState<SpreadsheetInstance | null>(null)
  const [tab, setTab] = useState<RibbonTab>('home')
  const [toolbar, setToolbar] = useState<ToolbarInstance | null>(null)

  return (
    <div className="editor">
      <SpreadsheetToolbar
        instance={instance}
        activeTab={tab}
        onTabChange={setTab}
        locale="en"
        ribbonTabs={EXCEL365_STANDARD_RIBBON_TABS}
        dropdownActions={dropdownActions}
        onSpellingReview={() => openSpellChecker()}
        onToolbarReady={setToolbar}
      />
      <Spreadsheet ui={ui} toolbar={false} onReady={setInstance} />
    </div>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { shallowRef, ref } from 'vue'
import {
  EXCEL365_STANDARD_RIBBON_TABS,
  Spreadsheet,
  type RibbonTab,
  type SpreadsheetInstance,
} from '@libraz/formulon-cell-vue'
import SpreadsheetToolbar from '@libraz/formulon-cell-vue/toolbar.vue'

const ui = { profile: 'excel365' } as const
const dropdownActions = {
  applyProtectAction: (action: string) => openProtectDialog(action),
}
const instance = shallowRef<SpreadsheetInstance | null>(null)
const tab = ref<RibbonTab>('home')
</script>

<template>
  <div class="editor">
    <SpreadsheetToolbar
      :instance="instance"
      :active-tab="tab"
      locale="en"
      :ribbon-tabs="EXCEL365_STANDARD_RIBBON_TABS"
      :dropdown-actions="dropdownActions"
      :on-spelling-review="openSpellChecker"
      @tab-change="tab = $event"
    />
    <Spreadsheet :ui="ui" :toolbar="false" @ready="instance = $event" />
  </div>
</template>
```

:::

`instance`, `activeTab`, and `locale` are required; React also requires `onTabChange`, and Vue reports tab changes as the `tab-change` event. `instance` may be `null` until the spreadsheet is ready. The optional props are:

| Prop | Use |
| --- | --- |
| `ribbonTabs` | The tab set; see [Tabs and display](#tabs-and-display). |
| `dropdownActions` | Replace individual dropdown handlers; see [Dropdown handlers](#dropdown-handlers). |
| `onToolbarReady` | Receives the `ToolbarInstance`, and `null` when the ribbon is torn down or fails to mount. |
| `onError` | Called when the ribbon fails to mount. Vue also emits `error`. |
| `onSpellingReview`, `onAccessibilityCheck`, `onTranslate`, `onRunScript`, `onAddIn`, `onDrawPen`, `onDrawEraser` | Host callbacks; see [Host callbacks](#host-callbacks). |

The components set the ribbon language from `locale` and mount again when `instance`, `locale`, `dropdownActions`, or `ribbonTabs` changes. A changed `activeTab` is forwarded to `setActiveTab()` without a re-mount. Pass `dropdownActions` and `ribbonTabs` as stable references (a module constant, `useMemo`, or a value defined once in `setup`).

## MountToolbarOptions

Every field is optional, so `{}` is a valid options object.

### Platform and labels

| Field | Meaning |
| --- | --- |
| `platform` | `default`, `mac`, or `auto`. When omitted, the toolbar inherits `data-fc-platform` from its host, the nearest `.fc-host`, or the instance host, and follows later platform changes on the instance. |
| `lang` | Locale for built-in ribbon labels. Defaults to the instance locale and follows `setLocale()`; an explicit `lang` stays fixed. |
| `text`, `menuText` | Replace the derived `ToolbarText` (button titles, group names) and `ToolbarMenuText` (dropdown labels). |

### Tabs and initial state

| Field | Default | Meaning |
| --- | --- | --- |
| `activeTab` | `'home'` | Initial `RibbonTab`. A tab outside the tab set falls back to the first tab. |
| `ribbonTabs` | see [Tabs and display](#tabs-and-display) | The tab set to render. |
| `ribbonDisplayMode` | `'full'` | `full`, `singleLine`, `tabsOnly`, or `autoHide`. |
| `collapsed` | `false` | Shorthand for `tabsOnly` when `ribbonDisplayMode` is omitted. |
| `formulaBarVisible` | `true` | Initial state of the View tab's formula bar toggle. |
| `theme` | `'paper'` | The ribbon's own `paper`, `ink`, or `contrast` state, reported through `onThemeChange`. Change the spreadsheet theme with `instance.setTheme()`. |
| `borderStyle`, `borderColor` | `'thin'`, `'#000000'` | Initial line style and color for the borders menu. |

### Command wiring

| Field | Meaning |
| --- | --- |
| `hooks` | `RibbonHooks` groups for commands that call into host or feature code: `clipboard`, `sortFilter`, `insert`, `page`, `drawing`, `review`, `protection`, `automation`, `formula`, `sheetView`. Each group is merged over the built-in group, so a host can replace one handler and keep the rest. |
| `dynamicDropdowns` | Turn on the built-in dropdown menus: `true` for the defaults, a partial `DynamicDropdownsCtx` to replace individual handlers, or a function returning that partial for a context built after mount. |
| `interceptCommand(id, button, event)` | Runs before a command is dispatched. Return `true` to mark it handled and skip the built-in dispatch. |
| `commandDelegation` | Set `false` when the host handles `[data-ribbon-command]` clicks itself. Tab and display-option clicks are always handled. |
| `menus` | `RibbonMenus` submenu factories, merged over the defaults. |
| `helpers` | A partial `RibbonRenderHelpers` to replace one renderer factory, such as the color picker. |
| `createBackstageView` | Returns the element shown while the backstage is open. |

### Runtime hooks

`focusSheet`, `refreshCells`, `refreshZoom`, `showMessage`, and `applyRibbonFormat` replace steps the dispatcher runs around a command. By default `focusSheet` focuses the spreadsheet host, `applyRibbonFormat` records the format change in the instance history, and the other three do nothing. `projectFormatToolbar` is called after the ribbon updates its active-state buttons, for hosts that mirror that state elsewhere. Most hosts leave all six unset.

### Callbacks

| Callback | Fires after |
| --- | --- |
| `onTabChange(tab)` | The active tab changes. |
| `onCollapsedChange(collapsed)` | The ribbon switches between expanded and collapsed display modes. |
| `onDisplayModeChange(mode)` | The display mode changes. |
| `onBackstageOpenChange(open)` | `setBackstageOpen()` changes the backstage state. |
| `onThemeChange(theme)` | The ribbon's theme state changes. |
| `onFormulaBarChange(visible)` | The formula bar toggle changes. |
| `onCommand(id, applied)` | A command was dispatched. `applied` is `false` when no built-in handler matched, which lets the host handle its own command IDs as a fallback. |

The backstage opens only through `toolbar.setBackstageOpen(true)`; selecting the File tab on its own does not open it. A host with a file menu can connect the two:

```ts
const toolbar = Spreadsheet.mountToolbar(toolbarHost, instance, {
  createBackstageView: () => buildFileMenu({ onClose: () => toolbar.setBackstageOpen(false) }),
  onTabChange: (tab) => {
    if (tab === 'file') toolbar.setBackstageOpen(true)
  },
})
```

Without `createBackstageView`, an open backstage shows an empty element.

## ToolbarInstance {#toolbarinstance}

| Member | Use |
| --- | --- |
| `host` | The element the ribbon was mounted into. |
| `instance` | The current `SpreadsheetInstance`, or `null` while a getter returns `null`. |
| `applyCommand(id)` | Dispatch a ribbon command ID through the same path as a click. Returns `true` when a handler matched. A command the interaction policy denies also returns `true`, without running. |
| `focusActiveTab()` | Focus the active tab button, for F6-style landmark cycling. Returns whether focus moved. |
| `setActiveTab(tab)`, `getActiveTab()` | Change or read the active tab. A tab that is not rendered is ignored. |
| `setDisplayMode(mode)`, `getDisplayMode()` | Change or read the display mode. |
| `setCollapsed(collapsed)`, `getCollapsed()` | Switch between `tabsOnly` and `full`; `getCollapsed()` is also `true` in `autoHide`. |
| `setBackstageOpen(open)`, `getBackstageOpen()` | Show or hide the backstage view. |
| `setDisplayMenuOpen(open)` | Open or close the ribbon display options menu. |
| `setFormulaBarVisible(visible)`, `getFormulaBarVisible()` | Update the formula bar toggle state. |
| `setTheme(theme)`, `getTheme()` | Update the ribbon's theme state. |
| `setBorderStyle(style)`, `getBorderStyle()`, `setBorderColor(color)`, `getBorderColor()` | Border menu state. |
| `dropdownsApi` | The dropdown controller when `dynamicDropdowns` is on, otherwise `null`. |
| `rerender()` | Rebuild the ribbon. Use it after a getter starts returning an instance; selection and format changes update the ribbon without it. |
| `dispose()` | Remove listeners, restore the host's `lang` and `data-fc-platform`, and clear the host element. |

Users can also change the display mode by double-clicking the active tab or pressing `Ctrl+F1`. Arrow keys, `Home`, and `End` move between tabs.

## Tabs and display {#tabs-and-display}

`RibbonTab` is one of `file`, `home`, `insert`, `draw`, `pageLayout`, `formulas`, `data`, `review`, `view`, `help`, `automate`, and `acrobat`. The package exports these tab sets:

| Constant | Tabs |
| --- | --- |
| `EXCEL365_STANDARD_RIBBON_TABS` | File, Home, Insert, Page Layout, Formulas, Data, Review, View, Help. |
| `OPTIONAL_RIBBON_TABS` | Draw, Automate, Acrobat. |
| `RIBBON_TABS` | The standard set followed by the optional tabs. |
| `EXCEL365_MAC_RIBBON_TABS` | Home, Insert, Draw, Page Layout, Formulas, Data, Review, View, Automate. |

When `ribbonTabs` is omitted, the default platform renders `RIBBON_TABS` and the Mac platform renders `EXCEL365_MAC_RIBBON_TABS`. Pass `EXCEL365_STANDARD_RIBBON_TABS` and append optional tabs only when the host has wired what they need. An explicit `ribbonTabs` also replaces the Mac tab set. Tabs render in the order of the array, and keyboard navigation skips tabs that are hidden or disabled.

`buildRibbonModel(lang, { tabs, profile })` returns the same model the ribbon renders: tabs with an `id` and `label`, groups with a `title`, and commands with an `id`, `label`, `title`, and optional `disabledReason`. `profile` is a `RibbonProfile`, either `default` or `excel365Mac`. Use it to build a host-owned command palette or to look up the command IDs to pass to `applyCommand()`:

```ts
import { buildRibbonModel, type RibbonProfile } from '@libraz/formulon-cell'

const profile: RibbonProfile = 'excel365Mac'
const commands = buildRibbonModel('en', { profile }).flatMap((tab) =>
  tab.groups.flatMap((group) => group.commands.map((command) => command.id)),
)
```

## Dropdown handlers {#dropdown-handlers}

Dropdown menus such as Paste, Fill, Clear, Sort & Filter, and Protect run handlers from a `DynamicDropdownsCtx`. Override one with a partial object: `dynamicDropdowns` in `mountToolbar()` and the inline `toolbar` option, or `dropdownActions` on the framework components. Keys you do not pass keep the built-in handler; `createDefaultDynamicDropdownsCtx()` returns the full default context.

```ts
const toolbar = Spreadsheet.mountToolbar(toolbarHost, instance, {
  dynamicDropdowns: {
    // 'protect-sheet', 'unprotect-sheet', 'protect-workbook', 'unprotect-workbook', 'allow-edit-ranges'
    applyProtectAction: (action) => openProtectDialog(action),
  },
})
```

The handler names follow the menus: `applyCopyAction`, `applyRibbonPasteAction`, `applyFillSeries`, `applyClearAction`, `applySortMenuAction`, `applyProtectAction`, `applyCalcOptionAction`, `applyScriptAction`, `insertPictureFromRibbon`, `createTableFromSelection`, and so on. The `DynamicDropdownsCtx` type declaration lists them all.

The inline ribbon leaves dropdowns off while an interaction policy is active. A mounted ribbon also disables the commands the active policy denies; see [Options](/cell/options#interaction-policy).

## Host callbacks {#host-callbacks}

The framework components route a few ribbon buttons to props:

| Prop | Ribbon command | Core hook |
| --- | --- | --- |
| `onSpellingReview` | Review → Spelling | `hooks.review.spelling` |
| `onAccessibilityCheck` | Review → Check Accessibility | `hooks.review.accessibility` |
| `onTranslate` | Review → Translate | `hooks.review.translate` |
| `onDrawPen`, `onDrawEraser` | Draw → Pen, Eraser on the default platform | `hooks.drawing.setInkMode()` with `'pen'` or `'erase'` |
| `onRunScript` | The custom-script item in the Automate script menu | `applyScriptAction('custom')` |
| `onAddIn` | Manage in the add-ins menu | `applyAddInAction('manage')` |

The components replace the core hook with the prop, so a button whose prop is omitted does nothing. With vanilla `mountToolbar()`, Spelling, Translate, and Check Accessibility keep their built-in handlers, which show a report for the selected cells; pass `hooks.review` to replace them. The Script and Add-ins buttons open their menu first, and the callback runs when the user picks the matching item. A `dropdownActions` entry for `applyScriptAction` or `applyAddInAction` takes precedence over these props.

## Platform differences {#platform-differences}

On the Mac platform the ribbon uses `EXCEL365_MAC_RIBBON_TABS`, which has no File or Help tab and includes Draw and Automate. Mac commands use IDs in the `mac.` namespace, such as `mac.data.goalSeek`, `mac.insert.sparkline`, `mac.review.stats`, and `mac.formulas.insertFunction`. `applyCommand()` dispatches them like any other ID, and many of them reuse the default command behind them.

```ts
instance.toolbar?.applyCommand('mac.data.goalSeek')
```

The Mac Draw tab keeps its ink in the mounted session; the `drawing` hook and the `onDrawPen` / `onDrawEraser` props apply to the default platform's Draw tab. [Platform and Mac UI](/cell/platform#mac-ribbon-dialogs) lists the Mac dialogs, their command IDs, and their limits.

## Styling {#styling}

`@libraz/formulon-cell/styles.css` imports the ribbon stylesheet along with the grid and themes, so most applications need nothing else. `@libraz/formulon-cell/styles/toolbar.css` is the ribbon stylesheet alone. The adapters' `@libraz/formulon-cell-react/toolbar.css` and `@libraz/formulon-cell-vue/toolbar.css` re-export that file for applications that list their stylesheets per package.

The ribbon reads its own `--fc-tb-*` tokens. Under `.fc-host`, which covers the inline ribbon, `--fc-tb-accent` and `--fc-tb-accent-strong` follow the grid's `--fc-accent` and `--fc-accent-strong`, so one brand override themes both. A separate toolbar keeps the toolbar defaults; set the tokens on its wrapper:

```css
.app-toolbar {
  --fc-tb-accent: #0f766e;
  --fc-tb-accent-strong: #115e59;
  --fc-tb-ribbon-bg: #ffffff;
  --fc-tb-ribbon-hover: #f0fdfa;
}
```

The `ink` and `contrast` themes supply their own `--fc-tb-*` values through `data-fc-theme`. [Theming](/cell/theming) covers the grid tokens.

## Related pages

- [Options](/cell/options) — when the ribbon appears, and how a policy restricts it.
- [Platform and Mac UI](/cell/platform) — the Mac ribbon, its dialogs, and their limits.
- [React and Vue adapters](/cell/frameworks) — the `Spreadsheet` component props.
- [Embedding](/cell/embedding) — host-owned controls without the ribbon.
- [Theming](/cell/theming) — themes and grid tokens.
