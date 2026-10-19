# Oracle Contribution

Oracle generation captures results from a real Excel installation. Verification reads committed goldens and needs no Excel, so it runs in CI.

::: info Generation and verification
Generation drives Excel and writes golden data plus capture metadata. Verification recalculates the committed cases with Formulon and compares the results with those goldens. Only generation requires a contributor machine with Excel.
:::

::: warning Microsoft 365 required
Oracle captures must come from Microsoft 365 Excel. Each of the four capture generators—`oracle-gen`, `oracle-gen-cf`, `oracle-gen-chart`, and `oracle-gen-workbook`—runs a startup sentinel using `=ARRAYTOTEXT(1)` and stops if Excel does not recognize it. Office 2019 and earlier cannot capture the newer functions reliably.
:::

## Contributor flow

1. Run `make oracle-setup` to prepare the oracle environment.
2. Run `make oracle-contribute`, or name a target with `TARGET=<target>`.
3. Review the generated goldens and capture metadata.
4. Submit the changes for review.

`make oracle-contribute` detects the installed Excel build and locale, then selects a matching target. If the committed capture already covers that Excel build, it reports that no refresh is needed. Target names use the form `<host>-365-<locale>`, such as `mac-365-ja_JP` or `win-365-ja_JP`.

On macOS, allow the terminal to automate Microsoft Excel when prompted. If capturing a different Mac locale, first record the existing values of Excel’s `AppleLanguages` and `AppleLocale` preferences. Set the target locale, quit and relaunch Excel, then capture. Restore the values you recorded afterward; delete a preference key only if it was absent before the change.

From WSL2, `make oracle-setup` prints the Windows-side setup steps. Set `FORMULON_WIN_PYTHON` to the Windows `python.exe` path; that interpreter needs `xlwings`, `pywin32`, and `pyyaml`. Use the repository’s `tools/oracle/.venv/bin/python` for direct Python checks on the WSL side.

## Targets and tracks

The formula manifest currently declares 14 Mac Excel 365 gates: the ja-JP primary plus en-US, de-DE, fr-FR, zh-CN, ko-KR, th-TH, es-ES, es-MX, pt-BR, ru-RU, zh-TW, it-IT, and nl-NL. The workbook track’s primary is Windows Excel 365 ja-JP. The other Windows locale profiles are estimates based on Mac captures and Windows host rules until real Windows captures replace them.

The chart and conditional-formatting tracks use Mac Excel 365 ja-JP. Chart cases live under `tests/oracle/cases_chart/` and their goldens under `tests/oracle/targets/mac-365-ja_JP/golden_chart/`. The chart capture reads both Excel-saved workbooks and, for applicable cases, Formulon-generated files reopened and saved by Excel. Its reader is the `chart_model_dump` binary.

A target’s directory does not make its goldens an active test. The target manifest and provenance marker decide whether CTest uses a capture. Other target combinations are research data until the manifest marks them active.

## Capture commands

Run these from the Formulon source root:

```sh
make oracle-setup
make oracle-contribute
make oracle-contribute TARGET=win-365-de_DE
make oracle-gen TARGET=mac-365-ja_JP SUITE=datetime
make oracle-gen-cf SUITE=<suite>
make build
make oracle-gen-chart SUITE=<suite>
make oracle-gen-workbook TARGET=win-365-ja_JP
make oracle-verify
```

`oracle-gen-chart` builds `chart_model_dump` before capture, so run `make build` first to configure the build directory. The chart generator only runs on macOS with Microsoft 365 Excel.

The formula, conditional-formatting, and chart generators accept a suite selector for a focused recapture. Omit it when generating a complete capture. In particular, a new workbook target must capture every required workbook suite before promotion.

### Promoting a workbook target

A new Windows workbook target is staged outside the repository until its evidence and goldens are reviewed. Generate the full capture without a suite selector, inspect it, then dry-run promotion before writing it into the tree:

```sh
make oracle-gen-workbook TARGET=<name>
make oracle-promote TRACK=workbook TARGET=<name> DRY_RUN=1
make oracle-promote TRACK=workbook TARGET=<name>
```

A successful promotion records the target provenance. Workbook CTest selects only `tracks.workbook.primary` in `tools/oracle/targets.yaml`, currently `win-365-ja_JP`. Promoting another Windows locale does not register its workbook tests; those captures remain research data until the test configuration selects them. Copying JSON files alone does not activate workbook tests.

## Reviewing a contribution

Check that the manifest target and locale match the Excel installation, that the capture records its build and operating system, and that the golden files landed under the correct track directory. Keep the generated provenance file with the capture. Review the case definitions and the diff for accidental personal data before submitting.

## Read next

- [Compatibility model](/compatibility/model) — the purpose of profile-specific measurements.
- [Oracle testing](/compatibility/oracle-testing) — how verification and divergence records work.
- [Locale profiles](/compatibility/locale-profiles) — which profiles are available.
