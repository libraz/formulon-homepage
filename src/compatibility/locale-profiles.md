# Locale Profiles

Excel behavior is not fully locale-neutral. Function names, separators, date parsing, width handling, currency, and text behavior can vary by platform and locale. Formulon therefore exposes named profiles instead of a single global compatibility mode.

::: info Glossary: compatibility profile
A named binding between an Excel build and a locale, plus the captured oracle data that proves Formulon matches it. The profile drives locale-sensitive function behavior; applications and tests pin to a profile explicitly rather than relying on host-OS defaults.
:::

## Profiles today

| Profile | Status | Purpose |
| --- | --- | --- |
| `win-365-ja_JP` | default runtime target; product-verified Windows Microsoft 365 ja-JP workbook-oracle primary | Primary runtime target and primary profile for the workbook-level (pivot/print) oracle track |
| `mac-365-ja_JP` | formula and conditional-formatting oracle primary | Primary formula- and conditional-formatting-oracle dataset |

The formula and conditional-formatting tracks regenerate from Mac Excel 365 ja-JP. The workbook track regenerates from a product-verified Windows Microsoft 365 ja-JP installation and uses `win-365-ja_JP` as its primary profile.

English-locale profiles are exposed only once their own oracle coverage exists. The repository tracks captured data per profile; profiles without sufficient data stay private to avoid implying compatibility that has not been verified.

## How a profile affects evaluation

Locale-sensitive areas include, but are not limited to:

- list and argument separators in some legacy paths,
- `TEXT()` / `VALUE()` formatting rules,
- `DATEVALUE()` and `TIMEVALUE()` parsing,
- currency / accounting number formats,
- function-name aliasing (e.g. fully translated names in non-English Excel locales),
- string width and `LEN` behavior in workbooks that mix half-/full-width characters.

::: warning Do not silently switch profiles
A workbook recalculated under a different profile can produce different results even when formulas look the same. Applications and CI pipelines should persist the profile they target and assert it at startup.
:::

## Persisting the profile

Through bindings:

```ts
wb.setExcelProfileId('win-365-ja_JP')
const id = wb.excelProfileId()
```

```python
wb.set_excel_profile_id('win-365-ja_JP')
```

The profile is stored as part of the workbook lifetime, not as a global runtime flag. Different workbooks in the same process can target different profiles.

## Read next

- [Compatibility model](/compatibility/model) — why profiles exist.
- [Oracle testing](/compatibility/oracle-testing) — how a profile is backed by data.
