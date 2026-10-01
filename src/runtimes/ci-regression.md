# CI Regression Workflows

Formulon is useful in CI when spreadsheet outputs are part of your product contract. Formula or calculated-value changes become explicit diffs that PR reviewers can classify.

::: info Glossary: parity runner
A repo-internal test runner that evaluates shared fixtures across every available channel (WASM, Python, CLI) and reports both *missing* channels (binding not built) and *mismatched* results (channels disagree on a value). Run with `make parity-test`. Native Node is not wired into the parity runner yet — there is no channel to compare it against.
:::

## Snapshot formulas

Create `model.formulas.txt` and `model.values.txt` in the repository, then commit them before enabling this check. `git diff` does not compare untracked files. A CI job can fail fast with `git ls-files --error-unmatch model.formulas.txt model.values.txt`.

```sh
formulon dump --formulas model.xlsx > model.formulas.txt
git diff --exit-code model.formulas.txt
```

This catches formula edits without depending on cached calculated values. The dump is cheap — no recalculation — so it can run on every PR.

## Snapshot recalculated values

```sh
formulon dump --values model.xlsx > model.values.txt
git diff --exit-code model.values.txt
```

Use this for golden-output tests. `dump --values` recalculates first, then prints every non-blank cell in stable sheet/cell order. Pair it with the formula snapshot when both authoring drift and value drift matter.

## Compare package surfaces

The repository includes a parity runner:

```sh
make parity-test
```

It evaluates shared fixtures across the `cli`, `npm` (WASM), and `python` channels and reports missing channels separately from mismatched results. Use it when changing bindings or packaging.

::: tip Parity vs oracle
The parity runner checks that *our own* surfaces agree with each other. The [oracle testing](/compatibility/oracle-testing) flow checks that we agree with *Excel*. Both are useful: parity is a fast pre-commit signal, oracle is the compatibility ground truth.
:::

<DiagramLayers :layers="[
  { title: 'Input', nodes: ['Shared workbook fixtures'] },
  { title: 'Verification track', nodes: [
    { label: 'Parity runner', note: 'WASM vs Python vs CLI' },
    { label: 'Oracle testing', note: 'shared engine vs captured Excel values' }
  ] },
  { title: 'Answers', nodes: [
    { label: 'Do our own surfaces agree?' },
    { label: 'Do we match Excel ground truth?' }
  ] }
]" />

## When not to use CI snapshots

Avoid direct snapshots for formulas that include volatile functions such as `NOW`, `TODAY`, `RAND`, and `RANDBETWEEN` unless the fixture controls or documents the volatility. External-service functions such as `WEBSERVICE`, CUBE functions, and `STOCKHISTORY` do not perform network I/O in this engine; they return a fixed unavailable Excel error. See [formula coverage](/compatibility/formula-coverage) for the list. Snapshot those errors as intentional compatibility behavior or exclude the cells.

For volatile-heavy workbooks, snapshot the formulas only (`dump --formulas`) and verify representative cells through a script that asserts ranges or shapes rather than exact values.

## Read next

- [CI workbook regression scenario](/scenarios/ci-regression) — end-to-end pipeline example.
- [CLI workflows](/runtimes/cli) — the commands behind the snapshots.
- [Oracle testing](/compatibility/oracle-testing) — compatibility ground truth.
