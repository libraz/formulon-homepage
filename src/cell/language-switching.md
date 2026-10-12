---
title: Language switching
description: Keep formulon-cell labels, formula syntax, workbook profiles, and host controls in sync when the user changes language.
---

# Language switching

`formulon-cell` changes more than the labels around the grid. A built-in locale selects the UI dictionary and the matching Formulon workbook profile, so number formats, dates, booleans, separators, and formula-bar text follow the same choice. Function names are localized only where the profile provides aliases; Chinese, Korean, and Thai keep canonical English function names. Use the mounted `SpreadsheetInstance` as the host-facing control point: `instance.locale` reports the committed locale and `instance.setLocale(locale)` returns whether the complete change was accepted.

## Try the complete flow

<LocaleSwitchDemo />

The demo keeps one workbook mounted while it changes the selector, UI labels, workbook profile, calculated value, and localized input. It compares the localized display with the canonical formula preserved in the workbook. The failure behavior for an open modal, Find/Replace panel, comment editor, filter menu, Mac Function Arguments palette, or rejected profile write is documented below.

## Mount with a locale and an optional selector

Pass a short built-in id or a valid language-region tag at mount time. The native selector is opt-in because many hosts already have a language menu of their own:

```ts
import { Spreadsheet, WorkbookHandle } from '@libraz/formulon-cell'
import '@libraz/formulon-cell/styles.css'

const workbook = await WorkbookHandle.createDefault({ locale: 'de-DE' })
const instance = await Spreadsheet.mount(host, {
  workbook,
  locale: 'de-DE',
  ui: {
    profile: 'excel365',
    features: { localeSwitcher: true },
  },
})

console.log(instance.locale) // 'de-DE'
console.log(instance.workbook.spreadsheetProfileId()) // 'windows-de_DE'
```

The built-in dictionaries are `en`, `ja`, `de`, `fr`, `zh`, `ko`, and `th`. Their matching profile suffixes are `en_US`, `ja_JP`, `de_DE`, `fr_FR`, `zh_CN`, `ko_KR`, and `th_TH`. A `default` UI platform uses `windows-*` public profile ids; `mac` uses `mac-*`. The engine ids behind those public values use `win-365-*` and `mac-365-*`.

| UI locale | Dictionary | Default platform | Mac platform |
| --- | --- | --- | --- |
| `en` or `en-US` | English | `windows-en_US` | `mac-en_US` |
| `ja` or `ja-JP` | 日本語 | `windows-ja_JP` | `mac-ja_JP` |
| `de` or `de-DE` | Deutsch | `windows-de_DE` | `mac-de_DE` |
| `fr` or `fr-FR` | Français | `windows-fr_FR` | `mac-fr_FR` |
| `zh` or `zh-CN` | 中文 | `windows-zh_CN` | `mac-zh_CN` |
| `ko` or `ko-KR` | 한국어 | `windows-ko_KR` | `mac-ko_KR` |
| `th` or `th-TH` | ไทย | `windows-th_TH` | `mac-th_TH` |

Any valid region tag with one of these built-in language bases maps to the same profile suffix: for example, `en-GB` uses the English `windows-en_US` or `mac-en_US` profile. The tag remains the committed `instance.locale`; the built-in selector represents it with the short `en` option. Script, variant, and private-use tags stay custom and do not select a profile.

`localeSwitcher` is off by default in every profile. Enable it with `ui.features.localeSwitcher: true`, or after mount with `setFeatures()`. An active interaction `policy` hides the selector, so a policy-bound application needs its own language control that calls `instance.setLocale()`.

## Change language from the host {#change-language-from-the-host}

```ts
function changeLanguage(next: string) {
  if (!instance.setLocale(next)) {
    showLanguageError('The spreadsheet kept its current language.')
    return
  }

  savePreference(instance.locale)
  renderProfile(instance.workbook.spreadsheetProfileId())
}

const off = instance.on('localeChange', ({ locale }) => {
  languageMenu.value = locale
})
```

`setLocale()` is atomic from the mounted instance's point of view. Before changing the profile, it commits an open inline or formula-bar edit using the old locale. A visible modal, Find/Replace panel, comment editor, or filter menu also blocks the request; `setLocale()` returns `false` and keeps the surface, its draft, and the current locale intact. The workbook profile is then changed, read back, and recalculated once. If the edit cannot be committed, the engine rejects the profile, the readback is unexpected, or recalculation fails, the mount restores the previous profile and UI locale and returns `false`. A successful call returns `true`; calling it with the current locale is also successful and does not recalculate again.

On Mac, an open Function Arguments palette owns a formula draft that cannot be translated in place. `setLocale()` returns `false`, keeps the palette and its draft open, and leaves the old locale active. Close or commit the palette, then retry the change.

The lower-level `instance.i18n.setLocale()` method still notifies the mounted UI and is useful inside dictionary or extension code. Host menus should prefer `instance.setLocale()` because it gives the caller the success boolean. The dictionary registry and subscriptions are covered in [Internationalization](/cell/i18n).

## Custom ids and regional tags {#custom-ids-and-regional-tags}

The dictionary resolver uses the base language of a BCP 47 or underscore tag. `en-US`, `en_US`, and `en` therefore use the English dictionary. A registered id such as `de-brand` can use a complete host dictionary, or it falls back to the built-in German dictionary because its base language is `de`; it does not select a workbook profile. Script, variant, and private tags such as `de-Latn-DE`, `de-DE-posix`, and `x-private` are custom UI ids and do not silently change formula semantics. An unregistered id with no built-in base language resolves to the default Japanese dictionary.

```ts
import { type Strings } from '@libraz/formulon-cell'

const brandStrings: Strings = loadBrandDictionary()
instance.i18n.register('de-brand', brandStrings)

// Labels use the registered dictionary; the workbook keeps its current
// profile because a custom id has no built-in profile mapping.
instance.setLocale('de-brand')
```

If the host wants German formula semantics with a custom dictionary, switch to `de` or `de-DE` for the workbook operation and apply the custom labels as an overlay with `instance.i18n.extend('de', overlay)`. See [Workbook language and formula profiles](/workbook/language) for the engine-side profile facts and conversion rules.

## Formula, value, and input behavior {#formula-value-and-input-behavior}

The UI uses the active profile for editing and display. A German editor accepts `=SUMME(1,5;2)`, stores the portable canonical formula `=SUM(1.5,2)`, and displays the localized spelling again after the locale changes. The calculated value remains `3,5` while German is active and follows the new number format after a switch.

```ts
const address = { sheet: 0, row: 0, col: 0 }

// Formula-bar, inline-editor, and clipboard input take the active profile.
// The UI canonicalizes the full localized formula before writing it.
typeIntoSpreadsheet('=SUMME(1,5;2)')
console.log(instance.workbook.cellFormula(address)) // '=SUM(1.5,2)'
console.log(instance.workbook.getValue(address)) // { kind: 'number', value: 3.5 }
```

`WorkbookHandle.setFormula()` is a programmatic boundary. Pass canonical formula text when writing directly. Its compatibility path can remap localized function aliases, but it does not convert the full grammar of separators, decimal literals, booleans, or error names. Convert localized text explicitly when it came from an external form or file:

```ts
const localized = '=SUMME(1,5;2)'
const canonical = instance.workbook.canonicalizeLocalizedFormula(localized)

instance.workbook.setFormula(address, canonical)
console.log(canonical) // '=SUM(1.5,2)'
```

Use the matching read methods for other host surfaces:

```ts
const display = instance.workbook.localizeFormulaText('=SUM(1.5,2)')
const facts = instance.workbook.localeFacts()
// facts.listSeparator, facts.decimalSeparator, boolean names, date order, …
```

`getFormulaForDisplay()` uses the same full-text localization for formula-bar and inline-editor display. `localizeFormulaText()` and `canonicalizeLocalizedFormula()` accept an optional public profile id when a host is converting text for a profile other than the active one. If the installed engine lacks full formula-locale capability, the methods fall back to function-name aliases and leave the rest of the text unchanged; check `workbook.capabilities.formulaLocale` and `workbook.capabilities.localeFacts` when that distinction matters.

## React, Vue, extensions, and host hooks

The adapters forward `locale`, `strings`, and `ui.features.localeSwitcher` to the same mount. Store the instance from `onReady` / `ready` and use `setLocale()` in a host-owned control:

::: code-group

```tsx [React]
import { useState } from 'react'
import {
  Spreadsheet,
  type SpreadsheetInstance,
  type SpreadsheetUiOptions,
} from '@libraz/formulon-cell-react'

const ui: SpreadsheetUiOptions = { profile: 'embedded' }

export function LanguageControl() {
  const [instance, setInstance] = useState<SpreadsheetInstance | null>(null)

  return (
    <>
      <Spreadsheet
        locale="en"
        ui={ui}
        onReady={setInstance}
        onLocaleChange={({ locale }) => savePreference(locale)}
      />

      <button disabled={!instance} onClick={() => instance?.setLocale('ja')}>
        日本語
      </button>
    </>
  )
}
```

```vue [Vue]
<script setup lang="ts">
import { shallowRef } from 'vue'
import {
  Spreadsheet,
  type SpreadsheetInstance,
  type SpreadsheetUiOptions,
} from '@libraz/formulon-cell-vue'

const ui: SpreadsheetUiOptions = { profile: 'embedded' }
const instance = shallowRef<SpreadsheetInstance | null>(null)
</script>

<template>
  <Spreadsheet
    locale="en"
    :ui="ui"
    @ready="instance = $event"
    @locale-change="({ locale }) => savePreference(locale)"
  />
  <button :disabled="!instance" @click="instance?.setLocale('ja')">日本語</button>
</template>
```

:::

`useI18n()` and `useSpreadsheetEvent(instance, 'localeChange', handler)` (or the Vue composables) keep host controls reactive. An extension can read the current `strings` through its context and update its labels when the i18n controller notifies it. Use the `localeChange` event for persistence, and keep the unsubscription returned by `instance.on()` for services outside a component. The [Hooks and composables](/cell/hooks) and [React and Vue adapters](/cell/frameworks) pages show the subscription boundaries.

