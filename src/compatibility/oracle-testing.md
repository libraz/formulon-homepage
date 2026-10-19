# Oracle Testing

Oracle tests compare Formulon with results captured from Microsoft 365 Excel for a named case, profile, and Excel build. They record observed behavior for those inputs; they do not claim complete Excel coverage.

::: info Oracle golden
An Oracle golden is a committed result captured from Excel for a known workbook or case, locale profile, and Excel build. Verification recalculates the case with Formulon and compares it with that captured result.
:::

::: info Accepted divergence
An accepted divergence is an intentional difference from Excel. Its registry entry records why the difference is kept, which result is preferred, and the last Excel build used to review it.
:::

## Oracle tracks {#verification-tracks}

| Track | What it checks | Capture source |
| --- | --- | --- |
| Formula primary | Formula results under the primary ja-JP profile | Mac Excel 365, `mac-365-ja_JP` |
| Formula locale gates | Formula results under the other locale profiles; the manifest currently declares 13 additional Mac gates | Mac Excel 365, one target per locale |
| Conditional formatting | Rule evaluation and rendered-format behavior | Mac Excel 365, ja-JP |
| Charts | Chart creation and edits, cached values, and reference behavior | Mac Excel 365, ja-JP |
| Workbook | PivotTable structures and print layout | Windows Excel 365, ja-JP |

The formula track has 14 Mac Excel 365 targets: the ja-JP primary and 13 locale gates. The workbook track uses Windows Excel 365 ja-JP because PivotTable creation depends on Windows COM automation. The chart and conditional-formatting tracks use the Mac ja-JP target. Capture metadata records the Excel build and locale for each target; workbook captures also carry a capture identifier for their cross-suite evidence.

A target directory alone does not make a track a gate. The target manifest and its provenance record determine which captures participate in CTest. Other host and locale combinations remain research data until the manifest marks them active. The remaining Windows locale profiles are estimates based on Mac measurements and Windows host rules.

The IronCalc corpus is a separate cross-check. It starts from xlsx fixtures maintained by the IronCalc project and imports their cached formula results. The importer records the workbook’s saving application and version, and excludes fixtures whose metadata does not identify an Excel product. These cached results come from varied Excel products and environments, so they are not a controlled capture for one named Excel 365 target. Run `make ironcalc-verify` to check this corpus.

## Run the captured tests

From a Formulon source checkout, build the test binaries and run the oracle-labeled CTests:

```sh
make build
make oracle-verify
```

The command uses the current CMake build configuration. Excel is not started during verification; the tests read committed goldens.

## How to resolve an Excel mismatch

Start with the failing case ID and the exact target golden. Check the target’s Excel build and locale metadata, then compare the case inputs, Formulon result, and captured Excel result. If the Excel build or target changed, capture that same target again and review the generated metadata and golden before updating them.

Numeric comparisons are exact by default: the absolute and relative tolerances are both zero. Some suites declare a nonzero tolerance, and a case may override it. A named `compare_mode` may select a structured comparison. Inspect the case and suite metadata before interpreting a small numeric difference. A tolerance changes the comparison rule; it does not change which result is authoritative.

Classify a skip by its cause. These labels describe different work and cannot be interchanged to make a failure disappear.

| Cause | Meaning and next action |
| --- | --- |
| `excel-no-value` | Excel rejects the formula or cannot produce a reproducible comparable result. This is the only skip cause outside the release-rate denominator. |
| `harness-cannot-capture` | Excel has a result, but the capture bridge cannot record it. Fix the harness and keep the case visible. |
| `engine-gap` | Excel has a result that Formulon does not yet match or implement. Fix the engine. |
| `accepted-divergence` | Formulon deliberately differs. Record the reason, preferred result, and last verified Excel build. |
| `non-identifiable` | The quantity has no unique value to match. Record the mathematical reason. |
| `unclassified` | The available evidence does not establish the cause. Keep it unresolved until the source is reviewed. |

For skip entries in `tests/divergence.yaml`, run the strict provenance check:

```sh
tools/oracle/.venv/bin/python tools/oracle/divergence_check.py --strict
```

This check verifies that entries resolve to live cases and that their evidence is current. It does not compare Formulon’s numeric results with Excel. The release policy requires zero failing cases and a pass rate of at least 99.5%. Its denominator starts with primary-oracle cases for which Excel produced a value; only `excel-no-value` may leave it. A rate is not a measure of total coverage: it does not include unimplemented functions or untested behavior.

## Metadata closure is separate from value parity

The function closure report checks metadata: declared behaviors, cases that cover them, corresponding goldens, divergence documentation, the function’s implementation and oracle-source status, and behavior-catalog drift. It does not execute formulas or measure numeric parity. Its denominator is the intersection of the function catalog and the functions the source scan finds implemented.

`--report` and `--status` are for inspection and exit successfully even when functions remain open. Print the current report with:

```sh
tools/oracle/.venv/bin/python tools/oracle/closure_check.py --report --json
```

To make an open function or family fail the command, check it directly:

```sh
tools/oracle/.venv/bin/python tools/oracle/closure_check.py SUM
tools/oracle/.venv/bin/python tools/oracle/closure_check.py family=math_trig
```

The workbook closure check is also pending-aware by default. It reports missing external captures without failing solely because a golden is absent:

```sh
tools/oracle/.venv/bin/python tools/oracle/workbook_closure_check.py
```

The `--require-active` option requires a manifest-approved, verified workbook capture. CMake registers that strict check under `oracle-release` only when configured with `-DFORMULON_ORACLE_RELEASE_GATES=ON`; the label does not add it to an ordinary build or `make oracle-verify` run. Configure the release check and select its label explicitly:

```sh
cmake -S . -B build -DFORMULON_ORACLE_RELEASE_GATES=ON
ctest --test-dir build -L oracle-release --output-on-failure
```

## Read next

- [Compatibility model](/compatibility/model) — profiles and documented differences.
- [Locale profiles](/compatibility/locale-profiles) — available Excel profiles.
- [Text collation](/compatibility/text-collation) — measured text ordering by profile.
- [Oracle contribution](/development/oracle-contribution) — how to capture and submit data.
