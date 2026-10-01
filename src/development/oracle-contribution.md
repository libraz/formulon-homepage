# Oracle Contribution

Oracle data is the main way to expand verified compatibility. Generation operates a real Excel installation; verification reads committed goldens and is safe for CI.

::: info Glossary: oracle generation vs verification
*Generation* runs the oracle capture tooling against a real Excel installation and writes golden JSON. It only happens on contributor machines that have Excel. *Verification* reads those committed goldens and compares them against Formulon output — no Excel required, safe for CI.
:::

::: warning Microsoft 365 only
Oracle data must come from **Excel 365** (a Microsoft 365 subscription). Office 2019 and earlier are not supported: functions added after Office 2019 — `ARRAYTOTEXT`, `LAMBDA`, and the dynamic-array family (`SORT`, `FILTER`, `UNIQUE`, `XLOOKUP`, …) — silently return `#NAME?` on Office 2019 with no warning. That would record incorrect values in the golden. All three generators (`oracle-gen`, `oracle-gen-cf`, `oracle-gen-workbook`) run a startup sentinel that evaluates `=ARRAYTOTEXT(1)` and abort generation with a clear error if Excel does not recognize it.
:::

<DiagramLayers :layers="[
  { title: 'Contributor machine', nodes: ['Real Excel 365 (locale-specific build)'] },
  { title: 'Generate', nodes: ['make oracle-contribute / oracle-gen[-cf|-workbook]'] },
  { title: 'Capture', nodes: ['Golden JSON + Excel build / OS / locale metadata'] },
  { title: 'Review', nodes: ['Pull request'] },
  { title: 'CI', nodes: [{ label: 'make oracle-verify', note: 'no Excel required' }] },
  { title: 'Compare', nodes: ['Formulon engine vs captured golden'] },
  { title: 'Outcome', nodes: ['Compatibility holds', 'Investigate per oracle-testing flow'] }
]" />

## Contributor flow

1. Install Excel 365 for the locale being contributed.
2. Run `make oracle-contribute` from the repository root.
3. Review the generated goldens and metadata.
4. Open a pull request with the captured data.

Each contribution should include the OS, Excel build, locale, and profile identity. When a golden later disagrees with Formulon, this metadata identifies the Excel build to capture again.

## Targets

Target names have the shape `<host>-<excel-major>-<locale>`, for example `mac-365-ja_JP` or `win-365-ja_JP`. The manifest lives at `tools/oracle/targets.yaml`.

Current wanted locales include English, German, French, Chinese, Korean, and Thai Excel environments. Each target adds locale-specific observations to the compatibility tests.

::: tip Contribution scope
A useful contribution does not have to cover every function. A complete golden run for one function family in one locale (text, dates, or lookup) expands the compatibility coverage that can be checked.
:::

## Commands

```sh
make oracle-setup
make oracle-contribute
make oracle-contribute TARGET=mac-365-en_US
make oracle-gen TARGET=win-365-ja_JP SUITE=count
make oracle-gen-cf SUITE=<category>
make oracle-gen-workbook TARGET=<name> SUITE=<category>
make oracle-verify
```

`make oracle-verify` is what runs in CI; the others need Excel and run only on contributor machines. `oracle-gen` covers formula goldens; `oracle-gen-cf` covers the conditional-formatting track (macOS only); `oracle-gen-workbook` covers the pivot-table / print-area track, auto-detecting the target from the host OS unless `TARGET` is given.

### Promoting a workbook target

New workbook targets are captured outside the repository until their provenance and goldens are reviewed. Run the generator, inspect the staged capture, and run a dry run of the promotion before writing it into the tree:

```sh
make oracle-gen-workbook TARGET=<name> SUITE=<category>
make oracle-promote TRACK=workbook TARGET=<name> DRY_RUN=1
make oracle-promote TRACK=workbook TARGET=<name>
```

Use `oracle-promote` to land an approved capture. Copying JSON alone does not activate the tests.

## What gets reviewed

PRs adding oracle data are reviewed for:

- correct target naming and manifest entry,
- captured Excel build / OS / locale metadata,
- goldens live under the right path so the verifier discovers them,
- no accidental inclusion of personal data in screenshots or sample inputs.

## Read next

- [Compatibility model](/compatibility/model) — why this work matters.
- [Oracle testing](/compatibility/oracle-testing) — how the data is used in tests.
- [Locale profiles](/compatibility/locale-profiles) — the public profile catalog.
