# Oracle Testing

Oracle tests compare Formulon against values captured from real Excel builds. They are the empirical layer of the compatibility story — what *Excel actually does* on a given workbook and locale, not what the documentation says it should.

::: info Glossary: oracle data
A captured set of Excel-produced values for a known workbook, profile, and build. Tests load the workbook, recalculate with Formulon, and compare against the captured values. When they disagree, *Excel* is treated as the source of truth.
:::

::: info Glossary: accepted divergence
A case where Formulon deliberately differs from Excel. Each accepted divergence carries a reason (security, deterministic behavior, fixed Excel bug, …) and a last-verified Excel build. Accepted divergences are documented rather than hidden behind generic "Excel-like" claims.
:::

## Verification tracks

The oracle suite has separate tracks for formulas, conditional formatting, imported-engine comparisons, and workbook structures. The table records each track's scope and capture source; run the source checks below for the current pass and skip details.

| Track | Scope | Golden source |
| --- | --- | --- |
| Primary formula oracle | Formula cell values | Mac Excel 365 ja-JP (`mac-365-ja_JP`) |
| Conditional-formatting oracle | Conditional-format predicates and visual results | Mac Excel 365 ja-JP (`mac-365-ja_JP`) |
| Imported third-party engine corpus | Cross-check against a non-Excel engine | Third-party engine, not Excel |
| Workbook oracle | PivotTable structures and print layout | Windows Microsoft 365 ja-JP (`win-365-ja_JP`) |

The formula and conditional-formatting tracks regenerate from Mac Excel 365 ja-JP; the workbook track regenerates from Windows Excel 365 ja-JP. Workbook goldens carry a capture identifier that pins every suite to a single verified Microsoft 365 session. The workbook capture uses a WSL2-to-Windows COM bridge for PivotTable and print behavior. Pass and skip counts belong to a particular capture and are intentionally omitted here. From a [Formulon source checkout](https://github.com/libraz/formulon), build the test binaries and run the suites:

```sh
make build
make oracle-verify
make ironcalc-verify
```

The catalogue closure checks are separate metadata checks; they do not recalculate the engine or report suite pass counts:

```sh
tools/oracle/.venv/bin/python tools/oracle/closure_check.py --report --json
tools/oracle/.venv/bin/python tools/oracle/workbook_closure_check.py
```

Of the `523` catalogued functions, `519` satisfy all six closure conditions (`behaviors_declared`, `cases_cover_behaviors`, `golden_present`, `divergence_documented`, `not_in_pilot`, `behavior_drift`). The remaining four — `ARRAYTOTEXT`, `FILTERXML`, `GETPIVOTDATA`, `PHONETIC` — fail only `behaviors_declared`; their behavior taxonomy is under-specified rather than unimplemented. `JIS` closes as a declared alias of `DBCS`: Excel rewrites that ja-JP formula-bar spelling before it stores or evaluates a formula, so no oracle case can name it, and the closure harness resolves the alias to the function it defers to.

Every skip is classified as an explicit divergence, host-service dependency, volatile or environment-bound case, or driver limitation — none is a silent stub. Skips registered in the divergence registry carry their reason and last-verified Excel build in [`tests/divergence.yaml`](https://github.com/libraz/formulon/blob/main/tests/divergence.yaml); driver or runner skips are checked separately against the goldens, feature metadata, and execution results.

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

The formula and conditional-formatting tracks use `mac-365-ja_JP` as their primary profile. The workbook track uses the product-verified Windows Microsoft 365 `win-365-ja_JP` profile.

## Read next

- [Compatibility model](/compatibility/model) — profiles, divergences, practical rules.
- [Locale profiles](/compatibility/locale-profiles) — which profiles exist today.
- [Oracle contribution](/development/oracle-contribution) — how to add data.
