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

`make oracle-contribute` needs Python 3.10 or newer. On first run it creates a virtual environment with `xlwings`. It then reads the installed Excel version and locale, maps them to a target in `tools/oracle/targets.yaml`, and generates the goldens; a full run takes 15 to 25 minutes. When the committed `ENVIRONMENT.md` for that target already records an Excel build at or above yours, it exits without generating anything.

- On macOS, grant the terminal Automation access to Microsoft Excel when prompted.
- From WSL2, export `FORMULON_WIN_PYTHON` as the path of the Windows-side `python.exe`, which needs `xlwings`, `pywin32`, and `pyyaml`.
- The first goldens for a new target are accepted once a second contributor regenerates them independently and gets the same output.

Each contribution should include the OS, Excel build, locale, and profile identity. When a golden later disagrees with Formulon, this metadata identifies the Excel build to capture again.

## Targets

Target names have the shape `<host>-<excel-major>-<locale>`, for example `mac-365-ja_JP` or `win-365-ja_JP`. The manifest lives at `tools/oracle/targets.yaml`.

The formula track has 14 Mac Excel gates: the primary `mac-365-ja_JP` plus 13 locale gates (`mac-365-{en_US,de_DE,fr_FR,zh_CN,ko_KR,th_TH,es_ES,es_MX,pt_BR,ru_RU,zh_TW,it_IT,nl_NL}`). The workbook track also has the measured `win-365-ja_JP` target. The remaining 13 Windows profiles (`win-365-{en_US,de_DE,fr_FR,zh_CN,ko_KR,th_TH,es_ES,es_MX,pt_BR,ru_RU,zh_TW,it_IT,nl_NL}`) are estimated from the Mac measurements plus the Windows host rules until real Windows captures replace them. Together these are 28 profile ids across 14 locales.

To capture a Mac locale, set `defaults write com.microsoft.Excel AppleLanguages -array <lang>` and `defaults write com.microsoft.Excel AppleLocale <locale>`, relaunch Excel, and run `make oracle-gen TARGET=<target>` (or `tools/oracle/oracle_gen.py --target <target> --incremental`). Afterwards run `defaults delete` on both keys to return to the system locale. Localized error names are resolved through `ERROR.TYPE`.

::: tip Contribution scope
A useful contribution does not have to cover every function. A complete golden run for one function family in one locale (text, dates, or lookup) expands the compatibility coverage that can be checked.
:::

## Commands

```sh
make oracle-setup
make oracle-contribute
make oracle-contribute TARGET=win-365-de_DE
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
