---
title: React & Vue adapters
description: The <Spreadsheet> and <SpreadsheetToolbar> components, hooks/composables, and error/strings props for the formulon-cell framework packages.
---

# Framework Adapters

`@libraz/formulon-cell-react` and `@libraz/formulon-cell-vue` wrap the vanilla `@libraz/formulon-cell` core with framework-idiomatic props, events, and state hooks. Both are thin — mounting, disposal, and ribbon behavior all live in core, so the two adapters mirror the same shape and stay in sync with each other. As with the rest of `formulon-cell`, these are reference-quality wrappers for integration testing and examples, not a hardened production component library.

## `<Spreadsheet>`

| Prop | Type | Notes |
| --- | --- | --- |
| `workbook` | `WorkbookHandle` | Pre-loaded workbook; a fresh default workbook is created if omitted |
| `ui` | `SpreadsheetUiOptions` | Simplified preset + feature switches; `theme`/`features` win when both are supplied |
| `theme` | `MountOptions['theme']` | Calls `instance.setTheme()` on change, no re-mount |
| `locale` | `MountOptions['locale']` | Calls `instance.i18n.setLocale()` on change |
| `strings` | `MountOptions['strings']` | Per-string overrides, applied via `i18n.extend()` |
| `features` | `FeatureFlags` | Toggle individual built-ins |
| `extensions` | `ExtensionInput[]` | Custom extensions mounted alongside/instead of built-ins |
| `functions` | `MountOptions['functions']` | Host-side custom functions registered against `instance.formula` |
| `seed` | `MountOptions['seed']` | Cell-seeding callback (mostly for demos) |
| `printerProfiles` | `readonly PrinterProfile[]` | See [Host integration](/cell/host-integration#printer-profile-api) |
| `printerProfileId` | `string` | Active host printer profile id |
| `refreshPrinterProfiles` | `MountOptions['refreshPrinterProfiles']` | Native/Electron printer discovery hook |
| `captureScreenClip` | `MountOptions['captureScreenClip']` | Backs Insert > Screenshot > Screen Clipping |
| `uploadStatus` | `MountOptions['uploadStatus']` | Status bar Upload Status indicator |
| `macroRecording` | `MountOptions['macroRecording']` | Status bar Macro Recording indicator |
| `errorFallback` | React: `ReactNode \| ((error: unknown) => ReactNode)` · Vue: `(error: unknown) => VNodeChild` | Framework-native UI shown when mount rejects |
| `className` / `style` (React), `class` / `style` (Vue) | — | Forwarded to the host element |

Runtime prop changes are applied through the imperative API rather than by re-mounting — `theme`, `locale`, `strings`, `workbook`, `features`, `extensions`, `printerProfiles`, `printerProfileId`, `uploadStatus`, and `macroRecording` all update the running instance in place, so selection, focus, and event subscriptions survive a prop change.

### React

```tsx
import { Spreadsheet, presets } from '@libraz/formulon-cell-react'

<Spreadsheet
  features={presets.standard()}
  locale="en"
  theme="paper"
  onReady={(instance) => console.log('mounted', instance.workbook.version)}
  onCellChange={(e) => console.log(e)}
  onSelectionChange={(e) => console.log(e.active)}
  onWorkbookChange={(e) => console.log(e)}
  onLocaleChange={(e) => console.log(e)}
  onThemeChange={(e) => console.log(e)}
  onRecalc={(e) => console.log(e)}
  onError={(err) => showConfigurationError(err)}
  errorFallback={(err) => <ConfigErrorPanel error={err} />}
/>
```

`SpreadsheetRef` exposes the live instance for imperative access:

```tsx
const ref = useRef<SpreadsheetRef>(null)
ref.current?.instance?.undo()
```

### Vue

```vue
<script setup lang="ts">
import { Spreadsheet, presets } from '@libraz/formulon-cell-vue'
</script>

<template>
  <Spreadsheet
    :features="presets.standard()"
    locale="en"
    theme="paper"
    @ready="(inst) => console.log('mounted', inst.workbook.version)"
    @cell-change="(e) => console.log(e)"
    @selection-change="(e) => console.log(e.active)"
    @workbook-change="(e) => console.log(e)"
    @locale-change="(e) => console.log(e)"
    @theme-change="(e) => console.log(e)"
    @recalc="(e) => console.log(e)"
    @error="(err) => showConfigurationError(err)"
    :error-fallback="(err) => h(ConfigErrorPanel, { error: err })"
  />
</template>
```

The Vue component `expose()`s `{ instance }` as a template ref, mirroring the React `SpreadsheetRef` shape.

## `<SpreadsheetToolbar>`

A thin adapter over core's `Spreadsheet.mountToolbar` — the ribbon DOM, menu factories, activation model, and dropdown dispatcher all live in core, so neither framework package carries its own ribbon implementation.

| Prop | Type | Notes |
| --- | --- | --- |
| `instance` | `SpreadsheetInstance \| null` | The mounted spreadsheet to attach the ribbon to |
| `activeTab` | `RibbonTab` | Controlled active tab |
| `onTabChange` / `@tab-change` | `(tab: RibbonTab) => void` | Fires when the ribbon changes tab |
| `locale` | `string` | `'en'` or otherwise treated as `'ja'` |
| `dropdownActions` | `Partial<DynamicDropdownsCtx>` | Override individual ribbon dropdown handlers (sort, protect, file picker, script/add-in actions, …) without forking the ribbon |
| `ribbonTabs` | `readonly RibbonTab[]` | Shared tab surface — `EXCEL365_STANDARD_RIBBON_TABS` for the baseline profile, append `OPTIONAL_RIBBON_TABS` to add automation tabs |
| `onSpellingReview`, `onAccessibilityCheck`, `onTranslate` | `() => void` | Review-tab hooks |
| `onRunScript`, `onAddIn` | `() => void` | Fire when the user picks the "custom"/"manage" action from the Script / Add-in dropdown |
| `onDrawPen`, `onDrawEraser` | `() => void` | Drawing-tab ink mode hooks |
| `onError` | `(error: unknown) => void` | Fires if the core toolbar fails to mount |
| `onToolbarReady` | `(toolbar: ToolbarInstance \| null) => void` | Receives the mounted core toolbar instance so hosts can dispatch shared commands (titlebar search, Tell Me) without querying DOM buttons |

```tsx
<SpreadsheetToolbar
  instance={instance}
  activeTab={activeTab}
  locale="en"
  onTabChange={setActiveTab}
  dropdownActions={{ applyProtectAction: openProtectDialog }}
/>
```

See the [Embedding guide's Ribbon toolbar section](/cell/embedding#ribbon-toolbar) for a fuller mount example in both frameworks, and the manual `Spreadsheet.mountToolbar()` path for hosts without React or Vue.

## Hooks / composables

Both packages export the same four primitives for reading instance state without wiring up your own store subscription. React's are hooks (`useSyncExternalStore`-backed); Vue's are composables (`watchEffect`-backed, returning `Ref`s).

| React | Vue | Signature | Description |
| --- | --- | --- | --- |
| `useSelection(instance)` | `useSelection(instance)` | `(instance: SpreadsheetInstance \| null) => Selection` (React) / `(instance: Ref<SpreadsheetInstance \| null>) => Ref<Selection>` (Vue) | Subscribe to the active selection |
| `useSpreadsheet(instance, selector, fallback)` | `useSpreadsheet(instance, selector, fallback)` | `<T>(instance, selector: (state: State) => T, fallback: T) => T` (React) / `=> Ref<T>` (Vue) | Subscribe to a selector over the store's `State`, with an SSR-safe fallback while the instance is null |
| `useI18n(instance)` | `useI18n(instance)` | React: `=> { locale: string; strings: Strings \| null }` · Vue: `=> { locale: Ref<string>; strings: Ref<Strings> }` | Current locale + strings, reactive to runtime `setLocale`/`extend`/`register` |
| `useSpreadsheetEvent(instance, event, handler)` | `useSpreadsheetEvent(instance, event, handler)` | `<K extends SpreadsheetEventName>(instance, event: K, handler: SpreadsheetEventHandler<K>) => void` | Subscribe to a lifecycle event (`cellChange`, `selectionChange`, `workbookChange`, `localeChange`, `themeChange`, `recalc`); the handler ref can change between renders without re-subscribing |

```tsx
// React
import { useSelection, useI18n, useSpreadsheetEvent } from '@libraz/formulon-cell-react'

const selection = useSelection(instance)
const { locale, strings } = useI18n(instance)
useSpreadsheetEvent(instance, 'cellChange', (e) => console.log(e))
```

```vue
<!-- Vue -->
<script setup lang="ts">
import { useSelection, useI18n, useSpreadsheetEvent } from '@libraz/formulon-cell-vue'

const selection = useSelection(instance)
const { locale, strings } = useI18n(instance)
useSpreadsheetEvent(instance, 'cellChange', (e) => console.log(e))
</script>
```

`useSelection` and `useSpreadsheet` fall back to a neutral `Selection`/`fallback` value while `instance` is `null` (before mount, or after `dispose()`), so components can render before the spreadsheet is ready without null-checking on every read.

## `errorFallback` prop / `error` event

`Spreadsheet.mount()` rejects when it can't produce an instance — most commonly when the WASM engine can't start (see [No SharedArrayBuffer, no silent fallback](/cell/index#no-sharedarraybuffer-no-silent-fallback)). Both adapters surface this as `onError` (React prop) / `error` (Vue emit) plus an `errorFallback` prop for a framework-native fallback UI, instead of letting the rejection become an unhandled promise rejection. Core's own error panel (`renderError`) is suppressed automatically whenever `errorFallback` is supplied. See the [Embedding guide's Lifecycle hooks](/cell/embedding#lifecycle-hooks) for the same contract in the vanilla package.

## `strings` prop

The `strings` prop is the declarative equivalent of calling `instance.i18n.extend(locale, strings)` yourself — applied once, right after mount, and again whenever the prop changes. Use it to declare per-string overrides alongside the other mount props instead of reaching for the i18n controller imperatively. See [i18n](/cell/i18n#override-entries-without-forking) for the dictionary shape.

## Read next

- [Embedding guide](/cell/embedding) — mounting shapes, presets/extensions, command helpers, the ribbon toolbar.
- [Host integration](/cell/host-integration) — the status bar and printer profile props these components forward.
- [i18n](/cell/i18n) — locale registration and the `strings` override shape.
