---
title: React and Vue adapters
description: Use formulon-cell from React or Vue with the same UI options, host hooks, and events as the core package.
---

# React and Vue adapters

`@libraz/formulon-cell-react` and `@libraz/formulon-cell-vue` provide the `Spreadsheet` component, a separate toolbar component, and small state hooks or composables. They mount the same core spreadsheet surface, so the options described in [Embedding](/cell/embedding) also apply here.

## A complete React mount

Import the core stylesheet once in the application. Give the component a height through its parent; the grid fills the available space.

```tsx
import '@libraz/formulon-cell/styles.css'
import '@libraz/formulon-cell-react/toolbar.css'
import {
  Spreadsheet,
  fixedFormPolicy,
} from '@libraz/formulon-cell-react'

const formRange = { sheet: 0, r0: 0, c0: 0, r1: 20, c1: 3 }

export function OrderForm() {
  return (
    <div className="cell-frame">
      <Spreadsheet
        ui={{
          profile: 'embedded',
          theme: 'paper',
          features: { shortcuts: true, clipboard: true },
        }}
        policy={fixedFormPolicy([formRange])}
        viewport={{
          range: formRange,
          tabNavigation: 'editable',
          tabBoundary: 'stop',
        }}
        contextMenu={{ mode: 'disabled' }}
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

The adapter applies prop changes to the mounted instance. Changing `theme`, `locale`, `strings`, `ui`, `features`, `extensions`, `policy`, `viewport`, `contextMenu`, `overlays`, or host status props does not require a remount.

When `policy` is active, built-in UI is limited to the formula bar, clipboard, shortcuts, wheel scrolling, and context menu even when other feature flags are true. See [Options](/cell/options#interaction-policy) for the policy and UI relationship.

## A complete Vue mount

The Vue package exposes the same options as props and the same lifecycle surface as kebab-case events.

```vue
<script setup lang="ts">
import '@libraz/formulon-cell/styles.css'
import '@libraz/formulon-cell-vue/toolbar.css'
import { fixedFormPolicy, Spreadsheet } from '@libraz/formulon-cell-vue'

const formRange = { sheet: 0, r0: 0, c0: 0, r1: 20, c1: 3 }

function saveDraft(event: { addr: unknown; value: unknown }) {
  console.log('draft changed', event.addr, event.value)
}
</script>

<template>
  <div class="cell-frame">
    <Spreadsheet
      :ui="{ profile: 'embedded', theme: 'paper', features: { shortcuts: true, clipboard: true } }"
      :policy="fixedFormPolicy([formRange])"
      :viewport="{ range: formRange, tabNavigation: 'editable', tabBoundary: 'stop' }"
      :context-menu="{ mode: 'disabled' }"
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
| `ui` | Choose `embedded`, `minimal`, `standard`, or `full` and set a theme. |
| `toolbar` | Mount the ribbon in the component, or pass toolbar options. |
| `policy` | Create a read-only viewer or restrict edits to form cells. |
| `viewport` | Limit the visible area and configure Tab navigation. |
| `contextMenu` | Keep the built-in menu, transform its items, or hand it to the host. |
| `overlays` | Keep menus and dialogs inside a modal or fullscreen root. |
| `workbook` | Mount a workbook loaded or prepared by the host. |
| `locale`, `strings` | Set the UI language and override labels. |
| `features`, `extensions` | Toggle built-in UI and add selected extensions. |
| `functions` | Register host-side formula functions before mount. |
| `printerProfiles`, `refreshPrinterProfiles` | Connect printing to native or Electron printer data. |
| `captureScreenClip` | Supply a host screenshot picker for Screen Clipping. |
| `uploadStatus`, `macroRecording` | Drive optional status-bar indicators. |

The React component additionally accepts `className`, `style`, `children`, `onReady`, `onError`, and `errorFallback`. Vue accepts `class`, `style`, the `ready` and `error` events, and an `error-fallback` function.

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

## The toolbar component

`SpreadsheetToolbar` is useful when the ribbon belongs in a layout separate from the spreadsheet component. Pass the instance received from `onReady` or a component ref.

```tsx
<SpreadsheetToolbar
  instance={instance}
  activeTab={activeTab}
  locale="en"
  onTabChange={setActiveTab}
  onToolbarReady={setToolbar}
  dropdownActions={{
    applyProtectAction: () => openHostDialog('protect'),
  }}
/>
```

Use `toolbar` on `Spreadsheet` when the ribbon should be part of the same host. Use `SpreadsheetToolbar` when the surrounding application owns the layout or title bar. The toolbar component accepts shared tab definitions and callbacks for host actions such as scripts, add-ins, spelling, translation, and drawing.

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
- [Embedding](/cell/embedding) — vanilla mounting, options, and modal placement.
- [Host integration](/cell/host-integration) — saving, status indicators, printing, and host callbacks.
- [Internationalization](/cell/i18n) — runtime locale and string overrides.
