# Compatibility Model

Formulon treats compatibility as a *measured property*. It does not claim generic Excel behavior; it targets named profiles backed by generated oracle data. That gives the project two concrete things to do — capture oracle data per profile, and surface accepted divergences explicitly.

::: info Glossary: measured compatibility
A compatibility claim that points at a profile and a body of oracle data that proves it. "Compatible with `win-365-ja_JP`" means *we ran this on Excel and captured the values*. "Excel-compatible" without a profile is intentionally not used.
:::

Capturing a profile is a one-way pipeline from a real Excel build to a reusable dataset:

<DiagramFlow :steps="[
  { label: 'Excel build', note: 'e.g. Win 365 ja-JP' },
  { label: 'Oracle dataset', note: 'captured' },
  { label: 'Compatibility profile', note: 'win-365-ja_JP — verified' }
]" />

Oracle tests recalculate fixture workbooks and compare their results with captured Excel values. Applications run the same engine, but do not compare against oracle data automatically:

<DiagramLayers :layers="[
  { title: 'Test inputs', nodes: ['Fixture workbook', 'Compatibility profile'] },
  { nodes: ['Formulon engine'] },
  { nodes: ['Calculated values'] },
  { title: 'Oracle test comparison', nodes: [
    { label: 'No divergence', note: 'profile claim holds' },
    { label: 'Tracked divergence', note: 'reason + last-verified build' },
    { label: 'Untracked divergence', note: 'bug — fix or document' }
  ] }
]" />

## Profiles

Formulon has 28 profiles, `{mac,win}-365-{ja_JP,en_US,de_DE,fr_FR,zh_CN,ko_KR,th_TH,es_ES,es_MX,pt_BR,ru_RU,zh_TW,it_IT,nl_NL}`, and the default is `win-365-en_US`. All 14 Mac profiles are measured against Mac Excel 365 formula oracles that gate CI: `mac-365-ja_JP` is primary and the other 13 locales each retain their own goldens. `win-365-ja_JP` is measured on Windows and is the workbook oracle profile; the other 13 Windows profiles are estimated from their Mac captures plus the measured Mac/Windows host differences.

See [Locale profiles](/compatibility/locale-profiles) for the public list and pinning behavior.

## Divergences

Reproducible differences in rounding, coercion, formula entry, and other results are engine work: capture Excel's answer and fix the implementation. Platform floating-point differences do not receive a blanket tolerance.

The divergence registry records deliberate differences, Excel cases without a reproducible value, capture-tool limitations, and unresolved engine gaps. Read each entry's `cause`, profile scope, reason, and last-verified Excel build. `mode: skip-oracle` means the comparison does not run; it does not establish agreement. A comparison with a tolerance establishes agreement only within that tolerance.

For example, a cycle through several cells with iteration disabled returns `#REF!` because its Excel result depends on entry order that the saved file does not record. A cell whose only cycle member is itself holds 0 as in Excel. Array memory limits and external services impose other boundaries. See [How far compatibility goes](/compatibility/edge-cases) for examples and [Oracle testing](/compatibility/oracle-testing) for classifications and release criteria.

## Practical rule

| Doing | Should |
| --- | --- |
| Applications using Formulon | Persist the profile used for calculation |
| Tests | State the profile they expect and pin to a Formulon version |
| Documentation | Avoid unqualified claims like "Excel-compatible" when a feature is only verified for one profile |
| Issue reports | Include the profile, the Formulon version, the Excel build of the oracle, and a minimal reproducing workbook |

## Read next

- [Locale profiles](/compatibility/locale-profiles) — the profile catalog.
- [Text collation](/compatibility/text-collation) — comparison, sorting, and lookup strength by profile.
- [Workbook language](/workbook/language) — formula text and function-name localization.
- [Cell language switching](/cell/language-switching) — changing an editor language at runtime.
- [Oracle testing](/compatibility/oracle-testing) — how a profile is verified.
- [Non-goals](/compatibility/non-goals) — what compatibility deliberately does not cover.
