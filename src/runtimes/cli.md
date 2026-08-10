# CLI Workflows

The CLI is the lowest-friction Formulon surface. It is useful when you need spreadsheet calculation in shell scripts, CI, or one-off reproductions — without writing a host-language integration.

::: info Glossary: standalone binary
A single executable file that links Formulon and a minimal command runner. No Node, Python, or shared libraries required at runtime. Download per `(os, arch)` from GitHub Releases.
:::

Common workflows:

- `eval`: evaluate a formula or expression on a fresh, empty workbook (supports `--json` and `--repeat N`).
- `recalc`: recalculate a workbook and write updated bytes.
- `dump`: inspect workbook structure and calculated values.
- `paginate`: resolve one worksheet's print area and page breaks.

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
formulon paginate --sheet 0 input.xlsx
```

::: tip --values recalculates; --formulas does not
`dump --values` recalculates the workbook before printing values, so it sees up-to-date results. `dump --formulas` and `dump --metadata` skip recalculation to stay cheap and side-effect-free.
:::

## Output format follows the -o extension

`recalc` picks the saved container format from `-o`'s extension, not from the input file: `.xlsb` writes MS-XLSB, anything else writes OOXML `.xlsx`.

```sh
formulon recalc model.xlsx -o model.xlsb
```

XLSB models styles, row/column layout, merges, date1904, sheet view/zoom/frozen panes, dynamic-array metadata, and supported tokenized formulas. Worksheet tails for conditional formatting, data validation, hyperlinks, auto-filter, print setup/breaks, and drawing/table references and relationships are preserved verbatim; preservation does not make them editable or evaluated. See [XLSB coverage](/compatibility/file-format-support).

`recalc` writes atomically: a failed load, recalc, or save leaves the existing target unchanged.

## Iterative calculation

Workbooks with intentional circular references need iterative calculation enabled, or `recalc` converges to whatever the engine's non-iterative circular-reference handling produces:

```sh
formulon recalc circular.xlsx -o circular.xlsx --iterative
```

`--iterative` turns on Excel's default knobs: a maximum of 100 iterations and a 0.001 change threshold per iteration. There is no flag to override those two numbers from the CLI.

## Pagination

```sh
formulon paginate [--sheet INDEX] <in.xlsx>
```

`INDEX` defaults to `0` and is zero-based. The output reports `sheet`, `pages`, inclusive zero-based `print_area`, `horizontal_breaks`, and `vertical_breaks`. Exit `0` means success, `64` means usage error, and `1` means an engine or I/O failure.

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
