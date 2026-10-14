---
title: Text collation
description: Compare, sort, group, and look up text with measured Mac rules, Windows word-sort rules, and function-specific strengths.
---

# Text Collation

Text comparison in a spreadsheet is a compatibility decision. The same two strings can compare equal in an operator, remain distinct in an exact lookup, and collapse into one row in `UNIQUE()`. Choose the profile first, then choose the operation whose Excel behavior you need to reproduce.

::: info Glossary: collation and strength
Collation is the rule for which strings are equal and how they are ordered. Strength is the depth of that rule a function observes within one profile.
:::

## Start with the task

| If the workbook is doing this | Collation strength | Functions and surfaces |
| --- | --- | --- |
| Compare values or apply a text criterion | `compare` | `=`, `<>`, `<`, `>`, `<=`, `>=`, criteria functions, `SWITCH`, approximate `MATCH` / `VLOOKUP`, `SEARCH` / `SEARCHB`, conditional-format text rules, and AutoFilter and PivotTable label filters |
| Sort, group, deduplicate, or use a modern lookup | `dynamic` | `SORT`, `UNIQUE`, `GROUPBY`, `XLOOKUP`, `XMATCH`, and PivotTable grouping |
| Reproduce a classic exact lookup | `classic exact` | Exact `MATCH`, `VLOOKUP`, and `HLOOKUP` |

On Mac profiles, `compare` includes measured expansions and the compare-only tertiary level. `dynamic` ignores that compare-only tertiary level so that width variants can group in the same way as Excel's dynamic-array operations. Mac `classic exact` suppresses expansions and half-width voiced-kana composition. This is why “Excel text equality” is too broad a description for an integration test.

## Mac and Windows profiles use different models

Every `mac-*` profile uses an order-preserving key generated from measured Mac Excel tables. The key contains primary, secondary, dynamic, and compare-only tertiary weights, plus the measured rules for word-sort symbols and trailing ignorable marks. Each locale has its own table and its own formula oracle; the tables are not a universal Unicode collation.

The Windows profiles build keys from the same locale tables under host rules measured on Windows Excel 365 ja-JP, a Windows word sort. Hyphen and apostrophe count only after every other difference, `æ` equals `ae`, half-width kana sort before full-width and katakana before hiragana, and Thai prefix vowels keep their position and sort before the consonants. Width differs only at comparison strength, kana type also at dynamic strength. Han order follows the locale's own rule. Collation order is reported as not measured for every Windows profile, including `win-365-ja_JP`, whose scalar locale facts are measured. `localeFacts(profileId).facts.collationMeasured` distinguishes the two: true for Mac profiles and false for Windows profiles.

### Results that differ between Mac and Windows

The same formula can return different results on the two Japanese profiles. Each row below was evaluated on `mac-365-ja_JP` and `win-365-ja_JP`; the Windows column matches the Windows Excel 365 ja-JP goldens. Pin the profile in tests instead of depending on the machine where the test happens to run.

| Formula | `mac-365-ja_JP` | `win-365-ja_JP` | Rule on Windows |
| --- | --- | --- | --- |
| `="Ａ"="A"` | `TRUE` | `FALSE` | Comparison keeps full-width and half-width apart. |
| `="ｱ"="ア"` | `TRUE` | `FALSE` | The same width rule applies to kana. |
| `="ア"="あ"` | `TRUE` | `FALSE` | Comparison keeps katakana and hiragana apart. |
| `="æ"="ae"` | `FALSE` | `TRUE` | Ligatures expand to their letters. |
| `="ß"="ss"` | `TRUE` | `TRUE` | Both profiles treat `ß` as `ss` when comparing. |
| `=SORT({"coop";"co-op"})` | `co-op`, `coop` | `coop`, `co-op` | A hyphen counts only after every other difference. |
| `=SORT({"あ";"ア"})` | `あ`, `ア` | `ア`, `あ` | Katakana sorts before hiragana. Mac treats the two as equal and keeps the input order. |
| `=SORT({"กา";"เก"})` | `กา`, `เก` | `เก`, `กา` | A Thai prefix vowel sorts before the consonants. |
| `=SORT({"家";"가"})` | `家`, `가` | `가`, `家` | Hangul sorts before Han. |
| `=ROWS(UNIQUE({"ア";"あ"}))` | `1` | `2` | Dynamic strength still distinguishes kana type. |
| `=XMATCH("Ａ",{"A"})` | `1` | `1` | Dynamic strength ignores width on both profiles. |
| `=MATCH("Ａ",{"A"},0)` | `1` | `#N/A` | Classic exact lookup keeps width apart. |
| `=MATCH("あ",{"ア"},0)` | `1` | `#N/A` | Classic exact lookup keeps kana type apart. |
| `=COUNTIF(A1:A2,"ＡＢＣ")` with `ＡＢＣ` and `ABC` | `2` | `1` | Criteria compare full-width letters as distinct. |
| `=COUNTIF(A1:A2,"１２３")` with `１２３` and `123` | `2` | `2` | Criteria fold full-width digits first, so both cells match. |

Other `win-*` profiles apply the same host rules to their own locale tables, so the width, kana, hyphen, and ligature rows carry over; Han order follows each locale. [How far compatibility goes](/compatibility/edge-cases#text-by-host) has a live demo of further Mac and Windows differences in `MATCH`, `CODE`, and `LENB`.

## Measured distinctions

The following examples are taken from the collation fixtures and unit tests. They describe the named profile and strength shown; they do not define a universal equivalence relation.

### Width and kana

- On measured Mac `ja_JP`, `en_US`, `ko_KR`, and `th_TH`, dynamic operations group `ｶﾞ` with `ガ`, `Ａ` with `A`, and `ア` with `あ`. Mac `zh_CN` and `zh_TW` retain a kana distinction for `ア` and `あ` in dynamic operations, while still grouping `Ａ` with `A` and `ｶﾞ` with `ガ` at dynamic strength.
- For `zh_CN` and `zh_TW`, comparison strength keeps `A` and `Ａ` distinct and keeps `ｶﾞ` and `ガ` distinct. Their dynamic strength folds those width variants.
- On Windows profiles, comparison strength keeps `ｶﾞ` / `ガ`, `ｱ` / `ア`, and `Ａ` / `A` distinct, dynamic strength groups each pair, and classic exact keeps them distinct. `ア` and `あ` stay distinct at dynamic strength, with katakana first.

### Accents and expansions

- In the measured Mac English table, comparison treats `straße` and `strasse` as equal, while `straße` sorts before `strasze`. Classic exact lookup keeps `ß` and `ss` distinct.
- Mac and Windows profiles compose a base letter with following combining marks (U+0300–U+036F) before comparing, so `"a"&UNICHAR(769)` equals `á` in comparisons, sorting, and dynamic lookups; classic exact lookup keeps them distinct.
- The French order tested is `cote < coté < côte < côté`.
- The German order tests `ä < ae` and `äz > aea`.
- The Spanish test places `ñ` after `nz`; the English table places `ñ` before `nz`.

### Kana marks, Thai, and Hangul

- In Mac Japanese, `かー` compares equal to `かあ`, `かゝ` equals `かか`, and `がゝ` sorts after `がか`. A trailing prolonged mark is not interchangeable with every neighboring character.
- The measured Thai order is profile-specific: `mac-365-ja_JP` puts `กา` before `เก`, while `mac-365-zh_CN` and the Windows profiles put `เก` before `กา`. This is a prefix-vowel rule, not a general Latin-like alphabet order.
- Mac `ja_JP`, `en_US`, `ko_KR`, and `th_TH` decompose Hangul for comparison: `각` equals `가` followed by U+11A8, and `간` sorts after `가나`. The `zh_CN` table keeps `각` distinct from that decomposed sequence. `ko_KR` also has its own KS X 1001 reading order.

### Han and punctuation order

Han order is profile data. The measured Mac tables use JIS X 0208 code-page order for `ja_JP`, GB2312 code-page order for `zh_CN` (the pinyin-oriented Chinese table), KS X 1001 reading order for `ko_KR`, and stroke-count groups with code-point order inside each group for `zh_TW`. The remaining locales use the base measured table. In Chinese word-sort behavior, the source tests order `ab < a'b < a-b`, and `a'` is not equal to `a`.

Do not replace these rules with `Intl.Collator` defaults or a single Unicode normalization pass. Those tools may be useful for a product's own search, but they do not reproduce a named Excel profile or the function strength used by Formulon.

## Compare text outside a formula

Use `compareText(a, b, strength, profileId)` when a host UI needs the same comparison as the engine. It returns `{ status, order }`, with `order` equal to -1, 0, or 1. `collationClasses(values, strength, profileId)` groups typed values and returns `{ status, classIds, classCount }`. Class IDs start at 0 in ascending `SORT` order: numbers, text, booleans, errors by code, then blanks. A number and its text spelling stay in different classes. IDs belong to one call; retain typed values rather than storing IDs across calls.

::: code-group

```ts [WASM / Native Node]
import { CollationStrength } from '@libraz/formulon' // native: @libraz/formulon-native

// wb is an initialized Workbook.
const result = wb.compareText('straße', 'strasse', CollationStrength.Compare, 'mac-365-en_US')
if (!result.status.ok) throw new Error(result.status.message)
console.log(result.order) // 0
```

```python [Python]
from formulon import CollationStrength, Workbook

print(Workbook.compare_text("straße", "strasse", CollationStrength.COMPARE, "mac-365-en_US"))  # 0
```

:::

Python's `collation_classes(values, strength, profile_id)` returns a `CollationClasses` record with `class_ids` and `class_count` and raises `FormulonError` on a host failure. The C equivalents are `fm_text_compare` and `fm_collation_classes`; the CLI does not expose a standalone comparison command.

## Compare the same formula on three bindings

The following examples compare measured `mac-365-ja_JP` collation with Windows word-sort `win-365-ja_JP` collation through the same workbook API. They run `SORT` at dynamic strength and print the two spilled cells. The output was checked against the current WASM and native artifacts; the Python binding calls the same C ABI surface.

::: code-group

```ts [WASM]
import createFormulon from '@libraz/formulon'

const Module = await createFormulon()
const wb = Module.Workbook.createDefault()
try {
  for (const profile of ['mac-365-ja_JP', 'win-365-ja_JP'] as const) {
    const status = wb.setExcelProfileId(profile)
    if (!status.ok) throw new Error(status.message)
    if (!wb.setFormula(0, 0, 0, '=SORT({"coop";"co-op"})').ok) throw new Error('setFormula failed')
    if (!wb.recalc().ok) throw new Error('recalc failed')
    console.log(profile, [0, 1].map(row => wb.getDisplayText(0, row, 0).text))
  }
} finally {
  wb.delete()
}
```

```ts [Native Node]
import { Workbook } from '@libraz/formulon-native'

const wb = Workbook.createDefault()
for (const profile of ['mac-365-ja_JP', 'win-365-ja_JP'] as const) {
  const status = wb.setExcelProfileId(profile)
  if (!status.ok) throw new Error(status.message)
  if (!wb.setFormula(0, 0, 0, '=SORT({"coop";"co-op"})').ok) throw new Error('setFormula failed')
  if (!wb.recalc().ok) throw new Error('recalc failed')
  console.log(profile, [0, 1].map(row => wb.getDisplayText(0, row, 0).text))
}
wb.dispose()
```

```python [Python]
from formulon import Workbook

with Workbook.create_default() as wb:
    for profile in ("mac-365-ja_JP", "win-365-ja_JP"):
        wb.set_excel_profile_id(profile)
        wb.set_formula(0, 0, 0, '=SORT({"coop";"co-op"})')
        wb.recalc()
        print(profile, [wb.get_display_text(0, row, 0)[0] for row in (0, 1)])
```

:::

All three print the equivalent of:

```text
mac-365-ja_JP [ 'co-op', 'coop' ]
win-365-ja_JP [ 'coop', 'co-op' ]
```

The code compares a dynamic-array operation. It does not imply that `="co-op"="coop"`, exact `MATCH`, and `UNIQUE` have the same strength. Test each function surface that matters to the workbook.

## Test profile and strength together

For a regression fixture, record the profile ID, function, input strings, and expected result. A useful small matrix includes:

- `SORT` and `UNIQUE` with `ß` / `ss`, `Ａ` / `A`, `ｶﾞ` / `ガ`, and `ア` / `あ`;
- comparison and exact `MATCH` for the same pairs;
- `XLOOKUP` or `XMATCH` for a dynamic lookup pair;
- one locale-specific Han pair when the workbook sorts Japanese, Simplified Chinese, Traditional Chinese, or Korean labels; and
- a Thai or Hangul pair if those labels are user data.

When a result changes, first check the profile ID and the operation's strength. Then compare the corresponding fixture under the same source profile. The collation implementation and tests are in `src/eval/collation.h`, `src/eval/collation.cpp`, `tests/unit/eval/collation_test.cpp`, and `tests/unit/eval/sort_eval_test.cpp` in the Formulon source tree.

## Read next

- [Locale profiles](/compatibility/locale-profiles) — separators, code pages, currency, and profile measurement status.
- [Workbook language](/workbook/language) — formula text localization.
- [Cell language switching](/cell/language-switching) — editor language changes.
- [Oracle testing](/compatibility/oracle-testing) — how the measured tables and formula goldens are checked.
