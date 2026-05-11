# CLI Workflows

The CLI is the lowest-friction Formulon surface. It is useful when you need spreadsheet calculation in shell scripts, CI, or one-off reproductions — without writing a host-language integration.

::: info Glossary: standalone binary
A single executable file that links Formulon and a minimal command runner. No Node, Python, or shared libraries required at runtime. Download per `(os, arch)` from GitHub Releases.
:::

Common workflows:

- `eval`: evaluate a formula or expression under a named profile.
- `recalc`: recalculate a workbook and write updated bytes.
- `dump`: inspect workbook structure and calculated values.

Use the CLI in CI to catch accidental workbook changes and to reproduce issues without writing a host-language integration first.

## Examples

```sh
formulon --version
formulon eval '=SUM(1,2,3)'
formulon eval --json '=1/0'
formulon recalc input.xlsx -o output.xlsx
formulon dump --formulas input.xlsx
formulon dump --values output.xlsx
formulon dump --sheets input.xlsx
formulon dump --metadata input.xlsx
```

::: tip --values recalculates; --formulas does not
`dump --values` recalculates the workbook before printing values, so it sees up-to-date results. `dump --formulas` and `dump --metadata` skip recalculation to stay cheap and side-effect-free.
:::

## CI usage

Run `recalc` and `dump --values` to snapshot calculated outputs against checked-in goldens. The CLI is deterministic for the same workbook + profile, so a `git diff` over the dump file is a stable signal in CI.

```sh
formulon recalc model.xlsx -o /tmp/model.recalc.xlsx --quiet
formulon dump --values /tmp/model.recalc.xlsx > model.values.txt
git diff --exit-code model.values.txt
```

For formulas only:

```sh
formulon dump --formulas model.xlsx > model.formulas.txt
git diff --exit-code model.formulas.txt
```

This catches formula edits without depending on cached calculated values.

::: warning Volatiles are not deterministic
`NOW`, `TODAY`, `RAND`, `RANDBETWEEN`, and a few network functions return different values on each call. Avoid them in CI snapshot fixtures, or stub them at the workbook level.
:::

## Read next

- [CLI reference](/api/cli) — full command syntax.
- [CI regression scenarios](/runtimes/ci-regression) — patterns for CI gating.
- [CI workbook regression scenario](/scenarios/ci-regression) — example pipeline.
