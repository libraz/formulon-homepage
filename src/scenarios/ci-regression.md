# CI Workbook Regression

Use the CLI to make workbook changes visible in code review. A workbook that someone hand-edited in Excel is otherwise an opaque binary; running it through Formulon turns the diff into something a reviewer can read. This pays off when spreadsheet outputs are part of your product contract.

::: info Glossary: golden file
A checked-in expected-output file that a test compares against the current output. When they diverge, the test fails and the reviewer decides whether the divergence is intentional (update the golden) or a regression (fix the code or the workbook).
:::

## Pipeline shape

<DiagramLayers
  :layers="[
    { nodes: [{ label: 'Pull request', note: 'workbook or engine change' }] },
    { nodes: [
      { label: 'formulon dump --formulas', note: 'formula snapshot, no recalc' },
      { label: 'formulon dump --values', note: 'recalculates, then value snapshot' }
    ] },
    { nodes: [{ label: 'git diff --exit-code', note: 'against committed testdata/*.txt' }] },
    { nodes: [
      { label: 'Clean', note: 'job passes' },
      { label: 'Drift', note: 'reviewer classifies the diff', tone: 'alt' }
    ] }
  ]"
  label="Pipeline: a pull request triggers a formula snapshot and a recalculated-value snapshot, both are diffed against committed text files, and the job either passes or routes the drift to a reviewer"
  caption="Both snapshots are plain text, so a workbook change reaches review as a readable diff."
/>

Create the expected files and commit them before enabling the job. `git diff` ignores untracked files, so fail fast with `git ls-files --error-unmatch testdata/model.formulas.txt testdata/model.values.txt`.

## Snapshot formulas

```sh
formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --formulas model.xlsx > testdata/model.formulas.txt
git diff --exit-code testdata/model.formulas.txt
```

This catches formula edits without depending on cached calculated values. The dump does not recalculate, so it is cheap enough to run on every PR.

## Snapshot recalculated values

```sh
formulon dump --profile win-365-en_US --now 2026-10-09T09:30:00 --values model.xlsx > testdata/model.values.txt
git diff --exit-code testdata/model.values.txt
```

`dump --values` recalculates first, then prints every non-blank cell in stable sheet/cell order. Pair it with the formula snapshot when both authoring drift and value drift matter.

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
      - name: Install the pinned Formulon CLI
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release download v0.18.0 --repo libraz/formulon \
            --pattern 'formulon-0.18.0-linux-x64.tar.gz*' --dir "$RUNNER_TEMP"
          cd "$RUNNER_TEMP"
          sha256sum -c formulon-0.18.0-linux-x64.tar.gz.sha256
          tar -xzf formulon-0.18.0-linux-x64.tar.gz
          echo "$RUNNER_TEMP/formulon-0.18.0-linux-x64" >> "$GITHUB_PATH"
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

`dump --values` recalculates before printing, so no separate `recalc` step is needed. The `--profile` and `--now` flags are explicit because neither is stored in the workbook. With volatile inputs controlled and the profile, clock and CLI version fixed, a changed snapshot points to a workbook or engine change.

::: tip Pin the Formulon version in CI
Pin the release tag explicitly, as the example does. An engine upgrade can change formula or file-format behavior intentionally, so do not treat patch releases as output-compatible by default. Bump the tag in a separate pull request, so the snapshot diff it causes gets its own review.
:::

## Review policy

Require reviewers to classify diffs as:

- expected formula edits,
- expected input changes,
- Formulon compatibility differences,
- Excel behavior changes,
- bugs.

This keeps workbook regression tests from becoming opaque golden files. The reviewer's classification is captured in the PR body (or a commit trailer); future contributors looking at the same diff can see why it was accepted.

## Volatile and service-backed formulas

Value snapshots are a poor fit for uncontrolled `NOW`, `TODAY`, `RAND`, and `RANDBETWEEN`. Either control them in the fixture, document them, or leave those workbooks out of value snapshots. External-service functions such as `WEBSERVICE`, CUBE functions, and `STOCKHISTORY` do not perform network I/O in this engine; they return a fixed unavailable Excel error. See [formula coverage](/compatibility/formula-coverage) for the list. Snapshot those errors as intentional compatibility behavior or exclude the cells.

For volatile-heavy workbooks, snapshot the formulas only (`dump --formulas`) and verify representative cells through a script that asserts ranges or shapes rather than exact values. The fixed `--profile` and `--now` flags still make the command's locale and clock inputs explicit; the clock does not affect formula-only output.

## Compare package surfaces {#compare-package-surfaces}

From a Formulon source checkout, `make parity-test` is a fast check before pushing. It catches a kind of regression the job above cannot: two packages disagreeing on the same workbook.

::: info Glossary: parity runner
A test runner in the Formulon source repository that evaluates shared fixtures through every channel that has been built (the CLI, the npm WASM package, and the Python wheel). It reports *missing* channels (not built) separately from *mismatched* results (channels disagree on a value), and skips with exit code 77 when fewer than two channels are available. It does not cover Native Node.
:::

<DiagramLayers :layers="[
  { title: 'Input', nodes: [{ label: 'Shared workbook fixtures', note: 'one set, every channel' }] },
  { title: 'Verification track', nodes: [
    { label: 'Parity runner', note: 'WASM vs Python vs CLI' },
    { label: 'Oracle testing', note: 'engine vs captured Excel values', tone: 'alt' }
  ] },
  { title: 'Question answered', nodes: [
    { label: 'Do our surfaces agree?', note: 'fast pre-commit signal' },
    { label: 'Do we match Excel?', note: 'compatibility ground truth', tone: 'alt' }
  ] }
]" caption="Parity compares Formulon with itself; only oracle testing compares it with Excel." />

Use the parity runner when changing bindings or packaging. [Oracle testing](/compatibility/oracle-testing) is the separate flow that checks agreement with Excel.

## Read next

- [CLI workflows](/runtimes/cli) — the commands behind this scenario.
- [Compatibility model](/compatibility/model) — why pinning a profile matters.
- [Oracle testing](/compatibility/oracle-testing) — compatibility ground truth.
