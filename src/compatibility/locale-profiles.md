# Locale Profiles

Excel behavior is not fully locale-neutral. Function names, separators, date parsing, width handling, currency, and text behavior can vary by platform and locale. Formulon therefore exposes named profiles instead of a single global compatibility mode.

::: info Glossary: compatibility profile
A named binding between an Excel build and a locale, plus the captured oracle data that proves Formulon matches it. The profile drives locale-sensitive function behavior; applications and tests pin to a profile explicitly rather than relying on host-OS defaults.
:::

## Profiles today

| Profile | Status | Purpose |
| --- | --- | --- |
| `win-365-ja_JP` | default runtime target; used for expected values captured and verified with Windows Microsoft 365 Excel | Primary runtime target and profile for the workbook-level (pivot/print) oracle track |
| `mac-365-ja_JP` | formula and conditional-formatting oracle primary | Primary formula- and conditional-formatting-oracle dataset |

The formula and conditional-formatting tracks regenerate from Mac Excel 365 ja-JP. The workbook track uses expected values captured and verified with Windows Microsoft 365 Excel and uses `win-365-ja_JP` as its primary profile.

English-locale profiles are exposed only once their own oracle coverage exists. The repository tracks captured data per profile; profiles without sufficient data stay private to avoid implying compatibility that has not been verified.

## How a profile affects evaluation

The current profile-controlled areas include:

- text matching and coercion, including width and kana handling,
- `CODE()` / `CHAR()` behavior,
- environment-sensitive `INFO()` / `CELL()` values,
- PivotTable labels and layout defaults.

Stored formulas use English function names and the invariant parser grammar. Function-name helpers provide presentation labels separately; changing a profile does not translate stored formulas or claim that every Excel locale difference is implemented.

::: warning Do not silently switch profiles
A workbook recalculated under a different profile can produce different results even when formulas look the same. Applications and CI pipelines should persist the profile they target and assert it at startup.
:::

## Persisting the profile

Through bindings:

::: code-group

```ts [WASM / Native Node]
wb.setExcelProfileId('win-365-ja_JP')
const profile = wb.excelProfileId()
if (!profile.status.ok) throw new Error(profile.status.message)
const id = profile.value
```

```python [Python]
wb.set_excel_profile_id('win-365-ja_JP')
id = wb.excel_profile_id()
```

:::

The profile is stored as part of the workbook lifetime, not as a global runtime flag. Different workbooks in the same process can target different profiles. The profile is not serialized into the workbook file, so applications must persist the selected id and apply it again after loading.

Changing the profile marks formulas dirty; it does not recalculate them. Call `recalc()` after changing the profile before reading values.

## Read next

- [Compatibility model](/compatibility/model) — why profiles exist.
- [Oracle testing](/compatibility/oracle-testing) — how a profile is backed by data.
