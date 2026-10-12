# CI Workbook Regression

Use the CLI to make workbook changes visible in code review. A workbook that someone hand-edited in Excel is otherwise an opaque binary; running it through Formulon turns the diff into something a reviewer can read.

::: warning Volatile formulas
Direct value snapshots are a poor fit for uncontrolled `NOW`, `TODAY`, `RAND`, and `RANDBETWEEN` formulas. Either isolate them, document them, or avoid value snapshots for those workbooks.
:::

::: info Glossary: golden file
A checked-in expected-output file that a test compares against the current output. When they diverge, the test fails and the reviewer decides whether the divergence is intentional (update the golden) or a regression (fix the code or the workbook).
:::

## Pipeline shape

<DiagramLayers
  :layers="[
    { nodes: ['Pull request'] },
    { nodes: ['CI job'] },
    { nodes: [
      { label: 'formulon dump --formulas', note: 'formula snapshot' },
      { label: 'formulon recalc → formulon dump --values', note: 'value snapshot' }
    ] },
    { nodes: ['testdata/*.txt'] },
    { nodes: ['git diff --exit-code'] },
    { nodes: [
      { label: 'Clean → pass', note: '' },
      { label: 'Drift → review classifies', note: 'expected / compat / bug' }
    ] }
  ]"
  label="Pipeline: a pull request triggers a CI job that runs both a formula snapshot and a recalculated-value snapshot, writes them to testdata, diffs them with git, and either passes cleanly or routes drift to reviewer classification"
/>

The base snapshot commands (`formulon dump --formulas`, `formulon dump --values`) are the same ones covered in [CI regression workflows](/runtimes/ci-regression) — see that page for the exact invocations and for when to skip snapshotting volatile formulas. This page focuses on wiring them into a PR pipeline and on the review policy for classifying drift.

Create and commit the expected files before enabling this job. `git diff` ignores untracked files, so add a fail-fast check such as `git ls-files --error-unmatch testdata/model.formulas.txt testdata/model.values.txt`.

From a Formulon source checkout, `make parity-test` is a fast complementary check before pushing: it evaluates shared fixtures across the available channels (`cli`, `npm` WASM, `python`) and reports channel disagreement, which is a form of regression the CI job above does not catch on its own. See [CI regression workflows](/runtimes/ci-regression#compare-package-surfaces) for details.

## GitHub Actions example

```yaml
name: workbook regression
on: [pull_request]
jobs:
  workbook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Check committed snapshots
        run: git ls-files --error-unmatch testdata/model.formulas.txt testdata/model.values.txt
      - name: Build the current Formulon CLI from source
        run: |
          git clone https://github.com/libraz/formulon.git formulon-src
          git -C formulon-src checkout v0.15.1
          sudo apt-get update
          sudo apt-get install -y --no-install-recommends build-essential cmake ninja-build
          cmake -S formulon-src -B formulon-src/build-ci -G Ninja \
            -DCMAKE_BUILD_TYPE=Release -DFM_BUILD_TESTING=OFF
          cmake --build formulon-src/build-ci --parallel --target formulon_cli
          install -Dm755 formulon-src/build-ci/bin/formulon_cli "$RUNNER_TEMP/formulon-bin/formulon"
          echo "$RUNNER_TEMP/formulon-bin" >> "$GITHUB_PATH"
      - name: Snapshot formulas
        run: |
          formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --formulas model.xlsx > testdata/model.formulas.txt
      - name: Snapshot values
        run: |
          formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --values model.xlsx > testdata/model.values.txt
      - name: Fail on diff
        run: |
          git diff --exit-code testdata/
```

With volatile inputs controlled and the profile, clock, and Formulon source revision fixed, a changed snapshot points to a workbook or engine change. An upgrade can intentionally change output, so review the pinned revision as part of the diff. The CLI flags are explicit because the profile and clock are not stored in the workbook. This example builds the pinned source tag; the matching GitHub Releases CLI archive also supports `--profile` and `--now`.

## Review policy

Require reviewers to classify diffs as:

- expected formula edits,
- expected input changes,
- Formulon compatibility differences,
- Excel behavior changes,
- bugs.

This keeps workbook regression tests from becoming opaque golden files. The reviewer's classification is captured in the PR body (or a commit trailer); future contributors looking at the same diff can see why it was accepted.

::: tip Pin the Formulon source revision in CI
Pin the Formulon source revision (or, after publication, a CLI binary URL for the matching release) explicitly. An engine upgrade can change formula or file-format behavior intentionally, so do not treat patch releases as output-compatible by default.
:::

## Read next

- [CLI workflows](/runtimes/cli) — the commands behind this scenario.
- [CI regression runtime page](/runtimes/ci-regression) — broader patterns.
- [Compatibility model](/compatibility/model) — why pinning a profile matters.
