# How Far Compatibility Goes

A formula engine can return a sensible answer for every input and still disagree with Excel on a large share of them. Excel's results depend on rounding rules, a calendar error kept since the 1980s, and text handling that changes with the locale and with the operating system. None of that is in a specification. A workbook built in Excel relies on it anyway, and when another engine recalculates that workbook, the totals shift by amounts too small to notice until a reconciliation fails.

Formulon treats what Excel actually returns as the specification. Every case below was captured from a real Excel build. Each table then runs the same formulas through the engine in this page, so you see the comparison rather than take it on trust.

::: tip How to read the tables
- **Plausible answer** is what a straightforward implementation tends to return: IEEE 754 arithmetic as-is, a standard calendar library, plain Unicode string comparison. It is a reasonable answer, but not the one Excel gives, so a workbook built in Excel recalculates differently. A dash means the straightforward answer happens to be Excel's on that row.
- **Excel** is the value captured from Excel. `mac-365-ja_JP` means Mac Excel 365 with the Japanese locale; see [Locale profiles](/compatibility/locale-profiles).
- **Formulon** is computed live when the table scrolls into view. Seed cells, where a case needs them, are listed under the formula; the formula itself sits in `Z1`.
:::

## Floating-point arithmetic

`0.5-0.4-0.1` is not exactly zero in binary floating point; the residue is about `-2.78E-17`. Excel hides that residue, but only in specific places. When the outermost `+` or `-` of a formula produces a result within 2<sup>-50</sup> of its larger operand, Excel reports exactly 0. Wrap the same expression in parentheses and it is no longer the outermost operation, so the residue shows. `SUM` applies the rule at each step; `SUMIF` does not. A comparison sees the raw value, which is why `=0.5-0.4-0.1=0` is `FALSE` even though the cell next to it displays 0.

An engine that rounds every result looks right on the first row and wrong on the second and third. An engine that never rounds is wrong on the first.

The rest of the group follows the same pattern: Excel keeps 15 significant digits when it turns a number into text, `MROUND` works on the binary value rather than the decimal you typed, and a negative base with a fractional exponent is accepted only for odd roots such as `1/3`.

On Windows profiles, `+ - * / ^ %`, `EXP`, and `LN` round the way Windows Excel does (x87 extended precision, then double), so results that land on a rounding tie match it to the last bit; aggregate functions and other builtins still compute in double. `^` and `POWER` also reproduce Excel's last bits: `8^(1/3)` is 1.9999999999999998, not 2, and `1.0001^1000` is 1.105165392603197.

<CompatCasesDemo group="float" />

## Dates and times

::: info Date serials
Excel stores a date as a number: the count of days since the start of 1900, so 1 is 1900-01-01 and 45658 is 2025-01-01. Every date function reads and writes these serials.
:::

Serial 60 is 1900-02-29, a day that never existed. Excel keeps it so old workbooks keep their dates, and `WORKDAY` will step onto it. A standard calendar library rejects the date, or shifts every serial before March 1900 by one day. Serial 0 formats as `1900/1/0`, not as the last day of 1899.

Japanese era dates have their own rules. `DATEVALUE` rejects the first-year form `令和元年` but accepts `平成32年`, a year after the Heisei era ended. `TEXT` with the `ggge` era code prints `令和1年`; the `元年` spelling appears only when the format carries the `[$-ja-JP-x-gannen]` tag. `TIMEVALUE("12:60")` rolls over to 13:00 instead of failing. On Windows ja-JP, `TEXT` accepts an array of formats, and `[$-LCID]` tags render Windows' own month and day names (`[$-411]mmm` is `1`, `[$-404]mmmm` is `一月`).

Workbooks saved with the 1904 date system are read with that system: serial 0 is 1904-01-01, and a negative serial formats as a mirrored date (`-1904/1/2`) instead of an error.

<CompatCasesDemo group="dates" />

## Blank cells, empty text, and type coercion

Excel distinguishes three kinds of "nothing": a cell that was never written, a cell holding a zero-length text constant, and a formula that returns `""`. Most functions treat them alike. `COUNTIF` does not: the criterion `""` matches all three, while `"="` matches only the truly blank cell.

Text that looks like a logical value is just as uneven. `IF` accepts the text `"TRUE"` but not `"  TRUE  "`; `AND` trims the spaces and accepts it. `SUM` rejects `"TRUE"` typed as an argument. `TRUE=1` is `FALSE`, because a logical value and a number are never equal. Under the Japanese profile, `VALUE` accepts a leading `¥` but not a trailing `円`.

<CompatCasesDemo group="coercion" />

## Text comparison by locale and by host

Whether two strings match depends on the locale and on the operating system Excel runs on. Under the Japanese profiles, `SUMIF` criteria treat hiragana and katakana as the same character, and the same for full-width and half-width forms, circled digits and plain digits, `ß` and `ss`. They do not treat `ä` as `a`. The English and German profiles keep the long-vowel mark `ー` distinct; the Japanese profile folds it into the vowel it extends.

Mac and Windows Excel disagree with each other even in the same locale. In the table below, Mac Excel's `MATCH` finds `あ` in a cell holding `ア` and Windows Excel does not. `CODE` and `LENB` answer from each platform's own legacy character set: on Windows ja-JP, Hangul is the single CP932 byte `?`, so `CODE("한")` is 63 and `LENB("한글")` is 2. Formulon returns each platform's answer when you select the matching profile.

Two cases that do not depend on the platform: a `COUNTIF` wildcard matches text only, so `"12*"` skips the number 1213, and `ASC` leaves `ヴ` as it is because no single half-width character represents it.

[Text comparison and sorting](/compatibility/text-collation) covers which functions compare case-insensitively and which compare exactly.

<CompatCasesDemo group="text" />

## Implicit intersection and spills

::: info Implicit intersection and spills
A range in a place that expects one value is reduced to the cell in the formula's own row or column. The `@` operator asks for this explicitly. A formula that returns several values *spills* them into the cells below and to the right; if any of those cells is occupied, the formula returns `#SPILL!`.
:::

`=@A1:A5` written in row 1 returns `A1`. `=@A3:A8` written in row 1 has no cell in that row, so it returns `#VALUE!`. A cell holding `=""` looks empty, but it still blocks a spill. A merged cell does too.

When a lookup is lifted over an array of keys, each element applies Excel's error precedence by itself: in `=VLOOKUP(A1:A2,D1:E2,3,FALSE)`, a key that is already an error returns that error, even though the column index `3` is invalid for every element.

<CompatCasesDemo group="spill" />

## Where Formulon deliberately differs

Matching Excel is the default, not an absolute rule. Each case where Formulon differs is recorded in the core repository's [`tests/divergence.yaml`](https://github.com/libraz/formulon/blob/main/tests/divergence.yaml), together with the reason and the Excel build last checked. A difference without an entry fails the oracle tests.

| Case | Excel | Formulon | Why |
| --- | --- | --- | --- |
| Circular reference with iterative calculation off | Seeds one member with 0 and computes the rest: `A1=B1+1`, `B1=A1+1` gives 1 and 0 | `#REF!` in every cell of the cycle Excel's values depend on which member it seeds, so there is no single correct number. A host running without a UI gets no warning dialog, so an error value is the signal it can act on. |
| `=WEEKNUM(DATE(2024,1,1),99)` | Mac: 1, Windows: `#NUM!` | `#NUM!` on both | `99` is not a valid return type; Formulon follows Windows and the documented contract. |
| Page breaks at a print scale of 50% or less | Breaks stop following page geometry | Geometric pagination | Excel's break set at small scales does not follow from the page size and grows again at 25%. |

Iterative financial functions (`RATE`, `IRR` and similar) are compared within a tolerance of 1E-9 absolute or 1E-6 relative, not bit for bit. `=RATE(10,-100,1000)` is `-1.96E-10` in Excel and 0 in Formulon. Both mean "zero" here, but they are not the same double.

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
