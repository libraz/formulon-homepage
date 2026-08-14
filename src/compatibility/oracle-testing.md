# Oracle Testing

Oracle tests compare Formulon against values captured from real Excel builds. They are the empirical layer of the compatibility story — what *Excel actually does* on a given workbook and locale, not what the documentation says it should.

::: info Glossary: oracle data
A captured set of Excel-produced values for a known workbook, profile, and build. Tests load the workbook, recalculate with Formulon, and compare against the captured values. When they disagree, *Excel* is treated as the source of truth.
:::

::: info Glossary: accepted divergence
A case where Formulon deliberately differs from Excel. Each accepted divergence carries a reason (security, deterministic behavior, fixed Excel bug, …) and a last-verified Excel build. Accepted divergences are documented rather than hidden behind generic "Excel-like" claims.
:::

## Current results

Where the oracle tracks stand today. Each row is what the suite reports on the checked-in goldens, not an aspiration.

| Track | Result | Documented skips / divergences | Golden source |
| --- | --- | --- | --- |
| Primary formula oracle | `3942/3942` passing | `140` skips | Mac Excel 365 ja-JP (`mac-365-ja_JP`) |
| Conditional-formatting oracle | `23/23` passing | — | Mac Excel 365 ja-JP |
| Imported third-party engine corpus (cross-check) | `12510/12510` passing | `168` divergences | Third-party engine, not Excel |
| Workbook oracle (pivot + print) | Pivot `28/28`, print `35/41` | `6` skips | Historical, reference-only — see below |

**97 oracle categories** are defined and regenerated from Mac Excel 365 ja-JP. Of the `522` catalogued functions, `517` satisfy all six closure conditions (`behaviors_declared`, `cases_cover_behaviors`, `golden_present`, `divergence_documented`, `not_in_pilot`, `behavior_drift`). Four of the remaining five — `ARRAYTOTEXT`, `FILTERXML`, `GETPIVOTDATA`, `PHONETIC` — fail only `behaviors_declared`, meaning their behavior taxonomy is under-specified rather than unimplemented. The fifth, `JIS`, lost its case coverage when that suite was retired for a Mac Excel bug and has not been re-covered.

Every skip is an explicit divergence, host-service dependency, volatile or environment-bound case, or driver limitation — none is a silent stub. Each carries the Excel build it was last verified against in [`tests/divergence.yaml`](https://github.com/libraz/formulon/blob/main/tests/divergence.yaml); the bulk sit at `16.108.1`, with the most recently re-probed cases at `16.111.2`.

::: warning The workbook track is not Microsoft 365 verified
The pivot and print figures come from the **checked-in historical golden** — Office 2019 or unknown-version files retained as reference-only. The `win-365-ja_JP` target is still `wanted`, and generating the external golden requires a product-verified Windows Microsoft 365 host. Read those two numbers as "passes against the reference capture", not as Microsoft 365 verification.
:::

## Why oracle data matters

Spreadsheet behavior includes many undocumented details: rounding edges, how `TEXT()` formats locale-specific digits, how `DATEVALUE()` handles two-digit years, how blank values coerce, how spill collisions interact with merged cells. Committed goldens (`tests/oracle/*/golden`) turn those details into reviewable data and make compatibility regressions visible at PR time rather than after deployment.

## How a failure is interpreted

<DiagramFlow :steps="[
  { label: 'Oracle test fails', note: 'Formulon ≠ captured Excel value' },
  { label: 'Wrong value?', note: 'yes → Formulon bug: fix engine, add a golden' },
  { label: 'Excel build changed?', note: 'yes → profile drift: re-capture, document' },
  { label: 'NOW / RAND / network dependent?', note: 'yes → volatile golden: re-capture controlled, or mark volatile' },
  { label: 'Accepted divergence', note: 'record reason + last-verified build' }
]" />

A failure usually falls into one of four buckets:

| Bucket | What it means | Typical fix |
| --- | --- | --- |
| Formulon bug | Engine produced the wrong value | Fix the engine, add a regression golden |
| Profile drift | Targeted Excel build changed | Re-capture the golden, document the change |
| Volatile golden | Captured value depended on `NOW` / `RAND` / network | Re-capture with controlled inputs, or mark the golden as volatile |
| Accepted divergence | The case is documented as intentionally different | Record it in the divergence list with reason + last-verified build |

## Contributing data

Locale coverage grows when contributors run the oracle capture flow on their own Excel installations and donate the resulting goldens. The same workbook can be captured on `win-365-ja_JP`, `mac-365-ja_JP`, and other profiles, expanding what the engine can validate against. See [Oracle contribution](/development/oracle-contribution) for the capture flow.

v0.9.2 added workbook-oracle coverage for pivot tables and print pagination through the Windows Excel bridge, with `win-365-ja_JP` as the primary profile. Mac and Windows captures now share a comparator, which makes cross-platform differences easier to review instead of hiding them as unrelated test output.

## Read next

- [Compatibility model](/compatibility/model) — profiles, divergences, practical rules.
- [Locale profiles](/compatibility/locale-profiles) — which profiles exist today.
- [Oracle contribution](/development/oracle-contribution) — how to add data.
