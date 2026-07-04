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

Every recalculation then checks itself against that same oracle data:

<DiagramLayers :layers="[
  { title: 'Inputs', nodes: ['Workbook', 'Compatibility profile'] },
  { nodes: ['Formulon engine'] },
  { nodes: ['Calculated values'] },
  { title: 'Compare vs oracle data', nodes: [
    { label: 'No divergence', note: 'profile claim holds' },
    { label: 'Tracked divergence', note: 'reason + last-verified build' },
    { label: 'Untracked divergence', note: 'bug — fix or document' }
  ] }
]" />

## Profiles

The main profile today is `win-365-ja_JP`. The repository also tracks Mac Excel 365 ja-JP data where that data is available. English-locale profiles remain hidden until they have their own locale-specific oracle coverage.

See [Locale profiles](/compatibility/locale-profiles) for the public list and pinning behavior.

## Divergences

Some differences are inevitable:

- floating-point drift between platforms,
- volatile snapshot mismatches,
- undocumented Excel behavior whose contract is not stable across builds,
- deliberate fixes for cases where reproducing Excel would make the engine less predictable (silent overflow, silent type coercion in specific corner cases).

Each accepted divergence carries a reason and a *last-verified Excel build* so future maintainers know whether the divergence is still intentional or whether Excel has since fixed the underlying behavior.

## Practical rule

| Doing | Should |
| --- | --- |
| Applications using Formulon | Persist the profile used for calculation |
| Tests | State the profile they expect and pin to a Formulon version |
| Documentation | Avoid unqualified claims like "Excel-compatible" when a feature is only verified for one profile |
| Issue reports | Include the profile, the Formulon version, the Excel build of the oracle, and a minimal reproducing workbook |

## Read next

- [Locale profiles](/compatibility/locale-profiles) — the profile catalog.
- [Oracle testing](/compatibility/oracle-testing) — how a profile is verified.
- [Non-goals](/compatibility/non-goals) — what compatibility deliberately does not cover.
