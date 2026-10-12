---
title: React and Vue adapters
description: Use formulon-cell from React or Vue with the same UI options, host hooks, and events as the core package.
---

# React and Vue adapters

`@libraz/formulon-cell-react` and `@libraz/formulon-cell-vue` provide the `Spreadsheet` component and small state hooks or composables. React exports `SpreadsheetToolbar` from its package root; Vue exposes the toolbar as the `@libraz/formulon-cell-vue/toolbar.vue` subpath. They mount the same core spreadsheet surface, so the options described in [Embedding](/cell/embedding) also apply here.

## A complete React mount

Import the core stylesheet once in the application. Give the component a height through its parent; the grid fills the available space.

```tsx
import '@libraz/formulon-cell/styles.css'
import {
  Spreadsheet,
  fixedFormPolicy,
  type ContextMenuOptions,
  type SpreadsheetUiOptions,
  type ViewportOptions,
} from '@libraz/formulon-cell-react'

// Module constants keep the prop references stable across renders.
const formRange = { sheet: 0, r0: 0, c0: 0, r1: 20, c1: 3 }
const ui: SpreadsheetUiOptions = {
  profile: 'embedded',
  theme: 'paper',
  features: { shortcuts: true, clipboard: true },
}
const policy = fixedFormPolicy([formRange])
const viewport: ViewportOptions = {
  range: formRange,
  tabNavigation: 'editable',
  tabBoundary: 'stop',
}
const contextMenu: ContextMenuOptions = { mode: 'disabled' }

export function OrderForm() {
  return (
    <div className="cell-frame">
      <Spreadsheet
        ui={ui}
        policy={policy}
        viewport={viewport}
        contextMenu={contextMenu}
        onReady={(instance) => console.log('spreadsheet ready', instance)}
        onChangeBatch={(event) => console.log('applied batch', event.revision)}
        onCellChange={(event) => console.log('draft changed', event.addr, event.value)}
      />
    </div>
  )
}
```

```css
.cell-frame {
  height: 560px;
  min-height: 0;
}

.cell-frame > * {
  height: 100%;
}
```

`onReady` receives the live `SpreadsheetInstance`. Keep it when an outer button, save action, or host dialog needs to call methods such as `applyChanges()`, `print()`, or `openFindReplace()`. `policy` controls what a user may edit, while `viewport` controls the visible and navigable area; using both is useful for forms embedded in a larger screen.

The adapter applies prop changes to the mounted instance by calling the matching setter, so changing `workbook`, `ui`, `toolbar`, `theme`, `locale`, `strings`, `features`, `extensions`, `policy`, `viewport`, `contextMenu`, `overlays`, the printer props, or the status props does not remount. Pass stable object references (state, `useMemo`, or a module constant): a new object literal on every render counts as a change and re-applies the setting.

A changed `locale` prop calls `instance.setLocale()`. When that call is rejected, for example because an edit or dialog is open, React reports it through `onError` and `onLocaleChange` with the locale that stayed active; see [Language switching](/cell/language-switching#change-language-from-the-host).
## A complete Vue mount

The Vue package exposes the same options as props and the same lifecycle surface as kebab-case events.

```vue
<script setup lang="ts">
import '@libraz/formulon-cell/styles.css'
import {
  fixedFormPolicy,
  Spreadsheet,
  type CellChangeEvent,
  type ContextMenuOptions,
  type SpreadsheetUiOptions,
  type ViewportOptions,
} from '@libraz/formulon-cell-vue'

// Constants in setup keep the prop references stable across re-renders.
const formRange = { sheet: 0, r0: 0, c0: 0, r1: 20, c1: 3 }
const ui: SpreadsheetUiOptions = {
  profile: 'embedded',
  theme: 'paper',
  features: { shortcuts: true, clipboard: true },
}
const policy = fixedFormPolicy([formRange])
const viewport: ViewportOptions = { range: formRange, tabNavigation: 'editable', tabBoundary: 'stop' }
const contextMenu: ContextMenuOptions = { mode: 'disabled' }

function saveDraft(event: CellChangeEvent) {
  console.log('draft changed', event.addr, event.value)
}
</script>

<template>
  <div class="cell-frame">
    <Spreadsheet
      :ui="ui"
      :policy="policy"
      :viewport="viewport"
      :context-menu="contextMenu"
      @cell-change="saveDraft"
      @change-batch="(event) => console.log(event.status)"
    />
  </div>
</template>

<style>
.cell-frame {
  height: 560px;
  min-height: 0;
}

.cell-frame > * {
  height: 100%;
}
</style>
```

`ref` on the component exposes `{ instance }`. Use it when a parent action must call the imperative API. The `ready` event is the convenient place to store the instance for application state.

## Component options

Both adapters forward these options to `Spreadsheet.mount()`:

| Option | Typical use |
| --- | --- |
| `ui` | Choose `embedded`, `minimal`, `standard`, `excel365`, or `full`, set a theme, and choose a `platform` of `default`, `mac`, or `auto`. |
| `theme` | Override `ui.theme` with `paper`, `ink`, `contrast`, or a custom name. |
| `toolbar` | Mount the ribbon in the component, or pass toolbar options. Omitted follows the `ui` profile; with no `ui`, no ribbon. See [Ribbon toolbar](/cell/toolbar). |
| `policy` | Create a read-only viewer or restrict edits to form cells. |
| `viewport` | Limit the visible area and configure Tab navigation. |
| `contextMenu` | Keep the built-in menu, transform its items, or hand it to the host. |
| `overlays` | Keep menus and dialogs inside a modal or fullscreen root. |
| `workbook` | Mount a workbook loaded or prepared by the host. |
| `getWorkbookName` | Return the current workbook name for the Watch Window; the callback is read live and may return `string`, `null`, or `undefined`. |
| `locale`, `strings` | Set the UI language and override labels. Use `ui.features.localeSwitcher` for the optional built-in selector. |
| `features`, `extensions` | Toggle built-in UI and add selected extensions. |
| `getFunctionArgumentHelp` | Supply typed argument labels, descriptions, or reference URLs to the Mac palette. |
| `functions` | Register host functions for formula autocomplete and `instance.formula`; see [Custom cells and host functions](/cell/custom-cells#host-functions). |
| `seed` | Fill a component-created workbook before the first render. |
| `printerProfiles`, `printerProfileId`, `refreshPrinterProfiles` | Connect printing to native or Electron printer data. |
| `captureScreenClip` | Supply a host screenshot picker for Screen Clipping. |
| `uploadStatus`, `macroRecording` | Drive optional status-bar indicators. |

The React component additionally accepts `className`, `style`, `onReady`, `onError`, `errorFallback`, a `ref` (a `SpreadsheetRef` with `instance`), and `children` (nodes, or a function that receives the live instance). Vue accepts `class`, `style`, the `ready` and `error` events, and an `error-fallback` function.

## Events and hooks

React event props and Vue emits cover the same events:

| React | Vue | Use it for |
| --- | --- | --- |
| `onChangeBatch` | `change-batch` | React to an applied cell batch from a host update or user action. |
| `onCellChange` | `cell-change` | Mirror a changed cell into draft state or analytics. |
| `onSelectionChange` | `selection-change` | Update a side panel or field inspector. |
| `onWorkbookChange` | `workbook-change` | Refresh host state after a workbook replacement. |
| `onLocaleChange` | `locale-change` | Persist the selected UI locale. |
| `onThemeChange` | `theme-change` | Persist or coordinate the host theme. |
| `onRecalc` | `recalc` | Update a save indicator or derived host view. |

React hooks and Vue composables connect selection, derived display values, change events, and language settings to host controls. The [Hooks and composables guide](/cell/hooks) includes a selection inspector, edit indicators, shared language controls, and rejected-edit feedback.

The `selection-change` event contains only the active cell, anchor, and primary range. Use `useSelection()` or `useSpreadsheet()` to read `state.selection.extraRanges` when a host panel needs all disjoint ranges.

## The toolbar component {#toolbar-component}

`SpreadsheetToolbar` mounts the ribbon outside the `Spreadsheet` component; [Ribbon toolbar](/cell/toolbar) covers its props, the inline `toolbar` option, and styling.

## Mount errors and framework fallbacks

`onError`/`error` runs when an instance cannot be mounted. React can render a node or render function with `errorFallback`; Vue can return a VNode from `error-fallback`. The host can use this to show a mount failure message with a retry control without querying the generated DOM.

```tsx
<Spreadsheet
  onError={(error) => reportMountError(error)}
  errorFallback={(error) => <MountError error={error} />}
/>
```

## Read next

- [Hooks and composables](/cell/hooks) — selection, edit notifications, and shared language controls.
- [Language switching](/cell/language-switching) — the host API, optional selector, formula profile, and rollback behavior.
- [Embedding](/cell/embedding) — vanilla mounting, options, and modal placement.
- [Platform and Mac UI](/cell/platform) — platform selection, Mac ribbon, and argument help.
- [Ribbon toolbar](/cell/toolbar) — `SpreadsheetToolbar`, the inline ribbon, and dropdown handlers.
- [Host integration](/cell/host-integration) — saving, status indicators, printing, and host callbacks.
- [Internationalization](/cell/i18n) — runtime locale and string overrides.
