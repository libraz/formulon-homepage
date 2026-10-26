# How Far Compatibility Goes

Formulon follows Excel's observed results down to rounding residues, text coercion, error precedence, and array shape. It also reproduces the stored formula text and workbook behavior that affect the next edit or save. The reference is a captured Excel result for a named profile and build.

This page shows selected examples and the regression evidence behind the wider implementation. It is not a complete inventory of Excel behavior. [Formula coverage](/compatibility/formula-coverage) describes which functions execute locally; [Oracle testing](/compatibility/oracle-testing) explains how results are compared.

## What is checked

| Surface | What has to agree with Excel |
| --- | --- |
| Calculated value | The underlying number, text, Boolean, error, or blank; a matching rounded display is insufficient. |
| Evaluation rules | Which inputs are coerced or ignored, which error wins, and whether a result is scalar or an array. |
| Stored formula and workbook state | Formula spelling, legacy array edits, inserted formats, pivot cells, and chart references or caches. |

::: tip How to read the tables
- **Plausible answer** is what a straightforward implementation tends to return: IEEE 754 arithmetic as-is, a standard calendar library, plain Unicode string comparison. It is a reasonable answer, but not the one Excel gives, so a workbook built in Excel recalculates differently. This column illustrates a possible implementation; it is not a benchmark of another product. A dash means no contrasting answer is shown.
- **Excel** is the value captured from Excel. `mac-365-ja_JP` means Mac Excel 365 with the Japanese locale; see [Locale profiles](/compatibility/locale-profiles).
- **Formulon** is computed live when the table scrolls into view. Seed cells, where a case needs them, are listed under the formula; the formula itself sits in `Z1`. Numeric results are compared as doubles with no tolerance, rather than as formatted cell text. The runtime version appears on each demo; during release preparation it can be an earlier published version than the documentation target.
:::

## Floating-point arithmetic

`0.5-0.4-0.1` leaves about `-2.78E-17` in binary floating point. Excel replaces that residue with 0 only in specific contexts. At the outermost `+` or `-` of a cell formula, it compares the result with a threshold of eight units in the last place (ULPs), scaled by the left operand's binary exponent. Parentheses around the expression prevent this outermost-operation rule, and a comparison sees the raw result: `=0.5-0.4-0.1=0` is `FALSE`.

`SUM`, `AVERAGE`, `SUBTOTAL` and `AGGREGATE` apply the cancellation rule only to the final addition, scaled by the partial sum before it. `SUMIF` does not apply it. Snapping every intermediate addition changes the result of longer sums.

The three expressions test different paths: a cell result, a parenthesized expression, and a Boolean comparison. Matching one path does not establish the others.

The table also checks that Excel keeps 15 significant digits when it turns a number into text, `MROUND` works on the binary value rather than the decimal you typed, and a negative base with a fractional exponent is accepted only for odd roots such as `1/3`.

Windows profiles also apply the measured Windows rounding rules to the arithmetic paths that differ from Mac Excel. This is separate from the host math-library differences described below: selecting an Excel profile does not replace the native or WASM math library.

<CompatCasesDemo group="float" />

## Numeric precision beyond the displayed decimal

Numeric parsing, calculation, and display have different rules. Text-to-number conversion keeps 15 significant digits by truncation; the `ROUND` family, `ROUNDUP` included, rounds from a 15-significant-digit decimal representation, so binary noise adds no unit (`ROUNDUP(0.1+0.2,1)` is 0.3); multiplication, `^`, and `POWER` flush subnormal results (below the normal double range) to zero. Number formatting has its own fraction, exponent, and placeholder rules: a fraction format's integer part takes the locale's group separator, a subnormal scientific exponent follows the integer placeholder count, and the 127-decimal cap is checked on the stored format. Applying one decimal-rounding rule everywhere would change these results.

These committed Mac ja-JP goldens show why the last digits matter. Each listed case has effective absolute and relative tolerances of zero, either at suite level or through a case override. Each linked golden records the Excel build, capture time, inputs, and comparison settings. These are source regression examples, separate from the browser tables.

| Formula | Captured numeric result | What it checks |
| --- | --- | --- |
| `=NUMBERVALUE("9999999999999999")` | `9999999999999990` | Text-to-number conversion truncates to Excel's significant-digit limit. [Golden: `integer_digits_truncated`](https://github.com/libraz/formulon/blob/main/tests/oracle/targets/mac-365-ja_JP/golden/numbervalue_rules.golden.json). |
| `=ROUNDUP(2.675,2)` | `2.6799999999999997` | The result can display as `2.68` while differing in its underlying double. [Golden: `round_digit_string_roundup_cents`](https://github.com/libraz/formulon/blob/main/tests/oracle/targets/mac-365-ja_JP/golden/math.golden.json). |
| `=ROUND(99.995,2)` | `100` | Decimal rounding carries into the integer part. [Golden: `round_digit_string_round_carry`](https://github.com/libraz/formulon/blob/main/tests/oracle/targets/mac-365-ja_JP/golden/math.golden.json). |
| `=RATE(10,-100,1000)` | `-1.963351707292562E-10` | The solver preserves Excel's small nonzero residual instead of replacing it with a mathematically exact zero. [Golden: `rate_zero_outcome`](https://github.com/libraz/formulon/blob/main/tests/oracle/targets/mac-365-ja_JP/golden/financial.golden.json). |
| `=NORM.DIST(17.947,-3.482,1.962,FALSE)` | `2.538700187017102E-27` | A small nonzero distribution tail must not disappear under a loose absolute tolerance. [Golden: `norm_dist_pdf_far_tail`](https://github.com/libraz/formulon/blob/main/tests/oracle/targets/mac-365-ja_JP/golden/distributions.golden.json). |
| `=NORM.DIST(39,1,1,FALSE)` | `0` | A separate case checks the tail that Excel flushes to zero. [Golden: `norm_dist_pdf_flushed`](https://github.com/libraz/formulon/blob/main/tests/oracle/targets/mac-365-ja_JP/golden/distributions.golden.json). |

Financial and statistical functions need more than a standard formula. `RATE`, `IRR`, `XIRR`, and `YIELD` follow Excel's solver behavior, including starting guesses and failure conditions. Distribution tails and inverses, variance under cancellation, and regression with dependent columns exercise different numerical paths. Inputs and comparison settings are recorded in the [RATE / IRR](https://github.com/libraz/formulon/blob/main/tests/oracle/cases/financial.yaml), [XIRR](https://github.com/libraz/formulon/blob/main/tests/oracle/cases/xirr_search.yaml), [YIELD](https://github.com/libraz/formulon/blob/main/tests/oracle/cases/financial_dcc.yaml), and [regression](https://github.com/libraz/formulon/blob/main/tests/oracle/cases/regression_advanced.yaml) suites. A simple payment or average does not exercise those boundary cases.

## Dates and times

::: info Date serials
Excel stores a date as a number: the count of days since the start of 1900, so 1 is 1900-01-01 and 45658 is 2025-01-01. Date calculations use these serials.
:::

Serial 60 is 1900-02-29, a day that never existed. Excel keeps it so old workbooks keep their dates, and `WORKDAY` will step onto it. A Gregorian calendar calculation needs an explicit serial-60 case to preserve that numbering. Serial 0 formats as `1900/1/0`, not as the last day of 1899.

Japanese era dates have their own rules. `DATEVALUE` rejects the first-year form `令和元年` but accepts `平成32年`, a year after the Heisei era ended. `TEXT` with the `ggge` era code prints `令和1年`; the `元年` spelling appears only when the format carries the `[$-ja-JP-x-gannen]` tag. `TIMEVALUE("12:60")` rolls over to 13:00 instead of failing. On Windows ja-JP, `TEXT` accepts an array of formats, and `[$-LCID]` tags render Windows' own month and day names (`[$-411]mmm` is `1`, `[$-404]mmmm` is `一月`).

Workbooks saved with the 1904 date system are read with that system: serial 0 is 1904-01-01, and a negative serial formats as a mirrored date (`-1904/1/2`) instead of an error.

<CompatCasesDemo group="dates" />

## Blank cells, empty text, and type coercion

Excel distinguishes three kinds of "nothing": a cell that was never written, a cell holding a zero-length text constant, and a formula that returns `""`. `COUNTIF` distinguishes them: the criterion `""` matches all three, while `"="` matches only the truly blank cell.

Text that looks like a logical value is just as uneven. `IF` accepts the text `"TRUE"` but not `"  TRUE  "`; `AND` trims the spaces and accepts it. `SUM` rejects `"TRUE"` typed as an argument. `TRUE=1` is `FALSE`, because a logical value and a number are never equal. Under the Japanese profile, `VALUE` accepts a leading `¥` but not a trailing `円`. `VALUE` and text-to-number coercion reject a grouped number only when its first group is all zeros: `046.565.118` parses in `de-DE` and `043,472` in `en-US`, while `000.509` in `de-DE` and `0,123` in `en-US` are `#VALUE!`.

<CompatCasesDemo group="coercion" />

## Text comparison by locale and by host {#text-by-host}

Whether two strings match depends on the locale and on the operating system Excel runs on. Under the Japanese profiles, `SUMIF` criteria treat hiragana and katakana as the same character, and the same for full-width and half-width forms, circled digits and plain digits, `ß` and `ss`. They do not treat `ä` as `a`. The English and German profiles keep the long-vowel mark `ー` distinct; the Japanese profile folds it into the vowel it extends.

Mac and Windows Excel disagree with each other even in the same locale. In the table below, Mac Excel's `MATCH` finds `あ` in a cell holding `ア` and Windows Excel does not. `CODE` and `LENB` answer from each platform's own legacy character set: on Windows ja-JP, Hangul is the single CP932 byte `?`, so `CODE("한")` is 63 and `LENB("한글")` is 2. Formulon returns each platform's answer when you select the matching profile.

Two cases that do not depend on the platform: a `COUNTIF` wildcard matches text only, so `"12*"` skips the number 1213, and `ASC` leaves `ヴ` as it is because no single half-width character represents it.

[Text comparison and sorting](/compatibility/text-collation) covers which functions compare case-insensitively and which compare exactly.

<CompatCasesDemo group="text" />

## Search paths and character positions

For approximate lookups, Formulon follows measured Excel search behavior, including probes with mixed types and unsorted ranges. With `A1:A3` holding `30`, `10`, `20`, Excel returns `2` for `=MATCH(15,A1:A3,1)` ([golden: `match_unsorted_with_approx`](https://github.com/libraz/formulon/blob/main/tests/oracle/targets/mac-365-ja_JP/golden/lookup.golden.json), zero tolerance). This pins one observed search path; it does not make unsorted input a valid substitute for the sorted input approximate lookup requires.

Character positions are also profile-dependent. The Mac ja-JP [text goldens](https://github.com/libraz/formulon/blob/main/tests/oracle/targets/mac-365-ja_JP/golden/text.golden.json) record `=LEN("😀")` as `1` (`supp_len_emoji`) and `=FIND("b","a😀b𐐨c𠀀d")` as `3` (`supp_find_after_astral`). These cases cover supplementary characters as well as ordinary text. They are Mac captures; they are not direct measurements of every Windows locale. See [Text collation](/compatibility/text-collation) for comparison strength and [Locale profiles](/compatibility/locale-profiles) for measurement scope.

## Implicit intersection and spills

::: info Implicit intersection and spills
A range in a place that expects one value is reduced to the cell in the formula's own row or column. The `@` operator asks for this explicitly. A formula that returns several values *spills* them into the cells below and to the right; if any of those cells is occupied, the formula returns `#SPILL!`.
:::

`=@A1:A5` written in row 1 returns `A1`. `=@A3:A8` written in row 1 has no cell in that row, so it returns `#VALUE!`. A cell holding `=""` looks empty, but it still blocks a spill. A merged cell does too.

When a lookup is lifted over an array of keys, each element applies Excel's error precedence by itself: in `=VLOOKUP(A1:A2,D1:E2,3,FALSE)`, a key that is already an error returns that error, even though the column index `3` is invalid for every element.

<CompatCasesDemo group="spill" />

## Accuracy after an edit or save

A matching formula value does not establish that the workbook will behave the same on the next edit. These checks cover observable workbook behavior as well:

| Area | Behavior checked | Evidence |
| --- | --- | --- |
| Formula entry | `1.50` is stored as `1.5`, a touching unary `+5` as `5`; rejected whitespace fails before mutation. The same entry rules cover cells, names, conditional formats, and validation. | [Formula-entry regression tests](https://github.com/libraz/formulon/blob/main/tests/c_api/formulon_c_formula_entry_test.cpp); [Workbook operations](/workbook/operations). |
| Formula nesting | More than 65 nested function calls is refused with `NestedFormulaTooDeep`; 256 parentheses and 1024 unary signs parse and evaluate. | [Error model](/compatibility/errors#formula-text-entry-paths). |
| Sheet names | A name that begins or ends with an apostrophe is refused on add and rename and fails a file load; `History` in any case is refused under `win-*` profiles and accepted under `mac-*`, as in Excel. | [Statuses](/compatibility/errors#statuses-returned-by-argument-and-structure-checks). |
| Legacy array formulas | Editing a non-anchor member is rejected without changing the block; every member answers `FORMULATEXT` and `ISFORMULA` from the block formula. | [Dynamic arrays](/workbook/dynamic-arrays). |
| Validation | A self-referencing rule evaluates the proposed input, including reads through ranges or indirect references, while stored cells remain unchanged. | [Proposed-value regression tests](https://github.com/libraz/formulon/blob/main/tests/unit/validation_eval_test.cpp); [Filters and validation](/workbook/filters-validation). |
| Structural edits | Inserted rows inherit formats and height from above; columns inherit formats and width from the left. Hosted sparklines are cloned; hidden state and outline level are not copied. Inserts and deletes that cut through a data table, a legacy array block, or a PivotTable are refused with `kPreconditionFailed`. | [Workbook operations](/workbook/operations). |
| PivotTables | The Windows ja-JP `blank_row_item_label` capture checks the output grid, labels and totals: `(North,100)`, `(blank,50)`, `(South,200)`, `(blank,25)` produce a blank-label group of `75` and a grand total of `375`. | [Workbook golden](https://github.com/libraz/formulon/blob/main/tests/oracle/targets/win-365-ja_JP/golden_wb/pivot_basic.golden.json); [PivotTables](/workbook/pivots). |
| Charts | Cached series distinguish blanks, text, Booleans and errors; references follow structural edits and caches refresh from stored values on save. These checks concern data and structure, not chart rendering. | [Chart data golden](https://github.com/libraz/formulon/blob/main/tests/oracle/targets/mac-365-ja_JP/golden_chart/data.golden.json), [save regression tests](https://github.com/libraz/formulon/blob/main/tests/unit/chart/chart_save_test.cpp); [Charts](/workbook/charts). |

The linked goldens are captured Excel observations. The linked regression tests also pin engine and API contracts; a regression test alone is not a fresh Excel measurement. The feature pages describe the supported read, edit, and save boundaries.

## What a passing comparison establishes

| Comparison | Meaning |
| --- | --- |
| Live tables on this page | Numeric values compare as doubles with no tolerance; text, errors, and Booleans compare in their shown form. |
| Exact oracle case | Its effective absolute and relative tolerances are both zero. A suite tolerance can be overridden per case, as the `RATE` example above does. |
| Tolerant or specialized oracle case | Agreement is established only under that case's effective tolerance or named comparison mode. |
| `host_libm` cases | For marked host-math results, comparison is exact on macOS and allows at most 4 ULP elsewhere. The host math library can put a Linux or WASM result 1–2 ULP from Mac Excel; selecting a Mac profile does not eliminate that execution-host difference. |

The [`host_libm` registry entries](https://github.com/libraz/formulon/blob/main/tests/divergence.yaml) and [comparison helper](https://github.com/libraz/formulon/blob/main/tests/support/host_libm_expect.h) make that exception explicit. It is not a blanket tolerance for all mathematical functions. Skipped cases establish no value agreement and are classified separately below.

## Differences that remain

The core repository's [`tests/divergence.yaml`](https://github.com/libraz/formulon/blob/main/tests/divergence.yaml) and per-target registries record the reason, profile scope, comparison policy, and last-verified Excel build for a tracked difference. These entries include intentional boundaries and cases that cannot be captured reliably; a skipped case is not evidence of a matching result.

| Case | Excel | Formulon | Reason or boundary |
| --- | --- | --- | --- |
| Multi-cell cycle, iteration off | `A1=B1+1`, `B1=A1+1` gives 1 and 0, or 0 and 1, depending on entry order | `#REF!` in every cycle member | The saved workbook does not record the entry order needed to reproduce Excel's result. A self-cycle such as `A1=A1+1` holds 0 in both engines. |
| Cells downstream of a cycle, iteration off | Values also depend on whether the cells were entered before or after the cycle closed | Propagates a multi-cell cycle's `#REF!`; computes from 0 downstream of a self-cycle | Excel's historical entry order cannot be recovered from the workbook. |
| `=WEEKNUM(DATE(2024,1,1),99)` on Mac | Alternates between 1 and `#NUM!` across cells and runs | `#NUM!` for unsupported return types on every host | Classified as `excel-no-value`: there is no reproducible Mac value to capture. |
| Arrays up to Excel's size bound | Mac Excel 365 evaluates up to 107,374,182 elements (`A:CX+0` evaluates, `A:CY+0` and `SEQUENCE(1048576,103)` give the number 0); Windows Excel abandons some smaller arrays | Generated arrays are limited to 1,048,576 cells; derived arrays to 10,000,000 cells, with `#NUM!` or `#CALC!` when exceeded | Memory limits bound evaluation in WASM. The 107,374,182 bound applies under every profile, and above it the formula holds 0 in both engines. `SUM`, `AVERAGE`, `MIN`, `MAX`, `PRODUCT`, and `COUNTA` fold whole-axis operation results without materializing them, and `ROWS` and `COLUMNS` can obtain shape without allocating the values. |
| Ad-hoc scalar evaluation of `=A1+1` at an empty `A1` | A stored self-cycle holds 0 with automatic calculation | Returns 1 from the cached blank cell | Ad-hoc evaluation does not install a formula or join the dependency graph. See [Workbook operations](/workbook/operations#ad-hoc-formula-evaluation). |
| Windows print-scale captures | Existing captures can read the previous pagination before Excel settles the layout after a scale change | Geometric pagination agrees with the measured Mac cases | Classified as `harness-cannot-capture`; Windows requires a settled-layout recapture. The old readback is not evidence of a universal Excel pagination rule. |

## How differences are closed

1. Pin the same profile, date system, input cells, and calculation settings. Record the Excel build and reduce the workbook to a reproducible case.
2. Capture Excel's result and stored formula text where relevant. Separate an engine difference from a capture limitation, a volatile input, or a profile/build change.
3. Fix the engine against that evidence and add a regression case. Cover the boundaries too: rounding ties, blanks, error precedence, locale, and array shape can select different execution paths.
4. Remove a resolved skip or tolerance entry, then verify the committed goldens and the divergence registry. Regenerate a golden only when a fresh Excel observation justifies changing it.

[Oracle testing](/compatibility/oracle-testing) gives the verification commands and explains what the closure metadata and release gate establish. A passing captured case does not prove every input or every Excel build matches.

## How the captures are kept current

- Formulon has 28 profiles. Fifteen are measured directly: all 14 Mac locales and Windows `ja_JP`. The other 13 Windows profiles are estimated from the Mac captures plus the Windows host rules.
- The formula captures for every Mac locale run as tests in CI. A result that differs from a capture fails the build unless a divergence entry covers it, and a divergence entry with no case behind it fails as well.
- Workbook-level behavior (PivotTables, print layout) is captured from Windows Excel `ja_JP`, where Excel's automation interface is reliable.

[Oracle testing](/compatibility/oracle-testing) describes the capture tracks and how a failure is triaged, and [Compatibility model](/compatibility/model) explains the profile model.

## What this does not promise

Matching these cases does not make every workbook match every Excel build. The Windows profiles other than `ja_JP` are estimates, Excel itself changes between builds, and your workbook may use a function family covered less densely than the ones above. Pin the profile your users run with `setExcelProfileId()`, and keep a few of your own workbooks with known Excel results as fixtures.

## Read next

- [Formula coverage](/compatibility/formula-coverage) — which functions are implemented.
- [Locale profiles](/compatibility/locale-profiles) — the 28 profiles and how to pin one.
- [Oracle testing](/compatibility/oracle-testing) — how captures are taken and checked.
