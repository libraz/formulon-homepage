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

The base snapshot commands (`formulon dump --formulas`, `formulon recalc && formulon dump --values`) are the same ones covered in [CI regression workflows](/runtimes/ci-regression) — see that page for the exact invocations and for when to skip snapshotting volatile formulas. This page focuses on wiring them into a PR pipeline and on the review policy for classifying drift.

Before pushing, `make parity-test` is a fast complementary local check: it evaluates shared fixtures across the available channels (`cli`, `npm` WASM, `python`) and reports channel disagreement, which is a form of regression the CI job above does not catch on its own. See [CI regression workflows](/runtimes/ci-regression#compare-package-surfaces) for details.

## GitHub Actions example

```yaml
name: workbook regression
on: [pull_request]
jobs:
  workbook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Install formulon CLI
        run: |
          curl -L -o formulon.tar.gz "https://github.com/libraz/formulon/releases/download/v0.10.0/formulon-0.10.0-linux-x64.tar.gz"
          tar -xzf formulon.tar.gz --strip-components=1
          chmod +x formulon
          sudo mv formulon /usr/local/bin/
      - name: Snapshot formulas
        run: |
          formulon dump --formulas model.xlsx > testdata/model.formulas.txt
      - name: Snapshot values
        run: |
          formulon recalc model.xlsx -o /tmp/model.xlsx --quiet
          formulon dump --values /tmp/model.xlsx > testdata/model.values.txt
      - name: Fail on diff
        run: |
          git diff --exit-code testdata/
```

The job is deterministic for the same workbook + profile + Formulon version, so the only way the step fails is if the workbook or the engine changed — both worth a review.

## Review policy

Require reviewers to classify diffs as:

- expected formula edits,
- expected input changes,
- Formulon compatibility differences,
- Excel behavior changes,
- bugs.

This keeps workbook regression tests from becoming opaque golden files. The reviewer's classification is captured in the PR body (or a commit trailer); future contributors looking at the same diff can see why it was accepted.

::: tip Pin Formulon version in CI
The dump output format and value semantics are stable across patch releases but pin the Formulon version (or the CLI binary URL) explicitly so an unrelated release upgrade does not show up as a workbook regression.
:::

## Read next

- [CLI workflows](/runtimes/cli) — the commands behind this scenario.
- [CI regression runtime page](/runtimes/ci-regression) — broader patterns.
- [Compatibility model](/compatibility/model) — why pinning a profile matters.
