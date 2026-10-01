---
title: Hooks and composables
description: Connect formulon-cell selection, state, events, and labels to React or Vue UI.
---

# Hooks and composables

The React and Vue adapters expose the same four subscriptions for UI around a spreadsheet:

<div class="wide-table cell-hook-table">

| Need | React | Vue |
| --- | --- | --- |
| Show the active cell or range | `useSelection(instance)` | `useSelection(instanceRef)` |
| Derive a value for a host panel | `useSpreadsheet(instance, selector, fallback)` | `useSpreadsheet(instanceRef, selector, fallback)` |
| Follow the active locale and labels | `useI18n(instance)` | `useI18n(instanceRef)` |
| React to a named spreadsheet event | `useSpreadsheetEvent(instance, event, handler)` | `useSpreadsheetEvent(instanceRef, event, handler)` |

</div>

These hooks subscribe to the instance that the adapter mounted. Pass `null` in React, or the same `shallowRef<SpreadsheetInstance | null>` in Vue, while the spreadsheet is mounting. The hooks return fallback values until an instance is ready and switch subscriptions when the instance changes.

The hooks observe state and events. They do not own the spreadsheet or call `dispose()`. The `<Spreadsheet>` adapter disposes its instance when its component leaves the tree. A host that calls `Spreadsheet.mount()` owns that instance and must dispose it at the end of the host view.

<CellEmbedDemo scenario="host-sync" />

## React: selection inspector and edit status

This example puts a spreadsheet and a host-owned inspector in the same component. It combines all four hooks:

- `useSelection` supplies the active cell and the primary selection rectangle.
- `useSpreadsheet` derives the number of cells in that rectangle.
- `useI18n` supplies the locale and the status-bar label for the inspector.
- `useSpreadsheetEvent` updates the inspector after an applied `changeBatch`.

```tsx
import { useState } from 'react'
import {
  Spreadsheet,
  useI18n,
  useSelection,
  useSpreadsheet,
  useSpreadsheetEvent,
  type SpreadsheetInstance,
} from '@libraz/formulon-cell-react'
import '@libraz/formulon-cell/styles.css'

export function SheetWithInspector() {
  const [instance, setInstance] = useState<SpreadsheetInstance | null>(null)
  const [lastEdit, setLastEdit] = useState<string | null>(null)
  const [mountError, setMountError] = useState<string | null>(null)

  // Hooks stay above the render branches. They also work while instance is null.
  const selection = useSelection(instance)
  const selectedCellCount = useSpreadsheet(
    instance,
    (state) => {
      const range = state.selection.range
      return (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1)
    },
    1,
  )
  const { locale, strings } = useI18n(instance)
  useSpreadsheetEvent(instance, 'changeBatch', (result) => {
    if (result.status !== 'applied') return
    const label = strings?.statusBar.cells ?? 'cells'
    setLastEdit(`${result.applied.length} ${label} · revision ${result.revision}`)
  })

  const readyLabel = strings?.statusBar.ready ?? 'Loading spreadsheet…'
  const activeCell = `${selection.active.row + 1}:${selection.active.col + 1}`

  return (
    <section className="sheet-layout">
      <div className="sheet-host">
        <Spreadsheet
          ui={{ profile: 'embedded', features: { shortcuts: true, clipboard: true } }}
          toolbar={false}
          locale="en"
          onReady={setInstance}
          onError={(error) => setMountError(error instanceof Error ? error.message : String(error))}
          style={{ width: '100%', height: 420 }}
        />
      </div>
      <aside className="sheet-inspector" aria-live="polite">
        {instance && strings ? (
          <>
            <strong>{readyLabel}</strong>
            <label>
              Language
              <select value={locale} onChange={(event) => instance.i18n.setLocale(event.target.value)}>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </label>
            <span>Active cell: {activeCell}</span>
            <span>Primary rectangle: {selectedCellCount} cells</span>
            <span>{lastEdit ?? 'No applied edit yet'}</span>
          </>
        ) : !mountError ? (
          <span>Loading spreadsheet…</span>
        ) : null}
        {mountError && <span role="alert">{mountError}</span>}
      </aside>
    </section>
  )
}
```

Give the spreadsheet host a real height. The imported core stylesheet supplies the grid styles; the host layout supplies the space in which the adapter can render it.

```css
.sheet-layout {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.sheet-host {
  min-height: 320px;
  height: 420px;
}

.sheet-inspector {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
```

The hook calls remain unconditional even before `onReady` fires. Keep the spreadsheet component mounted while the inspector changes; conditionally render the inspector contents instead of replacing the `<Spreadsheet>` element after the instance becomes ready.

The count above describes the primary rectangle in `selection.range`. A disjoint selection can also have `selection.extraRanges`; add those ranges explicitly when the host panel needs a total across every selected rectangle.

## Vue: the same inspector as an SFC

Vue composables receive the instance ref itself. Pass `instance` to every composable, never `instance.value`; the composable watches the ref and replaces its subscription when the adapter becomes ready or a new instance is installed.

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watchEffect } from 'vue'
import {
  Spreadsheet,
  useI18n,
  useSelection,
  useSpreadsheet,
  useSpreadsheetEvent,
  type SpreadsheetInstance,
} from '@libraz/formulon-cell-vue'
import '@libraz/formulon-cell/styles.css'

const instance = shallowRef<SpreadsheetInstance | null>(null)
const lastEdit = ref<string | null>(null)
const rejection = ref<string | null>(null)
const mountError = ref<string | null>(null)

const selection = useSelection(instance)
const selectedCellCount = useSpreadsheet(
  instance,
  (state) => {
    const range = state.selection.range
    return (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1)
  },
  1,
)
const { locale, strings } = useI18n(instance)
useSpreadsheetEvent(instance, 'changeBatch', (result) => {
  if (result.status !== 'applied') return
  const label = strings.value.statusBar?.cells ?? 'cells'
  lastEdit.value = `${result.applied.length} ${label} · revision ${result.revision}`
})

// Rejections are command results. They are separate from the applied batch event.
watchEffect((onCleanup) => {
  const current = instance.value
  rejection.value = null
  if (!current) return
  const off = current.commands.subscribe((result) => {
    if (result.status !== 'rejected') {
      if (result.status === 'applied') rejection.value = null
      return
    }
    const first = result.rejected[0]
    rejection.value = first
      ? `${first.code}${first.reason ? `: ${first.reason}` : ''}`
      : 'Edit rejected'
  })
  onCleanup(off)
})

const onReady = (next: SpreadsheetInstance) => {
  instance.value = next
}
const onError = (error: unknown) => {
  mountError.value = error instanceof Error ? error.message : String(error)
}
const changeLocale = (event: Event) => {
  instance.value?.i18n.setLocale((event.target as HTMLSelectElement).value)
}
const readyLabel = computed(() => strings.value.statusBar?.ready ?? 'Loading spreadsheet…')

// Clear the owner-side reference when this view is removed. The adapter still disposes the instance.
onBeforeUnmount(() => {
  instance.value = null
})
</script>

<template>
  <section class="sheet-layout">
    <div class="sheet-host">
      <Spreadsheet
        :ui="{ profile: 'embedded', features: { shortcuts: true, clipboard: true } }"
        :toolbar="false"
        locale="en"
        style="width: 100%; height: 420px"
        @ready="onReady"
        @error="onError"
      />
    </div>
    <aside class="sheet-inspector" aria-live="polite">
      <template v-if="instance">
        <strong>{{ readyLabel }}</strong>
        <label>
          Language
          <select :value="locale" @change="changeLocale">
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </label>
        <span>Active cell: {{ selection.active.row + 1 }}:{{ selection.active.col + 1 }}</span>
        <span>Primary rectangle: {{ selectedCellCount }} cells</span>
        <span>{{ lastEdit ?? 'No applied edit yet' }}</span>
        <span v-if="rejection" role="alert">{{ rejection }}</span>
      </template>
      <span v-else-if="!mountError">Loading spreadsheet…</span>
      <span v-if="mountError" role="alert">{{ mountError }}</span>
    </aside>
  </section>
</template>

<style scoped>
.sheet-layout {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.sheet-host {
  min-height: 320px;
  height: 420px;
}

.sheet-inspector {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
```

Vue templates use kebab-case for component events such as `@change-batch` and `@selection-change`. The event names passed to `useSpreadsheetEvent` are the typed instance names, such as `changeBatch` and `selectionChange`.

## Use case: show rejected edits

`useSpreadsheetEvent(instance, 'changeBatch', handler)` is suitable for an indicator that follows an applied batch. A policy rejection does not become an applied batch. Subscribe to `instance.commands` when the host must show the reason for a denied edit or distinguish `rejected`, `noop`, and `applied` results.

React can bind that subscription to the current instance with an effect:

```tsx
import { useEffect, useState } from 'react'
import type { SpreadsheetInstance } from '@libraz/formulon-cell-react'

export function RejectionNotice({ instance }: { instance: SpreadsheetInstance | null }) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setMessage(null)
    if (!instance) return
    return instance.commands.subscribe((result) => {
      if (result.status !== 'rejected') {
        if (result.status === 'applied') setMessage(null)
        return
      }
      const first = result.rejected[0]
      setMessage(first ? `${first.code}: ${first.reason ?? 'Edit rejected'}` : 'Edit rejected')
    })
  }, [instance])

  return message ? <p role="alert">{message}</p> : null
}
```

The Vue equivalent uses `watchEffect` and `onCleanup`, as shown in the complete SFC above. If the host issues a command itself, inspect the returned `ChangeBatchResult` from `instance.commands.execute(command)` and use the same `status` and `rejected` fields.

## Use case: localized host controls

Use `useI18n` when a host-owned panel should follow `instance.i18n.setLocale()` or label extensions. The returned dictionary is the same dictionary used by the spreadsheet UI, so a host control can share the active locale without maintaining a second locale subscription.

```tsx
const { locale, strings } = useI18n(instance)

return (
  <label>
    {locale === 'ja' ? '言語' : 'Language'}
    <select
      disabled={!instance}
      value={locale}
      onChange={(event) => instance?.i18n.setLocale(event.target.value)}
    >
      <option value="en">English</option>
      <option value="ja">日本語</option>
    </select>
    <span>{strings?.statusBar.ready}</span>
  </label>
)
```

Use a fallback while `strings` is `null` in React. In Vue, the composable returns an empty fallback dictionary until the instance is ready, so guard nested labels in a template or computed value.

## Use case: derive a host view from spreadsheet state

Use `useSpreadsheet` when the panel needs a small derived value rather than the whole store. The selector runs again when the spreadsheet store changes, and the fallback is used while no instance is available.

```tsx
const activeSheet = useSpreadsheet(instance, (state) => state.data.sheetIndex, 0)
const primaryRange = useSpreadsheet(instance, (state) => state.selection.range, {
  sheet: 0,
  r0: 0,
  c0: 0,
  r1: 0,
  c1: 0,
})
```

Select only what the panel renders. Keep formula values and workbook operations on `SpreadsheetInstance`; use the hook for a reactive display value.

## Which subscription should own the work?

Use the narrowest boundary that matches the task:

- Use `useSelection`, `useSpreadsheet`, or `useI18n` when a host component must re-render from current spreadsheet state.
- Use `useSpreadsheetEvent` for a named event that triggers a side effect in the component, such as an applied edit counter or a recalculation notice.
- Use `onReady`, `onError`, and the adapter's event props for a small mount-boundary callback. In Vue templates, use the adapter's kebab-case event spelling.
- Use `instance.on(event, handler)` for a service or host controller that lives outside a React or Vue component. Keep the returned disposer and call it when that service stops.

Do not wire the same event through both a hook and an adapter prop unless two independent consumers need it. Hooks clean up their own subscriptions when the component scope ends or when the instance changes. They never replace the owner-side `instance.dispose()` call.

Outside a component, call the disposer when the observer stops:

```ts
const offSelection = instance.on('selectionChange', (event) => {
  console.log('selection changed', event.range)
})

function stopWatching() {
  offSelection()
}
```

If a view replaces its spreadsheet instance, update the owner-side instance reference at the same time. React hooks resubscribe on the new object; Vue composables watch the ref and dispose the old subscription before attaching the new one.

The observer owns its subscription. The mount owner disposes the instance and manages any caller-supplied workbook separately. See [embedding and cleanup](./embedding).

Related: [React and Vue setup](./frameworks), [host integration](./host-integration), and [localization](./i18n).
