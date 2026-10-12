---
title: Formula language
description: Convert localized formula text to the stored English form, inspect locale facts, and choose the calculation profile.
---

# Formula language

A spreadsheet application has three language settings to coordinate: the labels in its UI, the formula text a person reads or enters, and the profile used to calculate values. Formulon's engine handles the last two. [formulon-cell](/cell/language-switching) also supplies translated UI controls and coordinates their language with the workbook.

The engine stores formulas with English function names, decimal points and invariant separators. Translate at the input and display boundaries; keep that stored form in files and application state.

<DiagramFlow :steps="[
  { label: 'Localized input', note: '=SUMME(1;2,5)' },
  { label: 'canonicalizeFormula', note: 'profile: mac-365-de_DE' },
  { label: 'Stored formula', note: '=SUM(1,2.5)' },
  { label: 'localizeFormula', note: 'display in the chosen language' }
]" />

## Translate an entire formula

Use a profile id for both directions. These calls translate text without changing the workbook's calculation profile.

::: code-group

```ts [WASM / Native Node]
// wb is an initialized Workbook; see the runtime's getting-started example.
const profile = 'mac-365-de_DE' as const
const displayed = wb.localizeFormula('=SUM(1,2.5)', profile)
if (!displayed.status.ok) throw new Error(displayed.status.message)
console.log(displayed.value) // =SUMME(1;2,5)

const stored = wb.canonicalizeFormula(displayed.value, profile)
if (!stored.status.ok) throw new Error(stored.status.message)
const status = wb.setFormula(0, 0, 0, stored.value)
if (!status.ok) throw new Error(status.message)
const recalculated = wb.recalc()
if (!recalculated.ok) throw new Error(recalculated.message)
```

```python [Python]
# wb is an initialized Workbook with a sheet.
profile = "mac-365-de_DE"
displayed = wb.localize_formula("=SUM(1,2.5)", profile)
print(displayed)  # =SUMME(1;2,5)
stored = wb.canonicalize_formula(displayed, profile)
wb.set_formula(0, 0, 0, stored)
wb.recalc()
```

:::

The CLI accepts stored English formulas. It has no whole-formula translation command; `--profile` selects calculation behavior. The C ABI exposes `fm_formula_localize` and `fm_formula_canonicalize`; see the [C reference](/api/c).

The rewrite covers function names, decimal points, argument and array separators, boolean literals and error names. Quoted string contents, quoted sheet names, external workbook qualifiers and structured-reference brackets remain unchanged. Translation is a text rewrite, so it does not validate formula grammar. The formula setter performs that check and rejects malformed input without changing the workbook; see the [error model](/compatibility/errors).

## Translate a function name

For a function picker, use `localizeFunctionName(canonicalName, profileId)` and `canonicalizeFunctionName(localizedName, profileId)` (`localize_function_name` and `canonicalize_function_name` in Python). An unknown profile or function returns a failed status in JavaScript and raises `FormulonError` in Python.

German, French, Spanish (Spain and Mexico), Brazilian Portuguese, Russian, Italian and Dutch profiles have localized function names. Japanese changes the spellings of `DBCS`, `DOLLAR` and `USDOLLAR`; many other function names stay English. Chinese, Korean and Thai profiles retain English function names. A language's unchanged function names do not imply that its separators, currency or text comparisons are unchanged.

`functionMetadata(name)` describes the canonical function's arity and availability. Its result is locale-invariant; it does not provide localized descriptions or argument help. Supply those from a host-owned catalog when the UI needs them.

## Inspect separators and display rules

Use `localeFacts(profileId)` rather than guessing from the browser's locale. Its JavaScript result has a `status` and a nullable `facts` object. Python's `locale_facts(profile_id)` returns the facts directly.

::: code-group

```ts [WASM / Native Node]
const result = wb.localeFacts('mac-365-de_DE')
if (!result.status.ok || !result.facts) throw new Error(result.status.message)
const facts = result.facts
console.log(facts.decimalSeparator, facts.listSeparator) // , ;
console.log(facts.trueName, facts.falseName) // WAHR FALSCH
```

```python [Python]
facts = wb.locale_facts("mac-365-de_DE")
print(facts.decimal_separator, facts.list_separator)  # , ;
print(facts.true_name, facts.false_name)  # WAHR FALSCH
```

:::

Facts include grouping and array separators, date order, boolean names, currency placement and default decimal places, and localized error names. `measured` describes whether the profile's scalar facts were captured from Excel. `collationMeasured` (`collation_measured` in Python) is separate: it is `true` for every `mac-*` profile and `false` for every `win-*` profile, including `win-365-ja_JP` even though its scalar `measured` value is `true`. Error-name entries carry their own `measured` flag, so a measured profile does not make every error spelling measured.

## Choose calculation behavior separately

`Workbook.createDefault()` / `create_default()` uses `win-365-en_US` for a new workbook. `createForProfile(profileId)` / `create_for_profile(profile_id)` selects another profile and applies that profile's new-workbook template defaults. There are [28 profile ids](/compatibility/locale-profiles). A profile affects parsing of numeric and date text, currency formats, code pages, text matching and ordering, and PivotTable labels. It can change results even when the stored formula is identical.

Calling `setExcelProfileId()` changes the profile and marks formulas dirty. Call `recalc()` before reading their results. A translation call with a different profile only changes the returned string. The profile is not saved into XLSX or XLSB; persist it alongside the file and reapply it after loading.

The UI library uses names such as `mac-de_DE` and `windows-de_DE` for its `SpreadsheetProfileId`, while the engine uses `mac-365-de_DE` and `win-365-de_DE` for `ExcelProfileId`. Keep each id at its own API boundary.

## Try dynamic language switching

This demo uses the real Cell UI and engine. Change the language on the mounted sheet and compare its active profile, displayed formula and stored formula. Edits remain in the same workbook. See [the language switching guide](/cell/language-switching) for host controls, persistence and failed-switch handling.

<LocaleSwitchDemo />

## Read next

- [Locale profiles](/compatibility/locale-profiles) — platform and locale coverage.
- [Text comparison and sorting](/compatibility/text-collation) — why matching and ordering depend on the profile.
- [Internationalization](/cell/i18n) — UI dictionaries and application-specific labels.
